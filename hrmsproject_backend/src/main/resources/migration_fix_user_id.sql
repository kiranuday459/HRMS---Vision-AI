-- Migration script to make user_id nullable in employees table
-- Run this script in your MySQL database to fix the constraint issue

USE hrms;

-- Make user_id column nullable
ALTER TABLE employees MODIFY COLUMN user_id BIGINT NULL;

-- Verify the change
DESCRIBE employees;

