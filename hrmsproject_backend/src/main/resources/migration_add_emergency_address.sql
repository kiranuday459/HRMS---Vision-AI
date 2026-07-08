-- Migration: add emergency_address column to employees table

USE hrms;

ALTER TABLE employees ADD COLUMN emergency_address TEXT NULL;

-- Verify
DESCRIBE employees;
