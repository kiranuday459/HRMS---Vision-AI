package com.hrms.service;

import com.hrms.dto.ClientTimesheetPendingDTO;
import com.hrms.model.ClientProjectAssignment;
import com.hrms.model.ClientTimesheet;
import com.hrms.model.ClientTimesheetStatus;
import com.hrms.model.Employee;
import com.hrms.model.User;
import com.hrms.repository.ClientProjectAssignmentRepository;
import com.hrms.repository.ClientTimesheetRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Email delivery for the Client Timesheet module: the rejection notice an employee gets the
 * moment an admin sends a week back, the Friday reminder for an incomplete week, and the
 * Monday submission summary for admins.
 *
 * These are additions. Every one of them sits alongside the existing in-module bell
 * notification written by {@link ClientTimesheetNotificationService} — none of them replaces
 * it, and nothing here touches the approve/reject decision itself.
 *
 * Every send is best-effort and swallows its own failures, matching the rule the rest of the
 * module already follows: mail is a side effect of an action that has already completed and
 * committed, so an unreachable mail server can never fail a rejection or abort a scheduled
 * sweep partway through.
 *
 * Recipients come from {@link CorporateEmailResolver} without exception — the login address,
 * the same rule the activation OTP was fixed to follow.
 */
@Service
public class ClientTimesheetEmailService {

    // "09-Aug-2026" — unambiguous across locales, unlike 09/08/2026.
    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("dd-MMM-yyyy", Locale.ENGLISH);
    // "Monday, 04-Aug-2026" — the day name is the point; a bare date reads as older news.
    private static final DateTimeFormatter STAMP_FMT =
            DateTimeFormatter.ofPattern("EEEE, dd-MMM-yyyy", Locale.ENGLISH);
    // "Wed 8-Jul" — short enough to list five of them on one line.
    private static final DateTimeFormatter MISSING_DAY_FMT = DateTimeFormatter.ofPattern("EEE d-MMM", Locale.ENGLISH);

    @Autowired
    private EmailService emailService;

    @Autowired
    private CorporateEmailResolver corporateEmailResolver;

    @Autowired
    private EmployeeCodeResolver employeeCodeResolver;

    @Autowired
    private UserDisplayNameResolver userDisplayNameResolver;

    @Autowired
    private ClientTimesheetRepository lineRepository;

    @Autowired
    private ClientProjectAssignmentRepository assignmentRepository;

    // Same "which days are missing" rule the Friday reminder uses, so a week cannot be
    // described one way in the rejection email and another way on Friday.
    @Autowired
    private ClientTimesheetWeekCompletion weekCompletion;

    // =====================================================================
    // 1. Rejection — event-triggered
    // =====================================================================

    /**
     * Emails the employee that their week was rejected, with the admin's reason.
     *
     * Called after the rejection has already been saved, so the line carries its own reviewer
     * and timestamp.
     *
     * The admin's single click rejects every day row of the week separately, so this is called
     * once per row and must produce exactly one email — see {@link #isSpokespersonRow}. The
     * week's missing days are consolidated into that one email rather than becoming an email
     * each.
     */
    public void sendRejectionNotice(ClientTimesheet rejectedLine) {
        try {
            if (rejectedLine == null) {
                return;
            }
            Employee employee = rejectedLine.getEmployee();
            String to = corporateEmailResolver.resolve(employee);
            if (to == null) {
                // No login account behind this employee — no inbox they sign in with, and
                // guessing a profile address is exactly what the OTP fix removed.
                return;
            }

            LocalDate weekStart = rejectedLine.getWeekStartDate() != null
                    ? rejectedLine.getWeekStartDate()
                    : rejectedLine.getDate();
            List<ClientTimesheet> weekLines = weekStart == null
                    ? List.of()
                    : lineRepository.findByEmployeeIdAndWeekStartDate(employee.getId(), weekStart);

            if (!isSpokespersonRow(rejectedLine, weekLines)) {
                return; // another row of this same week carries the email
            }

            LocalDateTime reviewedAt = rejectedLine.getReviewedAt() != null
                    ? rejectedLine.getReviewedAt()
                    : LocalDateTime.now();

            emailService.sendClientTimesheetRejection(
                    to,
                    displayName(employee),
                    employeeCodeResolver.resolve(employee),
                    projectNames(rejectedLine, weekLines, employee),
                    projectIds(rejectedLine, weekLines, employee),
                    weekRange(weekStart),
                    rejectedLine.getRejectionReason(),
                    userDisplayNameResolver.resolve(rejectedLine.getApprovedBy()),
                    reviewedAt.toLocalDate().format(STAMP_FMT),
                    formatMissingDays(missingDaysFor(employee, weekStart, weekLines)));
        } catch (Exception ex) {
            logFailure("rejection notice", ex);
        }
    }

    /**
     * Whether this row is the one that speaks for the whole week — the lowest-id row among the
     * week's reviewable rows. Exactly one row of a week satisfies this, so exactly one email
     * goes out however the rejections arrive.
     *
     * This replaced a check that asked "has a sibling already been rejected?", which sent five
     * emails for every rejection in production while passing its unit test. Rejecting a week is
     * not five sequential calls: the admin UI posts /reject for every day row through
     * Promise.all, so five requests run at once, each in its own transaction, each sending its
     * email before any of them commits. Every request looked around, saw four siblings still
     * PENDING, and concluded it was the first. Nothing that depends on seeing another
     * transaction's uncommitted work can be made to answer that question correctly.
     *
     * So this asks a question that needs no visibility at all. The candidate set is deliberately
     * PENDING *or* REJECTED: a row being rejected right now reads as PENDING to a transaction
     * that has not seen the commit and REJECTED to one that has, and both are in the set — so
     * every concurrent request computes the same set, the same minimum id, and the same single
     * winner, whatever each one happens to observe. APPROVED and DRAFT rows are excluded because
     * a rejection never touches them; including them would hand the email to a row that is not
     * part of this review and send nothing at all.
     *
     * The trade-off: rejecting a strict subset of a week's rows directly against the API, with
     * the lowest-id row left out, sends no email. The admin UI always posts every row, so that
     * shape does not arise in the product — and one email per rejection beats five.
     */
    private boolean isSpokespersonRow(ClientTimesheet line, Collection<ClientTimesheet> weekLines) {
        if (line.getId() == null) {
            return true; // unsaved row: nothing to compare against, so it speaks for itself
        }
        Long lowest = weekLines.stream()
                .filter(l -> l.getId() != null)
                .filter(ClientTimesheetEmailService::isReviewable)
                .map(ClientTimesheet::getId)
                .min(Long::compareTo)
                .orElse(null);
        // No reviewable rows found (an empty or stale read) — fall back to sending rather than
        // swallowing the notice: a duplicate is recoverable, silence is not.
        return lowest == null || lowest.equals(line.getId());
    }

    /** Rows a rejection can act on, and therefore the rows that compete to carry its email. */
    private static boolean isReviewable(ClientTimesheet line) {
        return line.getStatus() == ClientTimesheetStatus.PENDING
                || line.getStatus() == ClientTimesheetStatus.REJECTED;
    }

    /**
     * Workdays of the rejected week with nothing entered against them.
     *
     * Folded into the rejection email because the reason is so often "fill all the days for this
     * week and then submit" — naming the days turns that into something the employee can act on
     * without opening the timesheet to work out which ones are meant. Same rule and the same
     * spelling as the Friday reminder, so the two never disagree about a week.
     *
     * Bounded by the earlier of today and the week's end: a week rejected while it is still open
     * must not list days that are not due yet.
     */
    private List<LocalDate> missingDaysFor(Employee employee, LocalDate weekStart,
            Collection<ClientTimesheet> weekLines) {
        if (weekStart == null) {
            return List.of();
        }
        LocalDate weekEnd = weekStart.plusDays(6);
        LocalDate today = LocalDate.now();
        LocalDate dueBy = today.isBefore(weekEnd) ? today : weekEnd;
        LocalDate assignmentStart = activeAssignments(employee).stream()
                .map(ClientProjectAssignment::getAssignmentStartDate)
                .filter(java.util.Objects::nonNull)
                .min(LocalDate::compareTo)
                .orElse(null);
        return weekCompletion.missingWorkdays(weekLines, weekStart, assignmentStart, dueBy);
    }

    // =====================================================================
    // 2. Friday employee reminder — scheduled
    // =====================================================================

    /**
     * Emails one employee the days they still owe for the week. The caller has already
     * established that {@code missingDays} is non-empty — an employee who is up to date is
     * never mailed.
     *
     * @return true when an email was actually sent, so the caller only logs what it delivered
     */
    public boolean sendWeeklyReminder(Employee employee, LocalDate weekStart, List<LocalDate> missingDays) {
        try {
            if (employee == null || missingDays == null || missingDays.isEmpty()) {
                return false;
            }
            String to = corporateEmailResolver.resolve(employee);
            if (to == null) {
                return false;
            }
            emailService.sendClientTimesheetWeeklyReminder(
                    to,
                    displayName(employee),
                    employeeCodeResolver.resolve(employee),
                    weekRange(weekStart),
                    formatMissingDays(missingDays));
            return true;
        } catch (Exception ex) {
            logFailure("weekly reminder", ex);
            return false;
        }
    }

    // =====================================================================
    // 3. Monday admin summary — scheduled
    // =====================================================================

    /**
     * Emails every supplied admin the previous week's submission status. Sent whether or not
     * anyone is pending: "all submitted" is the answer the admin is looking for on a clean
     * week, and silence would be indistinguishable from a job that failed to run.
     *
     * @return the number of admins actually emailed
     */
    public int sendAdminSummary(Collection<User> admins, LocalDate weekStart,
            int submittedCount, int totalCount, List<ClientTimesheetPendingDTO> pending) {
        if (admins == null) {
            return 0;
        }
        String range = weekRange(weekStart);
        int sent = 0;
        for (User admin : admins) {
            try {
                String to = corporateEmailResolver.resolve(admin);
                if (to == null) {
                    continue;
                }
                emailService.sendClientTimesheetAdminSummary(
                        to, userDisplayNameResolver.resolve(admin), range,
                        submittedCount, totalCount, pending);
                sent++;
            } catch (Exception ex) {
                // One unreachable admin must not cost the others their summary.
                logFailure("admin summary", ex);
            }
        }
        return sent;
    }

    // =====================================================================
    // Formatting helpers — shared so every email spells a date the same way
    // =====================================================================

    /** "09-Aug-2026 to 15-Aug-2026" for a Saturday→Friday client timesheet week. */
    public String weekRange(LocalDate weekStart) {
        if (weekStart == null) {
            return "—";
        }
        return weekStart.format(DAY_FMT) + " to " + weekStart.plusDays(6).format(DAY_FMT);
    }

    /** "Wed 8-Jul, Thu 9-Jul, Fri 10-Jul" — the days named, not counted. */
    public String formatMissingDays(List<LocalDate> missingDays) {
        if (missingDays == null || missingDays.isEmpty()) {
            return "—";
        }
        return missingDays.stream().map(d -> d.format(MISSING_DAY_FMT)).collect(Collectors.joining(", "));
    }

    public String displayName(Employee employee) {
        if (employee == null) {
            return "—";
        }
        String name = (employee.getFirstName() + " "
                + (employee.getLastName() == null ? "" : employee.getLastName())).trim();
        return name.isEmpty() ? "—" : name;
    }

    /**
     * The project the rejected week was logged against.
     *
     * Read from the week's rows rather than only the rejected one: rejection acts per day row
     * and the row that happens to fire this email may be a time-off line, which carries no
     * project at all. Distinct values joined, so a week split across two projects names both
     * instead of silently picking one. Falls back to the employee's active assignment when the
     * week holds nothing but time off.
     */
    private String projectNames(ClientTimesheet line, Collection<ClientTimesheet> weekLines, Employee employee) {
        Set<String> names = collect(line, weekLines, ClientTimesheet::getProjectName);
        if (names.isEmpty()) {
            names = activeAssignments(employee).stream()
                    .map(ClientProjectAssignment::getProjectName)
                    .filter(ClientTimesheetEmailService::present)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
        }
        return names.isEmpty() ? null : String.join(", ", names);
    }

    private String projectIds(ClientTimesheet line, Collection<ClientTimesheet> weekLines, Employee employee) {
        Set<String> ids = collect(line, weekLines, ClientTimesheet::getProjectId);
        if (ids.isEmpty()) {
            ids = activeAssignments(employee).stream()
                    .map(ClientProjectAssignment::getProjectId)
                    .filter(ClientTimesheetEmailService::present)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
        }
        return ids.isEmpty() ? null : String.join(", ", ids);
    }

    /** Distinct non-blank values across the week, with the rejected row's own value first. */
    private Set<String> collect(ClientTimesheet line, Collection<ClientTimesheet> weekLines,
            java.util.function.Function<ClientTimesheet, String> field) {
        Set<String> out = new LinkedHashSet<>();
        String own = field.apply(line);
        if (present(own)) {
            out.add(own.trim());
        }
        if (weekLines != null) {
            for (ClientTimesheet l : weekLines) {
                String v = field.apply(l);
                if (present(v)) {
                    out.add(v.trim());
                }
            }
        }
        return out;
    }

    private List<ClientProjectAssignment> activeAssignments(Employee employee) {
        if (employee == null || employee.getId() == null) {
            return List.of();
        }
        try {
            return assignmentRepository.findByEmployeeIdAndActiveTrue(employee.getId());
        } catch (Exception ex) {
            return List.of();
        }
    }

    private static boolean present(String v) {
        return v != null && !v.isBlank();
    }

    private void logFailure(String what, Exception ex) {
        System.err.println("[ClientTimesheetEmail] Could not send '" + what + "': " + ex.getMessage());
    }
}
