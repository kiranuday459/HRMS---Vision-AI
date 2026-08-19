package com.hrms.service;

import com.hrms.dto.ClientTimesheetPendingDTO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Renders each email against a realistic roster and writes it to
 * {@code target/email-previews/} so the design can be opened in a browser and looked at.
 *
 * A rendering assertion proves the pieces are present; it cannot tell you the result reads
 * well. This exists so a change to {@link HtmlEmailTemplate} can be reviewed by eye without
 * waiting for a Monday or triggering a real send.
 *
 * The roster mirrors the pending list from the reported screenshot — including the corrupted
 * "ManishaVCMMM…MMMM B" record, which is real data and is deliberately rendered in full so the
 * preview shows how the table copes with it.
 */
@ExtendWith(MockitoExtension.class)
class EmailPreviewGeneratorTest {

    private static final Path OUT = Paths.get("target", "email-previews");
    private static final String CLIENT_WEEK = "08-Aug-2026 to 14-Aug-2026";
    private static final String INTERNAL_WEEK = "2026-08-10 to 2026-08-16";

    @Spy private EmailService emailService = new EmailService();

    private String captureAndWrite(String filename) throws IOException {
        ArgumentCaptor<String> html = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendHtmlEmail(any(), any(), subject.capture(), html.capture());

        Files.createDirectories(OUT);
        // A subject strip above the body, so the preview shows what lands in the inbox list too.
        String page = "<div style=\"font:13px -apple-system,Segoe UI,Arial,sans-serif;padding:10px 14px;"
                + "background:#1e293b;color:#e2e8f0;\">Subject: <strong>"
                + subject.getValue().replace("<", "&lt;") + "</strong></div>" + html.getValue();
        Files.writeString(OUT.resolve(filename), page, StandardCharsets.UTF_8);
        return html.getValue();
    }

    /** The pending roster from the reported screenshot. */
    private List<Map<String, String>> screenshotRoster() {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(row("Nikith Gunti", "00046", "REPORTING_MANAGER"));
        rows.add(row("Rahul Ravula", "00047", "EMPLOYEE"));
        rows.add(row("Pavan K", "00049", "EMPLOYEE"));
        rows.add(row("Lavanya N", "00044", "REPORTING_MANAGER"));
        rows.add(row("ManishaVCMMMMMMMMMMMMMMMMMMMMMMMM B", "00052", "EMPLOYEE"));
        rows.add(row("Thanusha P", "00068", "REPORTING_MANAGER"));
        rows.add(row("Raviteja Ch", "00055", "REPORTING_MANAGER"));
        rows.add(row("Pavan Karumanchi", "OF-IT-PK-0416", "EMPLOYEE"));
        rows.add(row("Kiran Uday", "1818", "EMPLOYEE"));
        rows.add(row("Madhu Sudhan B", "00062", "EMPLOYEE"));
        rows.add(row("John Smith", "00064", "EMPLOYEE"));
        rows.add(row("Srilakshmi N", "00045", "EMPLOYEE"));
        return rows;
    }

    private Map<String, String> row(String name, String id, String role) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("oryfolksId", id);
        m.put("role", role);
        return m;
    }

    @Test
    void writesAPreviewOfEveryEmail() throws IOException {
        doNothing().when(emailService).sendHtmlEmail(any(), any(), anyString(), anyString());

        // 1. Monday admin summary — the internal module's email, the one in the screenshot.
        emailService.sendAdminPendingSummary("admin3@hrms.com", "admin3", screenshotRoster(), INTERNAL_WEEK);
        String internalSummary = captureAndWrite("1-internal-monday-pending-summary.html");
        assertTrue(internalSummary.contains("ManishaVCMMMMMMMMMMMMMMMMMMMMMMMM B"),
                "the corrupted record renders in full rather than being hidden");
        assertTrue(internalSummary.contains("12 employees pending"));
        reset(emailService);
        doNothing().when(emailService).sendHtmlEmail(any(), any(), anyString(), anyString());

        // 2. Monday admin summary — Client Timesheet, with per-employee missing days.
        List<ClientTimesheetPendingDTO> pending = List.of(
                new ClientTimesheetPendingDTO("Nikith Gunti", "00046", CLIENT_WEEK,
                        "Mon 10-Aug, Tue 11-Aug, Wed 12-Aug, Thu 13-Aug, Fri 14-Aug"),
                new ClientTimesheetPendingDTO("ManishaVCMMMMMMMMMMMMMMMMMMMMMMMM B", "00052", CLIENT_WEEK,
                        "Wed 12-Aug, Thu 13-Aug"),
                new ClientTimesheetPendingDTO("Pavan Karumanchi", "OF-IT-PK-0416", CLIENT_WEEK, "Fri 14-Aug"));
        emailService.sendClientTimesheetAdminSummary("admin3@hrms.com", "admin3", CLIENT_WEEK, 7, 10, pending);
        assertTrue(captureAndWrite("2-client-monday-summary.html").contains("7 of 10 submitted"));
        reset(emailService);
        doNothing().when(emailService).sendHtmlEmail(any(), any(), anyString(), anyString());

        // 3. Client rejection.
        emailService.sendClientTimesheetRejection("rahul@visionai.com", "Rahul Ravula", "00047",
                "Atlas Migration", "P-8891", CLIENT_WEEK,
                "Fill all the days for this week and then submit.", "Shalini Golla",
                "Monday, 17-Aug-2026", "Wed 12-Aug, Thu 13-Aug");
        assertTrue(captureAndWrite("3-client-rejection.html").contains("Missing/incomplete days:"));
        reset(emailService);
        doNothing().when(emailService).sendHtmlEmail(any(), any(), anyString(), anyString());

        // 4. Client Friday reminder.
        emailService.sendClientTimesheetWeeklyReminder("rahul@visionai.com", "Rahul Ravula", "00047",
                CLIENT_WEEK, "Wed 12-Aug, Thu 13-Aug, Fri 14-Aug");
        captureAndWrite("4-client-friday-reminder.html");
        reset(emailService);
        doNothing().when(emailService).sendHtmlEmail(any(), any(), anyString(), anyString());

        // 5. Client all-submitted week.
        emailService.sendClientTimesheetAdminSummary("admin3@hrms.com", "admin3", CLIENT_WEEK, 10, 10, List.of());
        captureAndWrite("5-client-monday-all-clear.html");
        reset(emailService);
        doNothing().when(emailService).sendHtmlEmail(any(), any(), anyString(), anyString());

        // 6. Internal Friday reminder.
        emailService.sendTimesheetWeeklyReminder("rahul@visionai.com", "Rahul Ravula");
        captureAndWrite("6-internal-weekly-reminder.html");

        System.out.println("[EmailPreview] wrote previews to " + OUT.toAbsolutePath());
    }
}
