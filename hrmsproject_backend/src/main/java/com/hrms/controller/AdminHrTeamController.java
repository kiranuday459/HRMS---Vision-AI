package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.service.EmployeeReportingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Admin-only read endpoints for the Admin Dashboard. Currently exposes the HR Team &
 * Assigned Employees view (each HR user with the employees assigned to them).
 */
@RestController
@RequestMapping("/api/admin")
public class AdminHrTeamController {

    @Autowired
    private EmployeeReportingService employeeReportingService;

    @GetMapping("/hr-teams")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getHrTeams() {
        return ResponseEntity.ok(ApiResponse.success(employeeReportingService.listHrTeams()));
    }
}
