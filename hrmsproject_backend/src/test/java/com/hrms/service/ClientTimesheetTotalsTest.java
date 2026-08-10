package com.hrms.service;

import com.hrms.dto.ClientTimesheetWeekDTO;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Regular / OT / Time off / Grand Total arithmetic.
 *
 * The reported bug: the four figures on the employee's summary did not add up. Regular was
 * `leave + min(worked, capacity)`, so leave hours sat inside Regular while also being reported
 * as Time off — the same hours in two of the three categories. A week of 26 worked hours plus
 * one 8-hour leave day therefore showed Regular 34, Time off 8, Grand Total 34, and no
 * arrangement of those numbers was consistent.
 *
 * Regular is now worked hours only, which makes the summary a straight sum:
 *     Working     = Regular + OT
 *     Grand Total = Regular + OT + Time off
 * with no hour counted twice.
 *
 * Leave still consumes the day's regular capacity — that part is unchanged, and is what keeps
 * the 8h/day cap and the full-day-leave lock working.
 */
class ClientTimesheetTotalsTest {

    // The week in the bug report: Sat 6 Jun 2026 → Fri 12 Jun.
    private static final LocalDate SAT = LocalDate.of(2026, 6, 6);
    private static final LocalDate MON = LocalDate.of(2026, 6, 8);
    private static final LocalDate TUE = LocalDate.of(2026, 6, 9);
    private static final LocalDate WED = LocalDate.of(2026, 6, 10);
    private static final LocalDate THU = LocalDate.of(2026, 6, 11);
    private static final LocalDate FRI = LocalDate.of(2026, 6, 12);

    private final ClientTimesheetWeekService service = new ClientTimesheetWeekService();

    private ClientTimesheetWeekDTO week() {
        ClientTimesheetWeekDTO dto = new ClientTimesheetWeekDTO();
        dto.setProjectRows(new ArrayList<>());
        dto.setTimeOffRows(new ArrayList<>());
        return dto;
    }

    /** One project row with the given day/hours pairs. */
    private void worked(ClientTimesheetWeekDTO dto, Object... dayHourPairs) {
        ClientTimesheetWeekDTO.ProjectRowDTO row = new ClientTimesheetWeekDTO.ProjectRowDTO();
        row.setClientBillable("BILLABLE");
        row.setDays(days(dayHourPairs));
        dto.getProjectRows().add(row);
    }

    private void leave(ClientTimesheetWeekDTO dto, String type, Object... dayHourPairs) {
        ClientTimesheetWeekDTO.TimeOffRowDTO row = new ClientTimesheetWeekDTO.TimeOffRowDTO();
        row.setType(type);
        row.setDays(days(dayHourPairs));
        dto.getTimeOffRows().add(row);
    }

    private List<ClientTimesheetWeekDTO.DayHourDTO> days(Object... dayHourPairs) {
        List<ClientTimesheetWeekDTO.DayHourDTO> out = new ArrayList<>();
        for (int i = 0; i < dayHourPairs.length; i += 2) {
            ClientTimesheetWeekDTO.DayHourDTO d = new ClientTimesheetWeekDTO.DayHourDTO();
            d.setDate((LocalDate) dayHourPairs[i]);
            d.setHours(((Number) dayHourPairs[i + 1]).doubleValue());
            out.add(d);
        }
        return out;
    }

    private double working(ClientTimesheetWeekDTO dto) {
        return dto.getTotalRegularHours() + dto.getTotalOtHours();
    }

    // ── The reported case ───────────────────────────────────────────────────

    /**
     * 26 worked hours across four days, plus one full 8h holiday. Previously: Regular 34,
     * Time off 8, Grand 34 — unreadable. Now every line reconciles.
     */
    @Test
    void theReportedWeekAddsUp() {
        ClientTimesheetWeekDTO dto = week();
        worked(dto, MON, 8, TUE, 8, THU, 8, FRI, 2);   // 26 worked
        leave(dto, "HOLIDAY", WED, 8);                 // 8 leave, fills Wednesday

        service.applyTotals(dto);

        assertEquals(26.0, dto.getTotalRegularHours(), 0.001, "Regular is worked hours only");
        assertEquals(0.0, dto.getTotalOtHours(), 0.001);
        assertEquals(8.0, dto.getTotalTimeOffHours(), 0.001);
        assertEquals(26.0, working(dto), 0.001, "Working = Regular + OT, leave excluded");
        assertEquals(34.0, dto.getGrandTotal(), 0.001, "Grand = Regular + OT + Time off");
    }

    /** The identity itself, which is what the bug broke. */
    @Test
    void grandTotalIsAlwaysTheSumOfTheThreeCategories() {
        ClientTimesheetWeekDTO dto = week();
        worked(dto, MON, 10, TUE, 6, WED, 4, THU, 9, FRI, 8);
        leave(dto, "SICK", WED, 4);
        leave(dto, "PTO", TUE, 2);

        service.applyTotals(dto);

        assertEquals(
                dto.getTotalRegularHours() + dto.getTotalOtHours() + dto.getTotalTimeOffHours(),
                dto.getGrandTotal(), 0.001);
    }

    @Test
    void noHourIsCountedInTwoCategories() {
        ClientTimesheetWeekDTO dto = week();
        worked(dto, MON, 8);
        leave(dto, "HOLIDAY", MON, 0);   // worked a full day, no leave

        service.applyTotals(dto);

        // Regular must not contain any leave: with zero leave, Regular equals what was worked.
        assertEquals(8.0, dto.getTotalRegularHours(), 0.001);
        assertEquals(0.0, dto.getTotalTimeOffHours(), 0.001);
    }

    // ── The split itself ────────────────────────────────────────────────────

    /** Leave still eats the day's capacity, so work beyond what is left becomes OT. */
    @Test
    void leaveStillConsumesTheDaysRegularCapacity() {
        ClientTimesheetWeekDTO dto = week();
        worked(dto, MON, 6);
        leave(dto, "SICK", MON, 4);      // 4h capacity left, 6h worked

        service.applyTotals(dto);

        assertEquals(4.0, dto.getTotalRegularHours(), 0.001, "only 4h of capacity remained");
        assertEquals(2.0, dto.getTotalOtHours(), 0.001, "the 2h beyond it is overtime");
        assertEquals(4.0, dto.getTotalTimeOffHours(), 0.001);
        assertEquals(6.0, working(dto), 0.001, "6 hours were worked");
        assertEquals(10.0, dto.getGrandTotal(), 0.001);
    }

    @Test
    void aFullDayOfLeaveEarnsNoRegularAndNoOvertime() {
        ClientTimesheetWeekDTO dto = week();
        leave(dto, "HOLIDAY", MON, 8);

        service.applyTotals(dto);

        assertEquals(0.0, dto.getTotalRegularHours(), 0.001, "nothing was worked");
        assertEquals(0.0, dto.getTotalOtHours(), 0.001);
        assertEquals(8.0, dto.getTotalTimeOffHours(), 0.001);
        assertEquals(0.0, working(dto), 0.001);
        assertEquals(8.0, dto.getGrandTotal(), 0.001);
    }

    /** OT is untouched by this change: work past 8 on a leave-free day is still overtime. */
    @Test
    void overtimeOnALeaveFreeDayIsUnchanged() {
        ClientTimesheetWeekDTO dto = week();
        worked(dto, MON, 11);

        service.applyTotals(dto);

        assertEquals(8.0, dto.getTotalRegularHours(), 0.001);
        assertEquals(3.0, dto.getTotalOtHours(), 0.001);
        assertEquals(11.0, working(dto), 0.001);
    }

    /** OT is never folded into Regular — they stay separate until Grand Total. */
    @Test
    void overtimeIsNeverAddedIntoRegular() {
        ClientTimesheetWeekDTO dto = week();
        worked(dto, MON, 12, TUE, 12);

        service.applyTotals(dto);

        assertEquals(16.0, dto.getTotalRegularHours(), 0.001, "8 per day, no more");
        assertEquals(8.0, dto.getTotalOtHours(), 0.001);
        assertEquals(24.0, working(dto), 0.001);
    }

    @Test
    void weekendHoursAreNeitherRegularNorOvertime() {
        ClientTimesheetWeekDTO dto = week();
        worked(dto, SAT, 5);

        service.applyTotals(dto);

        assertEquals(0.0, dto.getTotalRegularHours(), 0.001);
        assertEquals(0.0, dto.getTotalOtHours(), 0.001);
    }

    @Test
    void anEmptyWeekIsAllZeroes() {
        ClientTimesheetWeekDTO dto = week();

        service.applyTotals(dto);

        assertEquals(0.0, dto.getTotalRegularHours(), 0.001);
        assertEquals(0.0, dto.getTotalOtHours(), 0.001);
        assertEquals(0.0, dto.getTotalTimeOffHours(), 0.001);
        assertEquals(0.0, dto.getGrandTotal(), 0.001);
    }

    /** Hours split across several project rows on one day share that day's capacity. */
    @Test
    void severalProjectRowsShareTheSameDaysCapacity() {
        ClientTimesheetWeekDTO dto = week();
        worked(dto, MON, 5);
        worked(dto, MON, 5);   // 10 worked on Monday across two rows

        service.applyTotals(dto);

        assertEquals(8.0, dto.getTotalRegularHours(), 0.001);
        assertEquals(2.0, dto.getTotalOtHours(), 0.001);
        assertEquals(10.0, working(dto), 0.001);
    }
}
