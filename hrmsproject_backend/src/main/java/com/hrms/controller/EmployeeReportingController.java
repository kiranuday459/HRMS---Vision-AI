package com.hrms.controller;

import com.hrms.dto.ManagerDetailsDTO;
import com.hrms.dto.ManagerSummaryDTO;
import com.hrms.service.EmployeeReportingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import com.hrms.dto.EmployeeReportingRequest;
import com.hrms.model.EmployeeReporting;

@RestController
@RequestMapping("/api/reporting-managers")
@RequiredArgsConstructor
public class EmployeeReportingController {

    private final EmployeeReportingService service;

    @GetMapping
    public ResponseEntity<List<ManagerSummaryDTO>> listManagers() {
        return ResponseEntity.ok(service.listManagers());
    }

    @GetMapping("/assignments")
    public ResponseEntity<List<com.hrms.dto.EmployeeReportingDTO>> listAssignments() {
        return ResponseEntity.ok(service.listAllAssignments());
    }

    @GetMapping("/available-employees")
    public ResponseEntity<List<com.hrms.dto.EmployeeSimpleDTO>> getAvailableEmployees() {
        return ResponseEntity.ok(service.getAvailableEmployees());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ManagerDetailsDTO> managerDetails(@PathVariable("id") Long id) {
        return ResponseEntity.ok(service.getManagerDetails(id));
    }

    @PostMapping
    public ResponseEntity<EmployeeReporting> createOrUpdate(@RequestBody EmployeeReportingRequest req) {
        EmployeeReporting saved = service.createOrUpdate(req);
        if (saved == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(saved);
    }

    // Assign (or re-assign) an employee to an HR user. Only the hr field is changed;
    // the reporting manager is preserved. Send hrId = null to unassign.
    @PostMapping("/assign-hr")
    public ResponseEntity<EmployeeReporting> assignHr(@RequestBody EmployeeReportingRequest req) {
        if (req == null || req.getEmployeeId() == null)
            return ResponseEntity.badRequest().build();
        EmployeeReporting saved = service.assignEmployeeToHr(req.getEmployeeId(), req.getHrId());
        if (saved == null)
            return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/promote/{id}")
    public ResponseEntity<?> promoteToManager(@PathVariable("id") Long id) {
        service.promoteToManager(id);
        return ResponseEntity.ok(java.util.Map.of("message", "Promoted to Manager successfully"));
    }

    @PostMapping("/promote-hr/{id}")
    public ResponseEntity<?> promoteToHR(@PathVariable("id") Long id) {
        service.promoteToHR(id);
        return ResponseEntity.ok(java.util.Map.of("message", "Promoted to HR successfully"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> removeManager(@PathVariable("id") Long id) {
        try {
            service.removeManager(id);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            java.io.StringWriter sw = new java.io.StringWriter();
            java.io.PrintWriter pw = new java.io.PrintWriter(sw);
            e.printStackTrace(pw);
            return ResponseEntity.status(500).body("Error deleting manager: " + e.toString() + "\nStack Trace:\n" + sw.toString());
        }
    }

    @DeleteMapping("/remove-member/{employeeId}")
    public ResponseEntity<String> removeTeamMember(@PathVariable("employeeId") Long employeeId) {
        try {
            service.removeTeamMember(employeeId);
            return ResponseEntity.ok("Team member removed");
        } catch (Exception e) {
             java.io.StringWriter sw = new java.io.StringWriter();
             java.io.PrintWriter pw = new java.io.PrintWriter(sw);
             e.printStackTrace(pw);
            return ResponseEntity.status(500).body("Error removing team member: " + e.getMessage() + "\nStack:\n" + sw.toString());
        }
    }
}
