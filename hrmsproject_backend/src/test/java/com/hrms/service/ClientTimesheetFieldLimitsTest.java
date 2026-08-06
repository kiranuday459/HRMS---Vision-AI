package com.hrms.service;

import com.hrms.dto.ClientProjectAssignmentDTO;
import com.hrms.dto.ClientTimesheetWeekDTO;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Field character limits are rejected server-side, not just capped in the UI.
 *
 * The frontend caps these inputs with maxLength, but a direct API call bypasses that
 * entirely — so these limits are the actual contract and must produce a 4xx. Each method
 * under test performs its length checks before touching any repository, so this runs with
 * no database and no Spring context.
 *
 * Agreed limits: Comment 256, Rejection Reason 256, Project Name 50, Project ID 25,
 * Task/Activity Description 256, Task/Activity ID 25.
 */
class ClientTimesheetFieldLimitsTest {

    private static String of(int length) {
        return "x".repeat(length);
    }

    private static ClientTimesheetWeekDTO weekWithRow(ClientTimesheetWeekDTO.ProjectRowDTO row) {
        ClientTimesheetWeekDTO dto = new ClientTimesheetWeekDTO();
        dto.setProjectRows(List.of(row));
        return dto;
    }

    /** A row whose every capped field sits exactly at its limit. */
    private static ClientTimesheetWeekDTO.ProjectRowDTO rowAtLimits() {
        ClientTimesheetWeekDTO.ProjectRowDTO row = new ClientTimesheetWeekDTO.ProjectRowDTO();
        row.setProjectId(of(25));
        row.setProjectName(of(50));
        row.setTaskId(of(25));
        row.setTaskDescription(of(256));
        row.setComment(of(256));
        return row;
    }

    private static void assertBadRequest(String expectedField, Executable call) {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, call::run);
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode(),
                "over-limit " + expectedField + " must be a 4xx, not a 500");
        assertTrue(ex.getReason() != null && ex.getReason().contains(expectedField),
                "message should name the offending field, was: " + ex.getReason());
    }

    /** Minimal throwing-runnable so the assertions read cleanly. */
    private interface Executable {
        void run();
    }

    // ── Timesheet project rows ──────────────────────────────────────────────

    @Test
    void acceptsEveryFieldExactlyAtItsLimit() {
        ClientTimesheetWeekService service = new ClientTimesheetWeekService();
        assertDoesNotThrow(() -> service.validateEntries(
                weekWithRow(rowAtLimits()), null, LocalDate.now()));
    }

    @Test
    void rejectsProjectIdOverTwentyFive() {
        ClientTimesheetWeekService service = new ClientTimesheetWeekService();
        ClientTimesheetWeekDTO.ProjectRowDTO row = rowAtLimits();
        row.setProjectId(of(26));
        assertBadRequest("Project ID", () -> service.validateEntries(weekWithRow(row), null, LocalDate.now()));
    }

    @Test
    void rejectsProjectNameOverFifty() {
        ClientTimesheetWeekService service = new ClientTimesheetWeekService();
        ClientTimesheetWeekDTO.ProjectRowDTO row = rowAtLimits();
        row.setProjectName(of(51));
        assertBadRequest("Project Name", () -> service.validateEntries(weekWithRow(row), null, LocalDate.now()));
    }

    @Test
    void rejectsTaskIdOverTwentyFive() {
        ClientTimesheetWeekService service = new ClientTimesheetWeekService();
        ClientTimesheetWeekDTO.ProjectRowDTO row = rowAtLimits();
        row.setTaskId(of(26));
        assertBadRequest("Task/Activity ID", () -> service.validateEntries(weekWithRow(row), null, LocalDate.now()));
    }

    @Test
    void rejectsTaskDescriptionOverTwoFiftySix() {
        ClientTimesheetWeekService service = new ClientTimesheetWeekService();
        ClientTimesheetWeekDTO.ProjectRowDTO row = rowAtLimits();
        row.setTaskDescription(of(257));
        assertBadRequest("Task/Activity Description",
                () -> service.validateEntries(weekWithRow(row), null, LocalDate.now()));
    }

    @Test
    void rejectsCommentOverTwoFiftySix() {
        ClientTimesheetWeekService service = new ClientTimesheetWeekService();
        ClientTimesheetWeekDTO.ProjectRowDTO row = rowAtLimits();
        row.setComment(of(257));
        assertBadRequest("Comment", () -> service.validateEntries(weekWithRow(row), null, LocalDate.now()));
    }

    // ── Daily hour caps ─────────────────────────────────────────────────────

    private static ClientTimesheetWeekDTO.DayHourDTO day(String date, double hours) {
        ClientTimesheetWeekDTO.DayHourDTO d = new ClientTimesheetWeekDTO.DayHourDTO();
        d.setDate(LocalDate.parse(date));
        d.setHours(hours);
        return d;
    }

    private static ClientTimesheetWeekDTO.ProjectRowDTO projectRow(double hours) {
        ClientTimesheetWeekDTO.ProjectRowDTO row = rowAtLimits();
        row.setDays(new java.util.ArrayList<>(List.of(day("2026-08-03", hours))));
        return row;
    }

    private static ClientTimesheetWeekDTO.TimeOffRowDTO leaveRow(double hours) {
        ClientTimesheetWeekDTO.TimeOffRowDTO row = new ClientTimesheetWeekDTO.TimeOffRowDTO();
        row.setType("PTO");
        row.setDays(new java.util.ArrayList<>(List.of(day("2026-08-03", hours))));
        return row;
    }

    private static ClientTimesheetWeekDTO weekOf(List<ClientTimesheetWeekDTO.ProjectRowDTO> project,
            List<ClientTimesheetWeekDTO.TimeOffRowDTO> leave) {
        ClientTimesheetWeekDTO dto = new ClientTimesheetWeekDTO();
        dto.setProjectRows(project);
        dto.setTimeOffRows(leave);
        return dto;
    }

    /** Validation runs against a date already in the past so the future-date guard is not hit. */
    private static final LocalDate TODAY = LocalDate.parse("2026-08-31");

    @Test
    void acceptsACellExactlyAtTheDailyMaximum() {
        ClientTimesheetWeekService service = new ClientTimesheetWeekService();
        assertDoesNotThrow(() -> service.validateEntries(
                weekOf(List.of(projectRow(24)), List.of()), null, TODAY));
    }

    @Test
    void rejectsMoreThanTwentyFourHoursInOneCell() {
        ClientTimesheetWeekService service = new ClientTimesheetWeekService();
        assertBadRequest("Hours", () -> service.validateEntries(
                weekOf(List.of(projectRow(25)), List.of()), null, TODAY));
    }

    @Test
    void rejectsNegativeHours() {
        ClientTimesheetWeekService service = new ClientTimesheetWeekService();
        assertBadRequest("negative", () -> service.validateEntries(
                weekOf(List.of(projectRow(-4)), List.of()), null, TODAY));
    }

    @Test
    void acceptsALeaveCellExactlyAtEight() {
        ClientTimesheetWeekService service = new ClientTimesheetWeekService();
        assertDoesNotThrow(() -> service.validateEntries(
                weekOf(List.of(), List.of(leaveRow(8))), null, TODAY));
    }

    @Test
    void rejectsMoreThanEightLeaveHoursInOneCell() {
        ClientTimesheetWeekService service = new ClientTimesheetWeekService();
        assertBadRequest("Leave hours", () -> service.validateEntries(
                weekOf(List.of(), List.of(leaveRow(9))), null, TODAY));
    }

    /**
     * The case the per-cell cap cannot catch: each row is legal on its own, but the day is not.
     */
    @Test
    void rejectsADayThatExceedsTwentyFourAcrossSeveralRows() {
        ClientTimesheetWeekService service = new ClientTimesheetWeekService();
        assertBadRequest("cannot exceed", () -> service.validateEntries(
                weekOf(List.of(projectRow(20), projectRow(20)), List.of()), null, TODAY));
    }

    @Test
    void rejectsLeaveExceedingEightAcrossSeveralLeaveRows() {
        ClientTimesheetWeekService service = new ClientTimesheetWeekService();
        assertBadRequest("daily maximum", () -> service.validateEntries(
                weekOf(List.of(), List.of(leaveRow(5), leaveRow(5))), null, TODAY));
    }

    /** Leave and worked hours share the same calendar day, so they share the 24h cap. */
    @Test
    void countsLeaveTowardTheTwentyFourHourDay() {
        ClientTimesheetWeekService service = new ClientTimesheetWeekService();
        assertBadRequest("cannot exceed", () -> service.validateEntries(
                weekOf(List.of(projectRow(20)), List.of(leaveRow(8))), null, TODAY));
    }

    @Test
    void allowsAFullButLegalDay() {
        ClientTimesheetWeekService service = new ClientTimesheetWeekService();
        assertDoesNotThrow(() -> service.validateEntries(
                weekOf(List.of(projectRow(16)), List.of(leaveRow(8))), null, TODAY));
    }

    // ── Admin rejection reason ──────────────────────────────────────────────

    @Test
    void rejectsRejectionReasonOverTwoFiftySix() {
        // The length guard is the first statement in reject(), so no repository is reached.
        ClientTimesheetService service = new ClientTimesheetService();
        assertBadRequest("Rejection Reason", () -> service.reject(1L, 1L, of(257)));
    }

    // ── Assignment creation (where Project ID/Name enter the system) ────────

    private static ClientProjectAssignmentDTO assignmentAtLimits() {
        ClientProjectAssignmentDTO dto = new ClientProjectAssignmentDTO();
        dto.setEmployeeIds(List.of(1L));
        dto.setAssignmentStartDate(LocalDate.now());
        dto.setProjectId(of(25));
        dto.setProjectName(of(50));
        dto.setTaskId(of(25));
        dto.setTaskDescription(of(256));
        return dto;
    }

    @Test
    void rejectsAssignmentProjectIdOverTwentyFive() {
        ClientProjectAssignmentService service = new ClientProjectAssignmentService();
        ClientProjectAssignmentDTO dto = assignmentAtLimits();
        dto.setProjectId(of(26));
        assertBadRequest("Project ID", () -> service.create(dto, null));
    }

    @Test
    void rejectsAssignmentProjectNameOverFifty() {
        ClientProjectAssignmentService service = new ClientProjectAssignmentService();
        ClientProjectAssignmentDTO dto = assignmentAtLimits();
        dto.setProjectName(of(51));
        assertBadRequest("Project Name", () -> service.create(dto, null));
    }
}
