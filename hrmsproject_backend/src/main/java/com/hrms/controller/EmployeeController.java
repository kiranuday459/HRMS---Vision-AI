package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.dto.EmployeeDTO;
import com.hrms.model.CompanyDetail;
import com.hrms.service.EmployeeService;
import jakarta.validation.Valid;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/employees")
// @CrossOrigin(origins = "http://localhost:3000") // OPTIONAL – can remove if global CORS exists
public class EmployeeController {

    @Autowired
    private EmployeeService employeeService;

    @Autowired
    private com.hrms.service.FileStorageService fileStorageService;

    @Autowired
    private com.hrms.repository.EmployeeRepository employeeRepository;

    @Autowired
    private com.hrms.repository.CompanyDetailRepository companyDetailRepository;

    /* =========================
       GENERATE EMPLOYEE ID & EMAIL
       ========================= */
    @GetMapping("/generate-id")
    public ResponseEntity<?> generateEmployeeId(
            @RequestParam String role,
            @RequestParam(required = false, defaultValue = "") String firstName,
            @RequestParam(required = false, defaultValue = "") String lastName
    ) {
        // Determine role prefix
        String rolePrefix;
        switch (role.toUpperCase()) {
            case "HR":         rolePrefix = "VA-HR"; break;
            case "EMPLOYEE":   rolePrefix = "VA-IT"; break;
            default:
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Invalid role: " + role));
        }

        // Build initials from lastName[0] + firstName[0]
        String initials = "";
        if (!lastName.isEmpty()) initials += lastName.substring(0, 1).toUpperCase();
        if (!firstName.isEmpty()) initials += firstName.substring(0, 1).toUpperCase();

        // Query all existing IDs that start with this role prefix to find next seq
        String searchPrefix = rolePrefix + "-";
        List<com.hrms.model.CompanyDetail> existing = companyDetailRepository.findByOryfolksIdStartingWith(searchPrefix);
        int nextSeq = 1;
        for (com.hrms.model.CompanyDetail cd : existing) {
            if (cd.getOryfolksId() != null) {
                // Format: VA-IT-GS-0001 → last segment is seq number
                String[] parts = cd.getOryfolksId().split("-");
                if (parts.length >= 4) {
                    try {
                        int seq = Integer.parseInt(parts[parts.length - 1]);
                        if (seq >= nextSeq) nextSeq = seq + 1;
                    } catch (NumberFormatException ignored) {}
                }
            }
        }

        String sequenceStr = String.format("%04d", nextSeq);
        String employeeId = rolePrefix + "-" + initials + "-" + sequenceStr;

        // Generate corporate email: <lastName first letter>.<firstName> all lowercase
        String emailPrefix = "";
        if (!lastName.isEmpty()) emailPrefix += lastName.substring(0, 1).toLowerCase();
        if (!firstName.isEmpty()) emailPrefix += "." + firstName.toLowerCase().replaceAll("[^a-z0-9]", "");

        // Ensure email uniqueness
        if (!emailPrefix.isEmpty()) {
            String finalEmail = emailPrefix;
            int count = 1;
            while (companyDetailRepository.findByOryfolksMailId(finalEmail + "@visionai.com").isPresent()) {
                finalEmail = emailPrefix + count;
                count++;
            }
            emailPrefix = finalEmail;
        }

        Map<String, String> result = new HashMap<>();
        result.put("employeeId", employeeId);
        result.put("emailPrefix", emailPrefix);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /* =========================
       GET ALL EMPLOYEES
       ========================= */
    @GetMapping
    public ResponseEntity<ApiResponse<List<EmployeeDTO>>> getAllEmployees() {

        List<EmployeeDTO> employees = employeeService.getAllEmployees();

        return ResponseEntity.ok(
                ApiResponse.success(employees)
        );
    }

    /* =========================
       GET EMPLOYEE BY ID
       ========================= */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<EmployeeDTO>> getEmployeeById(
            @PathVariable Long id
    ) {
        EmployeeDTO employee = employeeService.getEmployeeById(id);

        return ResponseEntity.ok(
                ApiResponse.success(employee)
        );
    }

    /* =========================
       CREATE EMPLOYEE
       (PHASE 1 – PERSONAL DETAILS ONLY)
       ========================= */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('HR')")
    public ResponseEntity<ApiResponse<EmployeeDTO>> createEmployee(
            @RequestBody EmployeeDTO dto
    ) {
        // Manual validation for debugging
        if (dto.getFirstName() == null || dto.getFirstName().trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("First name is required"));
        }
        if (dto.getLastName() == null || dto.getLastName().trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("Last name is required"));
        }
        if (dto.getEmail() == null || dto.getEmail().trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("Email is required"));
        }
        
        EmployeeDTO created = employeeService.createEmployee(dto);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success(
                        "Employee created successfully",
                        created
                ));
    }

    /* =========================
       UPDATE EMPLOYEE
       ========================= */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<EmployeeDTO>> updateEmployee(
            @PathVariable Long id,
            @Valid @RequestBody EmployeeDTO dto
    ) {
        EmployeeDTO updated = employeeService.updateEmployee(id, dto);

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Employee updated successfully",
                        updated
                )
        );
    }

    /* =========================
       PENDING APPROVAL CHECK
       (frontend pre-check for disable/delete UX)
       ========================= */
    @GetMapping("/{id}/pending-check")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> checkPendingApprovals(
            @PathVariable Long id
    ) {
        Map<String, Object> summary = employeeService.getPendingApprovalSummary(id);
        return ResponseEntity.ok(ApiResponse.success(summary));
    }

    /*
     * Build a 400 response blocking a disable/delete when the employee still has
     * pending timesheets or leaves awaiting approval. Returns null when there is
     * nothing pending (so the caller may proceed). This is the backend source of
     * truth — the frontend pre-check is only for nicer UX.
     */
    private ResponseEntity<ApiResponse<?>> pendingApprovalBlock(Long id, String action) {
        Map<String, Object> summary = employeeService.getPendingApprovalSummary(id);
        if (Boolean.TRUE.equals(summary.get("hasPending"))) {
            long pendingTimesheets = ((Number) summary.get("pendingTimesheets")).longValue();
            long pendingLeaves = ((Number) summary.get("pendingLeaves")).longValue();
            String message = "Cannot " + action + " this account. Employee has "
                    + pendingTimesheets + " pending timesheet(s) and "
                    + pendingLeaves + " pending leave(s) awaiting approval. "
                    + "Please ensure all timesheets and leaves are approved or rejected first.";
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse<>("error", message, summary));
        }
        return null;
    }

    /* =========================
       ENABLE / DISABLE EMPLOYEE
       (Admin only)
       ========================= */
    @PutMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<?>> updateEmployeeStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body
    ) {
        Boolean active = body.get("active");
        if (active == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("'active' field is required"));
        }

        // Block disabling an account with pending timesheets/leaves. Enabling is never blocked.
        if (Boolean.FALSE.equals(active)) {
            ResponseEntity<ApiResponse<?>> blocked = pendingApprovalBlock(id, "disable");
            if (blocked != null) {
                return blocked;
            }
        }

        EmployeeDTO updated = employeeService.setEmployeeActive(id, active);

        return ResponseEntity.ok(
                ApiResponse.success(
                        active ? "Employee enabled successfully" : "Employee disabled successfully",
                        updated
                )
        );
    }

    /* =========================
       UPLOAD PHOTO
       ========================= */
    @PostMapping("/upload-photo")
    public ResponseEntity<?> uploadPhoto(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            @RequestParam("employeeId") Long employeeId
    ) {
        try {
            com.hrms.model.Employee employee = employeeRepository.findById(employeeId)
                    .orElseThrow(() -> new RuntimeException("Employee not found"));

            String fileName = fileStorageService.storeFile(file, "profile_" + employeeId);
            String fileDownloadUri = org.springframework.web.servlet.support.ServletUriComponentsBuilder.fromCurrentContextPath()
                    .path("/api/uploads/")
                    .path(fileName)
                    .toUriString();

            employee.setPhotoPath(fileDownloadUri);
            employeeRepository.save(employee);

            return ResponseEntity.ok(ApiResponse.success("Photo uploaded successfully", fileDownloadUri));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Could not upload photo: " + e.getMessage()));
        }
    }

    /* =========================
       DELETE EMPLOYEE
       ========================= */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<?>> deleteEmployee(
            @PathVariable Long id
    ) {
        // Block deleting an account with pending timesheets/leaves awaiting approval.
        ResponseEntity<ApiResponse<?>> blocked = pendingApprovalBlock(id, "delete");
        if (blocked != null) {
            return blocked;
        }

        employeeService.deleteEmployee(id);

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Employee deleted successfully",
                        null
                )
        );
    }
}
