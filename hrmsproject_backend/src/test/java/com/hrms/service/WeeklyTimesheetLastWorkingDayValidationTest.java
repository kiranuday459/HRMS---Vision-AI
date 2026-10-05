package com.hrms.service;

import com.hrms.dto.TimesheetDTO;
import com.hrms.model.Employee;
import com.hrms.model.Holiday;
import com.hrms.model.Role;
import com.hrms.repository.CompanyDetailRepository;
import com.hrms.repository.EmployeeReportingRepository;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.HolidayRepository;
import com.hrms.repository.LeaveRepository;
import com.hrms.repository.TimesheetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class WeeklyTimesheetLastWorkingDayValidationTest {

    @Mock
    private TimesheetRepository timesheetRepository;

    @Mock
    private EmployeeRepository employeeRepository;

    @Mock
    private CompanyDetailRepository companyDetailRepository;

    @Mock
    private EmployeeReportingRepository employeeReportingRepository;

    @Mock
    private LeaveRepository leaveRepository;

    @Mock
    private HolidayRepository holidayRepository;

    @InjectMocks
    private TimesheetService timesheetService;

    private static final Long EMPLOYEE_ID = 101L;

    @BeforeEach
    void setUp() {
        Employee employee = new Employee();
        employee.setId(EMPLOYEE_ID);

        lenient().when(employeeRepository.findById(EMPLOYEE_ID))
                .thenReturn(Optional.of(employee));
        lenient().when(leaveRepository.findByEmployeeIdAndStatus(EMPLOYEE_ID, null))
                .thenReturn(Collections.emptyList());
        lenient().when(employeeReportingRepository.findFirstByEmployeeOrderByIdDesc(any()))
                .thenReturn(Optional.empty());
        lenient().when(holidayRepository.findAll())
                .thenReturn(Collections.emptyList());
    }

    @Test
    void getLastWorkingDayOfWeek_standardWeek_returnsFriday() {
        LocalDate saturday = LocalDate.of(2026, 9, 26);
        LocalDate lastWorkingDay = timesheetService.getLastWorkingDayOfWeek(saturday, Collections.emptySet());
        assertEquals(LocalDate.of(2026, 10, 2), lastWorkingDay); // Friday
        assertEquals(DayOfWeek.FRIDAY, lastWorkingDay.getDayOfWeek());
    }

    @Test
    void getLastWorkingDayOfWeek_whenFridayIsHoliday_returnsThursday() {
        LocalDate saturday = LocalDate.of(2026, 9, 26);
        LocalDate fridayHoliday = LocalDate.of(2026, 10, 2);
        LocalDate lastWorkingDay = timesheetService.getLastWorkingDayOfWeek(saturday, Set.of(fridayHoliday));
        assertEquals(LocalDate.of(2026, 10, 1), lastWorkingDay); // Thursday
        assertEquals(DayOfWeek.THURSDAY, lastWorkingDay.getDayOfWeek());
    }

    @Test
    void getLastWorkingDayOfWeek_whenThursdayAndFridayAreHolidays_returnsWednesday() {
        LocalDate saturday = LocalDate.of(2026, 9, 26);
        LocalDate fridayHoliday = LocalDate.of(2026, 10, 2);
        LocalDate thursdayHoliday = LocalDate.of(2026, 10, 1);
        LocalDate lastWorkingDay = timesheetService.getLastWorkingDayOfWeek(saturday, Set.of(fridayHoliday, thursdayHoliday));
        assertEquals(LocalDate.of(2026, 9, 30), lastWorkingDay); // Wednesday
        assertEquals(DayOfWeek.WEDNESDAY, lastWorkingDay.getDayOfWeek());
    }

    @Test
    void saveWeeklyTimesheet_shouldReject_whenMidWeek() {
        LocalDate today = LocalDate.now();
        // Set last working day (Friday) strictly after today
        LocalDate futureFriday = today.plusDays(3);
        LocalDate weekStart = futureFriday.minusDays(6);

        TimesheetDTO dto = new TimesheetDTO();
        dto.setDate(today.isAfter(weekStart) ? today : weekStart);
        dto.setCategory("PROJECT");
        dto.setTotalHours(8.0);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                timesheetService.saveWeeklyTimesheet(EMPLOYEE_ID, weekStart, Collections.singletonList(dto), Role.EMPLOYEE)
        );

        assertTrue(ex.getMessage().contains("Weekly timesheet cannot be submitted before the last working day of the week"));
    }

    @Test
    void saveWeeklyTimesheet_shouldAccept_whenLastWorkingDay() {
        // Construct a week where today IS the last working day (Friday)
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(6); // If Friday is today, weekStart is Saturday

        TimesheetDTO dto = new TimesheetDTO();
        dto.setDate(today);
        dto.setCategory("PROJECT");
        dto.setTotalHours(8.0);

        assertDoesNotThrow(() ->
                timesheetService.saveWeeklyTimesheet(EMPLOYEE_ID, weekStart, Collections.singletonList(dto), Role.EMPLOYEE)
        );
    }

    @Test
    void saveWeeklyTimesheet_shouldAccept_whenFridayIsHoliday_andSubmittedOnThursday() {
        LocalDate today = LocalDate.now();
        // Set up week where tomorrow (today + 1) is Friday and it is a holiday, so today (Thursday) is the last working day
        LocalDate fridayHoliday = today.plusDays(1);
        LocalDate weekStart = today.minusDays(5); // Saturday

        Holiday holiday = new Holiday();
        holiday.setHolidayDate(fridayHoliday.toString());
        holiday.setHolidayName("Public Holiday");
        lenient().when(holidayRepository.findAll()).thenReturn(List.of(holiday));

        TimesheetDTO dto = new TimesheetDTO();
        dto.setDate(today);
        dto.setCategory("PROJECT");
        dto.setTotalHours(8.0);

        // Since today is Thursday and Friday is a holiday, last working day is today (Thursday)
        assertDoesNotThrow(() ->
                timesheetService.saveWeeklyTimesheet(EMPLOYEE_ID, weekStart, Collections.singletonList(dto), Role.EMPLOYEE)
        );
    }

    @Test
    void saveWeeklyTimesheet_shouldAccept_whenPastWeek() {
        LocalDate today = LocalDate.now();
        LocalDate pastWeekStart = today.minusWeeks(2).with(TemporalAdjusters.previousOrSame(DayOfWeek.SATURDAY));
        LocalDate pastDate = pastWeekStart.plusDays(2); // Monday of that past week

        TimesheetDTO dto = new TimesheetDTO();
        dto.setDate(pastDate);
        dto.setCategory("PROJECT");
        dto.setTotalHours(8.0);

        assertDoesNotThrow(() ->
                timesheetService.saveWeeklyTimesheet(EMPLOYEE_ID, pastWeekStart, Collections.singletonList(dto), Role.EMPLOYEE)
        );
    }

    @Test
    void saveWeeklyTimesheet_shouldReject_whenFutureWeek() {
        LocalDate today = LocalDate.now();
        LocalDate futureWeekStart = today.plusWeeks(2).with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY));
        LocalDate futureDate = futureWeekStart.plusDays(2);

        TimesheetDTO dto = new TimesheetDTO();
        dto.setDate(futureDate);
        dto.setCategory("PROJECT");
        dto.setTotalHours(8.0);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                timesheetService.saveWeeklyTimesheet(EMPLOYEE_ID, futureWeekStart, Collections.singletonList(dto), Role.EMPLOYEE)
        );

        assertTrue(ex.getMessage().contains("Weekly timesheet cannot be submitted before the last working day of the week"));
    }
}
