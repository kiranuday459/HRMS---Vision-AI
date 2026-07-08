package com.hrms.service;

import com.hrms.dto.TimesheetDTO;
import com.hrms.model.Employee;
import com.hrms.model.Timesheet;
import com.hrms.model.TimesheetStatus;
import com.hrms.model.User;
import com.hrms.model.Role;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.TimesheetRepository;
import com.hrms.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.hrms.repository.EmployeeReportingRepository;
import com.hrms.model.EmployeeReporting;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Duration;
import java.util.List;
import java.util.stream.Collectors;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

@Service
@Transactional
public class TimesheetService {

    @Autowired
    private TimesheetRepository timesheetRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmployeeReportingRepository employeeReportingRepository;

    @Autowired
    private NotificationService notificationService;

    @PersistenceContext
    private EntityManager entityManager;

    public List<TimesheetDTO> getAllTimesheets(Long employeeId, Long excludeUserId, LocalDate fromDate, LocalDate toDate,
            String status, Integer page, Integer size) {
        TimesheetStatus statusEnum = status != null ? TimesheetStatus.valueOf(status.toUpperCase()) : null;

        List<Timesheet> timesheets;
        if (employeeId != null || excludeUserId != null || fromDate != null || toDate != null || statusEnum != null) {
            timesheets = timesheetRepository.findWithFilters(employeeId, excludeUserId, fromDate, toDate, statusEnum);
        } else {
            timesheets = timesheetRepository.findAll();
        }

        return timesheets.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public TimesheetDTO getTimesheetById(Long id) {
        Timesheet timesheet = timesheetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Timesheet not found"));
        return convertToDTO(timesheet);
    }

    public TimesheetDTO createTimesheet(TimesheetDTO dto) {
        Employee employee = employeeRepository.findById(dto.getEmployeeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        Timesheet timesheet = new Timesheet();
        timesheet.setEmployee(employee);
        timesheet.setDate(dto.getDate());
        timesheet.setStartTime(dto.getStartTime());
        timesheet.setEndTime(dto.getEndTime());
        timesheet.setProject(dto.getProject());
        timesheet.setTask(dto.getTask());
        timesheet.setNotes(dto.getNotes());

        // Set initial status + route based on the employee's role and their assigned
        // approvers' availability (assigned & active). Handles disabled HR/RM rerouting.
        applyInitialRouting(timesheet, employee);

        timesheet.setOnsiteOffshore(dto.getOnsiteOffshore());
        timesheet.setBillingLocation(dto.getBillingLocation());
        timesheet.setBillable(dto.getBillable());
        timesheet.setProjectName(dto.getProjectName());
        timesheet.setTaskDescription(dto.getTaskDescription());
        timesheet.setCategory(dto.getCategory());
        timesheet.setLeaveType(dto.getLeaveType());

        // Calculate total hours: (EndTime - StartTime)
        if (dto.getStartTime() != null && dto.getEndTime() != null) {
            Duration duration = Duration.between(dto.getStartTime(), dto.getEndTime());
            double total = duration.toMinutes() / 60.0;
            timesheet.setTotalHours(Math.max(0, total));
        }

        Timesheet saved = timesheetRepository.save(timesheet);

        // Notify RM and HR about new timesheet (if not a weekly batch, but weekly is
        // preferred)
        // For individual entries, we might not want to spam. But the user said "new
        // timesheet received".
        // Usually, weekly is what's monitored.

        return convertToDTO(saved);
    }

    public TimesheetDTO updateTimesheet(Long id, TimesheetDTO dto) {
        Timesheet timesheet = timesheetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Timesheet not found"));

        // Check if timesheet is in any pending state
        if (timesheet.getStatus() != TimesheetStatus.PENDING_RM_APPROVAL &&
            timesheet.getStatus() != TimesheetStatus.PENDING_HR_APPROVAL &&
            timesheet.getStatus() != TimesheetStatus.PENDING_RM_AS_HR_APPROVAL &&
            timesheet.getStatus() != TimesheetStatus.PENDING_ADMIN_APPROVAL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only pending timesheets can be updated");
        }

        timesheet.setDate(dto.getDate());
        timesheet.setStartTime(dto.getStartTime());
        timesheet.setEndTime(dto.getEndTime());
        timesheet.setProject(dto.getProject());
        timesheet.setTask(dto.getTask());
        timesheet.setNotes(dto.getNotes());

        timesheet.setOnsiteOffshore(dto.getOnsiteOffshore());
        timesheet.setBillingLocation(dto.getBillingLocation());
        timesheet.setBillable(dto.getBillable());
        timesheet.setProjectName(dto.getProjectName());
        timesheet.setTaskDescription(dto.getTaskDescription());
        timesheet.setCategory(dto.getCategory());
        timesheet.setLeaveType(dto.getLeaveType());

        // Recalculate total hours: (EndTime - StartTime)
        if (dto.getStartTime() != null && dto.getEndTime() != null) {
            Duration duration = Duration.between(dto.getStartTime(), dto.getEndTime());
            double total = duration.toMinutes() / 60.0;
            timesheet.setTotalHours(Math.max(0, total));
        }

        Timesheet updated = timesheetRepository.save(timesheet);
        return convertToDTO(updated);
    }

    public TimesheetDTO approveTimesheet(Long id, Long reviewerId, String comments) {
        Timesheet timesheet = timesheetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Timesheet not found"));

        User reviewer = userRepository.findById(reviewerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reviewer not found"));

        // Check if reviewer can approve this timesheet in its current status
        Role submitterRole = timesheet.getEmployee().getUser() != null ? timesheet.getEmployee().getUser().getRole() : Role.EMPLOYEE;
        if (!canApprove(timesheet.getStatus(), reviewer.getRole(), submitterRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "User with role " + reviewer.getRole() + " cannot approve timesheet in status " + timesheet.getStatus());
        }

        // Record approval based on the CURRENT stage and reviewer role. The RM standing in
        // for a disabled HR acts at PENDING_RM_AS_HR_APPROVAL — record that on the HR-stage
        // fields (not rmApprovedBy, which already holds their RM-stage approval).
        LocalDateTime now = LocalDateTime.now();
        boolean actingAsHrStand = timesheet.getStatus() == TimesheetStatus.PENDING_RM_AS_HR_APPROVAL;
        if (actingAsHrStand) {
            timesheet.setHrStageApprovedBy(reviewer);
            timesheet.setHrStageApprovedByRole(reviewer.getRole().name());
            timesheet.setHrStageApprovedAt(now);
            timesheet.setHrDisabledReroute(true);
        } else {
            switch (reviewer.getRole()) {
                case REPORTING_MANAGER:
                    timesheet.setRmApprovedBy(reviewer);
                    timesheet.setRmApprovedAt(now);
                    break;
                case HR:
                    timesheet.setHrApprovedBy(reviewer);
                    timesheet.setHrApprovedAt(now);
                    break;
                case ADMIN:
                    timesheet.setAdminApprovedBy(reviewer);
                    timesheet.setAdminApprovedAt(now);
                    break;
            }
        }

        // Determine next status. Pass whether the submitter has an HR assigned so the
        // RM → next transition can fall back to Admin when no HR exists.
        boolean submitterHasHr = hasHr(timesheet.getEmployee());
        TimesheetStatus nextStatus = getNextStatusAfterApproval(timesheet.getStatus(), reviewer.getRole(), submitterRole, submitterHasHr, timesheet.getApprovalRoute());
        timesheet.setStatus(nextStatus);

        // For backward compatibility, set the old reviewedBy field for the final approval
        if (nextStatus == TimesheetStatus.APPROVED) {
            timesheet.setReviewedBy(reviewer);
            timesheet.setReviewedAt(now);
        }

        timesheet.setManagerComments(comments);

        Timesheet approved = timesheetRepository.save(timesheet);

        // Notify Employee on a weekly basis
        notifyWeeklyTimesheetStatus(approved, "Approved");

        return convertToDTO(approved);
    }

    private void notifyWeeklyTimesheetStatus(Timesheet entry, String status) {
        if (entry.getEmployee().getUser() == null)
            return;

        LocalDate date = entry.getDate();
        // Calculate week start (Saturday is my week start in this app)
        // DayOfWeek.getValue(): 1(Mon) to 7(Sun)
        // If Mon(1), move back 2 days to Sat. (1+2)=3? No.
        // Sat is 6. Sun is 7.
        // If Sat(6), diff=0. If Sun(7), diff=1. If Mon(1), diff=2.
        // Formula for days to subtract: (dayOfWeek + 1) % 7
        int dayValue = date.getDayOfWeek().getValue();
        int daysToSubtract = (dayValue % 7) + 1;
        if (dayValue == 6)
            daysToSubtract = 0; // Saturday
        else if (dayValue == 7)
            daysToSubtract = 1; // Sunday
        else
            daysToSubtract = dayValue + 1; // Mon=2, Tue=3, etc.

        LocalDate weekStart = date.minusDays(daysToSubtract);
        LocalDate weekEnd = weekStart.plusDays(6);

        String message = "Your timesheet for the week starting " + weekStart + " has been " + status.toLowerCase()
                + ".";

        notificationService.createNotification(
                entry.getEmployee().getUser().getId(),
                "Timesheet " + status,
                message,
                "TIMESHEET",
                null);
    }

    public TimesheetDTO rejectTimesheet(Long id, Long reviewerId, String reason) {
        Timesheet timesheet = timesheetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Timesheet not found"));

        // Check if timesheet is in a rejectable state
        if (timesheet.getStatus() == TimesheetStatus.APPROVED || timesheet.getStatus() == TimesheetStatus.REJECTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Timesheet is already " + timesheet.getStatus());
        }

        User reviewer = userRepository.findById(reviewerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reviewer not found"));

        // Check if reviewer can reject this timesheet
        Role submitterRole = timesheet.getEmployee().getUser() != null ? timesheet.getEmployee().getUser().getRole() : Role.EMPLOYEE;
        if (!canApprove(timesheet.getStatus(), reviewer.getRole(), submitterRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "User with role " + reviewer.getRole() + " cannot reject timesheet in status " + timesheet.getStatus());
        }

        timesheet.setStatus(TimesheetStatus.REJECTED);
        timesheet.setRejectionReason(reason);
        timesheet.setRejectedByRole(reviewer.getRole().name());
        timesheet.setRejectedAt(LocalDateTime.now());

        // For backward compatibility, set the old fields
        timesheet.setManagerComments(reason);
        timesheet.setReviewedBy(reviewer);
        timesheet.setReviewedAt(LocalDateTime.now());

        Timesheet rejected = timesheetRepository.save(timesheet);

        // Notify Employee on a weekly basis
        notifyWeeklyTimesheetStatus(rejected, "Rejected");

        return convertToDTO(rejected);
    }

    public void saveWeeklyTimesheet(Long employeeId, LocalDate weekStart, List<TimesheetDTO> entries) {
        LocalDate weekEnd = weekStart.plusDays(6);

        // Server-side guard (double safety): reject any entry dated after today. Timesheet
        // hours may only be recorded for today and past days; the frontend also locks future
        // day columns. This runs BEFORE the delete so an invalid request cannot wipe data.
        if (entries != null) {
            LocalDate today = LocalDate.now();
            for (TimesheetDTO dto : entries) {
                if (dto.getDate() != null && dto.getDate().isAfter(today)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Cannot enter hours for future date: " + dto.getDate());
                }
            }
        }

        // Bulk DELETE via @Modifying @Query — atomic, reliable, flushes & clears
        // automatically
        timesheetRepository.deleteByEmployeeIdAndDateBetween(employeeId, weekStart, weekEnd);

        System.out.println("[TimesheetService] Deleted existing entries for employeeId=" + employeeId
                + " weekStart=" + weekStart + " weekEnd=" + weekEnd);
        System.out.println("[TimesheetService] Incoming entries count: " + (entries != null ? entries.size() : 0));

        if (entries != null && !entries.isEmpty()) {
            Employee employee = employeeRepository.findById(employeeId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

            int savedCount = 0;
            for (TimesheetDTO dto : entries) {
                try {
                    Timesheet timesheet = new Timesheet();
                    timesheet.setEmployee(employee);
                    timesheet.setDate(dto.getDate());
                    timesheet.setStartTime(dto.getStartTime());
                    timesheet.setEndTime(dto.getEndTime());
                    timesheet.setProject(dto.getProject());
                    timesheet.setTask(dto.getTask());
                    timesheet.setNotes(dto.getNotes());

                    // Set initial status + route (handles disabled HR/RM rerouting).
                    applyInitialRouting(timesheet, employee);

                    timesheet.setOnsiteOffshore(dto.getOnsiteOffshore());
                    timesheet.setBillingLocation(dto.getBillingLocation());
                    timesheet.setBillable(dto.getBillable());
                    timesheet.setProjectName(dto.getProjectName());
                    timesheet.setTaskDescription(dto.getTaskDescription());
                    timesheet.setCategory(dto.getCategory());
                    timesheet.setLeaveType(dto.getLeaveType());
                    // Use totalHours directly from DTO; only compute from times if not provided
                    if (dto.getTotalHours() != null && dto.getTotalHours() > 0) {
                        timesheet.setTotalHours(dto.getTotalHours());
                    } else if (dto.getStartTime() != null && dto.getEndTime() != null) {
                        Duration duration = Duration.between(dto.getStartTime(), dto.getEndTime());
                        timesheet.setTotalHours(Math.max(0, duration.toMinutes() / 60.0));
                    }
                    timesheetRepository.save(timesheet);
                    savedCount++;
                    System.out.println("[TimesheetService] Saved entry #" + savedCount
                            + " date=" + dto.getDate() + " hours=" + dto.getTotalHours()
                            + " category=" + dto.getCategory());
                } catch (Exception e) {
                    System.err.println("[TimesheetService] FAILED to save entry date=" + dto.getDate()
                            + " hours=" + dto.getTotalHours() + " error=" + e.getMessage());
                    throw e; // re-throw so transaction rolls back fully
                }
            }
            System.out.println("[TimesheetService] Total saved: " + savedCount + " entries");

            // Send notification after all rows are saved
            sendWeeklyTimesheetNotification(employeeId, weekStart);
        }
    }

    private void sendWeeklyTimesheetNotification(Long employeeId, LocalDate weekStart) {
        try {
            Employee employee = employeeRepository.findById(employeeId).orElse(null);
            if (employee == null)
                return;

            String employeeName = employee.getFirstName() + " " + employee.getLastName();
            String message = employeeName + " has submitted a weekly timesheet starting from " + weekStart + ".";

            System.out.println("[Notification] Sending timesheet notification for: " + employeeName);

            // Fallback: try both lookup methods
            EmployeeReporting reporting = employeeReportingRepository.findByEmployee(employee)
                    .orElseGet(() -> employeeReportingRepository.findByEmployee_Id(employeeId).orElse(null));

            System.out.println("[Notification] EmployeeReporting found: " + (reporting != null));

            // Notify RM
            if (reporting != null && reporting.getReportingManager() != null) {
                Employee rm = reporting.getReportingManager();
                System.out.println("[Notification] RM: " + rm.getFirstName() + ", User: "
                        + (rm.getUser() != null ? rm.getUser().getId() : "NULL"));
                if (rm.getUser() != null) {
                    notificationService.createNotification(
                            rm.getUser().getId(),
                            "New Timesheet Submission",
                            message,
                            "TIMESHEET",
                            null);
                    System.out.println("[Notification] ✓ Notified RM userId=" + rm.getUser().getId());
                }
            } else {
                System.out.println("[Notification] ⚠ No reporting manager found for: " + employeeName);
            }

            // Notify HR - Only if the employee is a Reporting Manager (HR monitors
            // managers)
            if (employee.getUser() != null && employee.getUser().getRole() == com.hrms.model.Role.REPORTING_MANAGER) {
                List<User> hrUsers = userRepository.findByRole(com.hrms.model.Role.HR);
                System.out.println("[Notification] HR users count: " + hrUsers.size());
                for (User hr : hrUsers) {
                    notificationService.createNotification(hr.getId(), "New Timesheet Submission", message, "TIMESHEET",
                            null);
                    System.out.println("[Notification] ✓ Notified HR userId=" + hr.getId());
                }
            } else {
                System.out.println("[Notification] Skipping HR notification (submitter not a manager)");
            }

            // Notify Admin
            List<User> adminUsers = userRepository.findByRole(com.hrms.model.Role.ADMIN);
            System.out.println("[Notification] Admin users count: " + adminUsers.size());
            for (User admin : adminUsers) {
                notificationService.createNotification(admin.getId(), "New Timesheet Submission", message, "TIMESHEET",
                        null);
                System.out.println("[Notification] ✓ Notified Admin userId=" + admin.getId());
            }
        } catch (Exception e) {
            System.err.println("[Notification] ✗ Failed to send weekly timesheet notifications: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public List<TimesheetDTO> getTeamTimesheets(Long managerId) {
        List<Timesheet> timesheets = timesheetRepository.findByManagerId(managerId);
        return timesheets.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    private TimesheetDTO convertToDTO(Timesheet timesheet) {
        TimesheetDTO dto = new TimesheetDTO();
        dto.setId(timesheet.getId());
        dto.setEmployeeId(timesheet.getEmployee().getId());

        // Add employee name and role
        String fullName = timesheet.getEmployee().getFirstName() + " " + timesheet.getEmployee().getLastName();
        dto.setEmployeeName(fullName);
        if (timesheet.getEmployee().getUser() != null) {
            dto.setEmployeeRole(timesheet.getEmployee().getUser().getRole().name());
        }
        // Expose the employee's account status so disabled accounts can be flagged read-only
        // in Admin/HR/RM views. Records of disabled employees are still returned (no filtering).
        dto.setEmployeeStatus(
                Boolean.FALSE.equals(timesheet.getEmployee().getActive()) ? "INACTIVE" : "ACTIVE");

        dto.setDate(timesheet.getDate());
        dto.setStartTime(timesheet.getStartTime());
        dto.setEndTime(timesheet.getEndTime());
        dto.setTotalHours(timesheet.getTotalHours());
        dto.setProject(timesheet.getProject());
        dto.setTask(timesheet.getTask());
        dto.setNotes(timesheet.getNotes());
        dto.setStatus(timesheet.getStatus().name());
        dto.setManagerComments(timesheet.getManagerComments());

        dto.setOnsiteOffshore(timesheet.getOnsiteOffshore());
        dto.setBillingLocation(timesheet.getBillingLocation());
        dto.setBillable(timesheet.getBillable());
        dto.setProjectName(timesheet.getProjectName());
        dto.setTaskDescription(timesheet.getTaskDescription());
        dto.setCategory(timesheet.getCategory());
        dto.setLeaveType(timesheet.getLeaveType());

        // Multi-stage approval tracking — show the actual person's name (firstName lastName)
        // of whoever acted, resolved from their linked Employee record. Falls back to the
        // username only when no Employee profile is linked to that user.
        if (timesheet.getRmApprovedBy() != null) {
            dto.setRmApprovedByName(resolveUserDisplayName(timesheet.getRmApprovedBy()));
            dto.setRmApprovedAt(timesheet.getRmApprovedAt() != null ? timesheet.getRmApprovedAt().toString() : null);
        }
        if (timesheet.getHrApprovedBy() != null) {
            dto.setHrApprovedByName(resolveUserDisplayName(timesheet.getHrApprovedBy()));
            dto.setHrApprovedAt(timesheet.getHrApprovedAt() != null ? timesheet.getHrApprovedAt().toString() : null);
        }
        if (timesheet.getAdminApprovedBy() != null) {
            dto.setAdminApprovedByName(resolveUserDisplayName(timesheet.getAdminApprovedBy()));
            dto.setAdminApprovedAt(timesheet.getAdminApprovedAt() != null ? timesheet.getAdminApprovedAt().toString() : null);
        }

        dto.setRejectionReason(timesheet.getRejectionReason());
        dto.setRejectedByRole(timesheet.getRejectedByRole());
        // On rejection the rejecter is recorded in reviewedBy — expose their actual name.
        if (timesheet.getStatus() == TimesheetStatus.REJECTED && timesheet.getReviewedBy() != null) {
            dto.setRejectedByName(resolveUserDisplayName(timesheet.getReviewedBy()));
        }
        dto.setRejectedAt(timesheet.getRejectedAt() != null ? timesheet.getRejectedAt().toString() : null);

        // Disabled HR/RM rerouting — expose route + flags so the RM/employee views can
        // render the info banner and the correct status text.
        dto.setApprovalRoute(timesheet.getApprovalRoute());
        dto.setSkippedRM(timesheet.getSkippedRM());
        dto.setSkippedHR(timesheet.getSkippedHR());
        dto.setReroutedToRM(timesheet.getReroutedToRM());
        dto.setHrDisabledReroute(timesheet.getHrDisabledReroute());
        dto.setHrStageApprovedByRole(timesheet.getHrStageApprovedByRole());

        return dto;
    }

    /**
     * Resolves the human-readable display name for a user who acted on a timesheet.
     * Prefers the linked Employee's full name; falls back to the username.
     */
    private String resolveUserDisplayName(User user) {
        if (user == null)
            return null;
        return employeeRepository.findByUser(user)
                .map(e -> (e.getFirstName() + " " + (e.getLastName() == null ? "" : e.getLastName())).trim())
                .filter(name -> !name.isEmpty())
                .orElse(user.getUsername());
    }

    /**
     * HR routing filter: from a list of timesheets, keep only those an HR user should
     * see — timesheets of employees assigned to this HR (hrId == this HR), plus any
     * employee not yet assigned to ANY HR (fallback: unassigned employees stay visible
     * to all HR users, preserving existing behaviour). Does not alter the approval flow.
     *
     * Other HR users are never shown in the HR team queue, regardless of assignment or
     * the unassigned-employee fallback — an HR should only see their team (employees and
     * reporting managers), not fellow HR accounts (active or disabled) or their own record.
     */
    public List<TimesheetDTO> filterForHr(List<TimesheetDTO> all, Long hrEmployeeId) {
        if (all == null || hrEmployeeId == null)
            return all;

        java.util.Set<Long> assignedToThisHr = new java.util.HashSet<>();
        java.util.Set<Long> assignedToAnyHr = new java.util.HashSet<>();
        for (EmployeeReporting er : employeeReportingRepository.findAll()) {
            if (er.getHr() != null && er.getEmployee() != null) {
                assignedToAnyHr.add(er.getEmployee().getId());
                if (hrEmployeeId.equals(er.getHr().getId())) {
                    assignedToThisHr.add(er.getEmployee().getId());
                }
            }
        }

        return all.stream()
                .filter(t -> t.getEmployeeId() != null
                        // Never show the HR their own timesheet in the team queue. Without this,
                        // the HR's own record (not assigned to any HR) slips through the
                        // unassigned-employee fallback below.
                        && !hrEmployeeId.equals(t.getEmployeeId())
                        // Exclude every other HR account too. Fellow HR users (even disabled ones)
                        // must not appear in this HR's team queue; without this they leak in via
                        // the unassigned-employee fallback below.
                        && !Role.HR.name().equals(t.getEmployeeRole())
                        && (assignedToThisHr.contains(t.getEmployeeId())
                                || !assignedToAnyHr.contains(t.getEmployeeId())))
                .collect(Collectors.toList());
    }

    /**
     * Whether the employee currently has a Reporting Manager assigned (via the most
     * recent EmployeeReporting row). Used to fall the approval routing forward to the
     * next available approver when a stage's approver is unassigned.
     */
    private boolean hasReportingManager(Employee employee) {
        return employeeReportingRepository.findFirstByEmployeeOrderByIdDesc(employee)
                .map(er -> er.getReportingManager() != null)
                .orElse(false);
    }

    /**
     * Whether the employee currently has an HR assigned (via the most recent
     * EmployeeReporting row).
     */
    private boolean hasHr(Employee employee) {
        return employeeReportingRepository.findFirstByEmployeeOrderByIdDesc(employee)
                .map(er -> er.getHr() != null)
                .orElse(false);
    }

    // An approver is "usable" only if assigned (non-null) AND active. A disabled account
    // (active == false) is not usable and triggers the disabled-approver rerouting.
    private boolean isUsable(Employee e) {
        return e != null && !Boolean.FALSE.equals(e.getActive());
    }

    private String nameOf(Employee e) {
        if (e == null) return "";
        return (e.getFirstName() + " " + (e.getLastName() == null ? "" : e.getLastName())).trim();
    }

    private void notifyEmployee(Employee e, String title, String message) {
        if (e != null && e.getUser() != null) {
            notificationService.createNotification(e.getUser().getId(), title, message, "TIMESHEET", null);
        }
    }

    /**
     * Sets the initial status + approval route for a newly submitted timesheet, honouring
     * disabled-approver rerouting (Part 1). Only EMPLOYEE submissions are rerouted; RM/HR/Admin
     * submitters keep the existing role-based routing (determineInitialStatus). Skip flags/route
     * are stamped ONLY when an assigned approver is DISABLED, so the normal flow and the pure
     * unassigned-approver fallback keep their current behaviour and appearance.
     */
    private void applyInitialRouting(Timesheet ts, Employee employee) {
        Role role = employee.getUser() != null ? employee.getUser().getRole() : Role.EMPLOYEE;

        if (role != Role.EMPLOYEE) {
            ts.setStatus(determineInitialStatus(employee));
            return;
        }

        EmployeeReporting er = employeeReportingRepository.findFirstByEmployeeOrderByIdDesc(employee).orElse(null);
        Employee rm = er != null ? er.getReportingManager() : null;
        Employee hr = er != null ? er.getHr() : null;
        boolean rmUsable = isUsable(rm);
        boolean hrUsable = isUsable(hr);
        boolean rmDisabled = rm != null && !rmUsable;
        boolean hrDisabled = hr != null && !hrUsable;

        // Case 3 — RM usable, HR assigned-but-disabled → RM handles the HR stage as well.
        if (rmUsable && hrDisabled) {
            ts.setStatus(TimesheetStatus.PENDING_RM_APPROVAL);
            ts.setApprovalRoute("RM_HANDLES_ALL");
            ts.setSkippedHR(true);
            ts.setSkippedHRReason("HR account is disabled");
            ts.setReroutedToRM(String.valueOf(rm.getId()));
            ts.setHrDisabledReroute(true);
            return;
        }

        // Otherwise route to the first USABLE approver (a disabled approver is treated like an
        // unassigned one for routing), stamping skip flags only for DISABLED approvers.
        if (rmUsable) {
            // Case 1 (both active) or RM active + HR unassigned (existing fallback). Unchanged.
            ts.setStatus(TimesheetStatus.PENDING_RM_APPROVAL);
        } else if (hrUsable) {
            // Case 2 — RM not usable, HR usable → skip RM, go to HR directly.
            ts.setStatus(TimesheetStatus.PENDING_HR_APPROVAL);
            if (rmDisabled) {
                ts.setApprovalRoute("HR_DIRECT");
                ts.setSkippedRM(true);
                ts.setSkippedRMReason("RM account is disabled");
            }
        } else {
            // Case 4/5 — neither usable → Admin.
            ts.setStatus(TimesheetStatus.PENDING_ADMIN_APPROVAL);
            if (rmDisabled || hrDisabled) {
                ts.setApprovalRoute("ADMIN_DIRECT");
                if (rmDisabled) { ts.setSkippedRM(true); ts.setSkippedRMReason("RM account is disabled"); }
                if (hrDisabled) { ts.setSkippedHR(true); ts.setSkippedHRReason("HR account is disabled"); }
            }
        }
    }

    /**
     * Part 1/7 — an approver account was DISABLED. Reroute the still-pending timesheets of every
     * employee this account is the RM or HR for, so items don't get stuck with someone who can
     * no longer log in. HR disabled → RM stands in (or Admin); RM disabled → HR (or Admin).
     */
    @Transactional
    public void rerouteTimesheetsForDisabledApprover(Long disabledEmployeeId) {
        if (disabledEmployeeId == null) return;
        Employee disabled = employeeRepository.findById(disabledEmployeeId).orElse(null);
        if (disabled == null) return;

        // Employees whose HR is the now-disabled account.
        for (EmployeeReporting er : employeeReportingRepository.findByHr(disabled)) {
            Employee emp = er.getEmployee();
            if (emp == null) continue;
            Employee rm = er.getReportingManager();
            boolean rmUsable = isUsable(rm);
            for (Timesheet ts : timesheetRepository.findByEmployeeIdAndStatus(emp.getId(), TimesheetStatus.PENDING_HR_APPROVAL)) {
                if (rmUsable) {
                    ts.setStatus(TimesheetStatus.PENDING_RM_AS_HR_APPROVAL);
                    ts.setApprovalRoute("RM_HANDLES_ALL");
                    ts.setSkippedHR(true);
                    ts.setSkippedHRReason("HR account is disabled");
                    ts.setReroutedToRM(String.valueOf(rm.getId()));
                    ts.setHrDisabledReroute(true);
                    timesheetRepository.save(ts);
                    notifyEmployee(rm, "Timesheet needs your approval",
                            nameOf(emp) + "'s HR is disabled — you are now handling the HR approval.");
                } else {
                    ts.setStatus(TimesheetStatus.PENDING_ADMIN_APPROVAL);
                    ts.setApprovalRoute("ADMIN_DIRECT");
                    ts.setSkippedHR(true);
                    ts.setSkippedHRReason("HR account is disabled");
                    timesheetRepository.save(ts);
                }
            }
        }

        // Employees whose Reporting Manager is the now-disabled account.
        for (EmployeeReporting er : employeeReportingRepository.findAllByReportingManager(disabled)) {
            Employee emp = er.getEmployee();
            if (emp == null) continue;
            Employee hr = er.getHr();
            boolean hrUsable = isUsable(hr);
            List<Timesheet> pending = new java.util.ArrayList<>();
            pending.addAll(timesheetRepository.findByEmployeeIdAndStatus(emp.getId(), TimesheetStatus.PENDING_RM_APPROVAL));
            // Items where this RM was standing in for a disabled HR — now the RM is gone too.
            pending.addAll(timesheetRepository.findByEmployeeIdAndStatus(emp.getId(), TimesheetStatus.PENDING_RM_AS_HR_APPROVAL));
            for (Timesheet ts : pending) {
                boolean wasRmStage = ts.getStatus() == TimesheetStatus.PENDING_RM_APPROVAL;
                if (wasRmStage && hrUsable) {
                    ts.setStatus(TimesheetStatus.PENDING_HR_APPROVAL);
                    ts.setApprovalRoute("HR_DIRECT");
                    ts.setSkippedRM(true);
                    ts.setSkippedRMReason("RM account is disabled");
                    timesheetRepository.save(ts);
                    notifyEmployee(hr, "Timesheet needs your approval",
                            nameOf(emp) + "'s Reporting Manager is disabled — routed to you for approval.");
                } else {
                    ts.setStatus(TimesheetStatus.PENDING_ADMIN_APPROVAL);
                    ts.setApprovalRoute("ADMIN_DIRECT");
                    ts.setSkippedRM(true);
                    ts.setSkippedRMReason("RM account is disabled");
                    timesheetRepository.save(ts);
                }
            }
        }
    }

    /**
     * Part 7 — an HR/RM account was RE-ENABLED. Transfer not-yet-approved reroute items back to
     * that approver's own stage. Already-approved records are untouched.
     */
    @Transactional
    public void transferTimesheetsBackToReenabledApprover(Long reenabledEmployeeId) {
        if (reenabledEmployeeId == null) return;
        Employee approver = employeeRepository.findById(reenabledEmployeeId).orElse(null);
        if (approver == null || !isUsable(approver)) return;

        // HR re-enabled → pull HR-stage items back from the stand-in RM.
        for (EmployeeReporting er : employeeReportingRepository.findByHr(approver)) {
            Employee emp = er.getEmployee();
            if (emp == null) continue;
            for (Timesheet ts : timesheetRepository.findByEmployeeIdAndStatus(emp.getId(), TimesheetStatus.PENDING_RM_AS_HR_APPROVAL)) {
                ts.setStatus(TimesheetStatus.PENDING_HR_APPROVAL);
                ts.setApprovalRoute("FULL_FLOW");
                ts.setSkippedHR(false);
                ts.setSkippedHRReason(null);
                ts.setReroutedToRM(null);
                ts.setHrDisabledReroute(false);
                timesheetRepository.save(ts);
                notifyEmployee(approver, "Timesheet awaiting your approval",
                        nameOf(emp) + "'s timesheet has been returned to you for HR approval.");
            }
        }

        // RM re-enabled → pull RM-skipped items (routed straight to HR, not yet acted on) back.
        for (EmployeeReporting er : employeeReportingRepository.findAllByReportingManager(approver)) {
            Employee emp = er.getEmployee();
            if (emp == null) continue;
            for (Timesheet ts : timesheetRepository.findByEmployeeIdAndStatus(emp.getId(), TimesheetStatus.PENDING_HR_APPROVAL)) {
                if (Boolean.TRUE.equals(ts.getSkippedRM()) && "HR_DIRECT".equals(ts.getApprovalRoute()) && ts.getRmApprovedBy() == null) {
                    ts.setStatus(TimesheetStatus.PENDING_RM_APPROVAL);
                    ts.setApprovalRoute("FULL_FLOW");
                    ts.setSkippedRM(false);
                    ts.setSkippedRMReason(null);
                    timesheetRepository.save(ts);
                    notifyEmployee(approver, "Timesheet awaiting your approval",
                            nameOf(emp) + "'s timesheet has been returned to you for approval.");
                }
            }
        }
    }

    /**
     * Re-routes an employee's timesheets that are waiting with Admin via the no-RM/no-HR
     * fallback (PENDING_ADMIN_APPROVAL) back into the RM/HR flow once an approver has been
     * assigned. Called after an RM/HR assignment change.
     *
     * Only employee/RM-submitted fallback sheets are moved; HR's own sheets (which
     * legitimately end at Admin) are left untouched, and already approved/rejected records
     * are never changed (they stay visible to the newly assigned RM/HR as read-only
     * history). Moving the status also removes Admin's ability to approve/reject, since
     * Admin approval is gated to the PENDING_ADMIN_APPROVAL stage. The RM/HR who now owns
     * each item is notified (Part 7).
     *
     * @return the number of timesheets re-routed.
     */
    @Transactional
    public int rerouteAdminPendingForEmployee(Long employeeId) {
        if (employeeId == null)
            return 0;
        Employee employee = employeeRepository.findById(employeeId).orElse(null);
        if (employee == null)
            return 0;

        boolean hasRM = hasReportingManager(employee);
        boolean hasHR = hasHr(employee);
        if (!hasRM && !hasHR)
            return 0; // still no approvers assigned — nothing to re-route

        List<Timesheet> pending = timesheetRepository.findByEmployeeIdAndStatus(
                employeeId, TimesheetStatus.PENDING_ADMIN_APPROVAL);

        int rerouted = 0;
        boolean movedToRm = false;
        boolean movedToHr = false;
        LocalDateTime now = LocalDateTime.now();
        for (Timesheet ts : pending) {
            TimesheetStatus target = rerouteTargetStatus(ts, hasRM, hasHR);
            if (target != null && target != ts.getStatus()) {
                ts.setStatus(target);
                ts.setTransferredFromAdmin(true);
                ts.setTransferredAt(now);
                timesheetRepository.save(ts);
                rerouted++;
                if (target == TimesheetStatus.PENDING_RM_APPROVAL)
                    movedToRm = true;
                else if (target == TimesheetStatus.PENDING_HR_APPROVAL)
                    movedToHr = true;
            }
        }

        // Part 7 — notify the RM/HR who now owns the transferred items (once per approver).
        if (rerouted > 0) {
            String name = (employee.getFirstName() + " " + (employee.getLastName() == null ? "" : employee.getLastName())).trim();
            String message = "A timesheet from " + name + " has been assigned to you for approval.";
            EmployeeReporting er = employeeReportingRepository.findFirstByEmployeeOrderByIdDesc(employee).orElse(null);
            if (movedToRm && er != null && er.getReportingManager() != null && er.getReportingManager().getUser() != null) {
                notificationService.createNotification(er.getReportingManager().getUser().getId(),
                        "Timesheet assigned for approval", message, "TIMESHEET", null);
            }
            if (movedToHr && er != null && er.getHr() != null && er.getHr().getUser() != null) {
                notificationService.createNotification(er.getHr().getUser().getId(),
                        "Timesheet assigned for approval", message, "TIMESHEET", null);
            }
        }
        return rerouted;
    }

    /**
     * The stage a fallback PENDING_ADMIN_APPROVAL timesheet should move to now that an
     * approver is assigned, or null to leave it with Admin.
     */
    private TimesheetStatus rerouteTargetStatus(Timesheet ts, boolean hasRM, boolean hasHR) {
        Role submitter = ts.getEmployee().getUser() != null ? ts.getEmployee().getUser().getRole() : Role.EMPLOYEE;
        // Only employee/RM sheets ever reach Admin via fallback; HR/Admin sheets belong to Admin.
        if (submitter != Role.EMPLOYEE && submitter != Role.REPORTING_MANAGER)
            return null;
        boolean rmApproved = ts.getRmApprovedBy() != null;
        // Employee sheet not yet RM-approved and an RM is now available → back to the RM stage.
        if (submitter == Role.EMPLOYEE && !rmApproved && hasRM)
            return TimesheetStatus.PENDING_RM_APPROVAL;
        // Otherwise, if an HR is now available → the HR stage (RM's own sheets skip the RM
        // stage; RM-approved employee sheets continue to HR).
        if (hasHR)
            return TimesheetStatus.PENDING_HR_APPROVAL;
        return null;
    }

    /**
     * Determines the initial status for a timesheet based on the employee's role AND
     * their assigned approvers. When a stage's approver is not assigned, routing falls
     * forward to the next available approver, ending at Admin:
     *   Employee: RM → HR → done   (no RM → start at HR; no RM & no HR → start at Admin)
     *   RM:       HR → done        (no HR → start at Admin)   [RM's own sheet skips the RM stage]
     *   HR:       Admin → done
     * Normal routing (all approvers assigned) is unchanged.
     */
    private TimesheetStatus determineInitialStatus(Employee employee) {
        Role role = employee.getUser() != null ? employee.getUser().getRole() : Role.EMPLOYEE;
        boolean hasRM = hasReportingManager(employee);
        boolean hasHR = hasHr(employee);

        switch (role) {
            case ADMIN:
                return TimesheetStatus.APPROVED; // Admin timesheets are auto-approved
            case HR:
                return TimesheetStatus.PENDING_ADMIN_APPROVAL; // HR → Admin
            case REPORTING_MANAGER:
                // An RM's own sheet skips the RM stage → HR, or Admin if no HR assigned.
                return hasHR ? TimesheetStatus.PENDING_HR_APPROVAL : TimesheetStatus.PENDING_ADMIN_APPROVAL;
            case EMPLOYEE:
            default:
                if (hasRM)
                    return TimesheetStatus.PENDING_RM_APPROVAL; // normal: Employee → RM
                if (hasHR)
                    return TimesheetStatus.PENDING_HR_APPROVAL;  // no RM → skip to HR
                return TimesheetStatus.PENDING_ADMIN_APPROVAL;   // no RM & no HR → Admin
        }
    }

    /**
     * Determines if a user with the given role can approve a timesheet in its current status
     */
    private boolean canApprove(TimesheetStatus currentStatus, Role reviewerRole, Role submitterRole) {
        // Admin override: an Admin may act on ANY pending timesheet, regardless of which
        // stage it currently sits at. This only grants Admin access — the RM/HR stage rules
        // below are unchanged (RM still only acts at the RM stage, HR only at the HR stage).
        if (reviewerRole == Role.ADMIN
                && (currentStatus == TimesheetStatus.PENDING_RM_APPROVAL
                    || currentStatus == TimesheetStatus.PENDING_HR_APPROVAL
                    || currentStatus == TimesheetStatus.PENDING_RM_AS_HR_APPROVAL
                    || currentStatus == TimesheetStatus.PENDING_ADMIN_APPROVAL)) {
            return true;
        }
        switch (currentStatus) {
            case PENDING_RM_APPROVAL:
                return reviewerRole == Role.REPORTING_MANAGER;
            case PENDING_HR_APPROVAL:
                return reviewerRole == Role.HR;
            case PENDING_RM_AS_HR_APPROVAL:
                // HR disabled — the Reporting Manager stands in for the HR stage.
                return reviewerRole == Role.REPORTING_MANAGER;
            case PENDING_ADMIN_APPROVAL:
                // Admin approves anything that reached the Admin stage — HR's own sheets
                // (normal) as well as employee/RM sheets routed here via the no-RM/no-HR
                // fallback.
                return reviewerRole == Role.ADMIN;
            default:
                return false;
        }
    }

    /**
     * Gets the next status after approval based on current status, reviewer role, and submitter role
     */
    private TimesheetStatus getNextStatusAfterApproval(TimesheetStatus currentStatus, Role reviewerRole, Role submitterRole, boolean submitterHasHr, String approvalRoute) {
        // Admin override: an Admin approval finalizes the timesheet from ANY pending stage.
        // RM/HR transitions below are unchanged.
        if (reviewerRole == Role.ADMIN) {
            return TimesheetStatus.APPROVED;
        }
        boolean rmHandlesAll = "RM_HANDLES_ALL".equals(approvalRoute);
        switch (currentStatus) {
            case PENDING_RM_APPROVAL:
                if (reviewerRole == Role.REPORTING_MANAGER) {
                    // HR is disabled and the RM is standing in → RM must also approve the HR
                    // stage (Part 2). Otherwise: normally HR; if the employee has no HR
                    // assigned, fall back to Admin.
                    if (rmHandlesAll)
                        return TimesheetStatus.PENDING_RM_AS_HR_APPROVAL;
                    return submitterHasHr ? TimesheetStatus.PENDING_HR_APPROVAL : TimesheetStatus.PENDING_ADMIN_APPROVAL;
                }
                break;
            case PENDING_RM_AS_HR_APPROVAL:
                // RM approving the stand-in HR stage finalizes the timesheet.
                if (reviewerRole == Role.REPORTING_MANAGER) {
                    return TimesheetStatus.APPROVED;
                }
                break;
            case PENDING_HR_APPROVAL:
                if (reviewerRole == Role.HR) {
                    // Employee and RM timesheets: RM → HR → APPROVED (stop here)
                    // HR timesheets: HR → Admin → APPROVED
                    if (submitterRole == Role.EMPLOYEE || submitterRole == Role.REPORTING_MANAGER) {
                        return TimesheetStatus.APPROVED;
                    } else {
                        return TimesheetStatus.PENDING_ADMIN_APPROVAL;
                    }
                }
                break;
            case PENDING_ADMIN_APPROVAL:
                if (reviewerRole == Role.ADMIN) {
                    return TimesheetStatus.APPROVED;
                }
                break;
        }
        return currentStatus; // Should not happen if canApprove is checked first
    }
}
