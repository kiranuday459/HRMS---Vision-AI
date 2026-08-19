package com.hrms.scheduler;

import com.hrms.dto.ClientTimesheetPendingDTO;
import com.hrms.model.ClientProjectAssignment;
import com.hrms.model.ClientTimesheet;
import com.hrms.model.ClientTimesheetStatus;
import com.hrms.model.Employee;
import com.hrms.model.Role;
import com.hrms.model.User;
import com.hrms.repository.ClientProjectAssignmentRepository;
import com.hrms.repository.ClientTimesheetRepository;
import com.hrms.repository.TimesheetNotificationLogRepository;
import com.hrms.repository.UserRepository;
import com.hrms.service.ClientTimesheetEmailService;
import com.hrms.service.ClientTimesheetWeekCompletion;
import com.hrms.service.EmployeeCodeResolver;
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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Scenarios 2 and 3: the two scheduled Client Timesheet reminders.
 *
 *   Friday 13:00 JST — each employee with an incomplete week, told which days they owe.
 *   Monday 10:00 JST — admins, told how many submitted and who did not.
 *
 * Both jobs run against a fixed date here rather than the wall clock. Which days count as
 * missing is the entire behaviour under test, so a suite that had to reason about the day it
 * happened to run on could not pin it — hence the package-private runWeeklyReminder(today) /
 * runAdminSummary(today) the @Scheduled methods delegate to.
 *
 * The calendar these dates sit on:
 *   Sat 08-Aug-2026  week start (client timesheet weeks run Saturday → Friday)
 *   Mon 10-Aug … Fri 14-Aug   the five expected workdays
 *   Fri 14-Aug-2026  the Friday job's reference date — the week closes today
 *   Mon 17-Aug-2026  the Monday job's reference date — reports the week above
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ClientTimesheetReminderEmailTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 8, 8);   // Saturday
    private static final LocalDate MON = LocalDate.of(2026, 8, 10);
    private static final LocalDate TUE = LocalDate.of(2026, 8, 11);
    private static final LocalDate WED = LocalDate.of(2026, 8, 12);
    private static final LocalDate THU = LocalDate.of(2026, 8, 13);
    private static final LocalDate FRI = LocalDate.of(2026, 8, 14);
    private static final LocalDate NEXT_MONDAY = LocalDate.of(2026, 8, 17);

    @Mock private ClientProjectAssignmentRepository assignmentRepository;
    @Mock private ClientTimesheetRepository lineRepository;
    @Mock private UserRepository userRepository;
    @Mock private TimesheetNotificationLogRepository notificationLogRepository;
    @Mock private EmployeeCodeResolver employeeCodeResolver;

    /** Real: deciding which days are missing is the behaviour being tested, not a collaborator. */
    @Spy private ClientTimesheetWeekCompletion weekCompletion = new ClientTimesheetWeekCompletion();

    /**
     * Real instance, spied. Its date formatters are pure, so the pending list the Monday job
     * builds carries real "Mon 10-Aug" strings; the two send methods are stubbed because
     * delivery itself belongs to ClientTimesheetRejectionEmailTest's collaborator, EmailService.
     */
    @Spy private ClientTimesheetEmailService emailService = new ClientTimesheetEmailService();

    @InjectMocks private ClientTimesheetScheduler scheduler;

    @BeforeEach
    void setUp() {
        doReturn(true).when(emailService).sendWeeklyReminder(any(), any(), anyList());
        doReturn(1).when(emailService).sendAdminSummary(any(), any(), anyInt(), anyInt(), anyList());
        when(notificationLogRepository.existsByEmployeeIdAndWeekStartAndNotificationType(any(), any(), anyString()))
                .thenReturn(false);
        when(notificationLogRepository.existsByEmployeeIsNullAndWeekStartAndNotificationType(any(), anyString()))
                .thenReturn(false);
        when(employeeCodeResolver.resolve(any())).thenAnswer(inv -> {
            Employee e = inv.getArgument(0);
            return e == null ? "—" : "OF-IT-PK-" + String.format("%04d", e.getId());
        });
        when(userRepository.findByRole(Role.ADMIN)).thenReturn(List.of(admin("shalini")));
    }

    // ---- fixtures ----------------------------------------------------------

    private Employee employee(long id, String first, String last) {
        Employee e = new Employee();
        e.setId(id);
        e.setFirstName(first);
        e.setLastName(last);
        e.setActive(true);
        User account = new User();
        account.setEmail(first + "@visionai.com");
        e.setUser(account);
        return e;
    }

    private User admin(String username) {
        User u = new User();
        u.setUsername(username);
        u.setEmail(username + "@visionai.com");
        u.setRole(Role.ADMIN);
        u.setActive(true);
        return u;
    }

    /** Puts the employee on an active project, assigned from the given date. */
    private void assign(Employee employee, LocalDate from) {
        ClientProjectAssignment a = new ClientProjectAssignment();
        a.setEmployee(employee);
        a.setProjectId("P-8891");
        a.setProjectName("Atlas Migration");
        a.setAssignmentStartDate(from);
        a.setActive(true);
        assignments.add(a);
    }

    private final List<ClientProjectAssignment> assignments = new ArrayList<>();

    private void wireAssignments() {
        when(assignmentRepository.findByActiveTrue()).thenReturn(assignments);
    }

    /** Eight hours of project work on each of the given days. */
    private void filled(Employee employee, ClientTimesheetStatus status, LocalDate... days) {
        List<ClientTimesheet> lines = new ArrayList<>();
        for (LocalDate d : days) {
            ClientTimesheet l = new ClientTimesheet();
            l.setEmployee(employee);
            l.setDate(d);
            l.setWeekStartDate(WEEK_START);
            l.setCategory("PROJECT");
            l.setHours(8.0);
            l.setStatus(status);
            lines.add(l);
        }
        when(lineRepository.findByEmployeeIdAndWeekStartDate(employee.getId(), WEEK_START)).thenReturn(lines);
    }

    private void nothingFilled(Employee employee) {
        when(lineRepository.findByEmployeeIdAndWeekStartDate(employee.getId(), WEEK_START))
                .thenReturn(List.of());
    }

    @SuppressWarnings("unchecked")
    private List<LocalDate> capturedMissingDays() {
        ArgumentCaptor<List<LocalDate>> captor = ArgumentCaptor.forClass(List.class);
        verify(emailService).sendWeeklyReminder(any(), eq(WEEK_START), captor.capture());
        return captor.getValue();
    }

    // =====================================================================
    // Scenario 2 — Friday 13:00 JST, employee with an incomplete week
    // =====================================================================

    /** The plain case: nothing entered all week, so all five workdays are named. */
    @Test
    void remindsAnEmployeeWhoFilledNothingAllWeek() {
        Employee e = employee(1L, "rahul", "ravula");
        assign(e, LocalDate.of(2026, 1, 1));
        nothingFilled(e);
        wireAssignments();

        assertEquals(1, scheduler.runWeeklyReminder(FRI));
        assertEquals(List.of(MON, TUE, WED, THU, FRI), capturedMissingDays());
    }

    /** The requirement's own example shape: some days in, the gaps named individually. */
    @Test
    void namesExactlyTheDaysLeftBlankNotJustThatSomeAreMissing() {
        Employee e = employee(2L, "deepika", "k");
        assign(e, LocalDate.of(2026, 1, 1));
        filled(e, ClientTimesheetStatus.DRAFT, MON, TUE);
        wireAssignments();

        scheduler.runWeeklyReminder(FRI);

        assertEquals(List.of(WED, THU, FRI), capturedMissingDays());
    }

    /** Up to date means no email at all — not an email saying nothing is missing. */
    @Test
    void leavesAnEmployeeWhoIsUpToDateAlone() {
        Employee e = employee(3L, "nikith", "g");
        assign(e, LocalDate.of(2026, 1, 1));
        filled(e, ClientTimesheetStatus.DRAFT, MON, TUE, WED, THU, FRI);
        wireAssignments();

        assertEquals(0, scheduler.runWeeklyReminder(FRI));
        verify(emailService, never()).sendWeeklyReminder(any(), any(), anyList());
    }

    /** A submitted week is complete by definition — the admin has it now, not the employee. */
    @Test
    void leavesAnEmployeeWhoSubmittedTheWholeWeekAlone() {
        Employee e = employee(4L, "suma", "y");
        assign(e, LocalDate.of(2026, 1, 1));
        filled(e, ClientTimesheetStatus.PENDING, MON, TUE, WED, THU, FRI);
        wireAssignments();

        assertEquals(0, scheduler.runWeeklyReminder(FRI));
    }

    /** Time off accounts for a day. Chasing someone for a day they were on PTO would be wrong. */
    @Test
    void treatsADayCoveredByTimeOffAsAccountedFor() {
        Employee e = employee(5L, "mounika", "k");
        assign(e, LocalDate.of(2026, 1, 1));
        List<ClientTimesheet> lines = new ArrayList<>();
        for (LocalDate d : List.of(MON, TUE, THU, FRI)) {
            ClientTimesheet l = new ClientTimesheet();
            l.setEmployee(e);
            l.setDate(d);
            l.setWeekStartDate(WEEK_START);
            l.setCategory("PROJECT");
            l.setHours(8.0);
            l.setStatus(ClientTimesheetStatus.DRAFT);
            lines.add(l);
        }
        ClientTimesheet pto = new ClientTimesheet();
        pto.setEmployee(e);
        pto.setDate(WED);
        pto.setWeekStartDate(WEEK_START);
        pto.setCategory("PTO");
        pto.setHours(8.0);
        pto.setStatus(ClientTimesheetStatus.DRAFT);
        lines.add(pto);
        when(lineRepository.findByEmployeeIdAndWeekStartDate(5L, WEEK_START)).thenReturn(lines);
        wireAssignments();

        assertEquals(0, scheduler.runWeeklyReminder(FRI));
    }

    /**
     * Assigned mid-week: the days before the assignment started are not theirs to fill — the
     * entry page rejects hours there outright — so they are not reported as missing.
     */
    @Test
    void doesNotChaseDaysBeforeTheAssignmentStarted() {
        Employee e = employee(6L, "ganesh", "y");
        assign(e, WED);
        nothingFilled(e);
        wireAssignments();

        scheduler.runWeeklyReminder(FRI);

        assertEquals(List.of(WED, THU, FRI), capturedMissingDays());
    }

    /** Weekends carry no hours and the entry page locks them. */
    @Test
    void neverReportsWeekendDaysAsMissing() {
        Employee e = employee(7L, "yashu", "s");
        assign(e, LocalDate.of(2026, 1, 1));
        nothingFilled(e);
        wireAssignments();

        scheduler.runWeeklyReminder(FRI);

        assertTrue(capturedMissingDays().stream().noneMatch(d ->
                d.getDayOfWeek().getValue() >= 6), "Saturday/Sunday must not be chased");
    }

    /** Already reminded for this week — a restart or a re-run must not mail twice. */
    @Test
    void doesNotRemindTwiceForTheSameWeek() {
        Employee e = employee(8L, "raviteja", "c");
        assign(e, LocalDate.of(2026, 1, 1));
        nothingFilled(e);
        wireAssignments();
        when(notificationLogRepository.existsByEmployeeIdAndWeekStartAndNotificationType(
                eq(8L), eq(WEEK_START), anyString())).thenReturn(true);

        assertEquals(0, scheduler.runWeeklyReminder(FRI));
    }

    /** Disabled in HRMS, or no login account: nobody to chase and no inbox to chase them at. */
    @Test
    void skipsDisabledEmployeesAndThoseWithoutALogin() {
        Employee disabled = employee(9L, "old", "staff");
        disabled.setActive(false);
        assign(disabled, LocalDate.of(2026, 1, 1));
        nothingFilled(disabled);

        Employee noLogin = employee(10L, "no", "login");
        noLogin.setUser(null);
        assign(noLogin, LocalDate.of(2026, 1, 1));
        nothingFilled(noLogin);
        wireAssignments();

        assertEquals(0, scheduler.runWeeklyReminder(FRI));
    }

    // =====================================================================
    // Scenario 3 — Monday 10:00 JST, admin summary for the closed week
    // =====================================================================

    /**
     * The headline number, on the requirement's own example: ten assigned employees, seven
     * submitted, three did not.
     */
    @Test
    void countsSubmittedAgainstNotSubmittedForThePreviousWeek() {
        for (long id = 1; id <= 7; id++) {
            Employee e = employee(id, "submitted" + id, "x");
            assign(e, LocalDate.of(2026, 1, 1));
            filled(e, ClientTimesheetStatus.PENDING, MON, TUE, WED, THU, FRI);
        }
        for (long id = 8; id <= 10; id++) {
            Employee e = employee(id, "pending" + id, "x");
            assign(e, LocalDate.of(2026, 1, 1));
            nothingFilled(e);
        }
        wireAssignments();

        scheduler.runAdminSummary(NEXT_MONDAY);

        ArgumentCaptor<Integer> submitted = ArgumentCaptor.forClass(Integer.class);
        ArgumentCaptor<Integer> total = ArgumentCaptor.forClass(Integer.class);
        verify(emailService).sendAdminSummary(anyCollection(), eq(WEEK_START),
                submitted.capture(), total.capture(), anyList());
        assertEquals(7, submitted.getValue());
        assertEquals(10, total.getValue());
    }

    /** Each pending employee is listed with their id, week and the exact days they left blank. */
    @Test
    void listsEachPendingEmployeeWithTheirMissingDays() {
        Employee submittedOne = employee(1L, "rahul", "ravula");
        assign(submittedOne, LocalDate.of(2026, 1, 1));
        filled(submittedOne, ClientTimesheetStatus.APPROVED, MON, TUE, WED, THU, FRI);

        Employee partial = employee(2L, "deepika", "k");
        assign(partial, LocalDate.of(2026, 1, 1));
        filled(partial, ClientTimesheetStatus.DRAFT, MON, TUE); // saved, never submitted

        Employee nothing = employee(3L, "nikith", "g");
        assign(nothing, LocalDate.of(2026, 1, 1));
        nothingFilled(nothing);
        wireAssignments();

        scheduler.runAdminSummary(NEXT_MONDAY);

        List<ClientTimesheetPendingDTO> pending = capturedPending();
        assertEquals(2, pending.size());

        ClientTimesheetPendingDTO deepika = pending.stream()
                .filter(p -> p.getEmployeeName().startsWith("deepika")).findFirst().orElseThrow();
        assertEquals("deepika k", deepika.getEmployeeName());
        assertEquals("OF-IT-PK-0002", deepika.getEmployeeId());
        assertEquals("08-Aug-2026 to 14-Aug-2026", deepika.getWeekRange());
        assertEquals("Wed 12-Aug, Thu 13-Aug, Fri 14-Aug", deepika.getMissingDays());

        ClientTimesheetPendingDTO nikith = pending.stream()
                .filter(p -> p.getEmployeeName().startsWith("nikith")).findFirst().orElseThrow();
        assertEquals("Mon 10-Aug, Tue 11-Aug, Wed 12-Aug, Thu 13-Aug, Fri 14-Aug", nikith.getMissingDays());
    }

    /**
     * A rejected week was still submitted — the employee did their part and the admin sent it
     * back. Listing them as "did not submit" would misreport the admin's own decision.
     */
    @Test
    void countsARejectedWeekAsSubmitted() {
        Employee e = employee(1L, "rahul", "ravula");
        assign(e, LocalDate.of(2026, 1, 1));
        filled(e, ClientTimesheetStatus.REJECTED, MON, TUE, WED, THU, FRI);
        wireAssignments();

        scheduler.runAdminSummary(NEXT_MONDAY);

        ArgumentCaptor<Integer> submitted = ArgumentCaptor.forClass(Integer.class);
        verify(emailService).sendAdminSummary(anyCollection(), eq(WEEK_START),
                submitted.capture(), eq(1), anyList());
        assertEquals(1, submitted.getValue());
        assertTrue(capturedPending().isEmpty());
    }

    /** A clean week still reports — silence would be indistinguishable from a job that failed. */
    @Test
    void stillEmailsAdminsWhenEveryoneSubmitted() {
        Employee e = employee(1L, "rahul", "ravula");
        assign(e, LocalDate.of(2026, 1, 1));
        filled(e, ClientTimesheetStatus.PENDING, MON, TUE, WED, THU, FRI);
        wireAssignments();

        scheduler.runAdminSummary(NEXT_MONDAY);

        verify(emailService).sendAdminSummary(anyCollection(), eq(WEEK_START), eq(1), eq(1), anyList());
        assertTrue(capturedPending().isEmpty());
    }

    /** Assigned after the week closed: nothing was owed, so they are not in either count. */
    @Test
    void excludesEmployeesAssignedAfterTheWeekEnded() {
        Employee e = employee(1L, "rahul", "ravula");
        assign(e, LocalDate.of(2026, 1, 1));
        filled(e, ClientTimesheetStatus.PENDING, MON, TUE, WED, THU, FRI);

        Employee justAssigned = employee(2L, "brand", "new");
        assign(justAssigned, NEXT_MONDAY);
        nothingFilled(justAssigned);
        wireAssignments();

        scheduler.runAdminSummary(NEXT_MONDAY);

        verify(emailService).sendAdminSummary(anyCollection(), eq(WEEK_START), eq(1), eq(1), anyList());
    }

    /** The summary goes to admins — the only role that approves or rejects in this module. */
    @Test
    void sendsOnlyToAdmins() {
        Employee e = employee(1L, "rahul", "ravula");
        assign(e, LocalDate.of(2026, 1, 1));
        nothingFilled(e);
        wireAssignments();

        scheduler.runAdminSummary(NEXT_MONDAY);

        verify(userRepository).findByRole(Role.ADMIN);
        verify(userRepository, never()).findByRole(Role.HR);
        verify(userRepository, never()).findByRole(Role.EMPLOYEE);
        verify(userRepository, never()).findByRole(Role.REPORTING_MANAGER);
    }

    /** Reports the week that just closed, not the one that opened on Saturday. */
    @Test
    void reportsTheWeekThatEndedLastFridayNotTheOpenOne() {
        Employee e = employee(1L, "rahul", "ravula");
        assign(e, LocalDate.of(2026, 1, 1));
        nothingFilled(e);
        wireAssignments();

        scheduler.runAdminSummary(NEXT_MONDAY);

        verify(emailService).sendAdminSummary(anyCollection(), eq(WEEK_START), anyInt(), anyInt(), anyList());
        assertEquals("08-Aug-2026 to 14-Aug-2026", capturedPending().get(0).getWeekRange());
    }

    @Test
    void doesNotSendTheSummaryTwiceForTheSameWeek() {
        Employee e = employee(1L, "rahul", "ravula");
        assign(e, LocalDate.of(2026, 1, 1));
        nothingFilled(e);
        wireAssignments();
        when(notificationLogRepository.existsByEmployeeIsNullAndWeekStartAndNotificationType(
                eq(WEEK_START), anyString())).thenReturn(true);

        assertEquals(0, scheduler.runAdminSummary(NEXT_MONDAY));
        verify(emailService, never()).sendAdminSummary(any(), any(), anyInt(), anyInt(), anyList());
    }

    @SuppressWarnings("unchecked")
    private List<ClientTimesheetPendingDTO> capturedPending() {
        ArgumentCaptor<List<ClientTimesheetPendingDTO>> captor = ArgumentCaptor.forClass(List.class);
        verify(emailService).sendAdminSummary(anyCollection(), any(), anyInt(), anyInt(), captor.capture());
        return captor.getValue();
    }

    // =====================================================================
    // The JST contract itself
    // =====================================================================

    /**
     * The requirement is a fixed Japanese wall-clock time on a server of unknown timezone.
     * Spring resolves each cron in the zone named on the annotation, so this asserts the two
     * declarations rather than the clock: Friday 13:00 and Monday 10:00, both Asia/Tokyo.
     */
    @Test
    void bothJobsAreScheduledInJapanStandardTime() throws Exception {
        org.springframework.scheduling.annotation.Scheduled friday = ClientTimesheetScheduler.class
                .getMethod("clientTimesheetWeeklyReminderJob")
                .getAnnotation(org.springframework.scheduling.annotation.Scheduled.class);
        assertEquals("0 0 13 * * FRI", friday.cron());
        assertEquals("Asia/Tokyo", friday.zone());

        org.springframework.scheduling.annotation.Scheduled monday = ClientTimesheetScheduler.class
                .getMethod("clientTimesheetAdminSummaryJob")
                .getAnnotation(org.springframework.scheduling.annotation.Scheduled.class);
        assertEquals("0 0 10 * * MON", monday.cron());
        assertEquals("Asia/Tokyo", monday.zone());
    }

    /** Fixed dates are only meaningful if the calendar underneath them is what it claims. */
    @Test
    void theFixtureCalendarIsWhatTheTestsAssume() {
        assertEquals(java.time.DayOfWeek.SATURDAY, WEEK_START.getDayOfWeek());
        assertEquals(java.time.DayOfWeek.FRIDAY, FRI.getDayOfWeek());
        assertEquals(java.time.DayOfWeek.MONDAY, NEXT_MONDAY.getDayOfWeek());
        assertEquals(WEEK_START, weekCompletion.weekStartOf(FRI));
        assertEquals(WEEK_START, weekCompletion.weekStartOf(NEXT_MONDAY).minusWeeks(1));
        assertEquals(Arrays.asList(MON, TUE, WED, THU, FRI),
                weekCompletion.expectedWorkdays(WEEK_START, null, FRI));
    }
}
