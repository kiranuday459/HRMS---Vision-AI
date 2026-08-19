package com.hrms.service;

import com.hrms.model.ClientProjectAssignment;
import com.hrms.model.ClientTimesheet;
import com.hrms.model.ClientTimesheetStatus;
import com.hrms.model.Employee;
import com.hrms.model.User;
import com.hrms.repository.ClientProjectAssignmentRepository;
import com.hrms.repository.ClientTimesheetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Scenario 1: an admin rejects a client timesheet and the employee is emailed immediately.
 *
 * The email is an addition — the bell notification the module already writes is untouched, and
 * so is the rejection decision itself. What is pinned here is what the employee receives: their
 * own name and id, the project and week, the admin's reason verbatim, who rejected it, and the
 * day it happened.
 *
 * The awkward part of this flow is that rejecting a week is not one call. The admin clicks once
 * and the frontend posts /reject per day row, so a five-day week rejects five times. One email
 * is correct; five is the module shouting.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ClientTimesheetRejectionEmailTest {

    private static final Long EMP_ID = 11L;
    private static final String LOGIN = "rahulreddyravula@visionai.com";
    private static final String PERSONAL = "rahul@gmail.com";
    /** A Saturday — client timesheet weeks run Saturday → Friday. */
    private static final LocalDate WEEK_START = LocalDate.of(2026, 8, 8);
    private static final LocalDateTime REJECTED_AT = LocalDateTime.of(2026, 8, 17, 9, 30);
    private static final String REASON = "Friday hours are logged against the wrong task id.";

    @Mock private EmailService emailService;
    @Mock private ClientTimesheetRepository lineRepository;
    @Mock private ClientProjectAssignmentRepository assignmentRepository;
    @Mock private EmployeeCodeResolver employeeCodeResolver;
    @Mock private UserDisplayNameResolver userDisplayNameResolver;

    /** The real routing rule, shared with the OTP — see ClientOtpEmailRecipientTest. */
    @Spy private CorporateEmailResolver corporateEmailResolver = new CorporateEmailResolver();

    /** Real: the missing-days section folded into this email must match the Friday reminder's. */
    @Spy private ClientTimesheetWeekCompletion weekCompletion = new ClientTimesheetWeekCompletion();

    @InjectMocks private ClientTimesheetEmailService service;

    private Employee employee;
    private User admin;

    @BeforeEach
    void setUp() {
        employee = new Employee();
        employee.setId(EMP_ID);
        employee.setFirstName("rahul");
        employee.setLastName("ravula r");
        employee.setEmail(PERSONAL);          // the Personal Email — must never be used
        employee.setCorporateEmail(null);     // never populated in any environment

        User account = new User();
        account.setEmail(LOGIN);
        employee.setUser(account);

        admin = new User();
        admin.setUsername("admin");

        when(employeeCodeResolver.resolve(employee)).thenReturn("OF-IT-PK-0416");
        when(userDisplayNameResolver.resolve(admin)).thenReturn("Shalini Golla");
        when(assignmentRepository.findByEmployeeIdAndActiveTrue(EMP_ID)).thenReturn(List.of());
    }

    /** One persisted day row of the rejected week. */
    private ClientTimesheet line(long id, LocalDate date, ClientTimesheetStatus status, LocalDateTime reviewedAt) {
        ClientTimesheet l = new ClientTimesheet();
        l.setId(id);
        l.setEmployee(employee);
        l.setDate(date);
        l.setWeekStartDate(WEEK_START);
        l.setWeekEndDate(WEEK_START.plusDays(6));
        l.setCategory("PROJECT");
        l.setProjectId("P-8891");
        l.setProjectName("Atlas Migration");
        l.setHours(8.0);
        l.setStatus(status);
        l.setRejectionReason(status == ClientTimesheetStatus.REJECTED ? REASON : null);
        l.setApprovedBy(status == ClientTimesheetStatus.REJECTED ? admin : null);
        l.setReviewedAt(reviewedAt);
        return l;
    }

    /**
     * Writes onto a row exactly what ClientTimesheetService.reject writes before it calls in
     * here — status, reason, reviewer and timestamp — so these tests exercise the same state
     * the production path produces.
     */
    private ClientTimesheet rejectRow(ClientTimesheet row, LocalDateTime at) {
        row.setStatus(ClientTimesheetStatus.REJECTED);
        row.setRejectionReason(REASON);
        row.setApprovedBy(admin);
        row.setReviewedAt(at);
        return row;
    }

    /** The five Mon–Fri rows of the week, all still pending. */
    private List<ClientTimesheet> pendingWeek() {
        List<ClientTimesheet> lines = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            lines.add(line(100 + i, WEEK_START.plusDays(2 + i), ClientTimesheetStatus.PENDING, null));
        }
        return lines;
    }

    private String[] capturedEmail() {
        ArgumentCaptor<String> to = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> name = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> empId = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> project = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> projectId = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> week = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> reason = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> by = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> on = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> missing = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendClientTimesheetRejection(to.capture(), name.capture(), empId.capture(),
                project.capture(), projectId.capture(), week.capture(), reason.capture(), by.capture(),
                on.capture(), missing.capture());
        return new String[] { to.getValue(), name.getValue(), empId.getValue(), project.getValue(),
                projectId.getValue(), week.getValue(), reason.getValue(), by.getValue(), on.getValue(),
                missing.getValue() };
    }

    /** Counts sends without caring about the arguments. */
    private void verifySendCount(int times) {
        verify(emailService, times(times)).sendClientTimesheetRejection(
                anyString(), anyString(), any(), any(), any(), anyString(), any(), any(), anyString(), any());
    }

    // ── The email fires, with everything the employee needs ─────────────────

    @Test
    void emailsTheEmployeeAsSoonAsTheWeekIsRejected() {
        List<ClientTimesheet> week = pendingWeek();
        ClientTimesheet rejected = rejectRow(week.get(0), REJECTED_AT);
        when(lineRepository.findByEmployeeIdAndWeekStartDate(EMP_ID, WEEK_START)).thenReturn(week);

        service.sendRejectionNotice(rejected);

        String[] sent = capturedEmail();
        assertEquals(LOGIN, sent[0], "must go to the login/corporate address");
        assertEquals("rahul ravula r", sent[1]);
        assertEquals("OF-IT-PK-0416", sent[2]);
        assertEquals("Atlas Migration", sent[3]);
        assertEquals("P-8891", sent[4]);
        assertEquals("08-Aug-2026 to 14-Aug-2026", sent[5]);
        assertEquals(REASON, sent[6], "the admin's reason, verbatim");
        assertEquals("Shalini Golla", sent[7]);
    }

    /** "Rejected on Monday, 17-Aug-2026" — the day name is part of the requirement. */
    @Test
    void namesTheDayItWasRejectedNotJustTheDate() {
        List<ClientTimesheet> week = pendingWeek();
        ClientTimesheet rejected = rejectRow(week.get(0), REJECTED_AT); // 17 Aug 2026 is a Monday
        when(lineRepository.findByEmployeeIdAndWeekStartDate(EMP_ID, WEEK_START)).thenReturn(week);

        service.sendRejectionNotice(rejected);

        assertEquals("Monday, 17-Aug-2026", capturedEmail()[8]);
    }

    @Test
    void neverSendsToThePersonalEmail() {
        List<ClientTimesheet> week = pendingWeek();
        ClientTimesheet rejected = rejectRow(week.get(0), REJECTED_AT);
        when(lineRepository.findByEmployeeIdAndWeekStartDate(EMP_ID, WEEK_START)).thenReturn(week);

        service.sendRejectionNotice(rejected);

        assertNotEquals(PERSONAL, capturedEmail()[0]);
    }

    @Test
    void sendsNothingWhenTheEmployeeHasNoLoginAccount() {
        employee.setUser(null);
        List<ClientTimesheet> week = pendingWeek();
        ClientTimesheet rejected = rejectRow(week.get(0), REJECTED_AT);

        service.sendRejectionNotice(rejected);

        verifyNoInteractions(emailService);
    }

    // ── One click, one email ────────────────────────────────────────────────

    /** Rejections arriving one after another, each row written before its notice. One email. */
    @Test
    void sendsOneEmailForAWeekRejectedRowByRow() {
        List<ClientTimesheet> week = pendingWeek();
        when(lineRepository.findByEmployeeIdAndWeekStartDate(EMP_ID, WEEK_START)).thenReturn(week);

        for (ClientTimesheet row : week) {
            service.sendRejectionNotice(rejectRow(row, REJECTED_AT));
        }

        verifySendCount(1);
    }

    /**
     * The bug as reported: one rejection, five emails.
     *
     * This is the shape the previous check could not survive. The admin UI posts /reject for
     * every day row through Promise.all, so five requests run concurrently, each in its own
     * transaction, each sending its email before any of them commits. Every request therefore
     * looks at the week and sees the other four rows still PENDING — none of them can tell that
     * it is not the first, so all five sent.
     *
     * Modelled by sending all five notices against a week whose rows are still PENDING, which is
     * exactly what each of those transactions observes.
     */
    @Test
    void sendsOneEmailWhenEveryRowIsRejectedConcurrentlyAndNoneHasCommitted() {
        List<ClientTimesheet> week = pendingWeek();
        when(lineRepository.findByEmployeeIdAndWeekStartDate(EMP_ID, WEEK_START)).thenReturn(week);

        for (ClientTimesheet row : week) {
            service.sendRejectionNotice(rejectRow(copyOf(row), REJECTED_AT));
        }

        verifySendCount(1);
    }

    /**
     * The opposite visibility, which the fix must survive just as well: every commit is visible,
     * so each request sees all five rows already REJECTED. A check that suppressed on "a sibling
     * is already rejected" would send nothing at all here.
     */
    @Test
    void sendsOneEmailWhenEveryRowIsAlreadyVisiblyRejected() {
        List<ClientTimesheet> week = pendingWeek();
        week.forEach(row -> rejectRow(row, REJECTED_AT));
        when(lineRepository.findByEmployeeIdAndWeekStartDate(EMP_ID, WEEK_START)).thenReturn(week);

        for (ClientTimesheet row : week) {
            service.sendRejectionNotice(row);
        }

        verifySendCount(1);
    }

    /** The same five rejections on five real threads, released together. */
    @Test
    void sendsOneEmailUnderGenuineConcurrency() throws Exception {
        List<ClientTimesheet> week = pendingWeek();
        when(lineRepository.findByEmployeeIdAndWeekStartDate(EMP_ID, WEEK_START)).thenReturn(week);

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(week.size());
        List<Future<?>> running = new ArrayList<>();
        for (ClientTimesheet row : week) {
            ClientTimesheet mine = rejectRow(copyOf(row), REJECTED_AT);
            running.add(pool.submit(() -> {
                try {
                    start.await();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }
                service.sendRejectionNotice(mine);
            }));
        }
        start.countDown();
        for (Future<?> f : running) {
            f.get(10, TimeUnit.SECONDS);
        }
        pool.shutdown();

        verifySendCount(1);
    }

    /** A row as a different transaction would load it — same id and data, separate instance. */
    private ClientTimesheet copyOf(ClientTimesheet source) {
        ClientTimesheet c = line(source.getId(), source.getDate(), source.getStatus(), source.getReviewedAt());
        c.setCategory(source.getCategory());
        c.setProjectId(source.getProjectId());
        c.setProjectName(source.getProjectName());
        return c;
    }

    /**
     * A week sent back a second time must email again. Resubmitting deletes and recreates the
     * line rows, so the second rejection carries none of the first one's rows to suppress it —
     * which is what makes the dedup safe rather than a permanent gag.
     */
    @Test
    void emailsAgainWhenAResubmittedWeekIsRejectedASecondTime() {
        List<ClientTimesheet> firstRound = pendingWeek();
        when(lineRepository.findByEmployeeIdAndWeekStartDate(EMP_ID, WEEK_START)).thenReturn(firstRound);
        service.sendRejectionNotice(rejectRow(firstRound.get(0), REJECTED_AT));

        // Employee resubmits: old rows deleted, new rows written with new ids.
        List<ClientTimesheet> secondRound = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            secondRound.add(line(200 + i, WEEK_START.plusDays(2 + i), ClientTimesheetStatus.PENDING, null));
        }
        when(lineRepository.findByEmployeeIdAndWeekStartDate(EMP_ID, WEEK_START)).thenReturn(secondRound);
        service.sendRejectionNotice(rejectRow(secondRound.get(0), REJECTED_AT.plusMinutes(2)));

        verify(emailService, times(2)).sendClientTimesheetRejection(
                anyString(), anyString(), any(), any(), any(), anyString(), any(), any(), anyString(), any());
    }

    // ── Missing days, consolidated into the one email ───────────────────────

    /**
     * The reason that prompted this: "fill all the days for this week and then submit". The
     * days it refers to are named inside the single rejection email, not split across one email
     * per day.
     */
    @Test
    void listsEveryMissingDayInsideTheOneEmail() {
        // Mon and Tue filled; Wed, Thu and Fri never were.
        List<ClientTimesheet> partial = new ArrayList<>();
        partial.add(line(100, WEEK_START.plusDays(2), ClientTimesheetStatus.PENDING, null)); // Mon
        partial.add(line(101, WEEK_START.plusDays(3), ClientTimesheetStatus.PENDING, null)); // Tue
        when(lineRepository.findByEmployeeIdAndWeekStartDate(EMP_ID, WEEK_START)).thenReturn(partial);

        ClientProjectAssignment assignment = new ClientProjectAssignment();
        assignment.setAssignmentStartDate(LocalDate.of(2026, 1, 1));
        when(assignmentRepository.findByEmployeeIdAndActiveTrue(EMP_ID)).thenReturn(List.of(assignment));

        service.sendRejectionNotice(rejectRow(partial.get(0), REJECTED_AT));

        verifySendCount(1);
        assertEquals("Wed 12-Aug, Thu 13-Aug, Fri 14-Aug", capturedEmail()[9]);
    }

    /** A week rejected for some other reason must not grow a misleading missing-days section. */
    @Test
    void reportsNoMissingDaysWhenTheWeekIsFullyFilled() {
        List<ClientTimesheet> week = pendingWeek(); // all five weekdays carry hours
        when(lineRepository.findByEmployeeIdAndWeekStartDate(EMP_ID, WEEK_START)).thenReturn(week);

        service.sendRejectionNotice(rejectRow(week.get(0), REJECTED_AT));

        assertEquals("—", capturedEmail()[9], "nothing to list on a complete week");
    }

    // ── Falling back to the assignment for project details ──────────────────

    /**
     * Rejection acts per day row, and the row that fires the email may be a time-off line,
     * which carries no project at all. The week's other rows answer for it; when the whole week
     * is time off, the active assignment does.
     */
    @Test
    void namesTheProjectEvenWhenTheRejectedRowIsATimeOffLine() {
        ClientTimesheet timeOff = line(300, WEEK_START.plusDays(2), ClientTimesheetStatus.REJECTED, REJECTED_AT);
        timeOff.setCategory("PTO");
        timeOff.setProjectId(null);
        timeOff.setProjectName(null);
        when(lineRepository.findByEmployeeIdAndWeekStartDate(EMP_ID, WEEK_START)).thenReturn(List.of(timeOff));

        ClientProjectAssignment assignment = new ClientProjectAssignment();
        assignment.setProjectId("P-8891");
        assignment.setProjectName("Atlas Migration");
        when(assignmentRepository.findByEmployeeIdAndActiveTrue(EMP_ID)).thenReturn(List.of(assignment));

        service.sendRejectionNotice(timeOff);

        String[] sent = capturedEmail();
        assertEquals("Atlas Migration", sent[3]);
        assertEquals("P-8891", sent[4]);
    }

    // ── The rejection itself must survive a mail failure ────────────────────

    @Test
    void neverThrowsWhenMailDeliveryFails() {
        List<ClientTimesheet> week = pendingWeek();
        ClientTimesheet rejected = rejectRow(week.get(0), REJECTED_AT);
        when(lineRepository.findByEmployeeIdAndWeekStartDate(EMP_ID, WEEK_START)).thenReturn(week);
        doThrow(new RuntimeException("Graph API down")).when(emailService).sendClientTimesheetRejection(
                anyString(), anyString(), any(), any(), any(), anyString(), any(), any(), anyString(), any());

        assertDoesNotThrow(() -> service.sendRejectionNotice(rejected));
    }
}
