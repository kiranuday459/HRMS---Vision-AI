-- =============================================================
-- Migration: client access / verification columns on employees
-- =============================================================
-- Additive/nullable columns supporting the admin Client Project Access & verification
-- views. Auto-applied by Hibernate (ddl-auto=update); kept for reference.

ALTER TABLE employees ADD COLUMN client_assigned    BIT(1)   NULL DEFAULT b'0';
ALTER TABLE employees ADD COLUMN client_verified    BIT(1)   NULL DEFAULT b'0';
ALTER TABLE employees ADD COLUMN client_otp         VARCHAR(255) NULL;
ALTER TABLE employees ADD COLUMN client_otp_expiry  DATETIME NULL;

-- (client_project, client_project_id, client_assignment_date were added by a prior
--  migration for the project-name display.)
