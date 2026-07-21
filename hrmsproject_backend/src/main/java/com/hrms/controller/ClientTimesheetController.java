package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.dto.ClientTimesheetDTO;
import com.hrms.service.ClientTimesheetService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * REST API for client timesheets. Fully self-contained — backed only by the
 * client_timesheets table via {@link ClientTimesheetService}. Endpoints are covered
 * by the existing "/api/** authenticated" security rule; approve/reject are ADMIN-only.
 */
@RestController
@RequestMapping("/api/client-timesheets")
@CrossOrigin(origins = "http://localhost:3000")
public class ClientTimesheetController {

    @Autowired
    private ClientTimesheetService clientTimesheetService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ClientTimesheetDTO>>> getAll(
            @RequestParam(required = false) Long employeeId,
            @RequestParam(required = false) String client,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        List<ClientTimesheetDTO> entries = clientTimesheetService.getAll(employeeId, client, status, fromDate, toDate);
        return ResponseEntity.ok(ApiResponse.success(entries));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ClientTimesheetDTO>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(clientTimesheetService.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ClientTimesheetDTO>> create(@Valid @RequestBody ClientTimesheetDTO dto) {
        ClientTimesheetDTO created = clientTimesheetService.create(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Client timesheet submitted successfully", created));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ClientTimesheetDTO>> approve(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        Long reviewerId = Long.valueOf(request.get("reviewerId").toString());
        ClientTimesheetDTO approved = clientTimesheetService.approve(id, reviewerId);
        return ResponseEntity.ok(ApiResponse.success("Client timesheet approved successfully", approved));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ClientTimesheetDTO>> reject(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        Long reviewerId = Long.valueOf(request.get("reviewerId").toString());
        String reason = request.get("reason") != null ? request.get("reason").toString() : null;
        ClientTimesheetDTO rejected = clientTimesheetService.reject(id, reviewerId, reason);
        return ResponseEntity.ok(ApiResponse.success("Client timesheet rejected", rejected));
    }
}
