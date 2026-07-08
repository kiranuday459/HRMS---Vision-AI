package com.hrms.config;

import com.hrms.model.Employee;
import com.hrms.model.EmployeeReporting;
import com.hrms.model.Role;
import com.hrms.model.User;
import com.hrms.repository.EmployeeReportingRepository;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Component
@Order(2)
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final EmployeeReportingRepository reportingRepository;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        System.out.println("Starting DataInitializer: Checking User-Employee mappings...");

        // 1. Ensure all Users have an Employee record
        List<User> allUsers = userRepository.findAll();
        for (User user : allUsers) {
            if (employeeRepository.findByUser(user).isEmpty()) {
                System.out.println("Creating missing Employee record for user: " + user.getUsername());
                Employee emp = new Employee();
                emp.setUser(user);
                emp.setEmail(user.getEmail());

                // Set default name based on username
                String name = user.getUsername().substring(0, 1).toUpperCase() + user.getUsername().substring(1);
                emp.setFirstName(name);
                emp.setLastName("User");
                
                // Add required fields to avoid validation errors
                emp.setPhoneNumber("9000000000"); // Default dummy phone
                emp.setDateOfBirth(LocalDate.of(1990, 1, 1)); // Default DOB
                emp.setGender("Other");

                emp.setActive(true);
                employeeRepository.save(emp);
            }
        }

        // 2. Find the Admin User
        List<User> admins = userRepository.findByRole(Role.ADMIN);
        if (admins.isEmpty()) {
            System.out.println("No Admin user found. Skipping reporting sync.");
            return;
        }
        User adminUser = admins.get(0);
        Optional<Employee> adminEmployeeOpt = employeeRepository.findByUser(adminUser);
        if (adminEmployeeOpt.isEmpty()) {
            System.out.println("Admin employee record not found yet. Skipping sync.");
            return;
        }
        Employee adminEmployee = adminEmployeeOpt.get();

        // 3. Find all Reporting Managers and sync them to report to Admin by default
        List<User> managers = userRepository.findByRole(Role.REPORTING_MANAGER);
        for (User managerUser : managers) {
            Optional<Employee> managerEmployeeOpt = employeeRepository.findByUser(managerUser);
            if (managerEmployeeOpt.isPresent()) {
                Employee managerEmployee = managerEmployeeOpt.get();
                EmployeeReporting er = reportingRepository.findByEmployee(managerEmployee)
                        .orElse(new EmployeeReporting());

                if (er.getEmployee() == null)
                    er.setEmployee(managerEmployee);

                if (er.getReportingManager() == null
                        || !er.getReportingManager().getId().equals(adminEmployee.getId())) {
                    er.setReportingManager(adminEmployee);
                    reportingRepository.save(er);
                    System.out.println("Synced manager " + managerEmployee.getFirstName() + " to Admin.");
                }
            }
        }
        System.out.println("DataInitializer: Check complete.");
    }
}

