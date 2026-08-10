package com.hrms.service;

import com.hrms.dto.ClientProjectAssignmentDTO;
import com.hrms.model.ClientProjectAssignment;
import com.hrms.model.CompanyDetail;
import com.hrms.model.Employee;
import com.hrms.model.Role;
import com.hrms.model.User;
import com.hrms.repository.ClientProjectAssignmentAuditRepository;
import com.hrms.repository.ClientProjectAssignmentRepository;
import com.hrms.repository.ClientTimesheetRepository;
import com.hrms.repository.CompanyDetailRepository;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * An employee cannot be put on a client project before they joined the company.
 *
 * The assignment start date is what opens the employee's Client Timesheet weeks, so a date
 * earlier than their joining date would let them log — and the client be billed for — hours
 * covering time they were not employed. The admin modal caps its date picker at the same
 * boundary, but that is the convenience; these tests pin the rule down where a direct API call
 * also has to pass through it.
 *
 * The joining date is read from CompanyDetail, which is where HR records it and where the
 * timesheet and leave-balance rules already read it from, with Employee.hireDate standing in
 * only when there is no company detail row at all.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ClientAssignmentJoiningDateTest {

    private static final Long EMP_ID = 11L;
    private static final LocalDate JOINED = LocalDate.of(2026, 6, 1);

    @Mock private ClientProjectAssignmentRepository assignmentRepository;
    // Append-only audit trail behind the Audit Logs tab; unstubbed, it records nothing and
    // changes no outcome asserted here.
    @Mock private ClientProjectAssignmentAuditRepository auditRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private UserRepository userRepository;
    @Mock private ClientVerificationService clientVerificationService;
    @Mock private ClientTimesheetNotificationService notificationService;
    @Mock private UserDisplayNameResolver userDisplayNameResolver;
    @Mock private ClientTimesheetRepository lineRepository;
    @Mock private CompanyDetailRepository companyDetailRepository;

    @InjectMocks private ClientProjectAssignmentService service;

    private Employee employee;

    @BeforeEach
    void setUp() {
        User user = new User();
        user.setRole(Role.EMPLOYEE);

        employee = new Employee();
        employee.setId(EMP_ID);
        employee.setFirstName("Priya");
        employee.setLastName("Raman");
        employee.setActive(true);
        employee.setUser(user);

        when(employeeRepository.findById(EMP_ID)).thenReturn(Optional.of(employee));
        when(employeeRepository.save(any(Employee.class))).thenAnswer(inv -> inv.getArgument(0));
        when(assignmentRepository.save(any(ClientProjectAssignment.class))).thenAnswer(inv -> inv.getArgument(0));
        // Free to be assigned: no live assignment already on this employee.
        when(assignmentRepository.findByEmployeeIdAndActiveTrue(anyLong())).thenReturn(Collections.emptyList());

        givenJoiningDate(JOINED);
    }

    /** HR recorded a joining date on the employee's CompanyDetail row. */
    private void givenJoiningDate(LocalDate date) {
        CompanyDetail detail = new CompanyDetail();
        detail.setJoiningDate(date);
        when(companyDetailRepository.findByEmployee_Id(EMP_ID)).thenReturn(Optional.of(detail));
    }

    private ClientProjectAssignmentDTO assignmentOn(LocalDate startDate) {
        ClientProjectAssignmentDTO dto = new ClientProjectAssignmentDTO();
        dto.setEmployeeIds(Arrays.asList(EMP_ID));
        dto.setClientName("Acme Corp");
        dto.setProjectName("Atlas Migration");
        dto.setProjectId("PRJ-1");
        dto.setAssignmentStartDate(startDate);
        return dto;
    }

    private ResponseStatusException reject(LocalDate startDate) {
        return assertThrows(ResponseStatusException.class, () -> service.create(assignmentOn(startDate), null));
    }

    // ── Allowed: on or after the joining date ────────────────────────────────

    @Test
    void assigningOnTheJoiningDateItselfIsAllowed() {
        List<ClientProjectAssignmentDTO> created = service.create(assignmentOn(JOINED), null);

        assertEquals(1, created.size());
        assertEquals(JOINED, created.get(0).getAssignmentStartDate());
    }

    @Test
    void assigningAfterTheJoiningDateIsAllowed() {
        // The day after, and a fortnight after — both plainly inside employment.
        assertEquals(1, service.create(assignmentOn(JOINED.plusDays(1)), null).size());
        assertEquals(1, service.create(assignmentOn(JOINED.plusDays(14)), null).size());
    }

    // ── Rejected: before the joining date ────────────────────────────────────

    @Test
    void assigningTheDayBeforeJoiningIsRejected() {
        ResponseStatusException ex = reject(JOINED.minusDays(1));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("cannot be earlier than the employee's joining date"),
                "message should state the rule, was: " + ex.getReason());
        // The admin assigns in batches, so the message has to say which employee and when they
        // joined — otherwise "one of these twelve joined later" is unactionable.
        assertTrue(ex.getReason().contains("Priya Raman"), "message should name the employee");
        assertTrue(ex.getReason().contains("2026-06-01"), "message should carry the joining date");
    }

    @Test
    void assigningWellBeforeJoiningIsRejected() {
        assertEquals(HttpStatus.BAD_REQUEST, reject(JOINED.minusMonths(3)).getStatusCode());
    }

    /** Nothing is written when the date is refused — not the assignment, not the access flags. */
    @Test
    void rejectedAssignmentPersistsNothingAndGrantsNoAccess() {
        reject(JOINED.minusDays(1));

        verify(assignmentRepository, never()).save(any(ClientProjectAssignment.class));
        verify(clientVerificationService, never()).issueAndSendOtp(any(Employee.class));
        assertNotEquals(Boolean.TRUE, employee.getClientAssigned());
    }

    // ── Fallbacks ────────────────────────────────────────────────────────────

    @Test
    void hireDateStandsInWhenThereIsNoCompanyDetailRow() {
        when(companyDetailRepository.findByEmployee_Id(EMP_ID)).thenReturn(Optional.empty());
        employee.setHireDate(JOINED);

        assertEquals(HttpStatus.BAD_REQUEST, reject(JOINED.minusDays(1)).getStatusCode());
        assertEquals(1, service.create(assignmentOn(JOINED), null).size());
    }

    /**
     * No joining date recorded anywhere — the assignment goes through. Blocking every employee
     * whose joining date HR never filled in would be a far wider change than this rule, and
     * would break assigning on existing data.
     */
    @Test
    void employeeWithNoRecordedJoiningDateIsStillAssignable() {
        when(companyDetailRepository.findByEmployee_Id(EMP_ID)).thenReturn(Optional.empty());
        employee.setHireDate(null);

        assertEquals(1, service.create(assignmentOn(LocalDate.of(2020, 1, 1)), null).size());
    }
}
