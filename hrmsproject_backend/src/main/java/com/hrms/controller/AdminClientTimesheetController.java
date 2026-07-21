package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.dto.ClientTimesheetWeekDTO;
import com.hrms.service.ClientTimesheetWeekService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Admin read-only detail for a client timesheet line — the full week context for the
 * approval queue. Approve/reject continue to use the existing per-line endpoints on
 * {@code /api/client-timesheets/{id}}; this only adds a view.
 */
@RestController
@RequestMapping("/api/admin/client-timesheets")
@CrossOrigin(origins = "http://localhost:3000")
public class AdminClientTimesheetController {

    @Autowired
    private ClientTimesheetWeekService weekService;

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ClientTimesheetWeekDTO>> getDetail(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(weekService.getAdminDetail(id)));
    }
}
