package com.hrms.service;

import com.hrms.dto.ClientTimesheetPendingDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * What the six timesheet emails actually render.
 *
 * The scheduler and service tests pin who is mailed and why; this pins the result — the subject
 * line, that every field the requirement names reaches the body, and that the shared HTML shell
 * is applied consistently rather than each message inventing its own look.
 *
 * Delivery is stubbed at {@link EmailService#sendHtmlEmail}, the single point every template
 * funnels through, so nothing here touches the Graph API.
 */
@ExtendWith(MockitoExtension.class)
class ClientTimesheetEmailTemplateTest {

    private static final String WEEK = "08-Aug-2026 to 14-Aug-2026";

    @Spy private EmailService emailService = new EmailService();

    @BeforeEach
    void stubDelivery() {
        doNothing().when(emailService).sendHtmlEmail(any(), any(), anyString(), anyString());
    }

    private String subject() {
        ArgumentCaptor<String> c = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendHtmlEmail(any(), any(), c.capture(), anyString());
        return c.getValue();
    }

    private String body() {
        ArgumentCaptor<String> c = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendHtmlEmail(any(), any(), anyString(), c.capture());
        return c.getValue();
    }

    private String[] recipients() {
        ArgumentCaptor<String[]> c = ArgumentCaptor.forClass(String[].class);
        verify(emailService).sendHtmlEmail(c.capture(), any(), anyString(), anyString());
        return c.getValue();
    }

    /** Text with the tags stripped — what the recipient actually reads. */
    private String text() {
        return body().replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
    }

    // ── 1. Rejection ────────────────────────────────────────────────────────

    private void sendRejection() {
        emailService.sendClientTimesheetRejection(
                "rahul@visionai.com", "rahul ravula r", "OF-IT-PK-0416",
                "Atlas Migration", "P-8891", WEEK,
                "Friday hours are logged against the wrong task id.",
                "Shalini Golla", "Monday, 17-Aug-2026", null);
    }

    @Test
    void rejectionSubjectNamesTheWeek() {
        sendRejection();
        assertEquals("Your Client Timesheet for " + WEEK + " was rejected.", subject());
    }

    @Test
    void rejectionBodyCarriesEveryRequiredField() {
        sendRejection();
        String text = text();
        assertAll(
                () -> assertTrue(text.contains("rahul ravula r"), "employee name"),
                () -> assertTrue(text.contains("OF-IT-PK-0416"), "employee id"),
                () -> assertTrue(text.contains("Atlas Migration"), "project name"),
                () -> assertTrue(text.contains("P-8891"), "project id"),
                () -> assertTrue(text.contains(WEEK), "week range"),
                () -> assertTrue(text.contains("Friday hours are logged against the wrong task id."), "reason"),
                () -> assertTrue(text.contains("Shalini Golla"), "who rejected it"),
                () -> assertTrue(text.contains("Monday, 17-Aug-2026"), "when, with the day name"));
        assertArrayEquals(new String[] { "rahul@visionai.com" }, recipients());
    }

    @Test
    void rejectionSurvivesAMissingReason() {
        emailService.sendClientTimesheetRejection("rahul@visionai.com", "rahul ravula r",
                "OF-IT-PK-0416", "Atlas Migration", "P-8891", WEEK, null, "Shalini Golla",
                "Monday, 17-Aug-2026", null);
        assertTrue(text().contains("No reason was recorded."));
    }

    @Test
    void rejectionFoldsTheMissingDaysIntoTheOneEmail() {
        emailService.sendClientTimesheetRejection("rahul@visionai.com", "rahul ravula r",
                "OF-IT-PK-0416", "Atlas Migration", "P-8891", WEEK,
                "Fill all the days for this week and then submit.", "Shalini Golla",
                "Monday, 17-Aug-2026", "Wed 12-Aug, Thu 13-Aug");
        String text = text();
        assertTrue(text.contains("Missing/incomplete days: Wed 12-Aug, Thu 13-Aug"));
        assertTrue(text.indexOf("Fill all the days") < text.indexOf("Missing/incomplete days:"),
                "the days elaborate on the reason, so they follow it");
    }

    @Test
    void rejectionOmitsTheMissingDaysSectionWhenThereAreNone() {
        emailService.sendClientTimesheetRejection("rahul@visionai.com", "rahul ravula r",
                "OF-IT-PK-0416", "Atlas Migration", "P-8891", WEEK, "Wrong task id.",
                "Shalini Golla", "Monday, 17-Aug-2026", "—");
        assertFalse(body().contains("Missing/incomplete days"));
    }

    // ── 2. Friday employee reminder ─────────────────────────────────────────

    @Test
    void reminderSubjectNamesTheWeek() {
        emailService.sendClientTimesheetWeeklyReminder("rahul@visionai.com", "rahul ravula r",
                "OF-IT-PK-0416", WEEK, "Wed 12-Aug, Thu 13-Aug, Fri 14-Aug");
        assertEquals("Reminder: Client Timesheet incomplete for " + WEEK + ".", subject());
    }

    @Test
    void reminderBodyListsTheMissingDaysIndividually() {
        emailService.sendClientTimesheetWeeklyReminder("rahul@visionai.com", "rahul ravula r",
                "OF-IT-PK-0416", WEEK, "Wed 12-Aug, Thu 13-Aug, Fri 14-Aug");
        String text = text();
        assertAll(
                () -> assertTrue(text.contains("rahul ravula r"), "employee name"),
                () -> assertTrue(text.contains("OF-IT-PK-0416"), "employee id"),
                () -> assertTrue(text.contains(WEEK), "week range"),
                () -> assertTrue(text.contains("Missing: Wed 12-Aug, Thu 13-Aug, Fri 14-Aug"),
                        "the days named, not counted"));
    }

    // ── 3. Monday admin summary ─────────────────────────────────────────────

    private List<ClientTimesheetPendingDTO> threePending() {
        return List.of(
                new ClientTimesheetPendingDTO("deepika k", "OF-IT-PK-0002", WEEK,
                        "Wed 12-Aug, Thu 13-Aug, Fri 14-Aug"),
                new ClientTimesheetPendingDTO("nikith g", "OF-IT-PK-0003", WEEK,
                        "Mon 10-Aug, Tue 11-Aug, Wed 12-Aug, Thu 13-Aug, Fri 14-Aug"),
                new ClientTimesheetPendingDTO("suma y", "OF-IT-PK-0004", WEEK, "Fri 14-Aug"));
    }

    @Test
    void summarySubjectCountsThePendingEmployees() {
        emailService.sendClientTimesheetAdminSummary("shalini@visionai.com", "Shalini Golla",
                WEEK, 7, 10, threePending());
        assertEquals("Weekly Client Timesheet Summary — " + WEEK + ": 3 employees pending.", subject());
    }

    @Test
    void summarySubjectReadsNaturallyForASingleEmployee() {
        emailService.sendClientTimesheetAdminSummary("shalini@visionai.com", "Shalini Golla",
                WEEK, 9, 10, threePending().subList(0, 1));
        assertEquals("Weekly Client Timesheet Summary — " + WEEK + ": 1 employee pending.", subject());
    }

    /** The count is a stat block above the table, not a sentence buried in prose. */
    @Test
    void summaryLeadsWithTheCountThenTheDetail() {
        emailService.sendClientTimesheetAdminSummary("shalini@visionai.com", "Shalini Golla",
                WEEK, 7, 10, threePending());
        String text = text();
        assertAll(
                () -> assertTrue(text.contains("7 of 10 submitted"), "headline count"),
                () -> assertTrue(text.contains("3 pending"), "the other half of the split"),
                () -> assertTrue(text.contains("deepika k"), "pending employee name"),
                () -> assertTrue(text.contains("OF-IT-PK-0002"), "pending employee id"),
                () -> assertTrue(text.contains("Wed 12-Aug, Thu 13-Aug, Fri 14-Aug"), "missing days"),
                () -> assertTrue(text.indexOf("7 of 10 submitted") < text.indexOf("Not submitted"),
                        "the count comes before the list"));
    }

    /** Missing days are a table column, so they sit on the same row as the employee. */
    @Test
    void summaryTableHasAMissingDaysColumn() {
        emailService.sendClientTimesheetAdminSummary("shalini@visionai.com", "Shalini Golla",
                WEEK, 7, 10, threePending());
        String text = text();
        assertTrue(text.contains("Employee Employee ID Missing Days"),
                "three column headings, in order");
        assertTrue(text.contains("suma y OF-IT-PK-0004 Fri 14-Aug"),
                "each employee's row carries their own missing days");
    }

    @Test
    void summaryReportsACleanWeekWithoutAnEmptyTable() {
        emailService.sendClientTimesheetAdminSummary("shalini@visionai.com", "Shalini Golla",
                WEEK, 10, 10, List.of());
        assertEquals("Weekly Client Timesheet Summary — " + WEEK + ": all submitted.", subject());
        String text = text();
        assertTrue(text.contains("10 of 10 submitted"));
        assertFalse(text.contains("Not submitted"), "no empty list heading on a clean week");
    }

    // ── 4. The internal module's three, same shell ──────────────────────────

    private List<Map<String, String>> internalPending() {
        return List.of(
                Map.of("name", "Nikith Gunti", "oryfolksId", "00046", "role", "REPORTING_MANAGER"),
                Map.of("name", "Rahul Ravula", "oryfolksId", "00047", "role", "EMPLOYEE"));
    }

    @Test
    void internalPendingSummaryRendersARealTable() {
        emailService.sendAdminPendingSummary("admin3@hrms.com", "admin3", internalPending(),
                "2026-08-10 to 2026-08-16");
        assertEquals("Timesheet Pending Submissions Summary", subject());
        String text = text();
        assertAll(
                () -> assertTrue(text.contains("Name Employee ID Role"), "the three original columns"),
                () -> assertTrue(text.contains("Nikith Gunti 00046 REPORTING_MANAGER"), "a full row"),
                () -> assertTrue(text.contains("2 employees pending"), "count up top"),
                () -> assertTrue(text.contains("2026-08-10 to 2026-08-16"), "week range in the header"));
        assertTrue(body().contains("<th"), "a real table header, not dashed text");
    }

    /**
     * The corrupted employee name from the reported screenshot. It is genuine data, so the
     * template must render it in full — wrapped, not cut — rather than hide the problem.
     */
    @Test
    void internalPendingSummaryShowsAnOverlongNameInFullRatherThanTruncatingIt() {
        String corrupted = "ManishaVCMMMMMMMMMMMMMMMMMMMMMMMM B";
        emailService.sendAdminPendingSummary("admin3@hrms.com", "admin3",
                List.of(Map.of("name", corrupted, "oryfolksId", "00052", "role", "EMPLOYEE")),
                "2026-08-10 to 2026-08-16");
        assertTrue(text().contains(corrupted), "the name is shown as stored, so the record gets fixed");
        assertTrue(body().contains("word-break:break-word"), "it wraps instead of stretching the table");
    }

    @Test
    void internalAllClearAndReminderUseTheSameShell() {
        emailService.sendAdminAllClearSummary("admin3@hrms.com", "admin3", "2026-08-10 to 2026-08-16");
        assertEquals("Timesheet Submissions All-Clear", subject());
        assertTrue(text().contains("All employees submitted"));
    }

    @Test
    void internalWeeklyReminderUsesTheSameShell() {
        emailService.sendTimesheetWeeklyReminder("rahul@visionai.com", "Rahul");
        assertEquals("Timesheet Weekly Reminder", subject());
        assertTrue(text().contains("Please submit your timesheet by end of day."));
    }

    // ── The shared shell itself ─────────────────────────────────────────────

    /**
     * Every message carries the same plain-text shell: heading, body and footer, with no
     * card chrome around them.
     *
     * The coloured band, tinted panels and rounded border this used to assert were dropped
     * deliberately. Recipients read the framed card as a pasted-in screenshot rather than a
     * written message, which is the one impression a notification cannot afford to give — so
     * the absence of that chrome is now the thing worth protecting, and it is asserted here
     * rather than merely left untested.
     */
    @Test
    void everyEmailUsesTheSharedPlainTextShell() {
        sendRejection();
        String html = body();
        assertAll(
                () -> assertFalse(html.contains("#0f172a"), "no navy header band"),
                () -> assertFalse(html.contains("#0d9488"), "no teal accent bar"),
                () -> assertFalse(html.contains("border-radius"), "no rounded card"),
                () -> assertFalse(html.contains("<img"), "text, never an image"),
                () -> assertTrue(html.contains("max-width:640px"), "constrained width"),
                () -> assertTrue(html.contains("VisionAI HRMS"), "footer"),
                () -> assertTrue(html.contains("Client Timesheet Rejected"), "title as plain text"),
                () -> assertFalse(html.contains("<style"), "inline styles only — Outlook drops style blocks"));
    }

    /**
     * Names and reasons are typed by people and go straight into markup. An apostrophe in
     * "O'Brien" must not break the document, and a value must never be able to carry tags of
     * its own into the message.
     */
    @Test
    void escapesUserSuppliedTextInsteadOfInjectingItAsMarkup() {
        emailService.sendClientTimesheetRejection("x@visionai.com", "Ann O'Brien <script>", "ID-1",
                "P & L Review", "P-1", WEEK, "Use <b>task 4</b>, not task 5.", "Admin", "Monday, 17-Aug-2026", null);
        String html = body();
        assertAll(
                () -> assertFalse(html.contains("<script>"), "no raw tag from a name"),
                () -> assertTrue(html.contains("&lt;script&gt;"), "escaped instead"),
                () -> assertTrue(html.contains("O&#39;Brien"), "apostrophe escaped"),
                () -> assertTrue(html.contains("P &amp; L Review"), "ampersand escaped"),
                () -> assertTrue(html.contains("&lt;b&gt;task 4&lt;/b&gt;"), "reason escaped, not honoured"));
    }
}
