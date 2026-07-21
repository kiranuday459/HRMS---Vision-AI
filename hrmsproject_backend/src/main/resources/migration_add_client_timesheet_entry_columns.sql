-- =============================================================
-- Migration: additive columns on client_timesheets for employee week entry
-- =============================================================
-- Extends the existing client_timesheets table (used by the admin approval queue and
-- Excel export) with the employee week-entry fields. All columns are nullable/additive,
-- so existing admin reads/writes are unaffected. Auto-applied by Hibernate; kept for
-- reference / manual environments.

ALTER TABLE client_timesheets ADD COLUMN week_start_date  DATE         NULL;
ALTER TABLE client_timesheets ADD COLUMN week_end_date    DATE         NULL;
ALTER TABLE client_timesheets ADD COLUMN week_id          BIGINT       NULL;
ALTER TABLE client_timesheets ADD COLUMN project_id       VARCHAR(255) NULL;
ALTER TABLE client_timesheets ADD COLUMN task_id          VARCHAR(255) NULL;
ALTER TABLE client_timesheets ADD COLUMN task_description VARCHAR(255) NULL;
ALTER TABLE client_timesheets ADD COLUMN onsite_offshore  VARCHAR(32)  NULL;
ALTER TABLE client_timesheets ADD COLUMN billing_location VARCHAR(64)  NULL;
ALTER TABLE client_timesheets ADD COLUMN comment          TEXT         NULL;
ALTER TABLE client_timesheets ADD COLUMN category         VARCHAR(32)  NULL;

-- Note: the status column already exists; the ClientTimesheetStatus enum simply gains a
-- new 'DRAFT' value (stored as the string 'DRAFT'). No column change required.
