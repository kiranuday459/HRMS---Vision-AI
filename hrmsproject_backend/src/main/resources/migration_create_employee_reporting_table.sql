-- Migration: create employee_reporting table and remove reporting_manager_id from employees

USE hrms;

-- Create new table to hold reporting and HR relationships
CREATE TABLE IF NOT EXISTS employee_reporting (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT NOT NULL,
  reporting_manager_id BIGINT NULL,
  hr_id BIGINT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_er_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_er_manager FOREIGN KEY (reporting_manager_id) REFERENCES employees(id),
  CONSTRAINT fk_er_hr FOREIGN KEY (hr_id) REFERENCES employees(id)
);

-- Drop the old reporting_manager_id column from employees (if it exists)
ALTER TABLE employees DROP COLUMN reporting_manager_id;

-- Verify
DESCRIBE employee_reporting;
