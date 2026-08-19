package com.hrms.scheduler;

import com.hrms.dto.ClientTimesheetPendingDTO;
import com.hrms.model.ClientProjectAssignment;
import com.hrms.model.ClientTimesheet;
import com.hrms.model.Employee;
import com.hrms.model.Role;
import com.hrms.model.TimesheetNotificationLog;
import com.hrms.model.User;
import com.hrms.repository.ClientProjectAssignmentRepository;
import com.hrms.repository.ClientTimesheetRepository;
import com.hrms.repository.TimesheetNotificationLogRepository;
import com.hrms.repository.UserRepository;
import com.hrms.service.ClientTimesheetEmailService;
import com.hrms.service.ClientTimesheetWeekCompletion;
import com.hrms.service.EmployeeCodeResolver;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * The two scheduled Client Timesheet reminders: Friday to employees with an incomplete week,
 * Monday to admins with the previous week's submission status.
 *
 * Separate from {@link TimesheetScheduler}, which does the same two things for the internal
 * timesheet feature on an Indian calendar. The two modules keep their own weeks (this one runs
 * Saturday→Friday), their own tables and their own recipients, and neither reads the other's.
 *
 * Both jobs are additive. They send email only — the module's bell notifications are written
 * by the submit/approve/reject actions themselves and are untouched here.
 */
@Component
public class ClientTimesheetScheduler {

    /**
     * Japan Standard Time. Spring resolves the cron expression in this zone regardless of the
     * server's own default, so the jobs fire at 13:00 and 10:00 Tokyo time whether the host is
     * on UTC, IST or anything else — and JST has no daylight saving, so the wall-clock time
     * never shifts. This is the same mechanism {@link TimesheetScheduler} already relies on for
     * Asia/Kolkata, and it needs {@code @EnableScheduling}, which
     * {@link com.hrms.config.SchedulerConfig} provides.
     */
    private static final String JST = "Asia/Tokyo";

    /** Log types, distinct from the internal module's so the two never dedupe each other out. */
    private static final String EMPLOYEE_REMINDER = "CLIENT_TIMESHEET_WEEKLY_REMINDER";
    private static final String ADMIN_SUMMARY = "CLIENT_TIMESHEET_ADMIN_SUMMARY";

    @Autowired
    private ClientProjectAssignmentRepository assignmentRepository;

    @Autowired
    private ClientTimesheetRepository lineRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TimesheetNotificationLogRepository notificationLogRepository;

    @Autowired
    private ClientTimesheetWeekCompletion weekCompletion;

    @Autowired
    private ClientTimesheetEmailService emailService;

    // Shared with the bell and the employee's own reminder, so the admin summary spells an
    // employee's id exactly as they do.
    @Autowired
    private EmployeeCodeResolver employeeCodeResolver;

    // =====================================================================
    // Friday 13:00 JST — employees with an unfilled or incomplete week
    // =====================================================================

    /**
     * Reminds each employee on an active client project of the days they have not filled in
     * for the current week.
     *
     * Friday is the last day of the client timesheet week (Saturday→Friday), so "the current
     * week" is the one closing today and every expected workday is already due.
     *
     * Only employees with at least one missing day are mailed. An employee who is fully up to
     * date gets nothing — a reminder they cannot act on is noise, and it would train them to
     * ignore the ones that matter.
     */
    @Scheduled(cron = "0 0 13 * * FRI", zone = JST)
    @Transactional
    public void clientTimesheetWeeklyReminderJob() {
        runWeeklyReminder(LocalDate.now(ZoneId.of(JST)));
    }

    /**
     * The job itself, with the reference date supplied.
     *
     * Package-private and parameterised rather than reading the clock inline so
     * ClientTimesheetReminderEmailTest can run it against a fixed Friday — which days count as
     * missing is the whole behaviour here, and a test that had to reason about the day it
     * happened to run on could not pin it.
     *
     * @return the number of employees emailed
     */
    int runWeeklyReminder(LocalDate today) {
        LocalDate weekStart = weekCompletion.weekStartOf(today);

        System.out.println("[ClientTimesheetScheduler] Weekly reminder job for week starting " + weekStart
                + " (" + JST + ")");

        int sent = 0;
        for (AssignedEmployee assigned : assignedEmployees()) {
            Employee employee = assigned.employee;
            try {
                if (notificationLogRepository.existsByEmployeeIdAndWeekStartAndNotificationType(
                        employee.getId(), weekStart, EMPLOYEE_REMINDER)) {
                    continue; // already reminded for this week
                }

                List<ClientTimesheet> weekLines =
                        lineRepository.findByEmployeeIdAndWeekStartDate(employee.getId(), weekStart);
                List<LocalDate> missing = weekCompletion.missingWorkdays(
                        weekLines, weekStart, assigned.assignmentStart, today);
                if (missing.isEmpty()) {
                    continue; // up to date — nothing to chase
                }

                if (emailService.sendWeeklyReminder(employee, weekStart, missing)) {
                    sent++;
                    logSent(employee, weekStart, EMPLOYEE_REMINDER);
                }
            } catch (Exception ex) {
                // One employee's failure must not stop the sweep.
                System.err.println("[ClientTimesheetScheduler] Reminder failed for employee "
                        + employee.getId() + ": " + ex.getMessage());
            }
        }
        System.out.println("[ClientTimesheetScheduler] Weekly reminder job sent " + sent + " email(s).");
        return sent;
    }

    // =====================================================================
    // Monday 10:00 JST — admin summary for the week that just ended
    // =====================================================================

    /**
     * Sends every active admin the previous week's submission status: the submitted /
     * not-submitted counts, then each pending employee with the exact days they left blank.
     *
     * Admins are the recipients because in this module they are the only role that approves
     * and rejects a client timesheet — the summary is a work queue for the people who act on
     * it. HR holds no client timesheet responsibility and is not mailed.
     *
     * "The previous week" is the one that ended last Friday. Today is Monday, so the week
     * containing today started on Saturday and is still open; the closed week is the one before
     * it.
     */
    @Scheduled(cron = "0 0 10 * * MON", zone = JST)
    @Transactional
    public void clientTimesheetAdminSummaryJob() {
        runAdminSummary(LocalDate.now(ZoneId.of(JST)));
    }

    /**
     * The job itself, with the reference date supplied — package-private for the same reason as
     * {@link #runWeeklyReminder}, so the counts and the pending detail can be asserted against
     * a fixed Monday.
     *
     * @return the number of admins emailed
     */
    int runAdminSummary(LocalDate today) {
        LocalDate weekStart = weekCompletion.weekStartOf(today).minusWeeks(1);
        LocalDate weekEnd = weekStart.plusDays(6);

        System.out.println("[ClientTimesheetScheduler] Admin summary job for week " + weekStart
                + " to " + weekEnd + " (" + JST + ")");

        if (notificationLogRepository.existsByEmployeeIsNullAndWeekStartAndNotificationType(
                weekStart, ADMIN_SUMMARY)) {
            System.out.println("[ClientTimesheetScheduler] Admin summary already sent for week " + weekStart);
            return 0;
        }

        int total = 0;
        int submitted = 0;
        List<ClientTimesheetPendingDTO> pending = new ArrayList<>();

        for (AssignedEmployee assigned : assignedEmployees()) {
            Employee employee = assigned.employee;
            try {
                LocalDate assignmentStart = assigned.assignmentStart;
                // An employee assigned after the week closed had nothing to submit for it.
                // Counting them as "not submitted" would report a backlog that does not exist.
                if (weekCompletion.expectedWorkdays(weekStart, assignmentStart, weekEnd).isEmpty()) {
                    continue;
                }
                total++;

                List<ClientTimesheet> weekLines =
                        lineRepository.findByEmployeeIdAndWeekStartDate(employee.getId(), weekStart);
                if (weekCompletion.wasSubmitted(weekLines)) {
                    submitted++;
                    continue;
                }

                // weekEnd, not today: the week is closed, so every workday in it was due.
                List<LocalDate> missing =
                        weekCompletion.missingWorkdays(weekLines, weekStart, assignmentStart, weekEnd);
                pending.add(new ClientTimesheetPendingDTO(
                        emailService.displayName(employee),
                        employeeCodeResolver.resolve(employee),
                        emailService.weekRange(weekStart),
                        emailService.formatMissingDays(missing)));
            } catch (Exception ex) {
                System.err.println("[ClientTimesheetScheduler] Summary check failed for employee "
                        + employee.getId() + ": " + ex.getMessage());
            }
        }

        pending.sort(Comparator.comparing(ClientTimesheetPendingDTO::getEmployeeName,
                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));

        List<User> admins = userRepository.findByRole(Role.ADMIN).stream()
                .filter(u -> !Boolean.FALSE.equals(u.getActive()))
                .collect(Collectors.toList());

        int sent = emailService.sendAdminSummary(admins, weekStart, submitted, total, pending);
        System.out.println("[ClientTimesheetScheduler] Admin summary: " + submitted + "/" + total
                + " submitted, " + pending.size() + " pending; emailed " + sent + " admin(s).");

        if (sent > 0) {
            logSent(null, weekStart, ADMIN_SUMMARY);
        }
        return sent;
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    /**
     * An employee on an active client project, paired with the earliest start date across
     * their active assignments — the gate the entry page uses, and therefore the earliest day
     * they could owe hours for.
     */
    private static final class AssignedEmployee {
        private final Employee employee;
        private final LocalDate assignmentStart;

        private AssignedEmployee(Employee employee, LocalDate assignmentStart) {
            this.employee = employee;
            this.assignmentStart = assignmentStart;
        }
    }

    /**
     * Every employee holding an active client project assignment, one entry each.
     *
     * Collapsed by employee id rather than by object identity so a legacy row carrying two
     * active assignments counts as one person, not two — Employee does not define equality, so
     * the id is the only safe key. Employees disabled in HRMS and those with no login account
     * are dropped: neither can fill a timesheet, and neither has an inbox to mail.
     */
    private List<AssignedEmployee> assignedEmployees() {
        Map<Long, AssignedEmployee> byId = new LinkedHashMap<>();
        for (ClientProjectAssignment a : assignmentRepository.findByActiveTrue()) {
            Employee e = a.getEmployee();
            if (e == null || e.getId() == null) continue;
            if (Boolean.FALSE.equals(e.getActive()) || e.getUser() == null) continue;

            byId.merge(e.getId(), new AssignedEmployee(e, a.getAssignmentStartDate()), (existing, incoming) -> {
                LocalDate a1 = existing.assignmentStart;
                LocalDate a2 = incoming.assignmentStart;
                if (a1 == null) return incoming;
                if (a2 == null) return existing;
                return a1.isBefore(a2) ? existing : incoming;
            });
        }
        return new ArrayList<>(byId.values());
    }

    /** Records a delivered notification so a restart or a re-run cannot mail it twice. */
    private void logSent(Employee employee, LocalDate weekStart, String type) {
        try {
            notificationLogRepository.save(
                    new TimesheetNotificationLog(employee, weekStart, type, LocalDateTime.now()));
        } catch (Exception ex) {
            // The email is already out; failing to log it must not fail the job.
            System.err.println("[ClientTimesheetScheduler] Could not log " + type + ": " + ex.getMessage());
        }
    }
}
