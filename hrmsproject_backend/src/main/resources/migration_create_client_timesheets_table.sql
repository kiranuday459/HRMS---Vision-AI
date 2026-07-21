-- =============================================================
-- Migration: create the client_timesheets table
-- =============================================================
-- This table is fully independent of the existing `timesheets` table. It stores
-- client timesheet entries only. Hibernate (ddl-auto=update) auto-creates this
-- table from the ClientTimesheet @Entity; this script is kept for reference and
-- for environments where schema changes are applied manually.
--
-- The only foreign keys are employee_id (same reference other tables already use)
-- and approved_by_id -> users(id) for the approver. No FK into `timesheets`.

CREATE TABLE IF NOT EXISTS client_timesheets (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    employee_id       BIGINT       NOT NULL,
    date              DATE         NOT NULL,
    client_name       VARCHAR(255) NULL,
    project_name      VARCHAR(255) NULL,
    task              VARCHAR(255) NULL,
    hours             DOUBLE       NULL,
    billable          BIT(1)       NULL,
    notes             TEXT         NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    rejection_reason  VARCHAR(255) NULL,
    approved_by_id    BIGINT       NULL,
    submitted_at      DATETIME     NULL,
    reviewed_at       DATETIME     NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_client_timesheets_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_client_timesheets_approver FOREIGN KEY (approved_by_id) REFERENCES users (id)
);
