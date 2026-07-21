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
        try {
            ensureGraphClient();

            Message message = new Message();
            message.setSubject(subject);
            
            ItemBody itemBody = new ItemBody();
            itemBody.setContentType(BodyType.Html);
            // Replace newlines with <br> to support both plain text and basic HTML formatting
            itemBody.setContent(body.replace("\n", "<br>"));
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
        StringBuilder body = new StringBuilder();
        body.append("Hi ").append(userName == null || userName.isBlank() ? "there" : userName).append(",\n\n");
        body.append("Your timesheet isn't filled — please submit by end of day.\n\n");
        body.append("Best regards,\n");
        body.append("HRMS Notification System");

        sendEmail(new String[] { to }, null, subject, body.toString());
    }

    public void sendAdminPendingSummary(String to, String adminName, java.util.List<java.util.Map<String, String>> pendingEmployees, String weekRange) {
        String subject = "Timesheet Pending Submissions Summary";
        StringBuilder body = new StringBuilder();
        body.append("Hi ").append(adminName == null || adminName.isBlank() ? "there" : adminName).append(",\n\n");
        body.append("The following employees have pending timesheet submissions for the week of ").append(weekRange).append(":\n\n");
        
        body.append(String.format("%-25s %-15s %-20s\n", "Name", "Employee ID", "Role"));
        body.append("------------------------------------------------------------\n");
        for (java.util.Map<String, String> emp : pendingEmployees) {
            body.append(String.format("%-25s %-15s %-20s\n", 
                emp.getOrDefault("name", "N/A"), 
                emp.getOrDefault("oryfolksId", "N/A"), 
                emp.getOrDefault("role", "N/A")));
        }
        body.append("\nTotal Pending Employees: ").append(pendingEmployees.size()).append("\n\n");
        body.append("Best regards,\n");
        body.append("HRMS Notification System");

        sendEmail(new String[] { to }, null, subject, body.toString());
    }

    public void sendAdminAllClearSummary(String to, String adminName, String weekRange) {
        String subject = "Timesheet Submissions All-Clear";
        StringBuilder body = new StringBuilder();
        body.append("Hi ").append(adminName == null || adminName.isBlank() ? "there" : adminName).append(",\n\n");
        body.append("All employees submitted — no pending timesheets this week (").append(weekRange).append(").\n\n");
        body.append("Best regards,\n");
        body.append("HRMS Notification System");

        sendEmail(new String[] { to }, null, subject, body.toString());
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
