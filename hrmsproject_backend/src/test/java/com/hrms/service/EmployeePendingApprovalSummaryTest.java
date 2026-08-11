package com.hrms.service;

import com.hrms.model.Employee;
import com.hrms.model.Leave;
import com.hrms.model.LeaveStatus;
import com.hrms.model.Timesheet;
import com.hrms.model.TimesheetStatus;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.LeaveRepository;
import com.hrms.repository.TimesheetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmployeePendingApprovalSummaryTest {

    @Mock
    private EmployeeRepository employeeRepository;

    @Mock
    private TimesheetRepository timesheetRepository;

    @Mock
    private LeaveRepository leaveRepository;

    @InjectMocks
    private EmployeeService employeeService;

    private static final Long EMPLOYEE_ID = 201L;

    @BeforeEach
    void setUp() {
        Employee employee = new Employee();
        employee.setId(EMPLOYEE_ID);
        lenient().when(employeeRepository.findById(EMPLOYEE_ID)).thenReturn(Optional.of(employee));
    }

    @Test
    void getPendingApprovalSummary_shouldReturnZero_whenNoRecordsExist() {
        when(timesheetRepository.findByEmployeeIdAndStatusIn(eq(EMPLOYEE_ID), any()))
                .thenReturn(Collections.emptyList());
        when(leaveRepository.countByEmployeeIdAndStatusIn(eq(EMPLOYEE_ID), any()))
                .thenReturn(0L);

        Map<String, Object> summary = employeeService.getPendingApprovalSummary(EMPLOYEE_ID);

        assertNotNull(summary);
        assertEquals(false, summary.get("hasPending"));
        assertEquals(0L, summary.get("pendingTimesheets"));
        assertEquals(0L, summary.get("pendingLeaves"));
    }

    @Test
    void getPendingApprovalSummary_shouldReturnZero_whenOnlyNonPendingRecordsExist() {
        when(timesheetRepository.findByEmployeeIdAndStatusIn(eq(EMPLOYEE_ID), any()))
                .thenReturn(Collections.emptyList());
        when(leaveRepository.countByEmployeeIdAndStatusIn(eq(EMPLOYEE_ID), any()))
                .thenReturn(0L);

        Map<String, Object> summary = employeeService.getPendingApprovalSummary(EMPLOYEE_ID);

        assertEquals(false, summary.get("hasPending"));
        assertEquals(0L, summary.get("pendingTimesheets"));
        assertEquals(0L, summary.get("pendingLeaves"));
    }

    @Test
    void getPendingApprovalSummary_shouldCountDistinctPendingWeeklyTimesheetsAndPendingLeaves() {
        // Create 15 entry rows for Week 1 (all pending RM approval)
        LocalDate weekStart = LocalDate.of(2026, 8, 1);
        Timesheet t1 = new Timesheet();
        t1.setDate(weekStart);
        t1.setStatus(TimesheetStatus.PENDING_RM_APPROVAL);

        Timesheet t2 = new Timesheet();
        t2.setDate(weekStart.plusDays(1));
        t2.setStatus(TimesheetStatus.PENDING_RM_APPROVAL);

        Timesheet t3 = new Timesheet();
        t3.setDate(weekStart.plusDays(4));
        t3.setStatus(TimesheetStatus.PENDING_RM_APPROVAL);

        List<Timesheet> pendingEntries = Arrays.asList(t1, t2, t3);

        when(timesheetRepository.findByEmployeeIdAndStatusIn(eq(EMPLOYEE_ID), any()))
                .thenReturn(pendingEntries);
        when(leaveRepository.countByEmployeeIdAndStatusIn(eq(EMPLOYEE_ID), any()))
                .thenReturn(1L);

        Map<String, Object> summary = employeeService.getPendingApprovalSummary(EMPLOYEE_ID);

        assertEquals(true, summary.get("hasPending"));
        // 3 entry rows all in the same week should yield exactly 1 pending weekly timesheet count
        assertEquals(1L, summary.get("pendingTimesheets"));
        assertEquals(1L, summary.get("pendingLeaves"));
    }

    @Test
    void getPendingApprovalSummary_shouldCountMultiplePendingWeeksCorrectly() {
        LocalDate week1Date = LocalDate.of(2026, 8, 1);
        LocalDate week2Date = LocalDate.of(2026, 8, 8);

        Timesheet t1 = new Timesheet();
        t1.setDate(week1Date);
        t1.setStatus(TimesheetStatus.PENDING_RM_APPROVAL);

        Timesheet t2 = new Timesheet();
        t2.setDate(week2Date);
        t2.setStatus(TimesheetStatus.PENDING_HR_APPROVAL);

        when(timesheetRepository.findByEmployeeIdAndStatusIn(eq(EMPLOYEE_ID), any()))
                .thenReturn(Arrays.asList(t1, t2));
        when(leaveRepository.countByEmployeeIdAndStatusIn(eq(EMPLOYEE_ID), any()))
                .thenReturn(0L);

        Map<String, Object> summary = employeeService.getPendingApprovalSummary(EMPLOYEE_ID);

        assertEquals(true, summary.get("hasPending"));
        assertEquals(2L, summary.get("pendingTimesheets"));
        assertEquals(0L, summary.get("pendingLeaves"));
    }
}
