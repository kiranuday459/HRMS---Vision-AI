-- =============================================================
-- Migration: Regular / Overtime totals on client_timesheet_weeks
-- =============================================================
-- Each weekday carries 8 hours of Regular capacity, shared between leave taken and
-- project hours worked. Anything a day's worked hours add beyond that capacity is
-- Overtime; a full-day leave (>= 8h) fills the quota and earns no overtime.
--
-- Both values are computed server-side in ClientTimesheetWeekService.applyTotals and
-- stored here so the admin approval queue reads authoritative figures rather than
-- recomputing (or trusting) what the browser sent.
--
-- Additive and nullable-safe: existing rows default to 0 and are recalculated the next
-- time the week is saved or submitted. Auto-applied by Hibernate (ddl-auto=update);
-- kept for reference / manually-migrated environments.

ALTER TABLE client_timesheet_weeks ADD COLUMN total_regular_hours DOUBLE NULL DEFAULT 0;
ALTER TABLE client_timesheet_weeks ADD COLUMN total_ot_hours      DOUBLE NULL DEFAULT 0;
