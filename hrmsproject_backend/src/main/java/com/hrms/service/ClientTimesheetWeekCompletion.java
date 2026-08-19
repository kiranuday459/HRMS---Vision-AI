package com.hrms.service;

import com.hrms.model.ClientTimesheet;
import com.hrms.model.ClientTimesheetStatus;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Answers "which days of this client timesheet week has the employee not filled in yet?" —
 * the question behind both the Friday employee reminder and the Monday admin summary.
 *
 * Shared by the two jobs on purpose: the employee's reminder and the admin's pending list
 * quote the same missing days for the same week, so an employee cannot be told they are up to
 * date while the admin is told they are three days short.
 *
 * Deliberately holds no repositories. The caller loads the week's line rows; this only decides
 * what they mean, so the rules below can be exercised directly in a unit test without a DB.
 */
@Component
public class ClientTimesheetWeekCompletion {

    /**
     * Client timesheet weeks run Saturday → Friday. Same arithmetic as
     * ClientTimesheetWeekService.weekStartOf — the reminder must group days into weeks
     * exactly as the entry page does, or it would report days from the wrong week.
     */
    public LocalDate weekStartOf(LocalDate date) {
        int offset = (date.getDayOfWeek().getValue() - DayOfWeek.SATURDAY.getValue() + 7) % 7;
        return date.minusDays(offset);
    }

    /**
     * The days of the week an employee is actually expected to account for.
     *
     * Monday–Friday only. The week spans Saturday → Friday, but weekends carry no Regular or
     * Overtime hours and the entry page locks them, so flagging a blank Saturday as "missing"
     * would be chasing an employee for a day the product does not let them fill.
     *
     * Two further exclusions, both mirroring rules the entry validator already enforces:
     *   - days before the employee's client assignment start date — hours there are rejected
     *     with "Cannot enter hours before your client assignment date";
     *   - days after {@code today} — rejected with "Cannot enter hours for future dates".
     * Without them, an employee assigned on Wednesday would be chased for the Monday and
     * Tuesday they could not have filled in even if they had tried.
     *
     * @param assignmentStart earliest active assignment date, or null when unknown (no gate)
     * @param today           the reference date; days after it are not yet due
     */
    public List<LocalDate> expectedWorkdays(LocalDate weekStart, LocalDate assignmentStart, LocalDate today) {
        List<LocalDate> expected = new ArrayList<>();
        if (weekStart == null) {
            return expected;
        }
        for (int i = 0; i < 7; i++) {
            LocalDate day = weekStart.plusDays(i);
            DayOfWeek dow = day.getDayOfWeek();
            if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) continue;
            if (assignmentStart != null && day.isBefore(assignmentStart)) continue;
            if (today != null && day.isAfter(today)) continue;
            expected.add(day);
        }
        return expected;
    }

    /**
     * Expected workdays with nothing entered against them, in date order.
     *
     * A day counts as filled by any line carrying hours — project work or time off alike.
     * Time off has to count: an employee who logged eight hours of PTO on Wednesday has
     * accounted for Wednesday, and nagging them for it would be wrong.
     *
     * Empty list means the employee is up to date and gets no email.
     */
    public List<LocalDate> missingWorkdays(Collection<ClientTimesheet> weekLines, LocalDate weekStart,
            LocalDate assignmentStart, LocalDate today) {
        Set<LocalDate> filled = new HashSet<>();
        if (weekLines != null) {
            for (ClientTimesheet line : weekLines) {
                if (line == null || line.getDate() == null) continue;
                // Lines are only persisted with hours > 0, but a zero row from an older
                // write must not be read as a day accounted for.
                if (line.getHours() != null && line.getHours() > 0) {
                    filled.add(line.getDate());
                }
            }
        }
        List<LocalDate> missing = new ArrayList<>();
        for (LocalDate day : expectedWorkdays(weekStart, assignmentStart, today)) {
            if (!filled.contains(day)) {
                missing.add(day);
            }
        }
        return missing;
    }

    /**
     * Whether the employee ever sent this week to the admin.
     *
     * PENDING, APPROVED and REJECTED all count — each one only exists because a submit
     * happened. REJECTED especially: the employee did submit, the admin sent it back, and the
     * Monday summary's "did not submit" list is not the place to report that. DRAFT rows were
     * saved and never submitted, and a week with no rows at all was never started.
     */
    public boolean wasSubmitted(Collection<ClientTimesheet> weekLines) {
        if (weekLines == null) {
            return false;
        }
        return weekLines.stream().anyMatch(l -> l != null
                && l.getStatus() != null
                && l.getStatus() != ClientTimesheetStatus.DRAFT);
    }
}
