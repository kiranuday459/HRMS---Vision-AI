package com.hrms.service;

import com.hrms.dto.TimesheetDTO;
import com.hrms.model.Employee;
import com.hrms.model.Role;
import com.hrms.model.Timesheet;
import com.hrms.model.TimesheetStatus;
import com.hrms.repository.CompanyDetailRepository;
import com.hrms.repository.EmployeeReportingRepository;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.HolidayRepository;
import com.hrms.repository.LeaveRepository;
import com.hrms.repository.TimesheetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WeeklyTimesheetDraftTest {

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
    void saveDraftWeeklyTimesheet_shouldAcceptPartialDataAndPersistAsDraft() {
        LocalDate weekStart = LocalDate.now().minusWeeks(1).with(TemporalAdjusters.previousOrSame(DayOfWeek.SATURDAY));
        LocalDate monday = weekStart.plusDays(2);

        TimesheetDTO dto = new TimesheetDTO();
        dto.setDate(monday);
        dto.setCategory("PROJECT");
        dto.setProject("PRJ-1");
        dto.setProjectName("Vision AI");
        dto.setTask("TASK-1");
        dto.setTotalHours(4.0); // partial day

        assertDoesNotThrow(() ->
                timesheetService.saveDraftWeeklyTimesheet(EMPLOYEE_ID, weekStart, Collections.singletonList(dto), Role.EMPLOYEE)
        );

        ArgumentCaptor<Timesheet> captor = ArgumentCaptor.forClass(Timesheet.class);
        verify(timesheetRepository, atLeastOnce()).save(captor.capture());

        Timesheet saved = captor.getValue();
        assertEquals(TimesheetStatus.DRAFT, saved.getStatus());
        assertEquals("PRJ-1", saved.getProject());
        assertEquals(4.0, saved.getTotalHours());
    }

    @Test
    void saveWeeklyTimesheet_shouldTransitionDraftToSubmitted() {
        LocalDate weekStart = LocalDate.now().minusWeeks(1).with(TemporalAdjusters.previousOrSame(DayOfWeek.SATURDAY));
        LocalDate monday = weekStart.plusDays(2);

        // Simulate an existing draft
        Timesheet draft = new Timesheet();
        draft.setStatus(TimesheetStatus.DRAFT);
        when(timesheetRepository.findWithFilters(eq(EMPLOYEE_ID), any(), eq(weekStart), any(), any()))
                .thenReturn(Collections.singletonList(draft));

        TimesheetDTO dto = new TimesheetDTO();
        dto.setDate(monday);
        dto.setCategory("PROJECT");
        dto.setProject("PRJ-1");
        dto.setProjectName("Vision AI");
        dto.setTotalHours(8.0);

        assertDoesNotThrow(() ->
                timesheetService.saveWeeklyTimesheet(EMPLOYEE_ID, weekStart, Collections.singletonList(dto), Role.EMPLOYEE)
        );

        ArgumentCaptor<Timesheet> captor = ArgumentCaptor.forClass(Timesheet.class);
        verify(timesheetRepository, atLeastOnce()).save(captor.capture());

        Timesheet saved = captor.getValue();
        assertNotEquals(TimesheetStatus.DRAFT, saved.getStatus());
        assertTrue(saved.getStatus() == TimesheetStatus.PENDING_RM_APPROVAL || saved.getStatus() == TimesheetStatus.PENDING_ADMIN_APPROVAL);
    }

    @Test
    void saveDraftWeeklyTimesheet_shouldReject_whenOverwritingSubmittedOrApproved() {
        LocalDate weekStart = LocalDate.now().minusWeeks(1).with(TemporalAdjusters.previousOrSame(DayOfWeek.SATURDAY));

        Timesheet submitted = new Timesheet();
        submitted.setStatus(TimesheetStatus.PENDING_RM_APPROVAL);
        when(timesheetRepository.findWithFilters(eq(EMPLOYEE_ID), any(), eq(weekStart), any(), any()))
                .thenReturn(Collections.singletonList(submitted));

        TimesheetDTO dto = new TimesheetDTO();
        dto.setDate(weekStart.plusDays(2));
        dto.setCategory("PROJECT");
        dto.setProject("PRJ-1");
        dto.setProjectName("Vision AI");
        dto.setTotalHours(8.0);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                timesheetService.saveDraftWeeklyTimesheet(EMPLOYEE_ID, weekStart, Collections.singletonList(dto), Role.EMPLOYEE)
        );

        assertTrue(ex.getMessage().contains("Cannot save draft for an already submitted or approved timesheet"));
    }

    @Test
    void saveDraftWeeklyTimesheet_shouldReject_whenHoursInvalid() {
        LocalDate weekStart = LocalDate.now().minusWeeks(1).with(TemporalAdjusters.previousOrSame(DayOfWeek.SATURDAY));

        TimesheetDTO dtoNegative = new TimesheetDTO();
        dtoNegative.setDate(weekStart.plusDays(2));
        dtoNegative.setCategory("PROJECT");
        dtoNegative.setProject("PRJ-1");
        dtoNegative.setProjectName("Vision AI");
        dtoNegative.setTotalHours(-2.0);

        ResponseStatusException exNegative = assertThrows(ResponseStatusException.class, () ->
                timesheetService.saveDraftWeeklyTimesheet(EMPLOYEE_ID, weekStart, Collections.singletonList(dtoNegative), Role.EMPLOYEE)
        );
        assertTrue(exNegative.getMessage().contains("Working hours cannot exceed 24 hours per day"));

        TimesheetDTO dtoExcess = new TimesheetDTO();
        dtoExcess.setDate(weekStart.plusDays(2));
        dtoExcess.setCategory("PROJECT");
        dtoExcess.setProject("PRJ-1");
        dtoExcess.setProjectName("Vision AI");
        dtoExcess.setTotalHours(25.0);

        ResponseStatusException exExcess = assertThrows(ResponseStatusException.class, () ->
                timesheetService.saveDraftWeeklyTimesheet(EMPLOYEE_ID, weekStart, Collections.singletonList(dtoExcess), Role.EMPLOYEE)
        );
        assertTrue(exExcess.getMessage().contains("Working hours cannot exceed 24 hours per day"));
    }

    @Test
    void saveDraftWeeklyTimesheet_shouldReject_whenDateOutsideWeek() {
        LocalDate weekStart = LocalDate.now().minusWeeks(1).with(TemporalAdjusters.previousOrSame(DayOfWeek.SATURDAY));
        LocalDate outsideDate = weekStart.minusDays(1); // Friday before weekStart

        TimesheetDTO dto = new TimesheetDTO();
        dto.setDate(outsideDate);
        dto.setCategory("PROJECT");
        dto.setProject("PRJ-1");
        dto.setProjectName("Vision AI");
        dto.setTotalHours(8.0);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                timesheetService.saveDraftWeeklyTimesheet(EMPLOYEE_ID, weekStart, Collections.singletonList(dto), Role.EMPLOYEE)
        );
        assertTrue(ex.getMessage().contains("outside of the selected week"));
    }

    @Test
    void saveDraftWeeklyTimesheet_shouldReject_whenDuplicateProjectTaskDate() {
        LocalDate weekStart = LocalDate.now().minusWeeks(1).with(TemporalAdjusters.previousOrSame(DayOfWeek.SATURDAY));
        LocalDate monday = weekStart.plusDays(2);

        TimesheetDTO dto1 = new TimesheetDTO();
        dto1.setDate(monday);
        dto1.setCategory("PROJECT");
        dto1.setProject("PRJ-1");
        dto1.setProjectName("Vision AI");
        dto1.setTask("TASK-A");
        dto1.setTotalHours(4.0);

        TimesheetDTO dto2 = new TimesheetDTO();
        dto2.setDate(monday);
        dto2.setCategory("PROJECT");
        dto2.setProject("PRJ-1");
        dto2.setProjectName("Vision AI");
        dto2.setTask("TASK-A");
        dto2.setTotalHours(4.0);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                timesheetService.saveDraftWeeklyTimesheet(EMPLOYEE_ID, weekStart, List.of(dto1, dto2), Role.EMPLOYEE)
        );
        assertTrue(ex.getMessage().contains("Duplicate project and task entry"));
    }

    @Test
    void saveDraftWeeklyTimesheet_shouldReject_whenProjectRowMissingProjectName() {
        LocalDate weekStart = LocalDate.now().minusWeeks(1).with(TemporalAdjusters.previousOrSame(DayOfWeek.SATURDAY));
        LocalDate monday = weekStart.plusDays(2);

        TimesheetDTO dto = new TimesheetDTO();
        dto.setDate(monday);
        dto.setCategory("PROJECT");
        dto.setProject("PRJ-1");
        dto.setProjectName(""); // missing
        dto.setTotalHours(4.0);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                timesheetService.saveDraftWeeklyTimesheet(EMPLOYEE_ID, weekStart, Collections.singletonList(dto), Role.EMPLOYEE)
        );
        assertTrue(ex.getMessage().contains("Project ID and Project Name are required"));
    }
}
