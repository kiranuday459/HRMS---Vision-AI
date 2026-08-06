package com.hrms.service;

import com.hrms.dto.ClientTimesheetNotificationDTO;
import com.hrms.model.ClientTimesheetNotification;
import com.hrms.model.Employee;
import com.hrms.model.Role;
import com.hrms.model.User;
import com.hrms.repository.ClientTimesheetNotificationRepository;
import com.hrms.repository.CompanyDetailRepository;
import com.hrms.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Notifications for the Client Timesheet workspace. Writes to
 * client_timesheet_notifications only — the main HRMS bell (`notifications`) is a
 * separate system and is never touched here.
 *
 * Every notify* method is best-effort: notification failures are logged and swallowed so
 * they can never roll back the submit / approve / reject / assign / verify action that
 * triggered them. Those actions own the transaction; this is only a side effect.
 */
@Service
@Transactional
public class ClientTimesheetNotificationService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm:ss");

    public static final String TIMESHEET_SUBMITTED = "TIMESHEET_SUBMITTED";
    public static final String TIMESHEET_RESUBMITTED = "TIMESHEET_RESUBMITTED";
    public static final String TIMESHEET_APPROVED = "TIMESHEET_APPROVED";
    public static final String TIMESHEET_REJECTED = "TIMESHEET_REJECTED";
    public static final String PROJECT_ASSIGNED = "PROJECT_ASSIGNED";
    public static final String ACCOUNT_VERIFIED = "ACCOUNT_VERIFIED";

    @Autowired
    private ClientTimesheetNotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CompanyDetailRepository companyDetailRepository;

    // =====================================================================
    // Write side — called from existing actions
    // =====================================================================

    /** Employee submitted (or resubmitted after a rejection) a week — notify every admin. */
    public void notifyAdminsTimesheetSubmitted(Employee employee, LocalDate weekStart, boolean resubmission) {
        try {
            String action = resubmission ? "Timesheet Resubmitted" : "Timesheet Submitted";
            String message = "Action: " + action + " (for " + fmt(weekStart) + ")"
                    + " | Employee: " + displayName(employee) + " (" + employeeCode(employee) + ")"
                    + stamp();
            String type = resubmission ? TIMESHEET_RESUBMITTED : TIMESHEET_SUBMITTED;
            for (User admin : userRepository.findByRole(Role.ADMIN)) {
                save(admin, type, message, employee.getId(), weekStart);
            }
        } catch (Exception ex) {
            logFailure("timesheet submitted", ex);
        }
    }

    /**
     * Admin approved a week — notify the employee. Approve runs per day row, so this is
     * called once per day of the week; only the first call records a notification.
     */
    public void notifyEmployeeTimesheetApproved(Employee employee, LocalDate weekStart) {
        try {
            if (alreadyNotified(userOf(employee), TIMESHEET_APPROVED, weekStart)) {
                return;
            }
            String message = "Action: Timesheet Approved (for " + fmt(weekStart) + ")" + stamp();
            save(userOf(employee), TIMESHEET_APPROVED, message, employee.getId(), weekStart);
        } catch (Exception ex) {
            logFailure("timesheet approved", ex);
        }
    }

    /**
     * Admin rejected a week — notify the employee, including the reason they must act on.
     * Deduped per week for the same reason as approval.
     */
    public void notifyEmployeeTimesheetRejected(Employee employee, LocalDate weekStart, String reason) {
        try {
            if (alreadyNotified(userOf(employee), TIMESHEET_REJECTED, weekStart)) {
                return;
            }
            String message = "Action: Timesheet Rejected (for " + fmt(weekStart) + ")"
                    + " | Reason: " + (reason == null || reason.isBlank() ? "—" : reason.trim())
                    + stamp();
            save(userOf(employee), TIMESHEET_REJECTED, message, employee.getId(), weekStart);
        } catch (Exception ex) {
            logFailure("timesheet rejected", ex);
        }
    }

    /** Admin assigned the employee to a client project. */
    public void notifyEmployeeProjectAssigned(Employee employee, String projectName, LocalDate assignmentStartDate) {
        try {
            String message = "Action: Assigned to Client Project"
                    + " | Project: " + (projectName == null || projectName.isBlank() ? "—" : projectName)
                    + " | Assigned: " + fmt(assignmentStartDate)
                    + stamp();
            save(userOf(employee), PROJECT_ASSIGNED, message, employee.getId(), null);
        } catch (Exception ex) {
            logFailure("project assigned", ex);
        }
    }

    /** Employee completed activation OTP verification. */
    public void notifyEmployeeAccountVerified(Employee employee) {
        try {
            String message = "Action: Account Verified"
                    + " | Project: " + (employee.getClientProject() == null || employee.getClientProject().isBlank()
                            ? "—" : employee.getClientProject())
                    + stamp();
            save(userOf(employee), ACCOUNT_VERIFIED, message, employee.getId(), null);
        } catch (Exception ex) {
            logFailure("account verified", ex);
        }
    }

    // =====================================================================
    // Read side — the module's bell panel
    // =====================================================================

    public Page<ClientTimesheetNotificationDTO> getForUser(Long userId, int page, int size) {
        User user = requireUser(userId);
        return notificationRepository
                .findByUserOrderByCreatedAtDesc(user, PageRequest.of(Math.max(0, page), Math.max(1, size)))
                .map(this::toDTO);
    }

    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserAndIsReadFalse(requireUser(userId));
    }

    /** Marks one row read. Scoped to the caller so a guessed id cannot touch another user's row. */
    public void markAsRead(Long userId, Long notificationId) {
        notificationRepository.findById(notificationId)
                .filter(n -> n.getUser() != null && n.getUser().getId().equals(userId))
                .ifPresent(n -> {
                    n.setRead(true);
                    notificationRepository.save(n);
                });
    }

    public void markAllAsRead(Long userId) {
        notificationRepository.markAllReadForUser(requireUser(userId));
    }

    /** Deletes one row. Same ownership scoping as markAsRead. */
    public void delete(Long userId, Long notificationId) {
        notificationRepository.findById(notificationId)
                .filter(n -> n.getUser() != null && n.getUser().getId().equals(userId))
                .ifPresent(notificationRepository::delete);
    }

    public void clearAll(Long userId) {
        notificationRepository.deleteAllForUser(requireUser(userId));
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private void save(User recipient, String eventType, String message, Long employeeId, LocalDate weekStart) {
        if (recipient == null) {
            return; // no login behind this employee — nothing to notify
        }
        ClientTimesheetNotification n = new ClientTimesheetNotification();
        n.setUser(recipient);
        n.setEventType(eventType);
        n.setMessage(message);
        n.setRelatedEmployeeId(employeeId);
        n.setRelatedWeekStart(weekStart);
        n.setRead(false);
        n.setCreatedAt(java.time.LocalDateTime.now(java.time.ZoneOffset.UTC));
        notificationRepository.save(n);
    }

    /**
     * True when an unread notification of this type already exists for the week. Scoped to
     * unread so a later decision on the same week can still notify once the employee has
     * seen the previous one.
     */
    private boolean alreadyNotified(User recipient, String eventType, LocalDate weekStart) {
        if (recipient == null || weekStart == null) {
            return false;
        }
        return notificationRepository
                .existsByUserAndEventTypeAndRelatedWeekStartAndIsReadFalse(recipient, eventType, weekStart);
    }

    private User requireUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
    }

    private User userOf(Employee employee) {
        return employee != null ? employee.getUser() : null;
    }

    private String displayName(Employee e) {
        if (e == null) return "—";
        String name = (e.getFirstName() + " " + (e.getLastName() == null ? "" : e.getLastName())).trim();
        return name.isEmpty() ? "—" : name;
    }

    /** Payroll-facing id shown beside the name, e.g. OF-IT-PK-0416; falls back to the row id. */
    private String employeeCode(Employee e) {
        if (e == null) return "—";
        return companyDetailRepository.findByEmployee_Id(e.getId())
                .map(d -> {
                    if (d.getOryfolksId() != null && !d.getOryfolksId().isBlank()) return d.getOryfolksId();
                    if (d.getVisionaiId() != null && !d.getVisionaiId().isBlank()) return d.getVisionaiId();
                    return null;
                })
                .orElse("ID-" + e.getId());
    }

    private String fmt(LocalDate d) {
        return d != null ? d.format(DATE_FMT) : "—";
    }

    /** The trailing " | Date: … | Time: …" every message ends with. */
    private String stamp() {
        LocalDateTime now = LocalDateTime.now();
        return " | Date: " + now.format(DATE_FMT) + " | Time: " + now.format(TIME_FMT);
    }

    private void logFailure(String event, Exception ex) {
        System.err.println("[ClientTimesheetNotification] Could not record '" + event + "': " + ex.getMessage());
    }

    private ClientTimesheetNotificationDTO toDTO(ClientTimesheetNotification n) {
        ClientTimesheetNotificationDTO dto = new ClientTimesheetNotificationDTO();
        dto.setId(n.getId());
        dto.setEventType(n.getEventType());
        dto.setMessage(n.getMessage());
        dto.setRelatedEmployeeId(n.getRelatedEmployeeId());
        dto.setRelatedWeekStart(n.getRelatedWeekStart());
        dto.setRead(n.isRead());
        dto.setCreatedAt(n.getCreatedAt());
        return dto;
    }
}
