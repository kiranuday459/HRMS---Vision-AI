package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.dto.TimesheetDTO;
import com.hrms.dto.EmployeeDTO;
import com.hrms.model.User;
import com.hrms.model.UserPrincipal;
import com.hrms.model.Role;
import com.hrms.service.TimesheetService;
import com.hrms.service.EmployeeService;
import com.hrms.service.EmailService;
import com.hrms.dto.TimesheetDownloadRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/timesheets")
@CrossOrigin(origins = "http://localhost:3000")
public class TimesheetController {

    @Autowired
    private TimesheetService timesheetService;

    @Autowired
    private EmployeeService employeeService;

    @Autowired
    private EmailService emailService;

    private Long getEmployeeIdFromAuth(Authentication authentication) {
        if (authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof UserPrincipal) {
            UserPrincipal userPrincipal = (UserPrincipal) authentication.getPrincipal();
            User user = userPrincipal.getUser();
            try {
                EmployeeDTO employee = employeeService.getEmployeeByUserId(user.getId());
                return employee.getId();
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<TimesheetDTO>>> getAllTimesheets(
            Authentication authentication,
            @RequestParam(required = false) Long employeeId,
            @RequestParam(required = false) Long excludeUserId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String status,
            @RequestParam(required = false, defaultValue = "0") Integer page,
            @RequestParam(required = false, defaultValue = "10") Integer size) {

        Long effectiveEmployeeId = employeeId;
        boolean filterForHr = false;
        Long hrEmployeeId = null;

        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal) {
            UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
            User user = principal.getUser();

            // If user is just an EMPLOYEE or REPORTING_MANAGER, force them to only see their own timesheets.
            // ADMIN sees everyone. HR sees only their assigned employees (with unassigned fallback).
            if (user.getRole() == Role.EMPLOYEE || user.getRole() == Role.REPORTING_MANAGER) {
                Long authEmployeeId = getEmployeeIdFromAuth(authentication);
                if (authEmployeeId != null) {
                    effectiveEmployeeId = authEmployeeId;
                }
            } else if (user.getRole() == Role.HR) {
                hrEmployeeId = getEmployeeIdFromAuth(authentication);
                // Apply the HR team-queue filter ONLY when the HR is not requesting their
                // own timesheets. The "My Timesheet" page fetches with employeeId = the HR's
                // own id; filterForHr excludes the HR's own records, so applying it there
                // would wrongly hide their own timesheets (showing every week as Not Filled).
                // When employeeId is null (the team queue), keep filtering as before.
                filterForHr = hrEmployeeId != null && !hrEmployeeId.equals(employeeId);
            }
        }

        List<TimesheetDTO> timesheets = timesheetService.getAllTimesheets(
                effectiveEmployeeId, excludeUserId, fromDate, toDate, status, page, size);

        // HR routing: restrict the HR queue to employees assigned to this HR.
        if (filterForHr) {
            timesheets = timesheetService.filterForHr(timesheets, hrEmployeeId);
        }
        return ResponseEntity.ok(ApiResponse.success(timesheets));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TimesheetDTO>> getTimesheetById(@PathVariable Long id) {
        TimesheetDTO timesheet = timesheetService.getTimesheetById(id);
        return ResponseEntity.ok(ApiResponse.success(timesheet));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TimesheetDTO>> createTimesheet(
            @Valid @RequestBody TimesheetDTO dto,
            Authentication authentication) {

        Long authEmployeeId = getEmployeeIdFromAuth(authentication);
        if (authEmployeeId != null) {
            dto.setEmployeeId(authEmployeeId);
        } else if (dto.getEmployeeId() == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("Employee profile not found. Are you logged in?"));
        }

        TimesheetDTO created = timesheetService.createTimesheet(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Timesheet submitted successfully", created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<TimesheetDTO>> updateTimesheet(
            @PathVariable Long id,
            @Valid @RequestBody TimesheetDTO dto) {
        TimesheetDTO updated = timesheetService.updateTimesheet(id, dto);
        return ResponseEntity.ok(ApiResponse.success("Timesheet updated successfully", updated));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN') or hasRole('HR') or hasRole('REPORTING_MANAGER')")
    public ResponseEntity<ApiResponse<TimesheetDTO>> approveTimesheet(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        Long reviewerId = Long.valueOf(request.get("reviewerId").toString());
        String comments = request.getOrDefault("comments", "").toString();
        TimesheetDTO approved = timesheetService.approveTimesheet(id, reviewerId, comments);
        return ResponseEntity.ok(ApiResponse.success("Timesheet approved successfully", approved));
    }

    @GetMapping("/manager/{managerId}/team-timesheets")
    @PreAuthorize("hasRole('ADMIN') or hasRole('HR') or hasRole('REPORTING_MANAGER')")
    public ResponseEntity<ApiResponse<List<TimesheetDTO>>> getTeamTimesheets(@PathVariable Long managerId) {
        List<TimesheetDTO> timesheets = timesheetService.getTeamTimesheets(managerId);
        return ResponseEntity.ok(ApiResponse.success(timesheets));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN') or hasRole('HR') or hasRole('REPORTING_MANAGER')")
    public ResponseEntity<ApiResponse<TimesheetDTO>> rejectTimesheet(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        Long reviewerId = Long.valueOf(request.get("reviewerId").toString());
        String reason = request.get("reason").toString();
        TimesheetDTO rejected = timesheetService.rejectTimesheet(id, reviewerId, reason);
        return ResponseEntity.ok(ApiResponse.success("Timesheet rejected", rejected));
    }

    @PostMapping("/save-weekly")
    public ResponseEntity<ApiResponse<Void>> saveWeekly(
            @RequestBody Map<String, Object> request,
            Authentication authentication) {
        
        Long employeeId = getEmployeeIdFromAuth(authentication);
        if (employeeId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Employee not found"));
        }

        // Validate required fields up front so missing/invalid input returns 400, not 500.
        Object weekStartRaw = request.get("weekStart");
        Object entriesRaw = request.get("entries");
        if (weekStartRaw == null || weekStartRaw.toString().isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error("weekStart is required"));
        }
        if (!(entriesRaw instanceof List) || ((List<?>) entriesRaw).isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error("entries are required and cannot be empty"));
        }

        LocalDate weekStart;
        try {
            weekStart = LocalDate.parse(weekStartRaw.toString().split("T")[0]);
        } catch (java.time.format.DateTimeParseException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error("weekStart is not a valid date"));
        }
        List<Map<String, Object>> entriesList = (List<Map<String, Object>>) entriesRaw;

        // Convert Map to DTOs
        List<TimesheetDTO> dtos = entriesList.stream().map(m -> {
            TimesheetDTO d = new TimesheetDTO();
            d.setDate(LocalDate.parse(m.get("date").toString()));
            if (m.get("startTime") != null) d.setStartTime(java.time.LocalTime.parse(m.get("startTime").toString()));
            if (m.get("endTime") != null) d.setEndTime(java.time.LocalTime.parse(m.get("endTime").toString()));
            d.setProject(m.get("project") != null ? m.get("project").toString() : null);
            d.setTask(m.get("task") != null ? m.get("task").toString() : null);
            d.setNotes(m.get("notes") != null ? m.get("notes").toString() : null);
            d.setCategory(m.get("category") != null ? m.get("category").toString() : null);
            d.setProjectName(m.get("projectName") != null ? m.get("projectName").toString() : null);
            d.setTaskDescription(m.get("taskDescription") != null ? m.get("taskDescription").toString() : null);
            d.setOnsiteOffshore(m.get("onsiteOffshore") != null ? m.get("onsiteOffshore").toString() : null);
            d.setBillingLocation(m.get("billingLocation") != null ? m.get("billingLocation").toString() : null);
            d.setBillable(m.get("billable") != null ? (Boolean) m.get("billable") : null);
            d.setLeaveType(m.get("leaveType") != null ? m.get("leaveType").toString() : null);
            // Map totalHours directly from the frontend payload
            if (m.get("totalHours") != null) {
                d.setTotalHours(Double.parseDouble(m.get("totalHours").toString()));
            }
            return d;
        }).collect(Collectors.toList());


        timesheetService.saveWeeklyTimesheet(employeeId, weekStart, dtos);
        return ResponseEntity.ok(ApiResponse.success("Weekly timesheet saved successfully", null));
    }

    @PostMapping("/download-notification")
    @PreAuthorize("hasRole('ADMIN') or hasRole('HR')")
    public ResponseEntity<ApiResponse<Void>> notifyDownload(
            @RequestBody TimesheetDownloadRequest request,
            Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        User user = principal.getUser();

        // Get downloading user's name
        String userName = user.getUsername();
        try {
            EmployeeDTO employee = employeeService.getEmployeeByUserId(user.getId());
            if (employee != null) {
                userName = employee.getFirstName() + " " + employee.getLastName();
            }
        } catch (Exception ignored) {}

        // Send the confirmation email
        String downloadTime = java.time.LocalDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        
        emailService.sendTimesheetDownloadConfirmation(
                user.getEmail(),
                userName,
                request.getTimesheetType(),
                downloadTime,
                request.getRecordCount(),
                request.getFilters()
        );

        return ResponseEntity.ok(ApiResponse.success("Notification sent successfully", null));
    }
}
