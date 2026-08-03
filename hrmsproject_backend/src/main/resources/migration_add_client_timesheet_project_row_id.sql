-- Groups day-level client_timesheets lines into distinct UI rows (multiple rows per project).
-- Applied automatically by Hibernate ddl-auto=update; kept for reference.
ALTER TABLE client_timesheets ADD COLUMN IF NOT EXISTS project_row_id VARCHAR(64);
