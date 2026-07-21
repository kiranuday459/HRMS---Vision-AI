package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.dto.ClientTimesheetWeekDTO;
import com.hrms.dto.ClientTimesheetWeekSummaryDTO;
import com.hrms.dto.EmployeeDTO;
import com.hrms.model.User;
import com.hrms.model.UserPrincipal;
import com.hrms.service.ClientTimesheetWeekService;
import com.hrms.service.EmployeeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Employee-facing Client Timesheet week API. Shares the /api/client-timesheets base
 * with the admin controller but only exposes the distinct /weeks, /save-draft paths —
 * the admin list/approve/reject/export endpoints are untouched.
 */
@RestController
@RequestMapping("/api/client-timesheets")
@CrossOrigin(origins = "http://localhost:3000")
public class ClientTimesheetWeekController {

    @Autowired
    private ClientTimesheetWeekService weekService;

    @Autowired
    private EmployeeService employeeService;

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

    @GetMapping("/weeks")
    public ResponseEntity<ApiResponse<List<ClientTimesheetWeekSummaryDTO>>> getWeeks(Authentication authentication) {
        Long employeeId = currentEmployeeId(authentication);
        if (employeeId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Employee profile not found"));
        }
        return ResponseEntity.ok(ApiResponse.success(weekService.getWeeks(employeeId)));
    }

    @GetMapping("/weeks/{weekStart}")
    public ResponseEntity<ApiResponse<ClientTimesheetWeekDTO>> getWeekDetail(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
            Authentication authentication) {
        Long employeeId = currentEmployeeId(authentication);
        if (employeeId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Employee profile not found"));
        }
        return ResponseEntity.ok(ApiResponse.success(weekService.getWeekDetail(employeeId, weekStart)));
    }

    @PostMapping("/save-draft")
    public ResponseEntity<ApiResponse<ClientTimesheetWeekDTO>> saveDraft(
            @RequestBody ClientTimesheetWeekDTO payload,
            Authentication authentication) {
        Long employeeId = currentEmployeeId(authentication);
        if (employeeId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Employee profile not found"));
        }
        return ResponseEntity.ok(ApiResponse.success("Draft saved", weekService.saveDraft(employeeId, payload)));
    }

    @PatchMapping("/weeks/{weekStart}/submit")
    public ResponseEntity<ApiResponse<ClientTimesheetWeekDTO>> submit(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
            @RequestBody ClientTimesheetWeekDTO payload,
            Authentication authentication) {
        Long employeeId = currentEmployeeId(authentication);
        if (employeeId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Employee profile not found"));
        }
        return ResponseEntity.ok(ApiResponse.success("Submitted for approval", weekService.submit(employeeId, weekStart, payload)));
    }
}
