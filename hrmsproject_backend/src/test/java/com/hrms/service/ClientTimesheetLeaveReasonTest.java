package com.hrms.service;

import com.hrms.dto.ClientTimesheetWeekDTO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * "Say why you took the leave."
 *
 * An employee entering hours against Paid Sick Leave, Holiday, PTO, Unpaid Leave or Earned
 * Leave must give a reason, scoped one per leave type per week — the same scoping a project
 * row's comment already uses.
 *
 * The frontend blocks Submit and highlights the row long before a request is made. These tests
 * cover the server-side rule, which is what makes it a rule: a direct API call bypasses the UI
 * entirely, and the entry page is a convenience over the contract, never the contract itself.
 *
 * No repositories are touched — requireLeaveReasons and validateEntries take only the payload,
 * so the rules run without a database. Same arrangement as ClientTimesheetFieldLimitsTest.
 */
class ClientTimesheetLeaveReasonTest {

    private final ClientTimesheetWeekService service = new ClientTimesheetWeekService();

    /**
     * The save-and-reload round trip, with the repositories mocked.
     *
     * Nested because it needs collaborators the rule tests above deliberately do without. This
     * is the wiring most likely to be wrong and least visible in a rules test: the reason is
     * written onto every day line of its leave type on save, and read back off those lines and
     * regrouped by type on load. A mismatch between the two would show up as a reason that
     * vanishes the moment the employee reopens the week.
     */
    @org.junit.jupiter.api.Nested
    @org.junit.jupiter.api.extension.ExtendWith(org.mockito.junit.jupiter.MockitoExtension.class)
    @org.mockito.junit.jupiter.MockitoSettings(strictness = org.mockito.quality.Strictness.LENIENT)
    class SaveAndReload {

        private static final Long EMP_ID = 7L;

        @org.mockito.Mock private com.hrms.repository.ClientTimesheetRepository lineRepository;
        @org.mockito.Mock private com.hrms.repository.ClientTimesheetWeekRepository weekRepository;
        @org.mockito.Mock private com.hrms.repository.EmployeeRepository employeeRepository;
        @org.mockito.Mock private ClientProjectAssignmentService assignmentService;
        @org.mockito.Mock private ClientTimesheetNotificationService notificationService;
        @org.mockito.Mock private UserDisplayNameResolver userDisplayNameResolver;

        @org.mockito.InjectMocks private ClientTimesheetWeekService wired;

        private final List<com.hrms.model.ClientTimesheet> saved = new ArrayList<>();

        @org.junit.jupiter.api.BeforeEach
        void setUp() {
            com.hrms.model.Employee employee = new com.hrms.model.Employee();
            employee.setId(EMP_ID);
            employee.setFirstName("Dana");
            employee.setLastName("Whitfield");

            org.mockito.Mockito.when(employeeRepository.findById(EMP_ID))
                    .thenReturn(java.util.Optional.of(employee));
            org.mockito.Mockito.when(weekRepository.findByEmployeeIdAndWeekStartDate(
                    org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.any()))
                    .thenReturn(java.util.Optional.empty());
            org.mockito.Mockito.when(weekRepository.save(org.mockito.ArgumentMatchers.any()))
                    .thenAnswer(inv -> inv.getArgument(0));
            org.mockito.Mockito.when(assignmentService.earliestAssignmentDate(EMP_ID))
                    .thenReturn(LocalDate.of(2026, 1, 1));
            org.mockito.Mockito.when(assignmentService.getActiveForEmployee(EMP_ID))
                    .thenReturn(java.util.Collections.emptyList());

            // The line table: empty before the save, then whatever the save wrote — which is
            // exactly what the reload reads, so the two halves meet on real data.
            org.mockito.Mockito.when(lineRepository.findByEmployeeIdAndWeekStartDate(
                    org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.any()))
                    .thenAnswer(inv -> new ArrayList<>(saved));
            org.mockito.Mockito.when(lineRepository.saveAll(org.mockito.ArgumentMatchers.any()))
                    .thenAnswer(inv -> {
                        saved.clear();
                        ((Iterable<com.hrms.model.ClientTimesheet>) inv.getArgument(0)).forEach(saved::add);
                        return new ArrayList<>(saved);
                    });
        }

        @org.junit.jupiter.api.Test
        void writesTheReasonOntoEveryDayLineAndReadsItBackOnTheRow() {
            ClientTimesheetWeekDTO payload = weekWith(
                    leaveRow("PTO", "Family wedding.", MON, TUE),
                    leaveRow("SICK", "Migraine.", WEEK_START.plusDays(4)));

            ClientTimesheetWeekDTO reloaded = wired.submit(EMP_ID, WEEK_START, payload);

            // Stored on each of the type's day lines, the same way a row comment is.
            assertEquals(2, saved.stream()
                    .filter(l -> "PTO".equals(l.getCategory()))
                    .filter(l -> "Family wedding.".equals(l.getLeaveReason()))
                    .count(), "both PTO days carry the reason");

            // And comes back on the right row, not smeared across the others.
            assertEquals("Family wedding.", reasonOf(reloaded, "PTO"));
            assertEquals("Migraine.", reasonOf(reloaded, "SICK"));
            assertNull(reasonOf(reloaded, "LOP"), "a type with no leave carries no reason");
        }

        /** Trimmed on the way in, so " x " and "x" are the same stored answer. */
        @org.junit.jupiter.api.Test
        void trimsTheReasonBeforeStoringIt() {
            wired.submit(EMP_ID, WEEK_START, weekWith(leaveRow("PTO", "  Family wedding.  ", MON)));
            assertEquals("Family wedding.", saved.get(0).getLeaveReason());
        }

        /** Project work is untouched — it carries a comment, and the two must not cross. */
        @org.junit.jupiter.api.Test
        void neverPutsALeaveReasonOnProjectWork() {
            ClientTimesheetWeekDTO payload = weekWith(leaveRow("PTO", "Family wedding.", MON));
            ClientTimesheetWeekDTO.ProjectRowDTO project = new ClientTimesheetWeekDTO.ProjectRowDTO();
            project.setRowId("r1");
            project.setProjectId("P-1");
            project.setProjectName("Atlas");
            project.setClientBillable("BILLABLE");
            project.setComment("Row comment, not a leave reason.");
            List<ClientTimesheetWeekDTO.DayHourDTO> days = new ArrayList<>();
            for (int i = 0; i < 7; i++) {
                ClientTimesheetWeekDTO.DayHourDTO d = new ClientTimesheetWeekDTO.DayHourDTO();
                d.setDate(WEEK_START.plusDays(i));
                d.setHours(WEEK_START.plusDays(i).equals(TUE) ? 8.0 : 0.0);
                days.add(d);
            }
            project.setDays(days);
            payload.getProjectRows().add(project);

            wired.submit(EMP_ID, WEEK_START, payload);

            assertTrue(saved.stream().filter(l -> "PROJECT".equals(l.getCategory()))
                    .allMatch(l -> l.getLeaveReason() == null), "project lines carry no leave reason");
            assertTrue(saved.stream().filter(l -> "PTO".equals(l.getCategory()))
                    .allMatch(l -> l.getComment() == null), "leave lines carry no row comment");
        }

        private String reasonOf(ClientTimesheetWeekDTO dto, String type) {
            // findFirst before map: mapping first would build an Optional.of(null) for a row
            // that legitimately has no reason, and throw instead of returning it.
            return dto.getTimeOffRows().stream()
                    .filter(r -> type.equalsIgnoreCase(r.getType()))
                    .findFirst()
                    .map(ClientTimesheetWeekDTO.TimeOffRowDTO::getReason)
                    .orElse(null);
        }
    }

    /** A Saturday — client timesheet weeks run Saturday → Friday. */
    private static final LocalDate WEEK_START = LocalDate.of(2026, 8, 8);
    private static final LocalDate MON = WEEK_START.plusDays(2);
    private static final LocalDate TUE = WEEK_START.plusDays(3);

    // ---- fixtures ----------------------------------------------------------

    private ClientTimesheetWeekDTO.TimeOffRowDTO leaveRow(String type, String reason, LocalDate... daysWithHours) {
        ClientTimesheetWeekDTO.TimeOffRowDTO row = new ClientTimesheetWeekDTO.TimeOffRowDTO();
        row.setType(type);
        row.setReason(reason);
        List<ClientTimesheetWeekDTO.DayHourDTO> days = new ArrayList<>();
        List<LocalDate> filled = List.of(daysWithHours);
        for (int i = 0; i < 7; i++) {
            LocalDate d = WEEK_START.plusDays(i);
            ClientTimesheetWeekDTO.DayHourDTO dh = new ClientTimesheetWeekDTO.DayHourDTO();
            dh.setDate(d);
            dh.setHours(filled.contains(d) ? 8.0 : 0.0);
            days.add(dh);
        }
        row.setDays(days);
        return row;
    }

    private ClientTimesheetWeekDTO weekWith(ClientTimesheetWeekDTO.TimeOffRowDTO... rows) {
        ClientTimesheetWeekDTO dto = new ClientTimesheetWeekDTO();
        dto.setWeekStartDate(WEEK_START);
        dto.setWeekEndDate(WEEK_START.plusDays(6));
        dto.setTimeOffRows(new ArrayList<>(List.of(rows)));
        dto.setProjectRows(new ArrayList<>());
        return dto;
    }

    private ResponseStatusException rejectedBy(ClientTimesheetWeekDTO payload) {
        return assertThrows(ResponseStatusException.class, () -> service.requireLeaveReasons(payload));
    }

    // ── The rule ────────────────────────────────────────────────────────────

    @Test
    void rejectsLeaveHoursWithNoReason() {
        ResponseStatusException ex = rejectedBy(weekWith(leaveRow("PTO", null, MON)));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Paid Time Off"),
                "names the leave type so the employee knows which row to open: " + ex.getReason());
    }

    @Test
    void acceptsLeaveHoursWithAReason() {
        assertDoesNotThrow(() -> service.requireLeaveReasons(
                weekWith(leaveRow("PTO", "Family wedding.", MON, TUE))));
    }

    /** Whitespace is not an answer. */
    @Test
    void treatsABlankReasonAsMissing() {
        assertEquals(HttpStatus.BAD_REQUEST, rejectedBy(weekWith(leaveRow("SICK", "   ", MON))).getStatusCode());
    }

    /** A row with no hours has nothing to explain, so it is never asked. */
    @Test
    void ignoresLeaveTypesThatCarryNoHours() {
        assertDoesNotThrow(() -> service.requireLeaveReasons(weekWith(
                leaveRow("SICK", null),
                leaveRow("HOLIDAY", null),
                leaveRow("PTO", "Family wedding.", MON))));
    }

    @Test
    void acceptsAWeekWithNoLeaveAtAll() {
        assertDoesNotThrow(() -> service.requireLeaveReasons(weekWith()));
        ClientTimesheetWeekDTO noRows = new ClientTimesheetWeekDTO();
        noRows.setTimeOffRows(null);
        assertDoesNotThrow(() -> service.requireLeaveReasons(noRows));
    }

    /** Every leave type is held to it, not just the one that happened to be tested. */
    @ParameterizedTest(name = "{0} requires a reason")
    @CsvSource({
        "SICK,    Paid Sick Leave",
        "HOLIDAY, Holiday (Public/National)",
        "PTO,     Paid Time Off",
        "LOP,     Unpaid Leave (LOP)",
        "EARNED,  Leave (Earned)",
    })
    void everyLeaveTypeRequiresAReason(String type, String label) {
        ResponseStatusException ex = rejectedBy(weekWith(leaveRow(type, null, MON)));
        assertTrue(ex.getReason().contains(label), "expected the message to name " + label + ": " + ex.getReason());
    }

    /** Several unexplained types are all named — one at a time would mean several round trips. */
    @Test
    void namesEveryLeaveTypeStillMissingAReason() {
        ResponseStatusException ex = rejectedBy(weekWith(
                leaveRow("SICK", null, MON),
                leaveRow("LOP", null, TUE),
                leaveRow("PTO", "Family wedding.", WEEK_START.plusDays(4))));

        assertTrue(ex.getReason().contains("Paid Sick Leave"), ex.getReason());
        assertTrue(ex.getReason().contains("Unpaid Leave (LOP)"), ex.getReason());
        assertFalse(ex.getReason().contains("Paid Time Off"), "the answered row is not chased: " + ex.getReason());
    }

    // ── Length, matching Comment and Rejection Reason ───────────────────────

    @Test
    void acceptsAReasonAtTheLimit() {
        String exactly256 = "x".repeat(256);
        assertDoesNotThrow(() -> service.validateEntries(
                weekWith(leaveRow("PTO", exactly256, MON)), null, LocalDate.of(2026, 12, 31)));
    }

    @Test
    void rejectsAReasonOverTheLimit() {
        String tooLong = "x".repeat(257);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.validateEntries(
                weekWith(leaveRow("PTO", tooLong, MON)), null, LocalDate.of(2026, 12, 31)));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Leave reason"), ex.getReason());
        assertTrue(ex.getReason().contains("256"), ex.getReason());
    }

    // ── What must not change ────────────────────────────────────────────────

    /**
     * The reason is an addition, not a new gate on the hour rules. A leave row that breaks the
     * 8h daily cap must still fail on the cap, reason or no reason.
     */
    @Test
    void leavesTheExistingLeaveHourCapAlone() {
        ClientTimesheetWeekDTO payload = weekWith(leaveRow("PTO", "Family wedding.", MON));
        payload.getTimeOffRows().get(0).getDays().stream()
                .filter(d -> d.getDate().equals(MON))
                .forEach(d -> d.setHours(9.0));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.validateEntries(payload, null, LocalDate.of(2026, 12, 31)));
        assertTrue(ex.getReason().toLowerCase().contains("leave hours"), ex.getReason());
    }

    /**
     * A draft is allowed to be incomplete — the employee saves as they go. Only submit is
     * gated, which is how every other required field in this module behaves.
     */
    @Test
    void theRuleIsSubmitOnlyAndNeverBlocksADraft() {
        ClientTimesheetWeekDTO unexplained = weekWith(leaveRow("PTO", null, MON));
        // validateEntries is what a save-draft runs; it must let this through.
        assertDoesNotThrow(() -> service.validateEntries(unexplained, null, LocalDate.of(2026, 12, 31)));
        // Only the submit-time pass objects.
        assertEquals(HttpStatus.BAD_REQUEST, rejectedBy(unexplained).getStatusCode());
    }
}
