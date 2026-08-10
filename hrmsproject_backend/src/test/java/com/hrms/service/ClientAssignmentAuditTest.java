package com.hrms.service;

import com.hrms.dto.ClientProjectAssignmentAuditDTO;
import com.hrms.dto.ClientProjectAssignmentDTO;
import com.hrms.model.ClientProjectAssignment;
import com.hrms.model.ClientProjectAssignmentAudit;
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
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * The staffing history behind the admin's Audit Logs tab.
 *
 * Every decision an admin makes about who is on a client project has to leave a row: the first
 * assignment, a removal, and a re-add after removal. The re-add case is why this is an event
 * table and not a pair of columns on the assignment — an assignment can cycle through removed
 * and restored repeatedly, and each pass has to survive rather than overwrite the last.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ClientAssignmentAuditTest {

    private static final Long EMP_ID = 7L;
    private static final Long ASSIGNMENT_ID = 42L;
    private static final Long ADMIN_USER_ID = 3L;

    @Mock private ClientProjectAssignmentRepository assignmentRepository;
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
    private ClientProjectAssignment assignment;
    private User admin;

    @BeforeEach
    void setUp() {
        User user = new User();
        user.setRole(Role.EMPLOYEE);

        employee = new Employee();
        employee.setId(EMP_ID);
        employee.setFirstName("Dana");
        employee.setLastName("Whitfield");
        employee.setActive(true);
        employee.setUser(user);

        admin = new User();
        admin.setId(ADMIN_USER_ID);
        admin.setRole(Role.ADMIN);

        assignment = new ClientProjectAssignment();
        assignment.setId(ASSIGNMENT_ID);
        assignment.setEmployee(employee);
        assignment.setClientName("Acme Corp");
        assignment.setProjectName("Atlas Migration");
        assignment.setProjectId("PRJ-1");
        assignment.setAssignmentStartDate(LocalDate.of(2026, 5, 27));
        assignment.setActive(true);

        when(employeeRepository.findById(EMP_ID)).thenReturn(Optional.of(employee));
        when(employeeRepository.save(any(Employee.class))).thenAnswer(inv -> inv.getArgument(0));
        when(assignmentRepository.findById(ASSIGNMENT_ID)).thenReturn(Optional.of(assignment));
        when(assignmentRepository.save(any(ClientProjectAssignment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(assignmentRepository.findByEmployeeIdAndActiveTrue(anyLong())).thenReturn(Collections.emptyList());
        when(lineRepository.findByEmployeeIdAndStatus(anyLong(), any())).thenReturn(Collections.emptyList());
        when(lineRepository.findByEmployeeIdAndStatusAndProjectId(anyLong(), any(), any())).thenReturn(Collections.emptyList());
        when(userRepository.findById(ADMIN_USER_ID)).thenReturn(Optional.of(admin));
        when(userDisplayNameResolver.resolve(admin)).thenReturn("Admin3");
    }

    private ClientProjectAssignmentDTO payload() {
        ClientProjectAssignmentDTO dto = new ClientProjectAssignmentDTO();
        dto.setEmployeeIds(List.of(EMP_ID));
        dto.setAssignmentStartDate(LocalDate.of(2026, 8, 1));
        dto.setClientName("Acme Corp");
        dto.setProjectName("Atlas Migration");
        dto.setProjectId("PRJ-1");
        return dto;
    }

    private ClientProjectAssignmentAudit captureOneAudit() {
        ArgumentCaptor<ClientProjectAssignmentAudit> captor =
                ArgumentCaptor.forClass(ClientProjectAssignmentAudit.class);
        verify(auditRepository).save(captor.capture());
        return captor.getValue();
    }

    // ── The four columns the tab shows ───────────────────────────────────────

    @Test
    void assigningRecordsEmployeeProjectAdminAndTime() {
        service.create(payload(), ADMIN_USER_ID);

        ClientProjectAssignmentAudit log = captureOneAudit();
        assertEquals(ClientProjectAssignmentAudit.ACTION_ASSIGNED, log.getAction());
        assertEquals("Dana Whitfield", log.getEmployeeName());
        assertEquals(EMP_ID, log.getEmployeeId());
        assertEquals("Atlas Migration", log.getProjectName());
        assertEquals("PRJ-1", log.getProjectId());
        assertEquals("Acme Corp", log.getClientName());
        assertEquals("Admin3", log.getPerformedByName(), "the acting admin has to be named");
        assertEquals(ADMIN_USER_ID, log.getPerformedById());
        assertNotNull(log.getPerformedAt());
    }

    @Test
    void removingRecordsWhoRemovedThem() {
        service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID);

        ClientProjectAssignmentAudit log = captureOneAudit();
        assertEquals(ClientProjectAssignmentAudit.ACTION_REMOVED, log.getAction());
        assertEquals("Dana Whitfield", log.getEmployeeName());
        assertEquals("Atlas Migration", log.getProjectName());
        assertEquals("Admin3", log.getPerformedByName());
        assertNotNull(log.getPerformedAt());
    }

    @Test
    void reAddingRecordsItAsItsOwnEvent() {
        assignment.setActive(false);

        service.reactivate(ASSIGNMENT_ID, ADMIN_USER_ID);

        ClientProjectAssignmentAudit log = captureOneAudit();
        assertEquals(ClientProjectAssignmentAudit.ACTION_REASSIGNED, log.getAction());
        assertEquals("Dana Whitfield", log.getEmployeeName());
        assertEquals("Admin3", log.getPerformedByName());
    }

    /**
     * The case that decided the design: remove → re-add → remove leaves three separate rows.
     * Columns on the assignment would have kept only the last of them.
     */
    @Test
    void aFullRemoveReAddRemoveCycleLeavesEveryStep() {
        service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID);
        assignment.setActive(false);
        service.reactivate(ASSIGNMENT_ID, ADMIN_USER_ID);
        service.deactivate(ASSIGNMENT_ID, ADMIN_USER_ID);

        ArgumentCaptor<ClientProjectAssignmentAudit> captor =
                ArgumentCaptor.forClass(ClientProjectAssignmentAudit.class);
        verify(auditRepository, times(3)).save(captor.capture());

        assertEquals(
                List.of(ClientProjectAssignmentAudit.ACTION_REMOVED,
                        ClientProjectAssignmentAudit.ACTION_REASSIGNED,
                        ClientProjectAssignmentAudit.ACTION_REMOVED),
                captor.getAllValues().stream().map(ClientProjectAssignmentAudit::getAction).toList());
    }

    /** One assign action over several employees leaves one row each, not one for the batch. */
    @Test
    void aBatchAssignmentLogsEveryEmployee() {
        Employee second = new Employee();
        second.setId(8L);
        second.setFirstName("Rory");
        second.setLastName("Vance");
        second.setActive(true);
        second.setUser(employee.getUser());
        when(employeeRepository.findById(8L)).thenReturn(Optional.of(second));

        ClientProjectAssignmentDTO dto = payload();
        dto.setEmployeeIds(List.of(EMP_ID, 8L));
        service.create(dto, ADMIN_USER_ID);

        verify(auditRepository, times(2)).save(any(ClientProjectAssignmentAudit.class));
    }

    // ── Robustness ───────────────────────────────────────────────────────────

    /**
     * The log records what happened; it does not get a veto over it. An audit write that blew
     * up must not roll back a completed assignment.
     */
    @Test
    void aFailingAuditWriteDoesNotFailTheAssignment() {
        when(auditRepository.save(any(ClientProjectAssignmentAudit.class)))
                .thenThrow(new RuntimeException("audit table unavailable"));

        assertDoesNotThrow(() -> service.create(payload(), ADMIN_USER_ID));
        verify(assignmentRepository).save(any(ClientProjectAssignment.class));
    }

    /** An action with no resolvable session is still recorded, just without a name. */
    @Test
    void anActionWithNoActingUserIsStillLogged() {
        service.deactivate(ASSIGNMENT_ID, null);

        ClientProjectAssignmentAudit log = captureOneAudit();
        assertEquals(ClientProjectAssignmentAudit.ACTION_REMOVED, log.getAction());
        assertNull(log.getPerformedByName());
        assertNull(log.getPerformedById());
    }

    // ── Read side ────────────────────────────────────────────────────────────

    @Test
    void theLogIsReadNewestFirstAndMapsEveryColumn() {
        ClientProjectAssignmentAudit row = new ClientProjectAssignmentAudit();
        row.setId(9L);
        row.setAction(ClientProjectAssignmentAudit.ACTION_ASSIGNED);
        row.setEmployeeName("Dana Whitfield");
        row.setProjectName("Atlas Migration");
        row.setProjectId("PRJ-1");
        row.setPerformedByName("Admin3");
        row.setPerformedAt(java.time.LocalDateTime.of(2026, 8, 9, 14, 30));
        when(auditRepository.findAllByOrderByPerformedAtDescIdDesc()).thenReturn(List.of(row));

        List<ClientProjectAssignmentAuditDTO> log = service.getAuditLog();

        assertEquals(1, log.size());
        assertEquals("Dana Whitfield", log.get(0).getEmployeeName());
        assertEquals("Atlas Migration", log.get(0).getProjectName());
        assertEquals("Admin3", log.get(0).getPerformedByName());
        assertEquals(ClientProjectAssignmentAudit.ACTION_ASSIGNED, log.get(0).getAction());
        assertNotNull(log.get(0).getPerformedAt());
        // The ordering is the repository's, so the service must not re-sort and undo it.
        verify(auditRepository).findAllByOrderByPerformedAtDescIdDesc();
    }
}
