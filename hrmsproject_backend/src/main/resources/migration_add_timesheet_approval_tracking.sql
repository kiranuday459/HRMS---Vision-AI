-- Migration to add multi-stage approval tracking fields to timesheets table
-- This enables sequential approval workflow: Employee → RM → HR → Admin

ALTER TABLE timesheets
ADD COLUMN rm_approved_by_id BIGINT,
ADD COLUMN rm_approved_at TIMESTAMP,
ADD COLUMN hr_approved_by_id BIGINT,
ADD COLUMN hr_approved_at TIMESTAMP,
ADD COLUMN admin_approved_by_id BIGINT,
ADD COLUMN admin_approved_at TIMESTAMP,
ADD COLUMN rejection_reason TEXT,
ADD COLUMN rejected_by_role VARCHAR(20),
ADD COLUMN rejected_at TIMESTAMP;

-- Add foreign key constraints
ALTER TABLE timesheets
ADD CONSTRAINT fk_timesheets_rm_approved_by
FOREIGN KEY (rm_approved_by_id) REFERENCES users(id);

ALTER TABLE timesheets
ADD CONSTRAINT fk_timesheets_hr_approved_by
FOREIGN KEY (hr_approved_by_id) REFERENCES users(id);

ALTER TABLE timesheets
ADD CONSTRAINT fk_timesheets_admin_approved_by
FOREIGN KEY (admin_approved_by_id) REFERENCES users(id);

-- Update existing timesheets to have appropriate initial status based on employee role
-- This is a data migration that will be handled by the application logic
-- when timesheets are loaded and saved