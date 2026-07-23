package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.dto.EmployeeDTO;
import com.hrms.dto.LeaveDTO;
import com.hrms.model.LeaveBalance;
import com.hrms.model.Role;
import com.hrms.model.User;
import com.hrms.model.UserPrincipal;
import com.hrms.service.EmployeeService;
import com.hrms.service.LeaveService;
import com.hrms.service.LeaveBalanceService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Comparator;
import com.hrms.model.Leave;

@RestController
@RequestMapping("/api/leaves")
@CrossOrigin(origins = "http://localhost:3000")
public class LeaveController {

    @Autowired
    private LeaveService leaveService;

    @Autowired
    private LeaveBalanceService leaveBalanceService;

    @Autowired
    private EmployeeService employeeService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<LeaveDTO>>> getAllLeaves(Authentication authentication) {
        List<LeaveDTO> leaves = leaveService.getAllLeaves();

        // HR routing: restrict the HR queue to leaves of employees assigned to this HR
        // (unassigned employees remain visible to all HR users). Admin still sees all.
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal) {
            User user = ((UserPrincipal) authentication.getPrincipal()).getUser();
            if (user.getRole() == Role.HR) {
                Long hrEmployeeId = getEmployeeIdFromAuth(authentication);
                if (hrEmployeeId != null) {
                    leaves = leaveService.filterForHr(leaves, hrEmployeeId);
                }
            }
        }
        return ResponseEntity.ok(ApiResponse.success(leaves));
    }

    private Long getEmployeeIdFromAuth(Authentication authentication) {
        if (authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof UserPrincipal) {
            User user = ((UserPrincipal) authentication.getPrincipal()).getUser();
            try {
                EmployeeDTO employee = employeeService.getEmployeeByUserId(user.getId());
                return employee.getId();
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<LeaveDTO>> getLeaveById(@PathVariable Long id) {
        LeaveDTO leave = leaveService.getLeaveById(id);
        return ResponseEntity.ok(ApiResponse.success(leave));
    }
    
    @GetMapping("/employee/{employeeId}")
    public ResponseEntity<ApiResponse<List<LeaveDTO>>> getLeavesByEmployee(@PathVariable Long employeeId) {
        List<LeaveDTO> leaves = leaveService.getLeavesByEmployeeId(employeeId);
        return ResponseEntity.ok(ApiResponse.success(leaves));
    }
    
    @GetMapping("/employee/{employeeId}/recent")
    public ResponseEntity<ApiResponse<List<LeaveDTO>>> getRecentLeavesByEmployee(@PathVariable Long employeeId, @RequestParam(defaultValue = "5") int limit) {
        List<LeaveDTO> leaves = leaveService.getRecentLeavesByEmployeeId(employeeId, limit);
        return ResponseEntity.ok(ApiResponse.success(leaves));
    }
    
    @PostMapping
    public ResponseEntity<ApiResponse<LeaveDTO>> createLeave(@Valid @RequestBody LeaveDTO dto) {
        LeaveDTO created = leaveService.createLeave(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Leave application submitted successfully", created));
    }
    
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN') or hasRole('HR') or hasRole('REPORTING_MANAGER')")
    public ResponseEntity<ApiResponse<LeaveDTO>> approveLeave(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        Long approverId = Long.valueOf(request.get("approverId").toString());
        LeaveDTO approved = leaveService.approveLeave(id, approverId);
        return ResponseEntity.ok(ApiResponse.success("Leave approved successfully", approved));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN') or hasRole('HR') or hasRole('REPORTING_MANAGER')")
    public ResponseEntity<ApiResponse<LeaveDTO>> rejectLeave(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        Object reasonObj = request != null ? request.get("reason") : null;
        if (reasonObj == null || reasonObj.toString().trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("Rejection reason is required."));
        }
        Long approverId = Long.valueOf(request.get("approverId").toString());
        String reason = reasonObj.toString().trim();
        LeaveDTO rejected = leaveService.rejectLeave(id, approverId, reason);
        return ResponseEntity.ok(ApiResponse.success("Leave rejected", rejected));
    }
    
    @GetMapping("/balance/{employeeId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLeaveBalance(@PathVariable Long employeeId) {
        LeaveBalance balance = leaveBalanceService.getLeaveBalance(employeeId);
        boolean onProbation = leaveBalanceService.isOnProbation(employeeId);
        java.time.LocalDate probationEnd = leaveBalanceService.getProbationEndDate(employeeId);

        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("id", balance.getId());
        payload.put("currentYear", balance.getCurrentYear());

        payload.put("casualLeavesTotal", balance.getCasualLeavesTotal());
        payload.put("casualLeavesUsed", balance.getCasualLeavesUsed());
        payload.put("casualLeavesCarriedForward", balance.getCasualLeavesCarriedForward());
        payload.put("casualLeavesRemaining", balance.getCasualLeavesRemaining());

        payload.put("sickLeavesTotal", balance.getSickLeavesTotal());
        payload.put("sickLeavesUsed", balance.getSickLeavesUsed());
        payload.put("sickLeavesRemaining", balance.getSickLeavesRemaining());

        payload.put("earnedLeavesTotal", balance.getEarnedLeavesTotal());
        payload.put("earnedLeavesUsed", balance.getEarnedLeavesUsed());
        payload.put("earnedLeavesCarriedForward", balance.getEarnedLeavesCarriedForward());
        payload.put("earnedLeavesRemaining", balance.getEarnedLeavesRemaining());

        payload.put("maternityLeavesTotal", balance.getMaternityLeavesTotal());
        payload.put("maternityLeavesUsed", balance.getMaternityLeavesUsed());
        payload.put("maternityLeavesRemaining", balance.getMaternityLeavesRemaining());

        payload.put("paternityLeavesTotal", balance.getPaternityLeavesTotal());
        payload.put("paternityLeavesUsed", balance.getPaternityLeavesUsed());
        payload.put("paternityLeavesRemaining", balance.getPaternityLeavesRemaining());

        payload.put("bereavementLeavesTotal", balance.getBereavementLeavesTotal());
        payload.put("bereavementLeavesUsed", balance.getBereavementLeavesUsed());
        payload.put("bereavementLeavesRemaining", balance.getBereavementLeavesRemaining());

        payload.put("onProbation", onProbation);
        payload.put("probationEndDate", probationEnd);
        payload.put("lastUpdated", balance.getLastUpdated());

        return ResponseEntity.ok(ApiResponse.success(payload));
    }
    
    @PostMapping("/balance/initialize/{employeeId}")
    public ResponseEntity<ApiResponse<LeaveBalance>> initializeLeaveBalance(@PathVariable Long employeeId) {
        LeaveBalance balance = leaveBalanceService.initializeLeaveBalance(employeeId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Leave balance initialized successfully", balance));
    }
    // Get all leaves for team members of a manager
    @GetMapping("/manager/{managerId}/team-leaves")
    public ResponseEntity<ApiResponse<List<LeaveDTO>>> getTeamLeavesByManager(@PathVariable Long managerId) {
        List<Leave> leaves = leaveService.getTeamLeavesByManagerId(managerId);
        // Sort: pending on top, then by date (optional)
        leaves.sort(Comparator.comparing((Leave l) -> !"PENDING".equalsIgnoreCase(l.getStatus().name()))
                .thenComparing(Leave::getStartDate));
        List<LeaveDTO> dtos = leaves.stream().map(leaveService::convertToDTO).toList();
        return ResponseEntity.ok(ApiResponse.success(dtos));
    }
}

