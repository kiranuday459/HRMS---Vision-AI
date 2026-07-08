package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.dto.CreateEmployeeUserRequest;
import com.hrms.model.Employee;
import com.hrms.model.Role;
import com.hrms.model.User;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/users")
public class AdminUserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * Create a login user for an existing employee with role EMPLOYEE.
     * Default password: emp123
     */
    @PostMapping("/employee")
    public ResponseEntity<ApiResponse<User>> createEmployeeUser(
            @RequestBody CreateEmployeeUserRequest request) {
        if (request.getEmployeeId() == null || request.getEmployeeId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Employee ID is required");
        }
        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }

        // Check for username or email conflicts
        userRepository.findByUsername(request.getEmployeeId()).ifPresent(u -> {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "User with this employee ID already exists");
        });

        userRepository.findByEmail(request.getEmail()).ifPresent(u -> {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "User with this email already exists");
        });

        // Find employee by email to link the user
        Employee employee = employeeRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Employee with email " + request.getEmail() + " not found. Please create the employee first."));

        // Check if employee already has a user account
        if (employee.getUser() != null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This employee already has a user account");
        }

        // Create user
        User user = new User();
        user.setUsername(request.getEmployeeId());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode("emp123"));
        user.setRole(Role.EMPLOYEE);
        user.setActive(true);

        User savedUser = userRepository.save(user);

        // Link user to employee
        employee.setUser(savedUser);
        employeeRepository.save(employee);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Employee user created successfully. Default password: emp123", savedUser));
    }
}
