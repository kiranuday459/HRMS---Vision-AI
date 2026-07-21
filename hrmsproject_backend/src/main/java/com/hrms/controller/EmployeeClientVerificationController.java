package com.hrms.controller;

import com.hrms.dto.ClientAccessStatusDTO;
import com.hrms.model.Employee;
import com.hrms.model.User;
import com.hrms.model.UserPrincipal;
import com.hrms.repository.EmployeeRepository;
import com.hrms.service.ClientVerificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * Employee-facing client-timesheet access endpoints: read access status (drives sidebar
 * visibility + activation banner), verify the activation OTP, and resend it (30s cooldown).
 * Distinct base path from the admin endpoints ("/api/admin/client-timesheet").
 */
@RestController
@RequestMapping("/api/client-timesheet")
@CrossOrigin(origins = "http://localhost:3000")
public class EmployeeClientVerificationController {

    @Autowired
    private ClientVerificationService verificationService;

    @Autowired
    private EmployeeRepository employeeRepository;

    private Employee currentEmployee(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal principal) {
            User user = principal.getUser();
            return employeeRepository.findByUser_Id(user.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Employee profile not found for this user."));
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated.");
    }

    @GetMapping("/access-status")
    public ResponseEntity<ClientAccessStatusDTO> accessStatus(Authentication authentication) {
        Employee employee = currentEmployee(authentication);
        return ResponseEntity.ok(verificationService.getAccessStatus(employee.getId()));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<Map<String, String>> verifyOtp(@RequestBody Map<String, String> body,
                                                         Authentication authentication) {
        Employee employee = currentEmployee(authentication);
        String message = verificationService.verifyOtp(employee.getId(), body == null ? null : body.get("otp"));
        return ResponseEntity.ok(Map.of("message", message));
    }

    @PostMapping("/resend-otp")
    public ResponseEntity<Map<String, String>> resendOtp(Authentication authentication) {
        Employee employee = currentEmployee(authentication);
        String message = verificationService.resendOtpForEmployee(employee.getId());
        return ResponseEntity.ok(Map.of("message", message));
    }
}
