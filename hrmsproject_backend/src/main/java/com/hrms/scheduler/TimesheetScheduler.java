package com.hrms.scheduler;

import com.hrms.model.*;
import com.hrms.repository.*;
import com.hrms.service.EmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class TimesheetScheduler {

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private TimesheetRepository timesheetRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CompanyDetailRepository companyDetailRepository;

    @Autowired
    private TimesheetNotificationLogRepository timesheetNotificationLogRepository;

    @Autowired
    private EmailService emailService;

    /**
     * Timesheet Weekly Reminder (Employee)
     * Scheduled job every Friday at 1:00 PM IST (Asia/Kolkata).
     * For each active employee, checks if current week's timesheet is submitted.
     * If NOT submitted, sends a reminder email.
     */
    @Scheduled(cron = "0 0 13 * * FRI", zone = "Asia/Kolkata")
    @Transactional
    public void timesheetWeeklyReminderJob() {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate weekEnd = weekStart.plusDays(6);

        System.out.println("[TimesheetScheduler] Running weekly reminder job for week start: " + weekStart);

        // Fetch all active employees who are not Admins or HR
        List<Employee> eligibleEmployees = employeeRepository.findAll().stream()
                .filter(e -> !Boolean.FALSE.equals(e.getActive()))
                .filter(e -> e.getUser() == null || (e.getUser().getRole() != Role.ADMIN && e.getUser().getRole() != Role.HR))
                .collect(Collectors.toList());

        for (Employee employee : eligibleEmployees) {
            try {
                // Ensure idempotency for this run
                boolean logExists = timesheetNotificationLogRepository
                        .existsByEmployeeIdAndWeekStartAndNotificationType(employee.getId(), weekStart, "WEEKLY_REMINDER");
                if (logExists) {
                    continue;
                }

                // Check if they have submitted any timesheet entries for this week
                List<Timesheet> entries = timesheetRepository.findByEmployeeIdAndDateBetween(employee.getId(), weekStart, weekEnd);
                if (entries == null || entries.isEmpty()) {
                    // Send reminder email
                    String toEmail = employee.getCorporateEmail() != null && !employee.getCorporateEmail().isBlank()
                            ? employee.getCorporateEmail() : employee.getEmail();

                    if (toEmail != null && !toEmail.isBlank()) {
                        String name = employee.getFirstName() + " " + employee.getLastName();
                        emailService.sendTimesheetWeeklyReminder(toEmail, name);

                        // Log notification
                        timesheetNotificationLogRepository.save(new TimesheetNotificationLog(
                                employee, weekStart, "WEEKLY_REMINDER", LocalDateTime.now()
                        ));
                    }
                }
            } catch (Exception e) {
                System.err.println("[TimesheetScheduler] Error sending reminder for employee: " + employee.getId() + ". " + e.getMessage());
            }
        }
    }

    /**
     * Admin Pending Summary & Admin All-Clear Summary
     * Scheduled job every Monday at 10:00 AM IST (Asia/Kolkata).
     * Checks previous week's timesheet submissions across all employees.
     * Sends Pending list summary or All-Clear confirmation to Admin.
     */
    @Scheduled(cron = "0 0 10 * * MON", zone = "Asia/Kolkata")
    @Transactional
    public void adminTimesheetSummaryJob() {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        LocalDate prevWeekStart = today.minusWeeks(1).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate prevWeekEnd = prevWeekStart.plusDays(6);
        String weekRange = prevWeekStart + " to " + prevWeekEnd;

        System.out.println("[TimesheetScheduler] Running admin summary job for week range: " + weekRange);

        // Ensure idempotency for this run
        boolean logExists = timesheetNotificationLogRepository
                .existsByEmployeeIsNullAndWeekStartAndNotificationType(prevWeekStart, "ADMIN_SUMMARY");
        if (logExists) {
            System.out.println("[TimesheetScheduler] Admin summary already sent for week: " + weekRange);
            return;
        }

        // Fetch all active employees who are not Admins or HR
        List<Employee> eligibleEmployees = employeeRepository.findAll().stream()
                .filter(e -> !Boolean.FALSE.equals(e.getActive()))
                .filter(e -> e.getUser() == null || (e.getUser().getRole() != Role.ADMIN && e.getUser().getRole() != Role.HR))
                .collect(Collectors.toList());

        List<Map<String, String>> pendingEmployeesList = new ArrayList<>();

        for (Employee employee : eligibleEmployees) {
            try {
                List<Timesheet> entries = timesheetRepository.findByEmployeeIdAndDateBetween(employee.getId(), prevWeekStart, prevWeekEnd);
                if (entries == null || entries.isEmpty()) {
                    Map<String, String> pendingInfo = new HashMap<>();
                    pendingInfo.put("name", employee.getFirstName() + " " + employee.getLastName());
                    
                    // Fetch Employee ID (oryfolksId) from CompanyDetails
                    String employeeIdVal = companyDetailRepository.findByEmployee_Id(employee.getId())
                            .map(CompanyDetail::getOryfolksId)
                            .orElse(employee.getId().toString());
                    pendingInfo.put("oryfolksId", employeeIdVal);

                    // Fetch Role
                    String roleVal = employee.getUser() != null ? employee.getUser().getRole().name() : "EMPLOYEE";
                    pendingInfo.put("role", roleVal);

                    pendingEmployeesList.add(pendingInfo);
                }
            } catch (Exception e) {
                System.err.println("[TimesheetScheduler] Error checking previous week submissions for employee: " + employee.getId() + ". " + e.getMessage());
            }
        }

        // Fetch all active Admin users
        List<User> admins = userRepository.findByRole(Role.ADMIN).stream()
                .filter(u -> !Boolean.FALSE.equals(u.getActive()))
                .collect(Collectors.toList());

        for (User admin : admins) {
            try {
                if (admin.getEmail() != null && !admin.getEmail().isBlank()) {
                    if (!pendingEmployeesList.isEmpty()) {
                        // Send Admin Pending Summary
                        emailService.sendAdminPendingSummary(admin.getEmail(), admin.getUsername(), pendingEmployeesList, weekRange);
                    } else {
                        // Send Admin All-Clear Summary
                        emailService.sendAdminAllClearSummary(admin.getEmail(), admin.getUsername(), weekRange);
                    }
                }
            } catch (Exception e) {
                System.err.println("[TimesheetScheduler] Error sending admin summary to: " + admin.getEmail() + ". " + e.getMessage());
            }
        }

        // Log notification to ensure idempotency
        try {
            timesheetNotificationLogRepository.save(new TimesheetNotificationLog(
                    null, prevWeekStart, "ADMIN_SUMMARY", LocalDateTime.now()
            ));
        } catch (Exception e) {
            System.err.println("[TimesheetScheduler] Failed to log admin summary: " + e.getMessage());
        }
    }
}
