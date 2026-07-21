-- =============================================================
-- Migration: client_project_assignments (employee → client/project)
-- =============================================================
-- Records which employees are assigned to which client/project and the earliest date
-- they may log hours against it. Auto-created by Hibernate (ddl-auto=update); kept for
-- reference / manual environments. Independent of the internal timesheets feature.

CREATE TABLE IF NOT EXISTS client_project_assignments (
    id                     BIGINT       NOT NULL AUTO_INCREMENT,
    employee_id            BIGINT       NOT NULL,
    client_name            VARCHAR(255) NULL,
    project_id             VARCHAR(255) NULL,
    project_name           VARCHAR(255) NULL,
    task_id                VARCHAR(255) NULL,
    task_description       VARCHAR(255) NULL,
    onsite_offshore        VARCHAR(32)  NULL,
    client_billable        VARCHAR(32)  NULL,
    billing_location       VARCHAR(64)  NULL,
    assignment_start_date  DATE         NOT NULL,
    active                 BIT(1)       NOT NULL DEFAULT b'1',
    assigned_by_id         BIGINT       NULL,
    created_at             DATETIME     NULL,
    updated_at             DATETIME     NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_cpa_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_cpa_assigned_by FOREIGN KEY (assigned_by_id) REFERENCES users (id)
);
