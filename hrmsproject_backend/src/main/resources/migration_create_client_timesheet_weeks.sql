-- =============================================================
-- Migration: client_timesheet_weeks (employee weekly header)
-- =============================================================
-- Week header (Saturday → Friday) for an employee's client timesheet: draft/submit
-- intent, running totals and submit/review timestamps. Line items live in
-- client_timesheets (linked by week_id). Auto-created by Hibernate; kept for reference.

CREATE TABLE IF NOT EXISTS client_timesheet_weeks (
    id                        BIGINT       NOT NULL AUTO_INCREMENT,
    employee_id               BIGINT       NOT NULL,
    week_start_date           DATE         NOT NULL,
    week_end_date             DATE         NOT NULL,
    status                    VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    total_billable_hours      DOUBLE       NULL,
    total_non_billable_hours  DOUBLE       NULL,
    total_timeoff_hours       DOUBLE       NULL,
    grand_total               DOUBLE       NULL,
    submitted_at              DATETIME     NULL,
    reviewed_at               DATETIME     NULL,
    rejection_reason          VARCHAR(255) NULL,
    approved_by_id            BIGINT       NULL,
    created_at                DATETIME     NULL,
    updated_at                DATETIME     NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_ctw_employee_week UNIQUE (employee_id, week_start_date),
    CONSTRAINT fk_ctw_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_ctw_approver FOREIGN KEY (approved_by_id) REFERENCES users (id)
);
