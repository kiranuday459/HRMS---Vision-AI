package com.hrms.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;

/**
 * Runs one-time SQL fixes at application startup that Hibernate's ddl-auto=update
 * cannot handle automatically (e.g., dropping NOT NULL constraints from existing columns).
 */
@Component
public class DatabaseMigrationRunner implements ApplicationRunner {

    @Autowired
    private DataSource dataSource;

    @Override
    public void run(ApplicationArguments args) {
        try (Connection conn = dataSource.getConnection(); Statement stmt = conn.createStatement()) {
            // Allow start_time and end_time to be NULL in the timesheets table.
            try {
                stmt.execute("ALTER TABLE timesheets MODIFY COLUMN start_time time(6) NULL");
                stmt.execute("ALTER TABLE timesheets MODIFY COLUMN end_time time(6) NULL");
                System.out.println("[DatabaseMigrationRunner] Successfully made start_time/end_time nullable");
            } catch (Exception e) {
                System.out.println("[DatabaseMigrationRunner] Note on timesheet times: " + e.getMessage());
            }

            // Widen leave and timesheet reason / rejection_reason / manager_comments columns to TEXT
            // so reasons up to 500 characters never fail with MySQL "Data too long for column" truncation errors.
            try {
                stmt.execute("ALTER TABLE leaves MODIFY COLUMN rejection_reason TEXT NULL");
                stmt.execute("ALTER TABLE leaves MODIFY COLUMN reason TEXT NULL");
                stmt.execute("ALTER TABLE timesheets MODIFY COLUMN rejection_reason TEXT NULL");
                stmt.execute("ALTER TABLE timesheets MODIFY COLUMN manager_comments TEXT NULL");
                System.out.println("[DatabaseMigrationRunner] Successfully expanded leave/timesheet reason and rejection_reason columns to TEXT");
            } catch (Exception e) {
                System.out.println("[DatabaseMigrationRunner] Note on reason columns: " + e.getMessage());
            }
        } catch (Exception e) {
            System.out.println("[DatabaseMigrationRunner] General Note: " + e.getMessage());
        }
    }
}
