package com.hrms.config;

import com.hrms.model.*;
import com.hrms.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Component
@Order(1)
public class DataSeeder implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private LeaveBalanceRepository leaveBalanceRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    @Transactional
    public void run(String... args) {
        System.out.println("=== DataSeeder: Starting Fresh Reset ===");

        // Clear any existing check constraints on leave_type that might block new types (like LOP)
        // Hibernate ddl-auto=update often fails to update these automatically on Postgres
        try {
            jdbcTemplate.execute("ALTER TABLE leaves DROP CONSTRAINT IF EXISTS leaves_leave_type_check");
        } catch (Exception ignored) {}

        try {
            // Check if our new admin setup already exists
            if (userRepository.findByUsername("admin1").isEmpty()) {
                System.out.println(">>> Wiping all database records for fresh start...");
                wipeDatabase();
                System.out.println("✓ Database wiped successfully");

                // Create default departments
                System.out.println(">>> Creating default departments...");
                Department adminDept = new Department();
                adminDept.setName("Administration");
                adminDept.setDescription("System Administration");
                adminDept = departmentRepository.save(adminDept);

                Department itDept = new Department();
                itDept.setName("IT");
                itDept.setDescription("Information Technology");
                departmentRepository.save(itDept);

                Department hrDept = new Department();
                hrDept.setName("HR");
                hrDept.setDescription("Human Resources");
                departmentRepository.save(hrDept);
                System.out.println("✓ Default departments created");

                // Create 4 Admin users with corresponding Employee records
                System.out.println(">>> Creating 4 Admin logins (admin1, admin2, admin3, admin4)...");
                for (int i = 1; i <= 4; i++) {
                    String username = "admin" + i;
                    createAdminWithEmployee(username, username + "@hrms.com", "admin123", adminDept);
                }
                
                System.out.println("✓ 4 Admin users and employees created with password: admin123");
            } else {
                System.out.println("=== Admin data already exists, skipping fresh reset ===");
            }

            // Initialize leave balances for any employees (though they should have them already)
            initializeLeaveBalances();

        } catch (Exception e) {
            System.err.println("Error during data seeding: " + e.getMessage());
            e.printStackTrace();
        }

        System.out.println("=== DataSeeder: Completed ===");
    }

    private void wipeDatabase() {
        // Disable foreign key checks, truncate all tables, then re-enable
        try {
            jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 0");

            // Truncate all tables in dependency order (reverse of creation)
            String[] tables = {
                "leave_details",
                "leaves",
                "leave_balances",
                "timesheets",
                "notifications",
                "holidays",
                "employee_documents",
                "employee_education",
                "employee_experience",
                "employee_reporting",
                "company_details",
                "employees",
                "users",
                "departments"
            };

            for (String table : tables) {
                try {
                    jdbcTemplate.execute("TRUNCATE TABLE " + table);
                } catch (Exception e) {
                    System.err.println("Failed to truncate table " + table + ": " + e.getMessage());
                }
            }

            jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1");
        } catch (Exception e) {
            System.err.println("Error during database wipe: " + e.getMessage());
        }
    }

    private void createAdminWithEmployee(String username, String email, String password, Department dept) {
        // 1. Create User
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(Role.ADMIN);
        user.setActive(true);
        user = userRepository.save(user);

        // 2. Create corresponding Employee (with required fields to avoid validation errors)
        Employee emp = new Employee();
        emp.setUser(user);
        emp.setFirstName(username.substring(0, 1).toUpperCase() + username.substring(1));
        emp.setLastName("Admin");
        emp.setEmail(email);
        emp.setPhoneNumber("000000000" + username.charAt(username.length()-1));
        emp.setDateOfBirth(LocalDate.of(1990, 1, 1));
        emp.setGender("Male");
        emp.setDepartment(dept);
        emp.setActive(true);
        employeeRepository.save(emp);
    }

    private void initializeLeaveBalances() {
        employeeRepository.findAll().forEach(employee -> {
            if (leaveBalanceRepository.findByEmployeeId(employee.getId()).isEmpty()) {
                LeaveBalance balance = new LeaveBalance();
                balance.setEmployee(employee);
                balance.setCasualLeavesTotal(10.0);
                balance.setCasualLeavesUsed(0.0);
                balance.setSickLeavesTotal(6.0);
                balance.setSickLeavesUsed(0.0);
                balance.setEarnedLeavesTotal(12.0);
                balance.setEarnedLeavesUsed(0.0);
                leaveBalanceRepository.save(balance);
            }
        });
    }
}

