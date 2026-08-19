package com.hrms.service;

import com.azure.identity.ClientSecretCredential;
import com.azure.identity.ClientSecretCredentialBuilder;
import com.microsoft.graph.models.BodyType;
import com.microsoft.graph.models.EmailAddress;
import com.microsoft.graph.models.ItemBody;
import com.microsoft.graph.models.Message;
import com.microsoft.graph.models.Recipient;
import com.microsoft.graph.serviceclient.GraphServiceClient;
import com.microsoft.graph.users.item.sendmail.SendMailPostRequestBody;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class EmailService {

    @Value("${azure.activedirectory.tenant-id}")
    private String tenantId;

    @Value("${azure.activedirectory.client-id}")
    private String clientId;

    @Value("${azure.activedirectory.client-secret}")
    private String clientSecret;

    @Value("${azure.activedirectory.sender-email}")
    private String senderEmail;

    private GraphServiceClient graphClient;

    private void ensureGraphClient() {
        if (graphClient == null) {
            final ClientSecretCredential credential = new ClientSecretCredentialBuilder()
                    .clientId(clientId)
                    .tenantId(tenantId)
                    .clientSecret(clientSecret)
                    .build();

            // v6 SDK uses the credential directly
            graphClient = new GraphServiceClient(credential);
        }
    }

    public synchronized void sendEmail(String[] to, String[] cc, String subject, String body) {
        // Plain-text body: newlines are the layout, so they become <br> on the way out.
        dispatch(to, cc, subject, body.replace("\n", "<br>"));
    }

    /**
     * Sends a body that is already HTML.
     *
     * Separate from {@link #sendEmail} because that one rewrites every newline as a &lt;br&gt;,
     * which is right for plain text and ruinous for markup — it would inject a line break
     * between every tag, pushing blank lines through tables and blowing the layout apart. The
     * templates built by {@link HtmlEmailTemplate} come through here untouched.
     */
    public synchronized void sendHtmlEmail(String[] to, String[] cc, String subject, String html) {
        dispatch(to, cc, subject, html);
    }

    private void dispatch(String[] to, String[] cc, String subject, String htmlBody) {
        try {
            ensureGraphClient();

            Message message = new Message();
            message.setSubject(subject);

            ItemBody itemBody = new ItemBody();
            itemBody.setContentType(BodyType.Html);
            itemBody.setContent(htmlBody);
            message.setBody(itemBody);

            List<Recipient> toRecipients = new ArrayList<>();
            for (String recipient : to) {
                if (recipient == null || recipient.trim().isEmpty()) continue;
                Recipient r = new Recipient();
                EmailAddress address = new EmailAddress();
                address.setAddress(recipient);
                r.setEmailAddress(address);
                toRecipients.add(r);
            }
            message.setToRecipients(toRecipients);

            if (cc != null && cc.length > 0) {
                List<Recipient> ccRecipients = new ArrayList<>();
                for (String recipient : cc) {
                    if (recipient == null || recipient.trim().isEmpty()) continue;
                    Recipient r = new Recipient();
                    EmailAddress address = new EmailAddress();
                    address.setAddress(recipient);
                    r.setEmailAddress(address);
                    ccRecipients.add(r);
                }
                message.setCcRecipients(ccRecipients);
            }

            SendMailPostRequestBody sendMailPostRequestBody = new SendMailPostRequestBody();
            sendMailPostRequestBody.setMessage(message);
            sendMailPostRequestBody.setSaveToSentItems(true);

            graphClient.users().byUserId(senderEmail)
                    .sendMail()
                    .post(sendMailPostRequestBody);

            System.out.println("Email sent successfully via Graph API to: " + String.join(", ", to));
        } catch (Exception e) {
            System.err.println("Failed to send email via Graph API: " + e.getMessage());
            // Optional: log full stack trace or throw exception if needed
        }
    }

    /**
     * Client Timesheet activation OTP. Sent automatically when an admin assigns an
     * employee to a client project, and on employee/admin "Resend OTP".
     */
    public void sendClientTimesheetOTP(String to, String name, String projectName, String otp) {
        String subject = "Verify Your Client Timesheet Access — VisionAI HRMS";
        StringBuilder body = new StringBuilder();
        body.append("Hi ").append(name == null || name.isBlank() ? "there" : name).append(",\n\n");
        body.append("You have been assigned to client project: ").append(projectName).append("\n\n");
        body.append("To activate your Client Timesheet access, use the OTP below:\n\n");
        body.append("        ").append(otp).append("\n\n");
        body.append("This OTP expires in 15 minutes.\n");
        body.append("Do not share this with anyone.\n\n");
        body.append("If you did not expect this, please contact your admin.\n\n");
        body.append("— VisionAI HRMS");
        sendEmail(new String[] { to }, null, subject, body.toString());
    }

    /**
     * Client Timesheet rejected by an admin. Sent to the employee the moment the rejection is
     * recorded, alongside — never instead of — the existing bell notification.
     *
     * Carries everything the employee needs to act without signing in first to find out why:
     * the week, the project it was logged against, the admin's own words, and who decided it
     * when. {@code rejectedOn} arrives pre-formatted as "Monday, 04-Aug-2026" — day name
     * included, because "rejected on the 4th" reads as older news than it is.
     *
     * One email covers the whole week. A week is stored as one row per day and the admin's
     * single click rejects every one of them, so the days are consolidated into the
     * {@code missingDays} section here rather than becoming an email each.
     *
     * @param missingDays workdays of the week left blank, pre-formatted as
     *                    "Wed 8-Jul, Thu 9-Jul", or null/blank when the week is fully filled —
     *                    the section is then omitted rather than printed empty, since a week can
     *                    be rejected for reasons that have nothing to do with missing days.
     */
    public void sendClientTimesheetRejection(String to, String employeeName, String employeeId,
            String projectName, String projectId, String weekRange, String reason,
            String rejectedByName, String rejectedOn, String missingDays) {
        String subject = "Your Client Timesheet for " + weekRange + " was rejected.";

        StringBuilder b = new StringBuilder();
        b.append(HtmlEmailTemplate.greeting(employeeName));
        b.append(HtmlEmailTemplate.paragraph(
                "Your Client Timesheet has been rejected. Please correct it and submit it again."));

        b.append(HtmlEmailTemplate.sectionLabel("Timesheet details"));
        b.append(HtmlEmailTemplate.detailRows(java.util.List.of(
                new String[] { "Employee Name", employeeName },
                new String[] { "Employee ID", employeeId },
                new String[] { "Project", projectName },
                new String[] { "Project ID", projectId },
                new String[] { "Week", weekRange })));

        b.append(HtmlEmailTemplate.sectionLabel("Rejection reason"));
        b.append(HtmlEmailTemplate.quote(reason == null || reason.isBlank()
                ? "No reason was recorded." : reason));

        if (missingDays != null && !missingDays.isBlank() && !"—".equals(missingDays.trim())) {
            b.append(HtmlEmailTemplate.sectionLabel("Days to complete"));
            b.append(HtmlEmailTemplate.highlight("Missing/incomplete days:", missingDays.trim()));
        }

        b.append(HtmlEmailTemplate.sectionLabel("Reviewed by"));
        b.append(HtmlEmailTemplate.detailRows(java.util.List.of(
                new String[] { "Rejected By", rejectedByName },
                new String[] { "Rejected On", rejectedOn })));

        b.append("<div style=\"height:8px;\"></div>");
        b.append(HtmlEmailTemplate.paragraph(
                "Sign in to VisionAI HRMS and open Client Timesheet to correct this week and resubmit it."));
        b.append(HtmlEmailTemplate.closing());

        sendHtmlEmail(new String[] { to }, null, subject,
                HtmlEmailTemplate.page("Client Timesheet Rejected", weekRange, b.toString()));
    }

    /**
     * Client Timesheet incomplete for the current week. Scheduled reminder, Fridays at 13:00
     * JST, sent only to employees who actually have days outstanding.
     *
     * {@code missingDays} names them — "Wed 8-Jul, Thu 9-Jul, Fri 10-Jul" — rather than saying
     * some days are missing, so the employee can open the week and fill in exactly those.
     */
    public void sendClientTimesheetWeeklyReminder(String to, String employeeName, String employeeId,
            String weekRange, String missingDays) {
        String subject = "Reminder: Client Timesheet incomplete for " + weekRange + ".";

        StringBuilder b = new StringBuilder();
        b.append(HtmlEmailTemplate.greeting(employeeName));
        b.append(HtmlEmailTemplate.paragraph("Your Client Timesheet for this week is not complete yet."));

        b.append(HtmlEmailTemplate.sectionLabel("Days to complete"));
        b.append(HtmlEmailTemplate.highlight("Missing:", blankTo(missingDays, "—")));

        b.append(HtmlEmailTemplate.sectionLabel("Timesheet details"));
        b.append(HtmlEmailTemplate.detailRows(java.util.List.of(
                new String[] { "Employee Name", employeeName },
                new String[] { "Employee ID", employeeId },
                new String[] { "Week", weekRange })));

        b.append("<div style=\"height:8px;\"></div>");
        b.append(HtmlEmailTemplate.paragraph(
                "Please fill in the days listed above and submit the week before the end of today."));
        b.append(HtmlEmailTemplate.closing());

        sendHtmlEmail(new String[] { to }, null, subject,
                HtmlEmailTemplate.page("Client Timesheet Reminder", weekRange, b.toString()));
    }

    /**
     * Client Timesheet submission status for the week that just ended. Scheduled summary,
     * Mondays at 10:00 JST, to the admins who approve and reject these timesheets.
     *
     * Leads with the count, because that is the whole answer on a week where everyone
     * submitted; the per-employee detail below it exists to be chased.
     */
    public void sendClientTimesheetAdminSummary(String to, String adminName, String weekRange,
            int submittedCount, int totalCount,
            java.util.List<com.hrms.dto.ClientTimesheetPendingDTO> pending) {
        int pendingCount = pending == null ? 0 : pending.size();
        String subject = "Weekly Client Timesheet Summary — " + weekRange + ": "
                + (pendingCount == 0
                        ? "all submitted."
                        : pendingCount + (pendingCount == 1 ? " employee pending." : " employees pending."));

        StringBuilder b = new StringBuilder();
        b.append(HtmlEmailTemplate.greeting(adminName));
        b.append(HtmlEmailTemplate.paragraph("Client Timesheet submission status for the week below."));

        // The whole answer on a clean week, and the first thing worth seeing on any other.
        b.append(HtmlEmailTemplate.statBlock(
                submittedCount + " of " + totalCount + " submitted",
                pendingCount == 0 ? null : (totalCount - submittedCount) + " pending"));

        if (pendingCount == 0) {
            b.append(HtmlEmailTemplate.paragraph(
                    "Every employee with an active client project assignment submitted this week."));
        } else {
            b.append(HtmlEmailTemplate.sectionLabel("Not submitted"));
            java.util.List<java.util.List<String>> rows = new ArrayList<>();
            for (com.hrms.dto.ClientTimesheetPendingDTO p : pending) {
                rows.add(java.util.List.of(
                        p.getEmployeeName() == null ? "—" : p.getEmployeeName(),
                        p.getEmployeeId() == null ? "—" : p.getEmployeeId(),
                        p.getMissingDays() == null ? "—" : p.getMissingDays()));
            }
            b.append(HtmlEmailTemplate.table(
                    java.util.List.of("Employee", "Employee ID", "Missing Days"), rows));
        }

        b.append(HtmlEmailTemplate.closing());

        sendHtmlEmail(new String[] { to }, null, subject,
                HtmlEmailTemplate.page("Weekly Client Timesheet Summary", weekRange, b.toString()));
    }

    /** Placeholder for a value that is missing rather than printing an empty column. */
    private String blankTo(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    public void sendOtpEmail(String to, String otp) {
        String subject = "Your Password Reset OTP";
        String body = "Dear User,\n\n" +
                "Your OTP for password reset is: " + otp + "\n\n" +
                "This OTP will expire in 10 minutes. If you did not request this, please ignore this email.\n\n" +
                "Best regards,\n" +
                "HR Team";
        sendEmail(new String[] { to }, null, subject, body);
    }

    public void sendLeaveRequestEmail(String[] to, String[] cc, String employeeName, String leaveType, String startDate,
            String endDate, Double daysCount, String reason, String role, String breakdown,
            Double casualBal, Double sickBal, Double earnedBal,
            Double maternityBal, Double paternityBal, Double bereavementBal) {
        String subject = "Leave Request Submitted: " + employeeName;
        StringBuilder body = new StringBuilder();
        body.append("Hello,\n\n");
        body.append("A leave request has been submitted with the following details:\n\n");
        body.append("Employee Name: ").append(employeeName).append("\n");
        body.append("Role:          ").append(role).append("\n");
        body.append("Leave Type:    ").append(leaveType).append("\n");
        body.append(String.format("Total Days:    %.1f\n", daysCount));
        body.append("Start Date:    ").append(startDate).append("\n");
        body.append("End Date:      ").append(endDate).append("\n");

        if (breakdown != null && !breakdown.isEmpty()) {
            body.append("\nLeave Breakdown:\n").append(breakdown).append("\n");
        }

        body.append("Reason:        ").append(reason).append("\n\n");
        body.append(buildBalanceBlock(casualBal, sickBal, earnedBal, maternityBal, paternityBal, bereavementBal));
        body.append("Best regards,\n");
        body.append("HRMS Notification System");

        sendEmail(to, cc, subject, body.toString());
    }

    public void sendLeaveStatusEmail(String[] to, String[] cc, String employeeName, String leaveType, String startDate,
            String endDate, Double daysCount, String status, String reason, String reviewerName, String breakdown,
            Double casualBal, Double sickBal, Double earnedBal,
            Double maternityBal, Double paternityBal, Double bereavementBal) {
        String subject = "Leave Request " + status + ": " + employeeName;
        StringBuilder body = new StringBuilder();
        body.append("Hello ").append(employeeName).append(",\n\n");
        body.append("Your leave request has been ").append(status.toLowerCase()).append(".\n\n");
        body.append("Details:\n");
        body.append("--------------------------\n");
        body.append("Employee Name: ").append(employeeName).append("\n");
        body.append("Leave Type:    ").append(leaveType).append("\n");
        body.append(String.format("Total Days:    %.1f\n", daysCount));
        body.append("Leave Dates:   ").append(startDate).append(" to ").append(endDate).append("\n");

        if (breakdown != null && !breakdown.isEmpty()) {
            body.append("\nLeave Breakdown:\n").append(breakdown).append("\n");
        }

        body.append("Status:        ").append(status).append("\n");
        body.append("Approver:      ").append(reviewerName).append("\n");

        if (reason != null && !reason.isEmpty()) {
            body.append("Comments:      ").append(reason).append("\n");
        }

        body.append("--------------------------\n\n");
        body.append(buildBalanceBlock(casualBal, sickBal, earnedBal, maternityBal, paternityBal, bereavementBal));
        body.append("Best regards,\n");
        body.append("HRMS Notification System");

        sendEmail(to, cc, subject, body.toString());
    }

    private String buildBalanceBlock(Double casualBal, Double sickBal, Double earnedBal,
                                     Double maternityBal, Double paternityBal, Double bereavementBal) {
        // earnedBal is retained in the signature only for callers; the policy now treats
        // Casual & Earned as a single combined pool reflected in casualBal.
        StringBuilder b = new StringBuilder();
        b.append("Available Balances:\n");
        b.append(String.format(" - Casual & Earned Leaves: %.2f\n", nz(casualBal)));
        b.append(String.format(" - Sick Leaves:            %.2f\n", nz(sickBal)));
        b.append(String.format(" - Maternity Leaves:       %.2f\n", nz(maternityBal)));
        b.append(String.format(" - Paternity Leaves:       %.2f\n", nz(paternityBal)));
        b.append(String.format(" - Bereavement Leaves:     %.2f\n\n", nz(bereavementBal)));
        return b.toString();
    }

    public void sendTimesheetDownloadConfirmation(String to, String userName, String timesheetType, String downloadTime, int recordCount, String filtersApplied) {
        String subject = "Timesheet Download Confirmation";
        StringBuilder body = new StringBuilder();
        body.append("Hi ").append(userName == null || userName.isBlank() ? "there" : userName).append(",\n\n");
        body.append("Your ").append(timesheetType != null && !timesheetType.isBlank() ? timesheetType : "timesheet").append(" download was successful.\n\n");
        body.append("Downloaded on: ").append(downloadTime).append("\n");
        body.append("Total Records: ").append(recordCount).append("\n");
        body.append("Filters Applied: ").append(filtersApplied == null || filtersApplied.isBlank() ? "None" : filtersApplied).append("\n\n");
        body.append("If you did not initiate this download, please contact your system administrator immediately.\n\n");
        body.append("Best regards,\n");
        body.append("HRMS Notification System");

        sendEmail(new String[] { to }, null, subject, body.toString());
    }

    public void sendTimesheetWeeklyReminder(String to, String userName) {
        String subject = "Timesheet Weekly Reminder";
        StringBuilder b = new StringBuilder();
        b.append(HtmlEmailTemplate.greeting(userName));
        b.append(HtmlEmailTemplate.paragraph("Your timesheet isn't filled in yet."));
        b.append(HtmlEmailTemplate.highlight("Action needed:", "Please submit your timesheet by end of day."));
        b.append(HtmlEmailTemplate.closing());

        sendHtmlEmail(new String[] { to }, null, subject,
                HtmlEmailTemplate.page("Timesheet Reminder", null, b.toString()));
    }

    /**
     * Pending internal-timesheet submissions for the week, to each admin.
     *
     * Carries the same three columns it always has — name, employee id, role. The rows arrive as
     * maps because that is what the caller has built for years; only the rendering changed here,
     * from a fixed-width text block to a real table. The old %-25s padding could not hold a name
     * longer than its column and pushed the remaining columns out of line whenever one appeared.
     */
    public void sendAdminPendingSummary(String to, String adminName, java.util.List<java.util.Map<String, String>> pendingEmployees, String weekRange) {
        String subject = "Timesheet Pending Submissions Summary";
        int pendingCount = pendingEmployees == null ? 0 : pendingEmployees.size();

        StringBuilder b = new StringBuilder();
        b.append(HtmlEmailTemplate.greeting(adminName));
        b.append(HtmlEmailTemplate.paragraph(
                "The following employees have pending timesheet submissions for the week below."));
        b.append(HtmlEmailTemplate.statBlock(
                pendingCount + (pendingCount == 1 ? " employee pending" : " employees pending"), null));

        b.append(HtmlEmailTemplate.sectionLabel("Pending submissions"));
        java.util.List<java.util.List<String>> rows = new ArrayList<>();
        if (pendingEmployees != null) {
            for (java.util.Map<String, String> emp : pendingEmployees) {
                rows.add(java.util.List.of(
                        emp.getOrDefault("name", "N/A"),
                        emp.getOrDefault("oryfolksId", "N/A"),
                        emp.getOrDefault("role", "N/A")));
            }
        }
        b.append(HtmlEmailTemplate.table(java.util.List.of("Name", "Employee ID", "Role"), rows));
        b.append(HtmlEmailTemplate.closing());

        sendHtmlEmail(new String[] { to }, null, subject,
                HtmlEmailTemplate.page("Timesheet Pending Submissions", weekRange, b.toString()));
    }

    public void sendAdminAllClearSummary(String to, String adminName, String weekRange) {
        String subject = "Timesheet Submissions All-Clear";
        StringBuilder b = new StringBuilder();
        b.append(HtmlEmailTemplate.greeting(adminName));
        b.append(HtmlEmailTemplate.statBlock("All employees submitted", "0 pending"));
        b.append(HtmlEmailTemplate.paragraph("There are no pending timesheets for this week."));
        b.append(HtmlEmailTemplate.closing());

        sendHtmlEmail(new String[] { to }, null, subject,
                HtmlEmailTemplate.page("Timesheet Submissions All-Clear", weekRange, b.toString()));
    }

    public void sendBulkTimesheetExportConfirmation(String to, String hrName, int recordCount, String timestamp, String filtersApplied) {
        String subject = "Bulk Timesheet Export Completed";
        StringBuilder body = new StringBuilder();
        body.append("Hi ").append(hrName == null || hrName.isBlank() ? "there" : hrName).append(",\n\n");
        body.append("Your bulk timesheet export is ready.\n\n");
        body.append("Total Records Included: ").append(recordCount).append("\n");
        body.append("Exported On: ").append(timestamp).append("\n");
        body.append("Filters Applied: ").append(filtersApplied == null || filtersApplied.isBlank() ? "None" : filtersApplied).append("\n\n");
        body.append("You can find the exported file in your downloads.\n\n");
        body.append("If you did not initiate this download, please contact your system administrator immediately.\n\n");
        body.append("Best regards,\n");
        body.append("HRMS Notification System");

        sendEmail(new String[] { to }, null, subject, body.toString());
    }

    private double nz(Double v) { return v == null ? 0.0 : v; }
}
