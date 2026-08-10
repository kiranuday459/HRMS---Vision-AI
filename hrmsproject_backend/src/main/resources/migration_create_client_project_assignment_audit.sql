-- Staffing history behind the Client Timesheet Admin "Audit Logs" tab.
--
-- One immutable row per staffing decision: ASSIGNED, REMOVED or REASSIGNED. A separate event
-- table rather than removed_by / removed_at columns on client_project_assignments, because the
-- same assignment can be removed and re-added repeatedly — columns would keep only the latest
-- of those and silently overwrite the earlier history.
--
-- Names are stored beside the ids on purpose: the log records what was true at the time, so a
-- later rename must not rewrite it. No foreign keys, for the same reason — the log has to
-- outlive the rows it describes.
--
-- Append-only. Nothing in the application updates or deletes from this table.

CREATE TABLE IF NOT EXISTS client_project_assignment_audit (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    assignment_id      BIGINT       NULL,
    employee_id        BIGINT       NULL,
    employee_name      VARCHAR(128) NULL,
    client_name        VARCHAR(255) NULL,
    project_id         VARCHAR(25)  NULL,
    project_name       VARCHAR(50)  NULL,
    action             VARCHAR(16)  NOT NULL,
    performed_by_id    BIGINT       NULL,
    performed_by_name  VARCHAR(128) NULL,
    performed_at       DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    -- The tab reads strictly newest-first, and filters by employee.
    KEY idx_cpa_audit_performed_at (performed_at DESC),
    KEY idx_cpa_audit_employee (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
