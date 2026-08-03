-- =============================================================
-- Migration: create the client_timesheet_notifications table
-- =============================================================
-- Backs the notification bell inside the Client Timesheet workspace. Deliberately
-- SEPARATE from the main HRMS `notifications` table: /api/notifications returns a user's
-- rows unfiltered, so sharing a table would surface client-timesheet activity in the HRMS
-- bell and merge two systems that are meant to stay independent.
--
-- Hibernate (ddl-auto=update) auto-creates this table from the ClientTimesheetNotification
-- @Entity; this script is kept for reference and for manually-migrated environments.
--
-- The only foreign key is user_id -> users(id) (the recipient). related_employee_id is a
-- plain context column, intentionally not a FK, so purging an employee never blocks or
-- cascades into notification history.

CREATE TABLE IF NOT EXISTS client_timesheet_notifications (
    id                  BIGINT       NOT NULL AUTO_INCREMENT,
    user_id             BIGINT       NOT NULL,
    event_type          VARCHAR(48)  NULL,
    message             TEXT         NULL,
    related_employee_id BIGINT       NULL,
    related_week_start  DATE         NULL,
    is_read             BIT(1)       NOT NULL DEFAULT 0,
    created_at          DATETIME     NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_ct_notifications_user FOREIGN KEY (user_id) REFERENCES users (id)
);

-- The panel always reads "my rows, newest first"; the unread badge counts by user.
CREATE INDEX idx_ct_notifications_user_created
    ON client_timesheet_notifications (user_id, created_at DESC);

CREATE INDEX idx_ct_notifications_user_unread
    ON client_timesheet_notifications (user_id, is_read);
