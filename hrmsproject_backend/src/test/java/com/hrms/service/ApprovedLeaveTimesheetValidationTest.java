package com.hrms.service;

import com.hrms.dto.TimesheetDTO;
import com.hrms.model.Employee;
import com.hrms.model.Leave;
import com.hrms.model.LeaveStatus;
import com.hrms.model.Role;
import com.hrms.repository.EmployeeReportingRepository;
import com.hrms.repository.CompanyDetailRepository;
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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ApprovedLeaveTimesheetValidationTest {

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
    private static final LocalDate LEAVE_DATE = LocalDate.of(2026, 8, 5);
    private static final LocalDate WORKING_DATE = LocalDate.of(2026, 8, 6);

    @BeforeEach
    void setUp() {
        Employee employee = new Employee();
        employee.setId(EMPLOYEE_ID);

        Leave approvedLeave = new Leave();
        approvedLeave.setStartDate(LEAVE_DATE);
        approvedLeave.setEndDate(LEAVE_DATE);
        approvedLeave.setStatus(LeaveStatus.APPROVED);

        lenient().when(leaveRepository.findByEmployeeIdAndStatus(EMPLOYEE_ID, LeaveStatus.APPROVED))
                .thenReturn(Collections.singletonList(approvedLeave));
        lenient().when(employeeRepository.findById(EMPLOYEE_ID))
                .thenReturn(Optional.of(employee));
        lenient().when(employeeReportingRepository.findFirstByEmployeeOrderByIdDesc(any()))
                .thenReturn(Optional.empty());
    }

    @Test
    void saveWeeklyTimesheet_shouldThrowException_whenWorkEntryOnApprovedLeaveDate() {
        TimesheetDTO workDto = new TimesheetDTO();
        workDto.setDate(LEAVE_DATE);
        workDto.setCategory("PROJECT");
        workDto.setTotalHours(8.0);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                timesheetService.saveWeeklyTimesheet(EMPLOYEE_ID, LocalDate.of(2026, 8, 1), Collections.singletonList(workDto), Role.EMPLOYEE)
        );

        assertEquals("400 BAD_REQUEST \"Timesheet entry is not allowed on approved leave days.\"", ex.getMessage());
    }

    @Test
    void saveWeeklyTimesheet_shouldAllowWorkEntryOnNonLeaveDate() {
        TimesheetDTO workDto = new TimesheetDTO();
        workDto.setDate(WORKING_DATE);
        workDto.setCategory("PROJECT");
        workDto.setTotalHours(8.0);

        assertDoesNotThrow(() ->
                timesheetService.saveWeeklyTimesheet(EMPLOYEE_ID, LocalDate.of(2026, 8, 1), Collections.singletonList(workDto), Role.EMPLOYEE)
        );
    }

    @Test
    void saveWeeklyTimesheet_shouldAllowLeaveCategoryEntryOnApprovedLeaveDate() {
        TimesheetDTO leaveDto = new TimesheetDTO();
        leaveDto.setDate(LEAVE_DATE);
        leaveDto.setCategory("LEAVE");
        leaveDto.setLeaveType("C");
        leaveDto.setTotalHours(8.0);

        assertDoesNotThrow(() ->
                timesheetService.saveWeeklyTimesheet(EMPLOYEE_ID, LocalDate.of(2026, 8, 1), Collections.singletonList(leaveDto), Role.EMPLOYEE)
        );
    }
}
