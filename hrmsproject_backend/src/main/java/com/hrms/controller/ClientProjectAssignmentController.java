package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.dto.ClientProjectAssignmentDTO;
import com.hrms.dto.EmployeeDTO;
import com.hrms.model.User;
import com.hrms.model.UserPrincipal;
import com.hrms.service.ClientProjectAssignmentService;
import com.hrms.service.EmployeeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Client/project assignment API. Admin creates/lists assignments; an employee reads
 * their own active assignments to build the Client Timesheet entry rows.
 */
@RestController
@RequestMapping("/api/client-project-assignments")
@CrossOrigin(origins = "http://localhost:3000")
public class ClientProjectAssignmentController {

    @Autowired
    private ClientProjectAssignmentService assignmentService;

    @Autowired
    private EmployeeService employeeService;

    private Long currentUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal) {
            return ((UserPrincipal) authentication.getPrincipal()).getUser().getId();
        }
        return null;
    }

    private Long currentEmployeeId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal) {
            User user = ((UserPrincipal) authentication.getPrincipal()).getUser();
            try {
                EmployeeDTO employee = employeeService.getEmployeeByUserId(user.getId());
                return employee != null ? employee.getId() : null;
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<ClientProjectAssignmentDTO>>> create(
            @RequestBody ClientProjectAssignmentDTO dto,
            Authentication authentication) {
        List<ClientProjectAssignmentDTO> created = assignmentService.create(dto, currentUserId(authentication));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(buildAssignMessage(created), created));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<ClientProjectAssignmentDTO>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(assignmentService.getAll()));
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<ClientProjectAssignmentDTO>>> getMine(Authentication authentication) {
        Long employeeId = currentEmployeeId(authentication);
        if (employeeId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Employee profile not found"));
        }
        return ResponseEntity.ok(ApiResponse.success(assignmentService.getActiveForEmployee(employeeId)));
    }

    /**
     * Success message for the assign action. Names the (single) employee/project when the
     * batch is one, and notes that a verification OTP has been emailed.
     */
    private String buildAssignMessage(List<ClientProjectAssignmentDTO> created) {
        if (created == null || created.isEmpty()) {
            return "No employees assigned.";
        }
        if (created.size() == 1) {
            ClientProjectAssignmentDTO a = created.get(0);
            return a.getEmployeeName() + " assigned to " + a.getProjectName()
                    + " successfully. A verification OTP has been sent to their registered email.";
        }
        return created.size() + " employees assigned to " + created.get(0).getProjectName()
                + " successfully. A verification OTP has been sent to each of their registered emails.";
    }

    /**
     * Soft-ends an assignment (sets active = false). Preserves the row for history.
     * Used by the admin Assigned Members tab remove action.
     */
    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ClientProjectAssignmentDTO>> deactivate(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Assignment ended", assignmentService.deactivate(id)));
    }
}
