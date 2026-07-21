package com.hrms.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "employees")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Employee {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@NotBlank
	private String firstName;

	private String middleName;

	@NotBlank
	private String lastName;

	@Email
	@Column(unique = true)
	private String email;

	@NotBlank
	@Column(unique = true)
	private String phoneNumber;
	private String alternatePhone;

	@jakarta.validation.constraints.NotNull
	private LocalDate dateOfBirth;

	@NotBlank
	private String gender;
	private String bloodGroup;

	private String passportNo;
	private String maritalStatus;

	private String photoPath;

	@Column(columnDefinition = "TEXT")
	private String presentAddress;

	@Column(columnDefinition = "TEXT")
	private String permanentAddress;

	private String addressProof;
	private String addressProofNumber;

	// Dedicated identity-proof columns so PAN and Aadhaar can both be stored
	// independently (the legacy addressProof/addressProofNumber pair could only hold one).
	private String panNo;
	private String aadhaarNo;

	private String emergencyContactName;
	private String emergencyRelationship;
	private String emergencyPhone;
	private String emergencyAddress;

	@OneToOne(optional = true)
	@JoinColumn(name = "user_id", nullable = true)
	private User user;

	@ManyToOne
	@JoinColumn(name = "department_id")
	private Department department;

	@ManyToOne
	@JoinColumn(name = "reporting_manager_id")
	private Employee reportingManager;

	private LocalDate hireDate;
	private String designation;
	private String employmentType;
	private String corporateEmail;

	// Current client-project assignment summary (set by the admin "Assign to client
	// project" flow). Used to append the project name after the employee's name in
	// lists/directories, and as a convenience mirror of the latest assignment.
	private String clientProject;
	private String clientProjectId;
	private LocalDate clientAssignmentDate;

	// ---- Client timesheet access / verification ----
	// True once the employee has been assigned to a client project.
	private Boolean clientAssigned = false;
	// True once the employee has verified their client-timesheet activation OTP.
	private Boolean clientVerified = false;
	// Hashed activation OTP + its expiry (set by the admin "Resend OTP" action).
	private String clientOtp;
	private LocalDateTime clientOtpExpiry;

	private Boolean active = true;

	private LocalDateTime createdAt;
	private LocalDateTime updatedAt;

	@OneToMany(mappedBy = "employee", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<EmployeeDocument> documents = new ArrayList<>();

	@PrePersist
	protected void onCreate() {
		createdAt = LocalDateTime.now();
		updatedAt = LocalDateTime.now();
	}

	@PreUpdate
	protected void onUpdate() {
		updatedAt = LocalDateTime.now();
	}
}
