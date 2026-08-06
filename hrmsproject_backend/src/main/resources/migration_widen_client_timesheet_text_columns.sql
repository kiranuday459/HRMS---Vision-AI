-- Widen the free-text columns whose agreed limit is 256 characters.
--
-- The agreed limits table sets Task/Activity Description, Comment and Rejection Reason to
-- 256, but these columns were created as VARCHAR(255). A value at the agreed limit would
-- therefore be accepted by both the UI and the service-layer validation and then fail at
-- MySQL with a raw "Data too long for column" 500 — the exact failure the length checks
-- exist to prevent. Widening to 256 makes the column the loosest constraint, so the
-- validation always wins.
--
-- Idempotent-ish: MODIFY is safe to re-run. Values are only ever widened, never truncated.
--
-- comment is already TEXT (migration_add_client_timesheet_entry_columns.sql) and needs no
-- change. project_id / project_name / task_id stay VARCHAR(255): their limits tightened to
-- 25/50/25, and leaving the columns wide keeps any pre-existing longer values readable
-- rather than truncating live data — the service layer is what enforces the new maximum.

ALTER TABLE client_timesheets
    MODIFY COLUMN task_description VARCHAR(256) NULL;

ALTER TABLE client_timesheets
    MODIFY COLUMN rejection_reason VARCHAR(256) NULL;

ALTER TABLE client_timesheet_weeks
    MODIFY COLUMN rejection_reason VARCHAR(256) NULL;

ALTER TABLE client_project_assignments
    MODIFY COLUMN task_description VARCHAR(256) NULL;
