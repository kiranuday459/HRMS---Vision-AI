package com.hrms.service;

import com.hrms.dto.ClientProjectAssignmentDTO;
import com.hrms.model.ClientProjectAssignment;
import com.hrms.model.Employee;
import com.hrms.model.Role;
import com.hrms.model.User;
import com.hrms.repository.ClientProjectAssignmentRepository;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Manages client/project assignments. Independent of the internal timesheets feature.
 */
@Service
@Transactional
public class ClientProjectAssignmentService {

    @Autowired
    private ClientProjectAssignmentRepository assignmentRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ClientVerificationService clientVerificationService;

    @Autowired
    private ClientTimesheetNotificationService notificationService;

    @Autowired
    private UserDisplayNameResolver userDisplayNameResolver;

    // Agreed field character limits, enforced server-side so a direct API call can't get
    // past the admin modal's maxLength. Mirrored in the frontend by utils/fieldLimits.js.
    private static final int MAX_PROJECT_ID = 25;
    private static final int MAX_PROJECT_NAME = 50;
    private static final int MAX_TASK_ID = 25;
    private static final int MAX_TASK_DESCRIPTION = 256;

    private void requireMaxLength(String value, int max, String fieldLabel) {
        if (value != null && value.length() > max) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    fieldLabel + " must be " + max + " characters or fewer (currently " + value.length() + ").");
        }
    }

    /**
     * Creates one assignment per employee in the payload (the admin modal assigns one
     * client/project to a set of employees). Returns the created assignments.
     */
    public List<ClientProjectAssignmentDTO> create(ClientProjectAssignmentDTO dto, Long createdByUserId) {
        List<Long> employeeIds = new ArrayList<>();
        if (dto.getEmployeeIds() != null) {
            employeeIds.addAll(dto.getEmployeeIds());
        }
        if (dto.getEmployeeId() != null && !employeeIds.contains(dto.getEmployeeId())) {
            employeeIds.add(dto.getEmployeeId());
        }
        if (employeeIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one employee is required");
        }
        if (dto.getAssignmentStartDate() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "assignmentStartDate is required");
        }
        // The assignment is where Project ID/Name enter the system — the timesheet only ever
        // copies them — so the limits have to be enforced at this door too, not just on save.
        requireMaxLength(dto.getProjectId(), MAX_PROJECT_ID, "Project ID");
        requireMaxLength(dto.getProjectName(), MAX_PROJECT_NAME, "Project Name");
        requireMaxLength(dto.getTaskId(), MAX_TASK_ID, "Task/Activity ID");
        requireMaxLength(dto.getTaskDescription(), MAX_TASK_DESCRIPTION, "Task/Activity Description");

        User assignedBy = createdByUserId != null
                ? userRepository.findById(createdByUserId).orElse(null)
                : null;

        List<ClientProjectAssignmentDTO> created = new ArrayList<>();
        for (Long employeeId : employeeIds) {
            Employee employee = employeeRepository.findById(employeeId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Employee not found: " + employeeId));

            // The picker already filters these out; re-checking here is what makes it a rule
            // rather than a UI convenience. A direct API call, a stale modal left open while
            // someone else assigns, or two admins submitting at once all land here.
            requireAssignable(employee);

            ClientProjectAssignment a = new ClientProjectAssignment();
            a.setEmployee(employee);
            a.setClientName(dto.getClientName());
            a.setProjectId(dto.getProjectId());
            a.setProjectName(dto.getProjectName());
            a.setTaskId(dto.getTaskId());
            a.setTaskDescription(dto.getTaskDescription());
            a.setOnsiteOffshore(dto.getOnsiteOffshore() != null ? dto.getOnsiteOffshore() : "ONSITE");
            a.setClientBillable(dto.getClientBillable() != null ? dto.getClientBillable() : "BILLABLE");
            a.setBillingLocation(dto.getBillingLocation() != null ? dto.getBillingLocation() : null);
            a.setAssignmentStartDate(dto.getAssignmentStartDate());
            a.setActive(true);
            a.setAssignedBy(assignedBy);

            created.add(toDTO(assignmentRepository.save(a)));

            // Mirror the current (latest) assignment onto the employee record so the
            // project name can be appended after the employee's name across the app.
            employee.setClientProject(dto.getProjectName());
            employee.setClientProjectId(dto.getProjectId());
            employee.setClientAssignmentDate(dto.getAssignmentStartDate());
            employee.setClientAssigned(true);
            // A (re)assignment always requires (re)verification: reset verified and issue a
            // fresh activation OTP (hashed + 15-min expiry) that is emailed to the employee.
            employee.setClientVerified(false);
            employeeRepository.save(employee);

            // Generate + email the activation OTP. Best-effort email inside the service —
            // never fails the assignment if mail delivery is unavailable.
            clientVerificationService.issueAndSendOtp(employee);

            // Side effect only: surface the assignment in the employee's Client Timesheet
            // bell. Swallows its own failures, so it cannot fail the assignment.
            notificationService.notifyEmployeeProjectAssigned(
                    employee, dto.getProjectName(), dto.getAssignmentStartDate());
        }
        return created;
    }

    /** Roles that may hold a client project assignment. Admins and HR never do. */
    private static final Set<Role> ASSIGNABLE_ROLES = EnumSet.of(Role.EMPLOYEE, Role.REPORTING_MANAGER);

    private String displayName(Employee e) {
        return (e.getFirstName() + " " + (e.getLastName() == null ? "" : e.getLastName())).trim();
    }

    /**
     * Guards the three ways an employee can be ineligible for a new client project
     * assignment. Each throws with a message naming the employee, because the admin assigns
     * in batches — "one of these 12 people is already assigned" would be useless.
     *
     * Ordering matters only for which message wins; all three are hard rejections.
     */
    private void requireAssignable(Employee employee) {
        Role role = employee.getUser() != null ? employee.getUser().getRole() : null;
        if (role != null && !ASSIGNABLE_ROLES.contains(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    displayName(employee) + " has the " + role.name()
                            + " role and cannot be assigned to a client project.");
        }
        if (Boolean.FALSE.equals(employee.getActive())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    displayName(employee) + " is disabled in HRMS and cannot be assigned to a client project.");
        }
        // One active project per employee. Checked against the assignments table rather than
        // employee.clientAssigned so an ended assignment frees the employee up again.
        List<ClientProjectAssignment> active = assignmentRepository.findByEmployeeIdAndActiveTrue(employee.getId());
        if (!active.isEmpty()) {
            String current = active.get(0).getProjectName();
            // 409, not 400: nothing is wrong with the request — the world changed under it.
            // This is the branch a second racing assign request lands in.
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    displayName(employee) + " is already assigned to "
                            + (current == null || current.isBlank() ? "a client project" : current)
                            + ". End that assignment before assigning a new one.");
        }
    }

    public List<ClientProjectAssignmentDTO> getActiveForEmployee(Long employeeId) {
        return assignmentRepository.findByEmployeeIdAndActiveTrue(employeeId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<ClientProjectAssignmentDTO> getAll() {
        return assignmentRepository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    /**
     * Earliest active assignment start date for an employee — the global gate for their
     * Client Timesheet summary. Null when the employee has no active assignment.
     */
    public LocalDate earliestAssignmentDate(Long employeeId) {
        return assignmentRepository.findByEmployeeIdAndActiveTrue(employeeId).stream()
                .map(ClientProjectAssignment::getAssignmentStartDate)
                .filter(d -> d != null)
                .min(LocalDate::compareTo)
                .orElse(null);
    }

    /**
     * Marks an assignment as inactive (Ended). Does not delete the row so history
     * is preserved. Used by the admin Assigned Members tab remove action.
     */
    public ClientProjectAssignmentDTO deactivate(Long id) {
        ClientProjectAssignment a = assignmentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Assignment not found: " + id));
        a.setActive(false);
        return toDTO(assignmentRepository.save(a));
    }

    private ClientProjectAssignmentDTO toDTO(ClientProjectAssignment a) {
        ClientProjectAssignmentDTO dto = new ClientProjectAssignmentDTO();
        dto.setId(a.getId());
        if (a.getEmployee() != null) {
            dto.setEmployeeId(a.getEmployee().getId());
            dto.setEmployeeName(displayName(a.getEmployee()));
            // Null-safe: the column defaults to true, but older rows may predate it.
            dto.setEmployeeActive(!Boolean.FALSE.equals(a.getEmployee().getActive()));
        }
        dto.setClientName(a.getClientName());
        dto.setProjectId(a.getProjectId());
        dto.setProjectName(a.getProjectName());
        dto.setTaskId(a.getTaskId());
        dto.setTaskDescription(a.getTaskDescription());
        dto.setOnsiteOffshore(a.getOnsiteOffshore());
        dto.setClientBillable(a.getClientBillable());
        dto.setBillingLocation(a.getBillingLocation());
        dto.setAssignmentStartDate(a.getAssignmentStartDate());
        dto.setActive(a.getActive());
        dto.setAssignedByName(userDisplayNameResolver.resolve(a.getAssignedBy()));
        dto.setCreatedAt(a.getCreatedAt() != null ? a.getCreatedAt().toString() : null);
        return dto;
    }
}
