package com.hrms.service;

import com.hrms.dto.AssignmentRemovalEligibilityDTO;
import com.hrms.dto.ClientProjectAssignmentDTO;
import com.hrms.model.ClientProjectAssignment;
import com.hrms.model.Employee;
import com.hrms.model.Role;
import com.hrms.model.User;
import com.hrms.model.ClientTimesheet;
import com.hrms.model.ClientTimesheetStatus;
import com.hrms.repository.ClientProjectAssignmentAuditRepository;
import com.hrms.repository.ClientProjectAssignmentRepository;
import com.hrms.repository.ClientTimesheetRepository;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Removing an employee from a client project, and putting them back.
 *
 * The rule these pin down: ending an assignment must also take the employee's Client Timesheet
 * access away. It did not — deactivate() flipped the assignment's own flag and left
 * employee.clientAssigned set, so the badge read "Ended" while the employee kept the module,
 * the sidebar entry and the ability to enter time. Everything that gates access reads that one
 * employee flag, so the tests below assert on it directly.
 *
 * The other half is what removal must NOT do: it is not a delete. The assignment row survives
 * so the admin keeps a record of who was on what, and submitted timesheets survive because
 * they are needed for review and billing long after someone rolls off.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ClientAssignmentRemovalTest {

    private static final Long EMP_ID = 7L;
    private static final Long ASSIGNMENT_ID = 42L;
    // The admin performing the removal / re-add. Only used for the audit trail, which is
    // append-only and swallows its own failures, so it never changes the outcomes asserted here.
    private static final Long ADMIN_USER_ID = 3L;

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

    @InjectMocks private ClientProjectAssignmentService service;

    private Employee employee;
    private ClientProjectAssignment assignment;

    @BeforeEach
    void setUp() {
        User user = new User();
        user.setRole(Role.EMPLOYEE);

        // An employee mid-assignment: on a project, access granted, OTP already verified.
        employee = new Employee();
        employee.setId(EMP_ID);
        employee.setFirstName("Dana");
        employee.setLastName("Whitfield");
        employee.setActive(true);
        employee.setUser(user);
        employee.setClientAssigned(true);
        employee.setClientVerified(true);
        employee.setClientProject("Atlas Migration");
        employee.setClientProjectId("PRJ-1");
        employee.setClientAssignmentDate(LocalDate.of(2026, 5, 27));

        assignment = new ClientProjectAssignment();
        assignment.setId(ASSIGNMENT_ID);
        assignment.setEmployee(employee);
        assignment.setProjectName("Atlas Migration");
        assignment.setProjectId("PRJ-1");
        assignment.setAssignmentStartDate(LocalDate.of(2026, 5, 27));
        assignment.setActive(true);

        when(assignmentRepository.findById(ASSIGNMENT_ID)).thenReturn(Optional.of(assignment));
        when(assignmentRepository.save(any(ClientProjectAssignment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(employeeRepository.save(any(Employee.class))).thenAnswer(inv -> inv.getArgument(0));
        // Default: nothing else active for this employee, and nothing awaiting approval.
        when(assignmentRepository.findByEmployeeIdAndActiveTrue(anyLong())).thenReturn(Collections.emptyList());
        when(lineRepository.findByEmployeeIdAndStatus(anyLong(), any())).thenReturn(Collections.emptyList());
        when(lineRepository.findByEmployeeIdAndStatusAndProjectId(anyLong(), any(), any()))
                .thenReturn(Collections.emptyList());
        when(lineRepository.findByEmployeeIdAndStatusIn(anyLong(), any())).thenReturn(Collections.emptyList());
        when(lineRepository.findByEmployeeIdAndStatusInAndProjectId(anyLong(), any(), any()))
                .thenReturn(Collections.emptyList());
    }

    /**
     * Weeks the admin has not yet approved or rejected for this employee on this project. Given
     * as day-level line rows, the way they are actually stored — several rows per week — so the
     * rollup to distinct weeks is exercised rather than assumed.
     */
    private void givenWeeksAwaitingApproval(LocalDate... weekStarts) {
        givenBlockingWeeks(ClientTimesheetStatus.PENDING, weekStarts);
    }

    /**
     * Weeks that block removal, in the given status. Given as day-level line rows, the way they
     * are actually stored — several rows per week — so the rollup to distinct weeks is exercised
     * rather than assumed. The guard now queries by a status set, so the stub answers the
     * status-set lookup regardless of which blocking status the rows carry.
     */
    private void givenBlockingWeeks(ClientTimesheetStatus status, LocalDate... weekStarts) {
        List<ClientTimesheet> lines = new ArrayList<>();
        for (LocalDate weekStart : weekStarts) {
            for (int day = 0; day < 5; day++) {          // Mon–Fri, one row each
                ClientTimesheet line = new ClientTimesheet();
                line.setWeekStartDate(weekStart);
                line.setDate(weekStart.plusDays(day));
                line.setProjectId("PRJ-1");
                line.setStatus(status);
                lines.add(line);
            }
        }
        when(lineRepository.findByEmployeeIdAndStatusInAndProjectId(
                eq(EMP_ID), any(), eq("PRJ-1"))).thenReturn(lines);
    }

    // ── Remove ──────────────────────────────────────────────────────────────

    @Test
    void removeEndsTheAssignmentWithoutDeletingIt() {
        ClientProjectAssignmentDTO dto = service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID);

        assertFalse(assignment.getActive(), "the assignment should be ended");
        assertFalse(dto.getActive(), "the returned row should report itself ended");
        verify(assignmentRepository, never()).delete(any());
        verify(assignmentRepository, never()).deleteById(anyLong());
    }

    /** The bug, stated directly. */
    @Test
    void removeRevokesClientTimesheetAccess() {
        service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID);

        assertEquals(Boolean.FALSE, employee.getClientAssigned(),
                "clientAssigned is what gates the module — removal must clear it");
        assertEquals(Boolean.FALSE, employee.getClientVerified());
        verify(employeeRepository).save(employee);
    }

    @Test
    void removeClearsTheMirroredProjectFields() {
        service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID);

        assertNull(employee.getClientProject());
        assertNull(employee.getClientProjectId());
        assertNull(employee.getClientAssignmentDate());
    }

    /** An OTP already sitting in the employee's inbox must not let them back in. */
    @Test
    void removeWipesAnyUnredeemedActivationOtp() {
        employee.setClientOtp("$2a$10$hashed");
        employee.setClientOtpExpiry(LocalDateTime.now().plusMinutes(10));

        service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID);

        assertNull(employee.getClientOtp());
        assertNull(employee.getClientOtpExpiry());
    }

    /**
     * Access is revoked on holding no assignment, not on ending one. A legacy row with two
     * active assignments must keep access to the one still running.
     */
    @Test
    void removeKeepsAccessWhenAnotherAssignmentIsStillActive() {
        ClientProjectAssignment other = new ClientProjectAssignment();
        other.setId(99L);
        other.setEmployee(employee);
        other.setActive(true);
        when(assignmentRepository.findByEmployeeIdAndActiveTrue(EMP_ID)).thenReturn(List.of(other));

        service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID);

        assertEquals(Boolean.TRUE, employee.getClientAssigned(), "still on another project");
        assertEquals(Boolean.TRUE, employee.getClientVerified());
    }

    @Test
    void removeIs404ForAnUnknownAssignment() {
        when(assignmentRepository.findById(404L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.deactivate(404L, ADMIN_USER_ID));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }

    // ── Blocked while a week is awaiting a decision ─────────────────────────

    @Test
    void removeIsBlockedWhileATimesheetIsPendingApproval() {
        givenWeeksAwaitingApproval(LocalDate.of(2026, 6, 6));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertTrue(assignment.getActive(), "the assignment must survive a blocked removal");
    }

    @Test
    void theBlockedMessageNamesTheEmployeeProjectAndCount() {
        givenWeeksAwaitingApproval(LocalDate.of(2026, 6, 6));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID));

        String reason = ex.getReason();
        assertTrue(reason.contains("Dana Whitfield"), reason);
        assertTrue(reason.contains("Atlas Migration"), reason);
        assertTrue(reason.contains("1 timesheet still open"), reason);
        assertTrue(reason.contains("see it through to approved"), reason);
    }

    /** The count is a count of weeks, and the wording follows it. */
    @Test
    void theBlockedMessagePluralisesForSeveralWeeks() {
        givenWeeksAwaitingApproval(LocalDate.of(2026, 6, 6), LocalDate.of(2026, 6, 13));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID));

        assertTrue(ex.getReason().contains("2 timesheets still open"), ex.getReason());
        assertTrue(ex.getReason().contains("see them through to approved"), ex.getReason());
    }

    /** A blocked removal must leave access exactly as it was. */
    @Test
    void aBlockedRemovalChangesNothing() {
        givenWeeksAwaitingApproval(LocalDate.of(2026, 6, 6));

        assertThrows(ResponseStatusException.class, () -> service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID));

        assertEquals(Boolean.TRUE, employee.getClientAssigned());
        assertEquals(Boolean.TRUE, employee.getClientVerified());
        assertEquals("Atlas Migration", employee.getClientProject());
        verify(assignmentRepository, never()).save(any(ClientProjectAssignment.class));
        verify(employeeRepository, never()).save(any(Employee.class));
    }

    /**
     * A rejected week blocks removal just as a pending one does. It is not a finished timesheet
     * — the admin has asked for a correction and the week is expected back — so removing the
     * employee mid-correction strands work that was already submitted once.
     */
    @Test
    void aRejectedTimesheetBlocksRemoval() {
        givenBlockingWeeks(ClientTimesheetStatus.REJECTED, LocalDate.of(2026, 6, 6));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertTrue(assignment.getActive(), "a blocked removal must leave the assignment active");
    }

    /** And the pre-check reports it, so the tab explains rather than confirms. */
    @Test
    void eligibilityReportsARejectedWeekAsBlocking() {
        givenBlockingWeeks(ClientTimesheetStatus.REJECTED, LocalDate.of(2026, 6, 6));

        AssignmentRemovalEligibilityDTO eligibility = service.removalEligibility(ASSIGNMENT_ID);

        assertFalse(eligibility.isRemovable());
        assertEquals(1, eligibility.getBlockingCount());
        assertEquals(List.of(LocalDate.of(2026, 6, 6)), eligibility.getBlockingWeekStarts());
    }

    /** Pending and rejected weeks are counted together, each week once. */
    @Test
    void pendingAndRejectedWeeksAreCountedTogether() {
        List<ClientTimesheet> mixed = new ArrayList<>();
        mixed.addAll(lineIn(ClientTimesheetStatus.PENDING, LocalDate.of(2026, 6, 6)));
        mixed.addAll(lineIn(ClientTimesheetStatus.REJECTED, LocalDate.of(2026, 6, 13)));
        when(lineRepository.findByEmployeeIdAndStatusInAndProjectId(eq(EMP_ID), any(), eq("PRJ-1")))
                .thenReturn(mixed);

        AssignmentRemovalEligibilityDTO eligibility = service.removalEligibility(ASSIGNMENT_ID);

        assertFalse(eligibility.isRemovable());
        assertEquals(2, eligibility.getBlockingCount());
        assertEquals(List.of(LocalDate.of(2026, 6, 6), LocalDate.of(2026, 6, 13)),
                eligibility.getBlockingWeekStarts());
    }

    /**
     * Approved, Draft and Not Started still do not block — they are settled or were never handed
     * over. The guard asks only for the unsettled statuses, so these are never fetched at all.
     */
    @Test
    void approvedAndDraftTimesheetsDoNotBlockRemoval() {
        when(lineRepository.findByEmployeeIdAndStatusAndProjectId(
                eq(EMP_ID), eq(ClientTimesheetStatus.APPROVED), any())).thenReturn(lineIn(ClientTimesheetStatus.APPROVED));
        when(lineRepository.findByEmployeeIdAndStatusAndProjectId(
                eq(EMP_ID), eq(ClientTimesheetStatus.DRAFT), any())).thenReturn(lineIn(ClientTimesheetStatus.DRAFT));

        assertDoesNotThrow(() -> service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID));

        assertFalse(assignment.getActive());
        assertEquals(Boolean.FALSE, employee.getClientAssigned(), "access still revoked as before");
    }

    /** The status set the guard asks for is exactly PENDING + REJECTED. */
    @Test
    void theGuardAsksForPendingAndRejectedOnly() {
        service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<ClientTimesheetStatus>> statuses =
                ArgumentCaptor.forClass(Collection.class);
        verify(lineRepository).findByEmployeeIdAndStatusInAndProjectId(
                eq(EMP_ID), statuses.capture(), eq("PRJ-1"));
        assertEquals(Set.of(ClientTimesheetStatus.PENDING, ClientTimesheetStatus.REJECTED),
                new HashSet<>(statuses.getValue()));
    }

    private List<ClientTimesheet> lineIn(ClientTimesheetStatus status) {
        return lineIn(status, LocalDate.of(2026, 5, 30));
    }

    private List<ClientTimesheet> lineIn(ClientTimesheetStatus status, LocalDate weekStart) {
        ClientTimesheet line = new ClientTimesheet();
        line.setWeekStartDate(weekStart);
        line.setProjectId("PRJ-1");
        line.setStatus(status);
        return List.of(line);
    }

    /** The guard asks only about this assignment's project. */
    @Test
    void theCheckIsScopedToThisAssignmentsProject() {
        service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID);

        verify(lineRepository).findByEmployeeIdAndStatusInAndProjectId(
                eq(EMP_ID), any(), eq("PRJ-1"));
        verify(lineRepository, never()).findByEmployeeIdAndStatusIn(anyLong(), any());
    }

    /**
     * With no project id to scope by there is nothing to match on, so the check widens to every
     * project — blocking on a pending week beats silently removing someone who has one.
     */
    @Test
    void anAssignmentWithNoProjectIdIsCheckedAcrossEveryProject() {
        assignment.setProjectId("   ");

        service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID);

        verify(lineRepository).findByEmployeeIdAndStatusIn(eq(EMP_ID), any());
    }

    /** Five day rows for one week are one pending timesheet, not five. */
    @Test
    void aWeekOfDayRowsCountsAsOneTimesheet() {
        givenWeeksAwaitingApproval(LocalDate.of(2026, 6, 6));   // seeds 5 line rows

        var eligibility = service.removalEligibility(ASSIGNMENT_ID);

        assertEquals(1, eligibility.getBlockingCount());
        assertEquals(List.of(LocalDate.of(2026, 6, 6)), eligibility.getBlockingWeekStarts());
    }

    /** Resolve the pending week, retry, and removal goes through as before. */
    @Test
    void removalSucceedsOnceThePendingTimesheetIsResolved() {
        givenWeeksAwaitingApproval(LocalDate.of(2026, 6, 6));
        assertThrows(ResponseStatusException.class, () -> service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID));

        // The week reaches approved — nothing is left pending or rejected.
        when(lineRepository.findByEmployeeIdAndStatusInAndProjectId(anyLong(), any(), any()))
                .thenReturn(Collections.emptyList());

        assertDoesNotThrow(() -> service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID));
        assertFalse(assignment.getActive());
        assertEquals(Boolean.FALSE, employee.getClientAssigned());
    }

    // ── Eligibility pre-check (drives the admin tab's message) ──────────────

    @Test
    void eligibilityReportsRemovableWhenNothingIsPending() {
        var eligibility = service.removalEligibility(ASSIGNMENT_ID);

        assertTrue(eligibility.isRemovable());
        assertEquals(0, eligibility.getBlockingCount());
    }

    @Test
    void eligibilityReportsTheBlockingWeeksAndWhoTheyBelongTo() {
        givenWeeksAwaitingApproval(LocalDate.of(2026, 6, 6), LocalDate.of(2026, 6, 13));

        var eligibility = service.removalEligibility(ASSIGNMENT_ID);

        assertFalse(eligibility.isRemovable());
        assertEquals(2, eligibility.getBlockingCount());
        assertEquals(List.of(LocalDate.of(2026, 6, 6), LocalDate.of(2026, 6, 13)),
                eligibility.getBlockingWeekStarts());
        assertEquals(EMP_ID, eligibility.getEmployeeId());
        assertEquals("Dana Whitfield", eligibility.getEmployeeName());
        assertEquals("Atlas Migration", eligibility.getProjectName());
    }

    /** The pre-check only reports; it must never change anything. */
    @Test
    void eligibilityIsReadOnly() {
        givenWeeksAwaitingApproval(LocalDate.of(2026, 6, 6));

        service.removalEligibility(ASSIGNMENT_ID);

        assertTrue(assignment.getActive());
        verify(assignmentRepository, never()).save(any(ClientProjectAssignment.class));
        verify(employeeRepository, never()).save(any(Employee.class));
    }

    // ── Re-add ──────────────────────────────────────────────────────────────

    @Test
    void reAddRestoresTheAssignmentAndAccess() {
        assignment.setActive(false);
        employee.setClientAssigned(false);
        employee.setClientProject(null);

        ClientProjectAssignmentDTO dto = service.reactivate(ASSIGNMENT_ID, ADMIN_USER_ID);

        assertTrue(assignment.getActive());
        assertTrue(dto.getActive());
        assertEquals(Boolean.TRUE, employee.getClientAssigned());
        assertEquals("Atlas Migration", employee.getClientProject());
        assertEquals("PRJ-1", employee.getClientProjectId());
        assertEquals(LocalDate.of(2026, 5, 27), employee.getClientAssignmentDate());
    }

    /** Access always costs a verification, however it was granted. */
    @Test
    void reAddRequiresFreshVerificationAndSendsANewOtp() {
        assignment.setActive(false);

        service.reactivate(ASSIGNMENT_ID, ADMIN_USER_ID);

        assertEquals(Boolean.FALSE, employee.getClientVerified(),
                "a re-added employee verifies again before entering time");
        verify(clientVerificationService).issueAndSendOtp(employee);
    }

    @Test
    void reAddNotifiesTheEmployee() {
        assignment.setActive(false);

        service.reactivate(ASSIGNMENT_ID, ADMIN_USER_ID);

        verify(notificationService).notifyEmployeeProjectAssigned(
                employee, "Atlas Migration", LocalDate.of(2026, 5, 27));
    }

    /**
     * Re-add is held to the same eligibility rules as a fresh assignment — this is the case a
     * blind flag-flip would get wrong, putting someone on two active projects.
     */
    @Test
    void reAddIsRejectedWhenTheEmployeePickedUpAnotherProjectMeanwhile() {
        assignment.setActive(false);
        ClientProjectAssignment other = new ClientProjectAssignment();
        other.setActive(true);
        other.setProjectName("Beacon Rollout");
        when(assignmentRepository.findByEmployeeIdAndActiveTrue(EMP_ID)).thenReturn(List.of(other));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.reactivate(ASSIGNMENT_ID, ADMIN_USER_ID));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Beacon Rollout"), ex.getReason());
        assertFalse(assignment.getActive(), "the assignment must stay removed");
    }

    @Test
    void reAddIsRejectedForAnEmployeeDisabledInHrms() {
        assignment.setActive(false);
        employee.setActive(false);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.reactivate(ASSIGNMENT_ID, ADMIN_USER_ID));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertFalse(assignment.getActive());
        verify(clientVerificationService, never()).issueAndSendOtp(any());
    }

    @Test
    void reAddIsRejectedForANonAssignableRole() {
        assignment.setActive(false);
        employee.getUser().setRole(Role.HR);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.reactivate(ASSIGNMENT_ID, ADMIN_USER_ID));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertFalse(assignment.getActive());
    }

    /** Re-adding something already active is a no-op, not a second OTP. */
    @Test
    void reAddOnAnAlreadyActiveAssignmentDoesNothing() {
        service.reactivate(ASSIGNMENT_ID, ADMIN_USER_ID);

        assertTrue(assignment.getActive());
        verify(clientVerificationService, never()).issueAndSendOtp(any());
        verify(notificationService, never()).notifyEmployeeProjectAssigned(any(), any(), any());
    }

    // ── Round trip ──────────────────────────────────────────────────────────

    /** Remove → re-add → remove, the sequence an admin actually performs. */
    @Test
    void accessFollowsTheAssignmentThroughAFullRoundTrip() {
        service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID);
        assertEquals(Boolean.FALSE, employee.getClientAssigned(), "after remove");

        service.reactivate(ASSIGNMENT_ID, ADMIN_USER_ID);
        assertEquals(Boolean.TRUE, employee.getClientAssigned(), "after re-add");

        // The re-add left the row active; removal has to see that and clear it again.
        when(assignmentRepository.findByEmployeeIdAndActiveTrue(EMP_ID)).thenReturn(Collections.emptyList());
        service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID);
        assertEquals(Boolean.FALSE, employee.getClientAssigned(), "after second remove");
    }
}
