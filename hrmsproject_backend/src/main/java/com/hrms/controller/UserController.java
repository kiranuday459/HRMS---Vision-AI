package com.hrms.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;
import com.hrms.dto.ApiResponse;
import com.hrms.dto.EmployeeDTO;
import com.hrms.model.Role;
import com.hrms.model.User;
import com.hrms.model.UserPrincipal;
import com.hrms.repository.UserRepository;
import com.hrms.service.EmployeeService;

@RestController
@RequestMapping("/api")
public class UserController {

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private EmployeeService employeeService;

	@GetMapping("/me")
	public ResponseEntity<?> me(Authentication authentication) {

		if (authentication == null || !authentication.isAuthenticated()) {
			return ResponseEntity
					.status(HttpStatus.UNAUTHORIZED)
					.body(Map.of("error", "Not authenticated"));
		}

		Object principal = authentication.getPrincipal();

		if (principal instanceof UserPrincipal userPrincipal) {
			return ResponseEntity.ok(userPrincipal.getUser());
		}

		return ResponseEntity
				.status(HttpStatus.UNAUTHORIZED)
				.body(Map.of("error", "Invalid principal"));
	}

	@GetMapping("/me/employee")
	public ResponseEntity<?> getMyEmployeeProfile(Authentication authentication) {
		if (authentication == null || !authentication.isAuthenticated()) {
			return ResponseEntity
					.status(HttpStatus.UNAUTHORIZED)
					.body(ApiResponse.error("Not authenticated"));
		}

		Object principal = authentication.getPrincipal();

		if (principal instanceof UserPrincipal userPrincipal) {
			User user = userPrincipal.getUser();
			try {
				// Get employee by user id
				EmployeeDTO employee = employeeService.getEmployeeByUserId(user.getId());
				return ResponseEntity.ok(ApiResponse.success(employee));
			} catch (Exception e) {
				return ResponseEntity
						.status(HttpStatus.NOT_FOUND)
						.body(ApiResponse.error("Employee profile not found for this user"));
			}
		}

		return ResponseEntity
				.status(HttpStatus.UNAUTHORIZED)
				.body(ApiResponse.error("Invalid principal"));
	}

	@GetMapping("/users")
	public ResponseEntity<?> getAllUsers() {
		List<User> users = userRepository.findAll();
		return ResponseEntity.ok(users);
	}

	@Autowired
	private PasswordEncoder passwordEncoder;

	@PostMapping("/users")
	public ResponseEntity<?> createUser(@RequestBody User user) {
		user.setPassword(passwordEncoder.encode(user.getPassword()));
		User savedUser = userRepository.save(user);
		return ResponseEntity.ok(savedUser);
	}

	@PostMapping("/users/create")
	public ResponseEntity<?> createUserAccount(@RequestBody User user) {
		try {
			// Check if username already exists
			if (userRepository.findByUsername(user.getUsername()).isPresent()) {
				return ResponseEntity
						.status(HttpStatus.BAD_REQUEST)
						.body(Map.of("message", "Username already exists"));
			}

			// Check if email already exists
			if (userRepository.findByEmail(user.getEmail()).isPresent()) {
				return ResponseEntity
						.status(HttpStatus.BAD_REQUEST)
						.body(Map.of("message", "Email already exists"));
			}

			// Encode password and save user
			user.setPassword(passwordEncoder.encode(user.getPassword()));
			User savedUser = userRepository.save(user);

			return ResponseEntity.ok(Map.of(
					"message", "User account created successfully",
					"user", savedUser));
		} catch (Exception e) {
			return ResponseEntity
					.status(HttpStatus.INTERNAL_SERVER_ERROR)
					.body(Map.of("message", "Failed to create user account: " + e.getMessage()));
		}
	}

	@PostMapping("/users/{userId}/role")
	public ResponseEntity<?> updateUserRole(
			@PathVariable Long userId,
			@RequestBody Map<String, String> payload) {
		try {
			String newRole = payload.get("role");

			if (newRole == null || newRole.trim().isEmpty()) {
				return ResponseEntity
						.status(HttpStatus.BAD_REQUEST)
						.body(Map.of("message", "Role is required"));
			}

			// Find user by ID
			User user = userRepository.findById(userId)
					.orElseThrow(() -> new RuntimeException("User not found"));

			// Validate role
			Role role;
			try {
				role = Role.valueOf(newRole.toUpperCase());
			} catch (IllegalArgumentException e) {
				return ResponseEntity
						.status(HttpStatus.BAD_REQUEST)
						.body(Map.of("message", "Invalid role: " + newRole));
			}

			// Update user role
			user.setRole(role);
			User updatedUser = userRepository.save(user);

			return ResponseEntity.ok(Map.of(
					"message", "User role updated successfully",
					"user", updatedUser));
		} catch (Exception e) {
			return ResponseEntity
					.status(HttpStatus.INTERNAL_SERVER_ERROR)
					.body(Map.of("message", "Failed to update user role: " + e.getMessage()));
		}
	}

}
