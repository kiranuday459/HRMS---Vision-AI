package com.hrms.controller;

import com.hrms.dto.AssignedEmployeeDTO;
import com.hrms.dto.VerificationSummaryDTO;
import com.hrms.service.ClientVerificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin-only client-timesheet access & verification endpoints. Distinct base path
 * ("/api/admin/client-timesheet", singular) so nothing collides with the existing
 * approval-queue endpoints.
 */
@RestController
@RequestMapping("/api/admin/client-timesheet")
@CrossOrigin(origins = "http://localhost:3000")
public class ClientVerificationController {

    @Autowired
    private ClientVerificationService verificationService;

    @GetMapping("/assigned-employees")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AssignedEmployeeDTO>> getAssignedEmployees() {
        return ResponseEntity.ok(verificationService.getAssignedEmployees());
    }

    @GetMapping("/verification-summary")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<VerificationSummaryDTO> getVerificationSummary() {
        return ResponseEntity.ok(verificationService.getVerificationSummary());
    }

    @PostMapping("/resend-otp/{employeeId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> resendOtp(@PathVariable Long employeeId) {
        String message = verificationService.resendOtp(employeeId);
        return ResponseEntity.ok(Map.of("message", message));
    }
}
