-- Give the 256-character free-text columns headroom above their validated limit.
--
-- migration_widen_client_timesheet_text_columns.sql set these columns to exactly the agreed
-- limit: VARCHAR(256) for a 256-character field. That leaves no margin at all — the column and
-- the validation are the same number, so anything in the write path that costs a single extra
-- character turns a legitimate maximum-length value into a failed INSERT.
--
-- That is what happened. A description of 255 characters submitted; 256 — the documented limit,
-- accepted by the UI counter and by the service-layer requireMaxLength — came back as
-- "Task/Activity Description is too long to save". The column accepts 256 when written directly
-- with SQL, so the extra character is introduced somewhere between the request and the insert;
-- widening removes the whole class of problem rather than chasing which layer adds it.
--
-- The enforced contract does not change: ClientTimesheetWeekService.MAX_TASK_DESCRIPTION and
-- FIELD_LIMITS.TASK_DESCRIPTION stay at 256, and a longer value is still rejected with a clear
-- 400 naming the field. This only stops MySQL from being the thing that rejects it, which it
-- should never have been — the service layer is the contract, the column is storage.
--
-- VARCHAR is variable-length: widening costs nothing for rows already stored, and no value is
-- truncated. Safe to re-run.

ALTER TABLE client_timesheets
    MODIFY COLUMN task_description VARCHAR(512) NULL;

-- The legacy admin-facing mirror that persist() copies taskDescription into. It has to move
-- with its twin — leaving it behind is exactly how the pair drifted one character apart before.
ALTER TABLE client_timesheets
    MODIFY COLUMN task VARCHAR(512) NULL;

ALTER TABLE client_project_assignments
    MODIFY COLUMN task_description VARCHAR(512) NULL;

ALTER TABLE client_timesheets
    MODIFY COLUMN rejection_reason VARCHAR(512) NULL;

ALTER TABLE client_timesheet_weeks
    MODIFY COLUMN rejection_reason VARCHAR(512) NULL;
