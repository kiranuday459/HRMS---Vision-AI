package com.hrms.service;

import com.hrms.dto.AssignmentRemovalEligibilityDTO;
import com.hrms.dto.ClientProjectAssignmentAuditDTO;
import com.hrms.dto.ClientProjectAssignmentDTO;
import com.hrms.model.ClientProjectAssignment;
import com.hrms.model.ClientProjectAssignmentAudit;
import com.hrms.model.ClientTimesheet;
import com.hrms.model.ClientTimesheetStatus;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Manages client/project assignments. Independent of the internal timesheets feature.
 */
@Service
@Transactional
public class ClientProjectAssignmentService {

    /**
     * Timesheet statuses that still have somewhere to go, and therefore block removing the
     * employee from the project. PENDING is waiting on the admin; REJECTED is waiting on the
     * employee to correct and resubmit. APPROVED is done, and DRAFT / NOT_STARTED were never
     * submitted at all.
     */
    private static final List<ClientTimesheetStatus> UNSETTLED_STATUSES =
            List.of(ClientTimesheetStatus.PENDING, ClientTimesheetStatus.REJECTED);

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

    // Read-only here, and only for the removal guard: an assignment cannot be closed out while
    // one of its weeks is still sitting in the admin's approval queue.
    @Autowired
    private ClientTimesheetRepository lineRepository;

    // Carries the official employment start date. Read-only here, for the joining-date guard.
    @Autowired
    private CompanyDetailRepository companyDetailRepository;

    // Append-only staffing history behind the admin's Audit Logs tab.
    @Autowired
    private ClientProjectAssignmentAuditRepository auditRepository;

    /**
     * Appends one row to the staffing history.
     *
     * Swallows its own failures deliberately: the log is a record of what happened, not a
     * precondition for it happening. An audit write that blew up would otherwise roll back a
     * completed assignment and leave the admin looking at an error for an action that was
     * fine.
     */
    private void recordAudit(String action, ClientProjectAssignment a, Long performedByUserId) {
        try {
            ClientProjectAssignmentAudit log = new ClientProjectAssignmentAudit();
            log.setAction(action);
            log.setAssignmentId(a.getId());
            if (a.getEmployee() != null) {
                log.setEmployeeId(a.getEmployee().getId());
                log.setEmployeeName(displayName(a.getEmployee()));
            }
            log.setClientName(a.getClientName());
            log.setProjectId(a.getProjectId());
            log.setProjectName(a.getProjectName());
            log.setPerformedById(performedByUserId);
            if (performedByUserId != null) {
                userRepository.findById(performedByUserId)
                        .ifPresent(u -> log.setPerformedByName(userDisplayNameResolver.resolve(u)));
            }
            log.setPerformedAt(LocalDateTime.now());
            auditRepository.save(log);
        } catch (Exception e) {
            System.err.println("[AssignmentAudit] could not record " + action + ": " + e.getMessage());
        }
    }

    /** The staffing history, newest first. Read-only — the tab that shows it never writes. */
    public List<ClientProjectAssignmentAuditDTO> getAuditLog() {
        return auditRepository.findAllByOrderByPerformedAtDescIdDesc().stream()
                .map(a -> {
                    ClientProjectAssignmentAuditDTO dto = new ClientProjectAssignmentAuditDTO();
                    dto.setId(a.getId());
                    dto.setAssignmentId(a.getAssignmentId());
                    dto.setEmployeeId(a.getEmployeeId());
                    dto.setEmployeeName(a.getEmployeeName());
                    dto.setClientName(a.getClientName());
                    dto.setProjectId(a.getProjectId());
                    dto.setProjectName(a.getProjectName());
                    dto.setAction(a.getAction());
                    dto.setPerformedByName(a.getPerformedByName());
                    dto.setPerformedAt(a.getPerformedAt());
                    return dto;
                })
                .collect(Collectors.toList());
    }

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
            requireOnOrAfterJoiningDate(employee, dto.getAssignmentStartDate());

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

            ClientProjectAssignment saved = assignmentRepository.save(a);
            created.add(toDTO(saved));
            recordAudit(ClientProjectAssignmentAudit.ACTION_ASSIGNED, saved, createdByUserId);

            grantAccess(employee, dto.getProjectName(), dto.getProjectId(), dto.getAssignmentStartDate());

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

    /**
     * The employee's official employment start date in HRMS, or null when it was never
     * recorded. CompanyDetail.joiningDate is the field HR fills in and the one the timesheet
     * and leave-balance rules already key off; Employee.hireDate is the older column and only
     * stands in when there is no company detail row, which is how the frontend reads it too.
     */
    private LocalDate joiningDateOf(Employee employee) {
        LocalDate joining = companyDetailRepository.findByEmployee_Id(employee.getId())
                .map(CompanyDetail::getJoiningDate)
                .orElse(null);
        return joining != null ? joining : employee.getHireDate();
    }

    /**
     * An employee cannot be put on a client project before they joined the company — the
     * assignment start date is what opens their Client Timesheet weeks, so a date before
     * joining would let them log client hours for time they were not employed.
     *
     * Null joining date is allowed through rather than rejected: it means HR never recorded
     * one, and blocking every such employee from being assigned would be a far larger change
     * than this rule. Mirrors the frontend cap in AssignEmployeeToClientProjectModal, which is
     * the convenience — this is the rule.
     */
    private void requireOnOrAfterJoiningDate(Employee employee, LocalDate assignmentStartDate) {
        if (assignmentStartDate == null) {
            return; // already rejected by the caller
        }
        LocalDate joining = joiningDateOf(employee);
        if (joining != null && assignmentStartDate.isBefore(joining)) {
            // Names the employee and the date: the admin assigns in batches, so "one of these
            // 12 joined later than that" would not say which to fix.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Client project assignment date cannot be earlier than the employee's joining date in VisionAI HRMS. "
                            + displayName(employee) + " joined on " + joining + ".");
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
     * Grants Client Timesheet access for an assignment the employee now holds.
     *
     * Shared by create() and reactivate() so a re-add lands the employee in exactly the state
     * a fresh assignment would: the current project mirrored onto the employee row (the app
     * appends it after their name in several places), access on, and verification off with a
     * fresh OTP — access always costs one verification, however it was granted.
     */
    private void grantAccess(Employee employee, String projectName, String projectId, LocalDate startDate) {
        employee.setClientProject(projectName);
        employee.setClientProjectId(projectId);
        employee.setClientAssignmentDate(startDate);
        employee.setClientAssigned(true);
        employee.setClientVerified(false);
        employeeRepository.save(employee);

        // Generate + email the activation OTP. Best-effort email inside the service —
        // never fails the assignment if mail delivery is unavailable.
        clientVerificationService.issueAndSendOtp(employee);
    }

    /**
     * Ends an assignment and, with it, the employee's Client Timesheet access.
     *
     * The row survives (active = false) so the Assigned Members tab keeps a record of who was
     * on what and the assignment can be restored later. What does not survive is access:
     * clearing clientAssigned is what actually revokes it, because the sidebar entry, the
     * dashboard activation banner, the route guard and /access-status all read that one flag.
     * Leaving it set was the bug — ending an assignment used to flip the badge to Ended while
     * the employee kept their Client Timesheet exactly as before.
     *
     * Verification is dropped and any unredeemed OTP is wiped, so an activation code that was
     * already in the employee's inbox cannot be used to walk back in after removal.
     *
     * Submitted weeks are deliberately untouched. Removal blocks new entry; it does not erase
     * history, which the admin still needs for review and billing.
     */
    public ClientProjectAssignmentDTO deactivate(Long id, Long performedByUserId) {
        ClientProjectAssignment a = assignmentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Assignment not found: " + id));
        requireNothingAwaitingApproval(a);
        a.setActive(false);
        ClientProjectAssignment saved = assignmentRepository.save(a);
        ClientProjectAssignmentDTO dto = toDTO(saved);
        recordAudit(ClientProjectAssignmentAudit.ACTION_REMOVED, saved, performedByUserId);
        revokeAccessIfUnassigned(a.getEmployee());
        return dto;
    }

    /**
     * Week starts still awaiting an approve/reject decision on this assignment's project.
     *
     * PENDING and REJECTED both count. Approved is settled; Draft and Not Started were never
     * submitted and are the employee's own to abandon.
     *
     * Rejected is here because it is not the end of the story — it is the admin asking for a
     * correction, and the week is expected back. Removing the employee mid-correction strands a
     * week that was already submitted once: they lose access to the project they would have to
     * fix it under, and it never returns to the queue. So the rule is "nothing still in flight",
     * not "nothing awaiting a first decision".
     */
    private List<LocalDate> weeksAwaitingApproval(ClientProjectAssignment a) {
        if (a.getEmployee() == null) {
            return Collections.emptyList();
        }
        Long employeeId = a.getEmployee().getId();
        String projectId = a.getProjectId();

        // Scoped to this assignment's project where there is one to scope by. projectId is the
        // assignment's own key and the value the entry page copies onto every project line, so
        // it is what ties a week to this assignment; time-off lines carry none and drop out,
        // which is right — pending leave is not work on this project. With no project id to
        // match on the check widens to every project, because blocking on a pending week beats
        // silently removing someone who has one.
        List<ClientTimesheet> pendingLines = (projectId == null || projectId.isBlank())
                ? lineRepository.findByEmployeeIdAndStatusIn(employeeId, UNSETTLED_STATUSES)
                : lineRepository.findByEmployeeIdAndStatusInAndProjectId(
                        employeeId, UNSETTLED_STATUSES, projectId);

        // Distinct weeks, because a week is what the admin queue lists and reviews as one
        // "timesheet". Counting line rows would report a normal five-day week as five pending
        // items and send the admin looking for four that do not exist.
        return pendingLines.stream()
                .map(ClientTimesheet::getWeekStartDate)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .collect(Collectors.toList());
    }

    /**
     * Reports whether an assignment can be removed, for the admin tab to check before it opens
     * its confirmation dialog — a blocked removal should be explained instead of confirmed and
     * then refused.
     */
    public AssignmentRemovalEligibilityDTO removalEligibility(Long id) {
        ClientProjectAssignment a = assignmentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Assignment not found: " + id));
        List<LocalDate> pending = weeksAwaitingApproval(a);
        return new AssignmentRemovalEligibilityDTO(
                pending.isEmpty(), pending,
                a.getEmployee() != null ? a.getEmployee().getId() : null,
                a.getEmployee() != null ? displayName(a.getEmployee()) : null,
                a.getProjectName());
    }

    /**
     * The rule itself, re-checked at the point of removal. The tab's pre-check is what makes
     * the block explainable; this is what makes it a rule — a direct API call, a stale tab left
     * open before the employee submitted, or two admins working at once all arrive here.
     */
    private void requireNothingAwaitingApproval(ClientProjectAssignment a) {
        List<LocalDate> pending = weeksAwaitingApproval(a);
        if (pending.isEmpty()) {
            return;
        }
        String who = a.getEmployee() != null ? displayName(a.getEmployee()) : "This employee";
        String project = (a.getProjectName() == null || a.getProjectName().isBlank())
                ? "this project" : a.getProjectName();
        // 409: the request is well formed, the state is not ready for it.
        boolean one = pending.size() == 1;
        throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Can't remove " + who + " from " + project + " — they have " + pending.size()
                        + (one ? " timesheet" : " timesheets")
                        + " still open (pending approval or rejected and not yet resubmitted). "
                        + "Please see " + (one ? "it" : "them") + " through to approved first.");
    }

    /**
     * Puts a removed assignment back and restores access.
     *
     * Runs requireAssignable first, so re-adding is held to the same rules as a fresh
     * assignment — the employee must still be active in HRMS, still hold an assignable role,
     * and must not have been given another project in the meantime. That last one is the case
     * that makes this more than a flag flip: reactivating blindly would put an employee on two
     * active projects and break the one-project rule from the other direction.
     */
    public ClientProjectAssignmentDTO reactivate(Long id, Long performedByUserId) {
        ClientProjectAssignment a = assignmentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Assignment not found: " + id));
        if (Boolean.TRUE.equals(a.getActive())) {
            return toDTO(a); // already active — nothing to restore
        }
        Employee employee = a.getEmployee();
        if (employee == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This assignment has no employee on it and cannot be restored.");
        }
        requireAssignable(employee);

        a.setActive(true);
        ClientProjectAssignment saved = assignmentRepository.save(a);
        ClientProjectAssignmentDTO dto = toDTO(saved);
        recordAudit(ClientProjectAssignmentAudit.ACTION_REASSIGNED, saved, performedByUserId);

        grantAccess(employee, a.getProjectName(), a.getProjectId(), a.getAssignmentStartDate());
        notificationService.notifyEmployeeProjectAssigned(
                employee, a.getProjectName(), a.getAssignmentStartDate());
        return dto;
    }

    /**
     * Takes Client Timesheet access away once an employee holds no active assignment at all.
     *
     * Guarded on the remaining count rather than assumed: the one-project rule means there is
     * normally nothing left, but a legacy row carrying two active assignments must not lose
     * access to the one that is still live.
     */
    private void revokeAccessIfUnassigned(Employee employee) {
        if (employee == null) {
            return;
        }
        if (!assignmentRepository.findByEmployeeIdAndActiveTrue(employee.getId()).isEmpty()) {
            return;
        }
        employee.setClientAssigned(false);
        employee.setClientVerified(false);
        employee.setClientProject(null);
        employee.setClientProjectId(null);
        employee.setClientAssignmentDate(null);
        employee.setClientOtp(null);
        employee.setClientOtpExpiry(null);
        employeeRepository.save(employee);
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
