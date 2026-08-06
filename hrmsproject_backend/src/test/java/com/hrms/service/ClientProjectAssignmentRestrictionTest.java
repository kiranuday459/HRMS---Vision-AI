package com.hrms.service;

import com.hrms.dto.ClientProjectAssignmentDTO;
import com.hrms.model.ClientProjectAssignment;
import com.hrms.model.Employee;
import com.hrms.model.Role;
import com.hrms.model.User;
import com.hrms.repository.ClientProjectAssignmentRepository;
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
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Who may be assigned to a client project.
 *
 * The picker filters these three cases out, but the filter is a convenience — a direct API
 * call, a stale modal, or two admins submitting at once all reach the service. These tests
 * cover the service-side rule that actually enforces it.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ClientProjectAssignmentRestrictionTest {

    @Mock private ClientProjectAssignmentRepository assignmentRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private UserRepository userRepository;
    @Mock private ClientVerificationService clientVerificationService;
    @Mock private ClientTimesheetNotificationService notificationService;
    @Mock private UserDisplayNameResolver userDisplayNameResolver;

    @InjectMocks private ClientProjectAssignmentService service;

    private static final Long EMP_ID = 7L;

    private Employee employee;

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

        when(employeeRepository.findById(EMP_ID)).thenReturn(Optional.of(employee));
        when(assignmentRepository.findByEmployeeIdAndActiveTrue(anyLong())).thenReturn(Collections.emptyList());
        when(assignmentRepository.save(any(ClientProjectAssignment.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    private ClientProjectAssignmentDTO payload() {
        ClientProjectAssignmentDTO dto = new ClientProjectAssignmentDTO();
        dto.setEmployeeIds(List.of(EMP_ID));
        dto.setAssignmentStartDate(LocalDate.of(2026, 8, 1));
        dto.setClientName("Globex");
        dto.setProjectName("Project B");
        dto.setProjectId("P-B");
        return dto;
    }

    private ResponseStatusException assertRejected() {
        return assertThrows(ResponseStatusException.class, () -> service.create(payload(), null));
    }

    /** Nothing may be written when the request is rejected — that is the whole point. */
    private void assertNothingPersisted() {
        verify(assignmentRepository, never()).save(any());
        verify(clientVerificationService, never()).issueAndSendOtp(any());
    }

    @Test
    void assignsAnActiveEmployeeWithNoCurrentProject() {
        assertDoesNotThrow(() -> service.create(payload(), null));
        verify(assignmentRepository, times(1)).save(any(ClientProjectAssignment.class));
    }

    @Test
    void rejectsAnEmployeeAlreadyOnAnotherProject() {
        ClientProjectAssignment existing = new ClientProjectAssignment();
        existing.setProjectName("Project A");
        existing.setActive(true);
        when(assignmentRepository.findByEmployeeIdAndActiveTrue(EMP_ID)).thenReturn(List.of(existing));

        ResponseStatusException ex = assertRejected();

        // 409, not 400 — this is the branch a second racing request lands in.
        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Dana Whitfield"), ex.getReason());
        assertTrue(ex.getReason().contains("Project A"), "should name the project they are on: " + ex.getReason());
        assertNothingPersisted();
    }

    @Test
    void rejectsAnHrUser() {
        employee.getUser().setRole(Role.HR);

        ResponseStatusException ex = assertRejected();

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("HR"), ex.getReason());
        assertNothingPersisted();
    }

    @Test
    void rejectsAnAdminUser() {
        employee.getUser().setRole(Role.ADMIN);

        ResponseStatusException ex = assertRejected();

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertNothingPersisted();
    }

    @Test
    void allowsAReportingManager() {
        employee.getUser().setRole(Role.REPORTING_MANAGER);
        assertDoesNotThrow(() -> service.create(payload(), null));
        verify(assignmentRepository, times(1)).save(any(ClientProjectAssignment.class));
    }

    @Test
    void rejectsAnEmployeeDisabledInHrms() {
        employee.setActive(false);

        ResponseStatusException ex = assertRejected();

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().toLowerCase().contains("disabled"), ex.getReason());
        assertNothingPersisted();
    }

    /**
     * An ended assignment must free the employee up again — the rule is one *active* project,
     * not one ever. findByEmployeeIdAndActiveTrue returning empty is exactly that state.
     */
    @Test
    void allowsReassignmentOnceThePreviousAssignmentHasEnded() {
        when(assignmentRepository.findByEmployeeIdAndActiveTrue(EMP_ID)).thenReturn(Collections.emptyList());
        assertDoesNotThrow(() -> service.create(payload(), null));
        verify(assignmentRepository, times(1)).save(any(ClientProjectAssignment.class));
    }
}
