package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.dto.ClientProjectAssignmentDTO;
import com.hrms.model.User;
import com.hrms.model.UserPrincipal;
import com.hrms.service.ClientProjectAssignmentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin endpoint for assigning employees to a client project. Creates the
 * ClientProjectAssignment rows (used by the employee entry page) and mirrors the current
 * project onto each employee record (used to append the project name after their name).
 */
@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "http://localhost:3000")
public class ClientProjectAssignmentAdminController {

    @Autowired
    private ClientProjectAssignmentService assignmentService;

    private Long currentUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal) {
            return ((UserPrincipal) authentication.getPrincipal()).getUser().getId();
        }
        return null;
    }

    @PostMapping("/assign-client-project")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<ClientProjectAssignmentDTO>>> assign(
            @RequestBody ClientProjectAssignmentDTO dto,
            Authentication authentication) {
        List<ClientProjectAssignmentDTO> created = assignmentService.create(dto, currentUserId(authentication));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(buildAssignMessage(created), created));
    }

    /**
     * Assignment confirmation that notes a verification OTP was emailed. Names the single
     * employee/project when the batch is one.
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
}
