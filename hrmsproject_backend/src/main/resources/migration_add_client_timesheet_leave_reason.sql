-- Leave reason for Client Timesheet time-off entries.
--
-- Employees must now say why they are taking leave. The reason is scoped per leave type per
-- week (matching how a project row's comment is scoped per row), and is written onto every day
-- line of that type in the week, so any one of them can answer for the row.
--
-- Nullable, with no backfill. Weeks saved before this column existed carry no reason and must
-- keep loading and displaying exactly as they did — the requirement applies to new submissions,
-- and inventing a reason for historic leave would put words in an employee's mouth. The
-- required-field check lives in the service layer at submit time, not in the column.
--
-- 512 rather than 256, deliberately. The agreed limit is 256 and it is enforced in
-- ClientTimesheetWeekService; the column is storage and must never be the thing that rejects a
-- valid value. See migration_task_text_headroom.sql — sizing a column to exactly its limit is
-- what broke the task description twice.
--
-- Safe to re-run: the ADD COLUMN is skipped when the column is already present.

SET @ddl := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE client_timesheets ADD COLUMN leave_reason VARCHAR(512) NULL',
        'SELECT ''client_timesheets.leave_reason already exists'''
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'client_timesheets'
      AND COLUMN_NAME = 'leave_reason'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
