package com.hrms.service;

import com.hrms.dto.AssignedEmployeeDTO;
import com.hrms.dto.ClientAccessStatusDTO;
import com.hrms.dto.VerificationSummaryDTO;
import com.hrms.model.Employee;
import com.hrms.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Client-timesheet access & verification. Issues activation OTPs (hashed at rest, 15-min
 * expiry), verifies employee-entered OTPs, resends (admin: no cooldown; employee: 30s
 * cooldown), and reports the per-employee access status. Independent of the internal
 * timesheets feature.
 */
@Service
@Transactional
public class ClientVerificationService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int OTP_EXPIRY_MINUTES = 15;
    private static final int EMPLOYEE_RESEND_COOLDOWN_SECONDS = 30;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // ---------- Admin views ----------

    public List<AssignedEmployeeDTO> getAssignedEmployees() {
        return employeeRepository.findByClientAssignedTrue().stream()
                .map(this::toDTO)
                .sorted((a, b) -> {
                    // Newest assignment first; nulls last.
                    if (a.getAssignmentDate() == null) return 1;
                    if (b.getAssignmentDate() == null) return -1;
                    return b.getAssignmentDate().compareTo(a.getAssignmentDate());
                })
                .collect(Collectors.toList());
    }

    public VerificationSummaryDTO getVerificationSummary() {
        long assigned = employeeRepository.countByClientAssignedTrue();
        long verified = employeeRepository.countByClientAssignedTrueAndClientVerifiedTrue();
        return new VerificationSummaryDTO(assigned, verified, Math.max(0, assigned - verified));
    }

    // ---------- OTP issuance (shared) ----------

    /**
     * Generates a fresh 6-digit OTP for the employee, stores it hashed with a 15-minute
     * expiry, saves, and emails it using the activation template. Best-effort email — a
     * mail failure never rolls back the OTP issuance. Returns the plain OTP (callers must
     * not persist or log it).
     */
    public String issueAndSendOtp(Employee employee) {
        String otp = String.format("%06d", RANDOM.nextInt(1_000_000));
        employee.setClientOtp(passwordEncoder.encode(otp)); // hashed at rest
        employee.setClientOtpExpiry(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES));
        employeeRepository.save(employee);

        String to = resolveEmail(employee);
        if (to != null && !to.isBlank()) {
            try {
                String name = (employee.getFirstName() + " "
                        + (employee.getLastName() == null ? "" : employee.getLastName())).trim();
                emailService.sendClientTimesheetOTP(to, name, employee.getClientProject(), otp);
            } catch (Exception ex) {
                System.err.println("[ClientVerification] OTP email failed for employee "
                        + employee.getId() + ": " + ex.getMessage());
            }
        }
        return otp;
    }

    // ---------- Admin resend ----------

    public String resendOtp(Long employeeId) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));
        if (!Boolean.TRUE.equals(employee.getClientAssigned())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Employee is not assigned to a client project.");
        }
        issueAndSendOtp(employee);
        return "OTP resent to employee's registered email.";
    }

    // ---------- Employee-facing ----------

    public ClientAccessStatusDTO getAccessStatus(Long employeeId) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));
        return new ClientAccessStatusDTO(
                Boolean.TRUE.equals(employee.getClientAssigned()),
                Boolean.TRUE.equals(employee.getClientVerified()),
                employee.getClientProject(),
                employee.getClientProjectId(),
                employee.getClientAssignmentDate());
    }

    /**
     * Verifies the OTP the employee entered. Throws with a user-facing message on any
     * failure (not assigned / expired / mismatch); returns a success message otherwise.
     */
    public String verifyOtp(Long employeeId, String otp) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        if (!Boolean.TRUE.equals(employee.getClientAssigned())) {
            // 400 (not 403): the global front-end interceptor force-logs-out on 403.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You are not assigned to any client project.");
        }
        if (Boolean.TRUE.equals(employee.getClientVerified())) {
            return "Already verified.";
        }
        if (otp == null || otp.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid OTP. Please try again.");
        }
        if (employee.getClientOtp() == null || employee.getClientOtpExpiry() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "OTP has expired. Please request a new one.");
        }
        if (LocalDateTime.now().isAfter(employee.getClientOtpExpiry())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "OTP has expired. Please request a new one.");
        }
        if (!passwordEncoder.matches(otp.trim(), employee.getClientOtp())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid OTP. Please try again.");
        }

        employee.setClientVerified(true);
        employee.setClientOtp(null);
        employee.setClientOtpExpiry(null);
        employeeRepository.save(employee);
        return "Verification successful. Client Timesheet access granted.";
    }

    /**
     * Employee-triggered resend with a 30-second cooldown. Rejects if not assigned or
     * already verified.
     */
    public String resendOtpForEmployee(Long employeeId) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        if (!Boolean.TRUE.equals(employee.getClientAssigned())) {
            // 400 (not 403): the global front-end interceptor force-logs-out on 403.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not assigned to any client project.");
        }
        if (Boolean.TRUE.equals(employee.getClientVerified())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Already verified.");
        }
        // Enforce the 30s cooldown: last generation = current expiry - 15 min.
        if (employee.getClientOtpExpiry() != null) {
            LocalDateTime lastGenerated = employee.getClientOtpExpiry().minusMinutes(OTP_EXPIRY_MINUTES);
            LocalDateTime nextAllowed = lastGenerated.plusSeconds(EMPLOYEE_RESEND_COOLDOWN_SECONDS);
            if (LocalDateTime.now().isBefore(nextAllowed)) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Please wait a few seconds before requesting another OTP.");
            }
        }
        issueAndSendOtp(employee);
        return "OTP resent to your registered email.";
    }

    // ---------- helpers ----------

    private String resolveEmail(Employee employee) {
        return employee.getCorporateEmail() != null && !employee.getCorporateEmail().isBlank()
                ? employee.getCorporateEmail() : employee.getEmail();
    }

    private AssignedEmployeeDTO toDTO(Employee e) {
        AssignedEmployeeDTO dto = new AssignedEmployeeDTO();
        dto.setEmployeeId(e.getId());
        dto.setEmployeeName((e.getFirstName() + " " + (e.getLastName() == null ? "" : e.getLastName())).trim());
        dto.setProjectName(e.getClientProject());
        dto.setProjectId(e.getClientProjectId());
        dto.setAssignmentDate(e.getClientAssignmentDate());
        dto.setClientVerified(Boolean.TRUE.equals(e.getClientVerified()));
        return dto;
    }
}
