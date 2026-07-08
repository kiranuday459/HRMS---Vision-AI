-- Migration: add address_proof_number column to employees table

USE hrms;

ALTER TABLE employees ADD COLUMN address_proof_number VARCHAR(255) NULL;

-- Verify
DESCRIBE employees;
