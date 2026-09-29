-- Migration to widen timesheets.status column from ENUM to VARCHAR(50)
-- This allows new status values such as 'DRAFT' without MySQL 'Data truncated for column status' errors.

ALTER TABLE timesheets MODIFY COLUMN status VARCHAR(50) DEFAULT 'PENDING_RM_APPROVAL';
