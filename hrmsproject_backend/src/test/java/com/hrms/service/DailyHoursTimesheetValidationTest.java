package com.hrms.service;

import com.hrms.dto.TimesheetDTO;
import com.hrms.model.Employee;
import com.hrms.model.Role;
import com.hrms.repository.CompanyDetailRepository;
import com.hrms.repository.EmployeeReportingRepository;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.LeaveRepository;
import com.hrms.repository.TimesheetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class DailyHoursTimesheetValidationTest {

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

    @InjectMocks
    private TimesheetService timesheetService;

    private static final Long EMPLOYEE_ID = 101L;
    private static final LocalDate TEST_DATE = LocalDate.now().minusDays(1);

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
    }

    @Test
    void saveWeeklyTimesheet_shouldAccept_8Hours() {
        TimesheetDTO workDto = new TimesheetDTO();
        workDto.setDate(TEST_DATE);
        workDto.setCategory("PROJECT");
        workDto.setTotalHours(8.0);

        assertDoesNotThrow(() ->
                timesheetService.saveWeeklyTimesheet(EMPLOYEE_ID, TEST_DATE.minusDays(1), Collections.singletonList(workDto), Role.EMPLOYEE)
        );
    }

    @Test
    void saveWeeklyTimesheet_shouldAccept_24Hours() {
        TimesheetDTO workDto = new TimesheetDTO();
        workDto.setDate(TEST_DATE);
        workDto.setCategory("PROJECT");
        workDto.setTotalHours(24.0);

        assertDoesNotThrow(() ->
                timesheetService.saveWeeklyTimesheet(EMPLOYEE_ID, TEST_DATE.minusDays(1), Collections.singletonList(workDto), Role.EMPLOYEE)
        );
    }

    @Test
    void saveWeeklyTimesheet_shouldReject_24Point1Hours() {
        TimesheetDTO workDto = new TimesheetDTO();
        workDto.setDate(TEST_DATE);
        workDto.setCategory("PROJECT");
        workDto.setTotalHours(24.1);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                timesheetService.saveWeeklyTimesheet(EMPLOYEE_ID, TEST_DATE.minusDays(1), Collections.singletonList(workDto), Role.EMPLOYEE)
        );

        assertTrue(ex.getMessage().contains("Working hours cannot exceed 24 hours per day."));
    }

    @Test
    void saveWeeklyTimesheet_shouldReject_25Hours() {
        TimesheetDTO workDto = new TimesheetDTO();
        workDto.setDate(TEST_DATE);
        workDto.setCategory("PROJECT");
        workDto.setTotalHours(25.0);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                timesheetService.saveWeeklyTimesheet(EMPLOYEE_ID, TEST_DATE.minusDays(1), Collections.singletonList(workDto), Role.EMPLOYEE)
        );

        assertTrue(ex.getMessage().contains("Working hours cannot exceed 24 hours per day."));
    }

    @Test
    void saveWeeklyTimesheet_shouldReject_30Hours() {
        TimesheetDTO workDto = new TimesheetDTO();
        workDto.setDate(TEST_DATE);
        workDto.setCategory("PROJECT");
        workDto.setTotalHours(30.0);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                timesheetService.saveWeeklyTimesheet(EMPLOYEE_ID, TEST_DATE.minusDays(1), Collections.singletonList(workDto), Role.EMPLOYEE)
        );

        assertTrue(ex.getMessage().contains("Working hours cannot exceed 24 hours per day."));
    }

    @Test
    void saveWeeklyTimesheet_shouldReject_NegativeHours() {
        TimesheetDTO workDto = new TimesheetDTO();
        workDto.setDate(TEST_DATE);
        workDto.setCategory("PROJECT");
        workDto.setTotalHours(-1.0);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                timesheetService.saveWeeklyTimesheet(EMPLOYEE_ID, TEST_DATE.minusDays(1), Collections.singletonList(workDto), Role.EMPLOYEE)
        );

        assertTrue(ex.getMessage().contains("Working hours cannot exceed 24 hours per day."));
    }
}
