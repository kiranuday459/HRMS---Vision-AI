package com.hrms.service;

import com.hrms.dto.EmployeeDTO;
import com.hrms.dto.EmployeeDocumentDTO;
import com.hrms.dto.EmployeeEducationDTO;
import com.hrms.dto.EmployeeExperienceDTO;
import com.hrms.model.Employee;
import com.hrms.model.EmployeeDocument;
import com.hrms.model.EmployeeEducation;
import com.hrms.model.EmployeeExperience;
// import com.hrms.model.Department;            // PHASE 2
// import com.hrms.repository.DepartmentRepository; // PHASE 2
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.EmployeeDocumentRepository;
import com.hrms.repository.EmployeeEducationRepository;
import com.hrms.repository.EmployeeExperienceRepository;
import com.hrms.repository.UserRepository;
import com.hrms.repository.CompanyDetailRepository;
import com.hrms.model.CompanyDetail;
import com.hrms.model.Leave;
import com.hrms.model.LeaveBalance;
import com.hrms.model.User;
import com.hrms.model.Role;
import com.hrms.repository.LeaveRepository;
import com.hrms.repository.LeaveBalanceRepository;
import com.hrms.repository.EmployeeReportingRepository;
import com.hrms.repository.TimesheetRepository;
import com.hrms.model.EmployeeReporting;
import com.hrms.model.Timesheet;
import com.hrms.model.TimesheetStatus;
import com.hrms.model.LeaveStatus;
import com.hrms.service.LeaveBalanceService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
public class EmployeeService {

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private EmployeeEducationRepository educationRepository;

    @Autowired
    private EmployeeExperienceRepository experienceRepository;

    @Autowired
    private EmployeeDocumentRepository documentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CompanyDetailRepository companyDetailRepository;

    @Autowired
    private LeaveRepository leaveRepository;

    @Autowired
    private LeaveBalanceRepository leaveBalanceRepository;

    @Autowired
    private EmployeeReportingRepository reportingRepository;

    @Autowired
    private TimesheetRepository timesheetRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private LeaveBalanceService leaveBalanceService;

    // Field injection (cycle-tolerant) so setEmployeeActive can trigger disabled-approver
    // rerouting of timesheets/leaves (Part 1/7).
    @Autowired
    private TimesheetService timesheetService;

    @Autowired
    private LeaveService leaveService;

    // @Autowired
    // private DepartmentRepository departmentRepository; // PHASE 2

    /*
     * =========================
     * READ OPERATIONS
     * =========================
     */

    public List<EmployeeDTO> getAllEmployees() {
        return employeeRepository.findAll()
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public EmployeeDTO getEmployeeById(Long id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));
        return convertToDTO(employee);
    }

    public EmployeeDTO getEmployeeByUserId(Long userId) {
        // Find employee by user_id foreign key using repository
        Employee employee = employeeRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Employee profile not found for user ID: " + userId));
        return convertToDTO(employee);
    }

    /*
     * =========================
     * PENDING APPROVAL CHECK
     * (blocks disable/delete while approvals are outstanding)
     * =========================
     */

    // Timesheet statuses that count as "pending approval". A timesheet moving through
    // the RM → HR → Admin approval chain is blocking until it is fully APPROVED or REJECTED.
    private static final List<TimesheetStatus> PENDING_TIMESHEET_STATUSES = Arrays.asList(
            TimesheetStatus.PENDING_RM_APPROVAL,
            TimesheetStatus.PENDING_HR_APPROVAL,
            TimesheetStatus.PENDING_RM_AS_HR_APPROVAL,
            TimesheetStatus.PENDING_ADMIN_APPROVAL);

    // Leave statuses that count as "pending approval".
    private static final List<LeaveStatus> PENDING_LEAVE_STATUSES =
            Arrays.asList(LeaveStatus.PENDING);

    /**
     * Summarise how many timesheets and leaves are still awaiting approval for an
     * employee. Used to block disabling/deleting an account while approvals are
     * outstanding (a disabled/deleted employee can never resolve them).
     */
    public Map<String, Object> getPendingApprovalSummary(Long id) {
        employeeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        long pendingTimesheets = timesheetRepository.countByEmployeeIdAndStatusIn(id, PENDING_TIMESHEET_STATUSES);
        long pendingLeaves = leaveRepository.countByEmployeeIdAndStatusIn(id, PENDING_LEAVE_STATUSES);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("hasPending", pendingTimesheets > 0 || pendingLeaves > 0);
        summary.put("pendingTimesheets", pendingTimesheets);
        summary.put("pendingLeaves", pendingLeaves);
        return summary;
    }

    // Enable / disable an employee (toggle active flag). Mirrors the status onto the
    // linked user account so login is blocked/restored.
    public EmployeeDTO setEmployeeActive(Long id, boolean active) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        employee.setActive(active);
        employeeRepository.save(employee);

        User user = employee.getUser();
        if (user != null) {
            user.setActive(active);
            userRepository.save(user);
        }

        // Disabled HR/RM rerouting (Part 1/7): when this account is an approver for other
        // employees, reroute their pending items away from the disabled approver (and back
        // when re-enabled). No-op when the account is not anyone's RM/HR.
        if (!active) {
            timesheetService.rerouteTimesheetsForDisabledApprover(id);
            leaveService.rerouteLeavesForDisabledApprover(id);
        } else {
            timesheetService.transferTimesheetsBackToReenabledApprover(id);
            leaveService.transferLeavesBackToReenabledApprover(id);
        }

        Employee reloaded = employeeRepository.findById(id).orElse(employee);
        return convertToDTO(reloaded);
    }

    /*
     * =========================
     * CREATE EMPLOYEE
     * (PHASE 1 ONLY)
     * =========================
     */

    public EmployeeDTO createEmployee(EmployeeDTO dto) {

        if (employeeRepository.findByEmail(dto.getEmail()).isPresent()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Employee with this personal email already exists");
        }

        if (dto.getPhoneNumber() != null && !dto.getPhoneNumber().isBlank()) {
            if (employeeRepository.findByPhoneNumber(dto.getPhoneNumber()).isPresent()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Employee with this phone number already exists");
            }
        }

        if (dto.getCorporateEmail() != null && !dto.getCorporateEmail().isBlank()) {
            if (companyDetailRepository.findByOryfolksMailId(dto.getCorporateEmail()).isPresent()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Employee with this corporate email already exists");
            }
        }

        if (dto.getOryfolksId() != null && !dto.getOryfolksId().isBlank()) {
            if (companyDetailRepository.findByOryfolksId(dto.getOryfolksId()).isPresent()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Employee with this corporate ID already exists");
            }
        }

        // Create Employee
        Employee employee = convertToEntity(dto);

        // Link user if userId is provided
        if (dto.getUserId() != null) {
            User user = userRepository.findById(dto.getUserId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
            employee.setUser(user);
        }

        Employee saved = employeeRepository.save(employee);

        // Automatically create a user account for the employee ONLY if:
        // 1. No user exists with this email
        // 2. Employee doesn't already have a user linked
        // Removed automatic creation as it conflicts with manual user creation phase
        
        // Save Education records
        if (dto.getEducationList() != null && !dto.getEducationList().isEmpty()) {
            for (EmployeeEducationDTO eduDto : dto.getEducationList()) {
                EmployeeEducation education = convertEducationToEntity(eduDto);
                education.setEmployee(saved);
                educationRepository.save(education);
            }
        }

        // Save Experience records
        if (dto.getExperienceList() != null && !dto.getExperienceList().isEmpty()) {
            for (EmployeeExperienceDTO expDto : dto.getExperienceList()) {
                EmployeeExperience experience = convertExperienceToEntity(expDto);
                experience.setEmployee(saved);
                experienceRepository.save(experience);
            }
        }

        // Save Company Details if provided
        if (dto.getOryfolksId() != null || dto.getCorporateEmail() != null || dto.getDesignation() != null) {
            com.hrms.model.CompanyDetail companyDetail = new com.hrms.model.CompanyDetail();
            companyDetail.setEmployee(saved);
            String oryfolksId = dto.getOryfolksId() != null ? dto.getOryfolksId() : "PENDING";
            String oryfolksMailId = dto.getCorporateEmail() != null ? dto.getCorporateEmail() : dto.getEmail();
            companyDetail.setOryfolksId(oryfolksId);
            companyDetail.setVisionaiId(oryfolksId);  // Set visionaiId to match oryfolksId
            companyDetail.setOryfolksMailId(oryfolksMailId);
            companyDetail.setVisionaiMailId(oryfolksMailId);  // Set visionaiMailId to match oryfolksMailId
            companyDetail.setDesignation(dto.getDesignation() != null ? dto.getDesignation() : "Employee");
            companyDetail.setJoiningDate(dto.getJoiningDate());
            companyDetailRepository.save(companyDetail);
        }

        // Handle automatic User Account creation if requested
        if (Boolean.TRUE.equals(dto.getCreateAccount())) {
            String username = dto.getOryfolksId();
            String corporateEmail = dto.getCorporateEmail();

            if (username == null || username.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Corporate ID is required for account creation");
            }
            if (corporateEmail == null || corporateEmail.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Corporate Email is required for account creation");
            }

            // Check if user already exists
            if (userRepository.findByUsername(username).isPresent()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "User with this Corporate ID already exists");
            }
            if (userRepository.findByEmail(corporateEmail).isPresent()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "User with this Corporate Email already exists");
            }

            // Create User — assign role based on DTO role field
            Role userRole = Role.EMPLOYEE;
            if ("HR".equalsIgnoreCase(dto.getRole())) {
                userRole = Role.HR;
            }

            User user = new User();
            user.setUsername(username);
            user.setEmail(corporateEmail);
            user.setPassword(passwordEncoder.encode("emp123")); // Default password
            user.setRole(userRole);
            user.setActive(true);
            User savedUser = userRepository.save(user);

            // Link to Employee
            saved.setUser(savedUser);
            employeeRepository.save(saved);
        }

        // Initialize Leave Balance
        leaveBalanceService.initializeLeaveBalance(saved.getId());

        EmployeeDTO resultDto = convertToDTO(saved);
        // Explicitly set these if they were just saved and might not be picked up by
        // separate query due to transactional lag
        if (dto.getOryfolksId() != null)
            resultDto.setOryfolksId(dto.getOryfolksId());
        if (dto.getCorporateEmail() != null)
            resultDto.setCorporateEmail(dto.getCorporateEmail());
        if (dto.getDesignation() != null)
            resultDto.setDesignation(dto.getDesignation());
        if (dto.getJoiningDate() != null)
            resultDto.setJoiningDate(dto.getJoiningDate());

        return resultDto;
    }

    /*
     * =========================
     * UPDATE EMPLOYEE
     * (PHASE 1 ONLY)
     * =========================
     */

    public EmployeeDTO updateEmployee(Long id, EmployeeDTO dto) {

        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        if (!employee.getEmail().equals(dto.getEmail())
                && employeeRepository.findByEmail(dto.getEmail()).isPresent()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Email already exists");
        }

        if (dto.getPhoneNumber() != null && !dto.getPhoneNumber().equals(employee.getPhoneNumber())
                && employeeRepository.findByPhoneNumber(dto.getPhoneNumber()).isPresent()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Phone number already exists");
        }

        employee.setFirstName(dto.getFirstName());
        employee.setMiddleName(dto.getMiddleName());
        employee.setLastName(dto.getLastName());
        employee.setEmail(dto.getEmail());
        employee.setPhoneNumber(dto.getPhoneNumber());
        employee.setAlternatePhone(dto.getAlternatePhone());
        employee.setDateOfBirth(dto.getDateOfBirth());
        employee.setGender(dto.getGender());
        employee.setBloodGroup(dto.getBloodGroup());
        employee.setPassportNo(dto.getPassportNo());
        employee.setMaritalStatus(dto.getMaritalStatus());
        employee.setPhotoPath(dto.getPhotoPath());
        employee.setPresentAddress(dto.getPresentAddress());
        employee.setPermanentAddress(dto.getPermanentAddress());
        employee.setAddressProof(dto.getAddressProof());
        employee.setAddressProofNumber(dto.getAddressProofNumber());
        employee.setPanNo(dto.getPanNo());
        employee.setAadhaarNo(dto.getAadhaarNo());
        employee.setEmergencyContactName(dto.getEmergencyContactName());
        employee.setEmergencyRelationship(dto.getEmergencyRelationship());
        employee.setEmergencyPhone(dto.getEmergencyPhone());
        employee.setEmergencyAddress(dto.getEmergencyAddress());
        employee.setActive(
                dto.getActive() != null ? dto.getActive() : employee.getActive());

        // Update Company Details if present
        if (dto.getDesignation() != null || dto.getCorporateEmail() != null || dto.getOryfolksId() != null) {
            CompanyDetail details = companyDetailRepository.findByEmployee_Id(employee.getId())
                    .orElse(new CompanyDetail());
            details.setEmployee(employee);
            if (dto.getDesignation() != null)
                details.setDesignation(dto.getDesignation());
            if (dto.getCorporateEmail() != null)
                details.setOryfolksMailId(dto.getCorporateEmail());
            if (dto.getOryfolksId() != null)
                details.setOryfolksId(dto.getOryfolksId());
            if (dto.getJoiningDate() != null)
                details.setJoiningDate(dto.getJoiningDate());
            companyDetailRepository.save(details);
        }

        /*
         * =========================
         * CORPORATE DETAILS
         * (PHASE 2 – COMMENTED)
         * =========================
         */

        // employee.setHireDate(dto.getHireDate());

        // if (dto.getDepartmentId() != null) {
        // Department dept = departmentRepository.findById(dto.getDepartmentId())
        // .orElseThrow(() ->
        // new ResponseStatusException(HttpStatus.NOT_FOUND, "Department not found")
        // );
        // employee.setDepartment(dept);
        // }

        // if (dto.getReportingManagerId() != null) {
        // Employee manager = employeeRepository.findById(dto.getReportingManagerId())
        // .orElseThrow(() ->
        // new ResponseStatusException(HttpStatus.NOT_FOUND, "Reporting manager not
        // found")
        // );
        // employee.setReportingManager(manager);
        // }

        Employee updated = employeeRepository.save(employee);

        // Update education records: remove existing and recreate from DTO
        List<EmployeeEducation> existingEdus = educationRepository.findByEmployeeId(id);
        if (existingEdus != null && !existingEdus.isEmpty()) {
            educationRepository.deleteAll(existingEdus);
        }
        if (dto.getEducationList() != null && !dto.getEducationList().isEmpty()) {
            for (EmployeeEducationDTO eduDto : dto.getEducationList()) {
                EmployeeEducation education = convertEducationToEntity(eduDto);
                education.setEmployee(updated);
                educationRepository.save(education);
            }
        }

        // Update experience records: remove existing and recreate from DTO
        List<EmployeeExperience> existingExps = experienceRepository.findByEmployeeId(id);
        if (existingExps != null && !existingExps.isEmpty()) {
            experienceRepository.deleteAll(existingExps);
        }
        if (dto.getExperienceList() != null && !dto.getExperienceList().isEmpty()) {
            for (EmployeeExperienceDTO expDto : dto.getExperienceList()) {
                EmployeeExperience experience = convertExperienceToEntity(expDto);
                experience.setEmployee(updated);
                experienceRepository.save(experience);
            }
        }

        // reload updated entity to ensure relations are fresh
        Employee reloaded = employeeRepository.findById(updated.getId()).orElse(updated);
        return convertToDTO(reloaded);
    }

    /*
     * =========================
     * DELETE EMPLOYEE
     * =========================
     */

    public void deleteEmployee(Long id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        try {
            // 1. Handle EmployeeReporting references (where id is manager/hr)
            // Subordinates' reporting manager set to null
            List<EmployeeReporting> subordinates = reportingRepository.findAllByReportingManager(employee);
            for (EmployeeReporting er : subordinates) {
                er.setReportingManager(null);
                reportingRepository.save(er);
            }

            // Also clear reportingManager field in Employee table (self-reference)
            List<Employee> directSubordinates = employeeRepository.findByReportingManager(employee);
            for (Employee e : directSubordinates) {
                e.setReportingManager(null);
                employeeRepository.save(e);
            }

            // Subordinates' HR set to null
            List<EmployeeReporting> hrSubordinates = reportingRepository.findByHr(employee);
            for (EmployeeReporting er : hrSubordinates) {
                er.setHr(null);
                reportingRepository.save(er);
            }

            // Subordinates' previous manager set to null
            List<EmployeeReporting> prevSubordinates = reportingRepository.findByPreviousReportingManager(employee);
            for (EmployeeReporting er : prevSubordinates) {
                er.setPreviousReportingManager(null);
                reportingRepository.save(er);
            }

            // 2. Clear approvals/reviews by this employee's USER
            if (employee.getUser() != null) {
                User user = employee.getUser();
                
                // Clear leave approvals
                List<Leave> approvedLeaves = leaveRepository.findByApprovedBy(user);
                for (Leave l : approvedLeaves) {
                    l.setApprovedBy(null);
                    leaveRepository.save(l);
                }

                // Clear timesheet reviews
                List<Timesheet> reviewedTimesheets = timesheetRepository.findByReviewedBy(user);
                for (Timesheet t : reviewedTimesheets) {
                    t.setReviewedBy(null);
                    timesheetRepository.save(t);
                }
            }

            // 3. Delete employee's own Assignment/Reporting records
            reportingRepository.findByEmployee(employee).ifPresent(er -> {
                reportingRepository.delete(er);
            });

            // 4. Delete timesheets
            List<Timesheet> timesheets = timesheetRepository.findByEmployeeId(id);
            if (timesheets != null && !timesheets.isEmpty()) {
                timesheetRepository.deleteAll(timesheets);
            }

            // 5. Delete education
            List<EmployeeEducation> educations = educationRepository.findByEmployeeId(id);
            if (educations != null && !educations.isEmpty()) {
                educationRepository.deleteAll(educations);
            }

            // 6. Delete experience
            List<EmployeeExperience> experiences = experienceRepository.findByEmployeeId(id);
            if (experiences != null && !experiences.isEmpty()) {
                experienceRepository.deleteAll(experiences);
            }

            // 7. Delete documents
            List<EmployeeDocument> documents = documentRepository.findByEmployeeId(id);
            if (documents != null && !documents.isEmpty()) {
                documentRepository.deleteAll(documents);
            }

            // 8. Delete company details
            companyDetailRepository.findByEmployee_Id(id).ifPresent(details -> {
                companyDetailRepository.delete(details);
            });

            // 9. Delete leave balances
            leaveBalanceRepository.findByEmployeeId(id).ifPresent(balance -> {
                leaveBalanceRepository.delete(balance);
            });

            // 10. Delete leave applications
            List<Leave> leaves = leaveRepository.findByEmployeeId(id);
            if (leaves != null && !leaves.isEmpty()) {
                leaveRepository.deleteAll(leaves);
            }

            // 11. Delete linked user LAST (to avoid violating FK in other approvals before we cleared them)
            if (employee.getUser() != null) {
                Long userId = employee.getUser().getId();
                // We set user to null in employee first to avoid cyclical check
                User userToDelete = employee.getUser();
                employee.setUser(null);
                employeeRepository.save(employee);
                userRepository.delete(userToDelete);
            }

            // 12. Finally delete employee
            employeeRepository.delete(employee);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to delete employee: " + ex.getMessage());
        }
    }

    /*
     * =========================
     * ENTITY → DTO
     * =========================
     */

    private EmployeeDTO convertToDTO(Employee employee) {

        EmployeeDTO dto = new EmployeeDTO();
        dto.setId(employee.getId());
        dto.setFirstName(employee.getFirstName());
        dto.setMiddleName(employee.getMiddleName());
        dto.setLastName(employee.getLastName());
        dto.setEmail(employee.getEmail());
        dto.setPhoneNumber(employee.getPhoneNumber());
        dto.setAlternatePhone(employee.getAlternatePhone());
        dto.setDateOfBirth(employee.getDateOfBirth());
        dto.setGender(employee.getGender());
        dto.setBloodGroup(employee.getBloodGroup());
        dto.setPassportNo(employee.getPassportNo());
        dto.setMaritalStatus(employee.getMaritalStatus());
        dto.setPhotoPath(employee.getPhotoPath());
        dto.setPresentAddress(employee.getPresentAddress());
        dto.setPermanentAddress(employee.getPermanentAddress());
        dto.setAddressProof(employee.getAddressProof());
        dto.setAddressProofNumber(employee.getAddressProofNumber());
        // PAN / Aadhaar come from their dedicated columns. For records created before
        // these columns existed, fall back to the legacy single addressProof slot so the
        // previously-saved value still displays.
        String panNo = employee.getPanNo();
        String aadhaarNo = employee.getAadhaarNo();
        if (panNo == null && "PAN".equals(employee.getAddressProof())) {
            panNo = employee.getAddressProofNumber();
        }
        if (aadhaarNo == null && "Aadhar".equals(employee.getAddressProof())) {
            aadhaarNo = employee.getAddressProofNumber();
        }
        dto.setPanNo(panNo);
        dto.setAadhaarNo(aadhaarNo);
        dto.setEmergencyAddress(employee.getEmergencyAddress());
        dto.setEmergencyContactName(employee.getEmergencyContactName());
        dto.setEmergencyRelationship(employee.getEmergencyRelationship());
        dto.setEmergencyPhone(employee.getEmergencyPhone());
        dto.setActive(employee.getActive());
        dto.setClientProject(employee.getClientProject());
        dto.setClientProjectId(employee.getClientProjectId());
        dto.setClientAssignmentDate(employee.getClientAssignmentDate());

        if (employee.getUser() != null) {
            dto.setUserId(employee.getUser().getId());
            if (employee.getUser().getRole() != null) {
                dto.setRole(employee.getUser().getRole().name());
            } else {
                dto.setRole("EMPLOYEE");
            }
        } else {
            dto.setRole("EMPLOYEE");
        }

        // Add company details (designation and corporate email)
        companyDetailRepository.findByEmployee_Id(employee.getId()).ifPresent(details -> {
            dto.setDesignation(details.getDesignation());
            dto.setCorporateEmail(details.getOryfolksMailId());
            dto.setOryfolksId(details.getOryfolksId());
            dto.setJoiningDate(details.getJoiningDate());
        });

        // Load and set education list
        List<EmployeeEducation> educations = educationRepository.findByEmployeeId(employee.getId());
        dto.setEducationList(educations.stream()
                .map(this::convertEducationToDTO)
                .collect(Collectors.toList()));

        // Load and set experience list
        List<EmployeeExperience> experiences = experienceRepository.findByEmployeeId(employee.getId());
        dto.setExperienceList(experiences.stream()
                .map(this::convertExperienceToDTO)
                .collect(Collectors.toList()));

        // Load and set document list
        List<EmployeeDocument> documents = documentRepository.findByEmployeeId(employee.getId());
        dto.setDocumentList(documents.stream()
                .map(this::convertDocumentToDTO)
                .collect(Collectors.toList()));

        // Resolve the employee's assigned Reporting Manager and HR names (org reporting),
        // so the Profile View can display them read-only. Uses a tolerant lookup so a
        // duplicate reporting row never breaks the list endpoint.
        reportingRepository.findFirstByEmployeeOrderByIdDesc(employee).ifPresent(er -> {
            if (er.getReportingManager() != null) {
                String managerName = (er.getReportingManager().getFirstName() + " "
                        + (er.getReportingManager().getLastName() == null ? "" : er.getReportingManager().getLastName())).trim();
                dto.setReportingManagerName(managerName);
                dto.setReportingManagerActive(er.getReportingManager().getActive());
            }
            if (er.getHr() != null) {
                String hrName = (er.getHr().getFirstName() + " "
                        + (er.getHr().getLastName() == null ? "" : er.getHr().getLastName())).trim();
                dto.setHrName(hrName);
                dto.setHrActive(er.getHr().getActive());
            }
        });
        if (dto.getReportingManagerName() == null) {
            dto.setReportingManagerName("N/A");
        }
        if (dto.getHrName() == null) {
            dto.setHrName("N/A");
        }

        /*
         * =========================
         * PHASE 2 FIELDS (COMMENTED)
         * =========================
         */

        // dto.setHireDate(employee.getHireDate());

        // if (employee.getDepartment() != null) {
        // dto.setDepartmentId(employee.getDepartment().getId());
        // }

        // if (employee.getReportingManager() != null) {
        // dto.setReportingManagerId(employee.getReportingManager().getId());
        // }

        return dto;
    }

    /*
     * =========================
     * DTO → ENTITY
     * =========================
     */

    private Employee convertToEntity(EmployeeDTO dto) {

        Employee employee = new Employee();
        employee.setFirstName(dto.getFirstName());
        employee.setMiddleName(dto.getMiddleName());
        employee.setLastName(dto.getLastName());
        employee.setEmail(dto.getEmail());
        employee.setPhoneNumber(dto.getPhoneNumber());
        employee.setAlternatePhone(dto.getAlternatePhone());
        employee.setDateOfBirth(dto.getDateOfBirth());
        employee.setGender(dto.getGender());
        employee.setBloodGroup(dto.getBloodGroup());
        employee.setPassportNo(dto.getPassportNo());
        employee.setMaritalStatus(dto.getMaritalStatus());
        employee.setPhotoPath(dto.getPhotoPath());
        employee.setPresentAddress(dto.getPresentAddress());
        employee.setPermanentAddress(dto.getPermanentAddress());
        employee.setAddressProof(dto.getAddressProof());
        employee.setAddressProofNumber(dto.getAddressProofNumber());
        employee.setPanNo(dto.getPanNo());
        employee.setAadhaarNo(dto.getAadhaarNo());
        employee.setEmergencyAddress(dto.getEmergencyAddress());
        employee.setEmergencyContactName(dto.getEmergencyContactName());
        employee.setEmergencyRelationship(dto.getEmergencyRelationship());
        employee.setEmergencyPhone(dto.getEmergencyPhone());
        employee.setActive(dto.getActive() != null ? dto.getActive() : true);

        /*
         * =========================
         * PHASE 2 FIELDS (COMMENTED)
         * =========================
         */

        // employee.setHireDate(dto.getHireDate());

        // if (dto.getDepartmentId() != null) {
        // Department dept = departmentRepository.findById(dto.getDepartmentId())
        // .orElseThrow(() ->
        // new ResponseStatusException(HttpStatus.NOT_FOUND, "Department not found")
        // );
        // employee.setDepartment(dept);
        // }

        // if (dto.getReportingManagerId() != null) {
        // Employee manager = employeeRepository.findById(dto.getReportingManagerId())
        // .orElseThrow(() ->
        // new ResponseStatusException(HttpStatus.NOT_FOUND, "Reporting manager not
        // found")
        // );
        // employee.setReportingManager(manager);
        // }

        return employee;
    }

    /*
     * =========================
     * EDUCATION CONVERSION
     * =========================
     */

    private EmployeeEducationDTO convertEducationToDTO(EmployeeEducation education) {
        EmployeeEducationDTO dto = new EmployeeEducationDTO();
        dto.setId(education.getId());
        dto.setInstitutionName(education.getInstitutionName());
        dto.setDegreeLevel(education.getDegreeLevel());
        dto.setStartYear(education.getStartYear());
        dto.setEndYear(education.getEndYear());
        return dto;
    }

    private EmployeeEducation convertEducationToEntity(EmployeeEducationDTO dto) {
        EmployeeEducation education = new EmployeeEducation();
        education.setInstitutionName(dto.getInstitutionName());
        education.setDegreeLevel(dto.getDegreeLevel());
        education.setStartYear(dto.getStartYear());
        education.setEndYear(dto.getEndYear());
        return education;
    }

    /*
     * =========================
     * EXPERIENCE CONVERSION
     * =========================
     */

    private EmployeeExperienceDTO convertExperienceToDTO(EmployeeExperience experience) {
        EmployeeExperienceDTO dto = new EmployeeExperienceDTO();
        dto.setId(experience.getId());
        dto.setEmployerName(experience.getEmployerName());
        dto.setBusinessType(experience.getBusinessType());
        dto.setDesignation(experience.getDesignation());
        dto.setStartDate(experience.getStartDate());
        dto.setEndDate(experience.getEndDate());
        dto.setEmployerAddress(experience.getEmployerAddress());
        dto.setReportingManagerName(experience.getReportingManagerName());
        dto.setReportingManagerEmail(experience.getReportingManagerEmail());
        dto.setReportingManagerPhone(null); // Not in entity model
        return dto;
    }

    private EmployeeExperience convertExperienceToEntity(EmployeeExperienceDTO dto) {
        EmployeeExperience experience = new EmployeeExperience();
        experience.setEmployerName(dto.getEmployerName());
        experience.setBusinessType(dto.getBusinessType());
        experience.setDesignation(dto.getDesignation());
        experience.setStartDate(dto.getStartDate());
        experience.setEndDate(dto.getEndDate());
        experience.setEmployerAddress(dto.getEmployerAddress());
        experience.setReportingManagerName(dto.getReportingManagerName());
        experience.setReportingManagerEmail(dto.getReportingManagerEmail());
        return experience;
    }

    /*
     * =========================
     * DOCUMENT CONVERSION
     * =========================
     */

    private EmployeeDocumentDTO convertDocumentToDTO(EmployeeDocument document) {
        return EmployeeDocumentDTO.builder()
                .id(document.getId())
                .documentType(document.getDocumentType())
                .documentName(document.getDocumentName())
                .fileName(document.getFileName())
                .fileUrl(document.getFileUrl())
                .contentType(document.getContentType())
                .fileSize(document.getFileSize())
                .uploadedAt(document.getUploadedAt())
                .build();
    }
}
