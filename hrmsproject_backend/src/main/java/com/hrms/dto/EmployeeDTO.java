//package com.hrms.dto;
//
//import jakarta.validation.constraints.Email;
//import jakarta.validation.constraints.NotBlank;
//import java.time.LocalDate;
//
//public class EmployeeDTO {
//    private Long id;
//    
//    @NotBlank(message = "First name is required")
//    private String firstName;
//    
//    @NotBlank(message = "Last name is required")
//    private String lastName;
//    
//    @NotBlank(message = "Email is required")
//    @Email(message = "Invalid email format")
//    private String email;
//    
//    private String phoneNumber;
//    private LocalDate dateOfBirth;
//    private LocalDate hireDate;
//    private Long departmentId;
//    private Long reportingManagerId;
//    private Boolean active;
//    
//    // Getters and Setters
//    public Long getId() { return id; }
//    public void setId(Long id) { this.id = id; }
//    public String getFirstName() { return firstName; }
//    public void setFirstName(String firstName) { this.firstName = firstName; }
//    public String getLastName() { return lastName; }
//    public void setLastName(String lastName) { this.lastName = lastName; }
//    public String getEmail() { return email; }
//    public void setEmail(String email) { this.email = email; }
//    public String getPhoneNumber() { return phoneNumber; }
//    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
//    public LocalDate getDateOfBirth() { return dateOfBirth; }
//    public void setDateOfBirth(LocalDate dateOfBirth) { this.dateOfBirth = dateOfBirth; }
//    public LocalDate getHireDate() { return hireDate; }
//    public void setHireDate(LocalDate hireDate) { this.hireDate = hireDate; }
//    public Long getDepartmentId() { return departmentId; }
//    public void setDepartmentId(Long departmentId) { this.departmentId = departmentId; }
//    public Long getReportingManagerId() { return reportingManagerId; }
//    public void setReportingManagerId(Long reportingManagerId) { this.reportingManagerId = reportingManagerId; }
//    public Boolean getActive() { return active; }
//    public void setActive(Boolean active) { this.active = active; }
//}
//

package com.hrms.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import java.time.LocalDate;
import java.util.List;

//
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeDTO {

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getFirstName() {
		return firstName;
	}

	public void setFirstName(String firstName) {
		this.firstName = firstName;
	}

	public String getMiddleName() {
		return middleName;
	}

	public void setMiddleName(String middleName) {
		this.middleName = middleName;
	}

	public String getLastName() {
		return lastName;
	}

	public void setLastName(String lastName) {
		this.lastName = lastName;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public String getPhoneNumber() {
		return phoneNumber;
	}

	public void setPhoneNumber(String phoneNumber) {
		this.phoneNumber = phoneNumber;
	}

	public String getAlternatePhone() {
		return alternatePhone;
	}

	public void setAlternatePhone(String alternatePhone) {
		this.alternatePhone = alternatePhone;
	}

	public LocalDate getDateOfBirth() {
		return dateOfBirth;
	}

	public void setDateOfBirth(LocalDate dateOfBirth) {
		this.dateOfBirth = dateOfBirth;
	}

	public String getGender() {
		return gender;
	}

	public void setGender(String gender) {
		this.gender = gender;
	}

	public String getBloodGroup() {
		return bloodGroup;
	}

	public void setBloodGroup(String bloodGroup) {
		this.bloodGroup = bloodGroup;
	}

	public String getPassportNo() {
		return passportNo;
	}

	public void setPassportNo(String passportNo) {
		this.passportNo = passportNo;
	}

	public String getMaritalStatus() {
		return maritalStatus;
	}

	public void setMaritalStatus(String maritalStatus) {
		this.maritalStatus = maritalStatus;
	}

	public String getPhotoPath() {
		return photoPath;
	}

	public void setPhotoPath(String photoPath) {
		this.photoPath = photoPath;
	}

	public String getPresentAddress() {
		return presentAddress;
	}

	public void setPresentAddress(String presentAddress) {
		this.presentAddress = presentAddress;
	}

	public String getPermanentAddress() {
		return permanentAddress;
	}

	public void setPermanentAddress(String permanentAddress) {
		this.permanentAddress = permanentAddress;
	}

	public String getAddressProof() {
		return addressProof;
	}

	public void setAddressProof(String addressProof) {
		this.addressProof = addressProof;
	}

	public String getAddressProofNumber() {
		return addressProofNumber;
	}

	public void setAddressProofNumber(String addressProofNumber) {
		this.addressProofNumber = addressProofNumber;
	}

	public String getPanNo() {
		return panNo;
	}

	public void setPanNo(String panNo) {
		this.panNo = panNo;
	}

	public String getAadhaarNo() {
		return aadhaarNo;
	}

	public void setAadhaarNo(String aadhaarNo) {
		this.aadhaarNo = aadhaarNo;
	}

	public String getEmergencyContactName() {
		return emergencyContactName;
	}

	public void setEmergencyContactName(String emergencyContactName) {
		this.emergencyContactName = emergencyContactName;
	}

	public String getEmergencyRelationship() {
		return emergencyRelationship;
	}

	public void setEmergencyRelationship(String emergencyRelationship) {
		this.emergencyRelationship = emergencyRelationship;
	}

	public String getEmergencyPhone() {
		return emergencyPhone;
	}

	public void setEmergencyPhone(String emergencyPhone) {
		this.emergencyPhone = emergencyPhone;
	}

	public String getEmergencyAddress() {
		return emergencyAddress;
	}

	public void setEmergencyAddress(String emergencyAddress) {
		this.emergencyAddress = emergencyAddress;
	}

	public List<EmployeeEducationDTO> getEducationList() {
		return educationList;
	}

	public void setEducationList(List<EmployeeEducationDTO> educationList) {
		this.educationList = educationList;
	}

	public List<EmployeeExperienceDTO> getExperienceList() {
		return experienceList;
	}

	public void setExperienceList(List<EmployeeExperienceDTO> experienceList) {
		this.experienceList = experienceList;
	}

	public Boolean getActive() {
		return active;
	}

	public void setActive(Boolean active) {
		this.active = active;
	}

	private Long id;

	/* ========= PERSONAL DETAILS ========= */

	@NotBlank(message = "First name is required")
	private String firstName;
	private String middleName;
	@NotBlank(message = "Last name is required")
	private String lastName;

	@NotBlank(message = "Email is required")
	@Email(message = "Email must be valid")
	private String email;

	@NotBlank(message = "Phone number is required")
	private String phoneNumber;
	private String alternatePhone;

	@jakarta.validation.constraints.NotNull(message = "Date of birth is required")
	private LocalDate dateOfBirth;

	@NotBlank(message = "Gender is required")
	private String gender;
	private String bloodGroup;

	private String passportNo;
	private String maritalStatus;

	private String photoPath;

	/* ========= ADDRESS ========= */

	private String presentAddress;
	private String permanentAddress;
	private String addressProof;
	private String addressProofNumber;
	private String panNo;
	private String aadhaarNo;

	/* ========= EMERGENCY CONTACT ========= */

	private String emergencyContactName;
	private String emergencyRelationship;
	private String emergencyPhone;
	private String emergencyAddress;

	/* ========= EDUCATION & EXPERIENCE ========= */

	private List<EmployeeEducationDTO> educationList;
	private List<EmployeeExperienceDTO> experienceList;
	private List<EmployeeDocumentDTO> documentList;

	/* ========= STATUS ========= */

	private Boolean active;

	private String role;
	private String corporateEmail;
	private String designation;
	private String oryfolksId;
	private java.time.LocalDate joiningDate;
	private Long userId;
	private Boolean createAccount;

	// Current client-project assignment (for appending the project name after the name).
	private String clientProject;
	private String clientProjectId;
	private java.time.LocalDate clientAssignmentDate;
	// Client-timesheet access/verification status (OTP secrets are never exposed).
	private Boolean clientAssigned;
	private Boolean clientVerified;

	public Boolean getClientAssigned() {
		return clientAssigned;
	}

	public void setClientAssigned(Boolean clientAssigned) {
		this.clientAssigned = clientAssigned;
	}

	public Boolean getClientVerified() {
		return clientVerified;
	}

	public void setClientVerified(Boolean clientVerified) {
		this.clientVerified = clientVerified;
	}

	public String getClientProject() {
		return clientProject;
	}

	public void setClientProject(String clientProject) {
		this.clientProject = clientProject;
	}

	public String getClientProjectId() {
		return clientProjectId;
	}

	public void setClientProjectId(String clientProjectId) {
		this.clientProjectId = clientProjectId;
	}

	public java.time.LocalDate getClientAssignmentDate() {
		return clientAssignmentDate;
	}

	public void setClientAssignmentDate(java.time.LocalDate clientAssignmentDate) {
		this.clientAssignmentDate = clientAssignmentDate;
	}

	/* ========= ORG REPORTING (resolved names for profile view) ========= */
	private String reportingManagerName;
	private String hrName;
	// Active state of this employee's reporting manager / HR, so the Employee "My Profile"
	// view can show "(Disabled)" beside a disabled RM/HR. false => disabled.
	private Boolean reportingManagerActive;
	private Boolean hrActive;

	public Boolean getReportingManagerActive() {
		return reportingManagerActive;
	}

	public void setReportingManagerActive(Boolean reportingManagerActive) {
		this.reportingManagerActive = reportingManagerActive;
	}

	public Boolean getHrActive() {
		return hrActive;
	}

	public void setHrActive(Boolean hrActive) {
		this.hrActive = hrActive;
	}

	public Boolean getCreateAccount() {
		return createAccount;
	}

	public void setCreateAccount(Boolean createAccount) {
		this.createAccount = createAccount;
	}

	public String getReportingManagerName() {
		return reportingManagerName;
	}

	public void setReportingManagerName(String reportingManagerName) {
		this.reportingManagerName = reportingManagerName;
	}

	public String getHrName() {
		return hrName;
	}

	public void setHrName(String hrName) {
		this.hrName = hrName;
	}

	public Long getUserId() {
		return userId;
	}

	public void setUserId(Long userId) {
		this.userId = userId;
	}

	public java.time.LocalDate getJoiningDate() {
		return joiningDate;
	}

	public void setJoiningDate(java.time.LocalDate joiningDate) {
		this.joiningDate = joiningDate;
	}

	public String getOryfolksId() {
		return oryfolksId;
	}

	public void setOryfolksId(String oryfolksId) {
		this.oryfolksId = oryfolksId;
	}

	public String getRole() {
		return role;
	}

	public void setRole(String role) {
		this.role = role;
	}

	public String getCorporateEmail() {
		return corporateEmail;
	}

	public void setCorporateEmail(String corporateEmail) {
		this.corporateEmail = corporateEmail;
	}

	public String getDesignation() {
		return designation;
	}

	public void setDesignation(String designation) {
		this.designation = designation;
	}

	public List<EmployeeDocumentDTO> getDocumentList() {
		return documentList;
	}

	public void setDocumentList(List<EmployeeDocumentDTO> documentList) {
		this.documentList = documentList;
	}
}
