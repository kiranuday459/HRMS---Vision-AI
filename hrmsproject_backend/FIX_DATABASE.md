# Fix Database Schema - Make user_id Nullable

## Problem
The `employees` table has `user_id` as NOT NULL, but the application needs it to be nullable so employees can be created without user accounts initially.

## Solution

### Option 1: Run SQL Script (Recommended - Immediate Fix)

1. Open MySQL command line or MySQL Workbench
2. Connect to your database: `hrms`
3. Run this SQL command:

```sql
ALTER TABLE employees MODIFY COLUMN user_id BIGINT NULL;
```

4. Verify the change:
```sql
DESCRIBE employees;
```

You should see `user_id` with `Null: YES`

### Option 2: Using MySQL Workbench

1. Open MySQL Workbench
2. Connect to your database
3. Open a new SQL tab
4. Paste and execute:
```sql
USE hrms;
ALTER TABLE employees MODIFY COLUMN user_id BIGINT NULL;
```

### Option 3: Restart Application (May Work)

Sometimes Hibernate will update the schema on restart. Try:
1. Stop the Spring Boot application
2. Restart it
3. Check if the error is resolved

If Option 3 doesn't work, use Option 1 or 2.

## Verification

After running the SQL, test creating an employee:
- The employee should be created successfully
- The popup should appear to create a user account
- The user account creation should work

## Notes

- The entity code already has `nullable = true` annotation
- The database schema just needs to be updated manually
- This is a one-time fix - future schema updates will respect the nullable setting

