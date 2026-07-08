package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.model.CompanyDetail;
import com.hrms.model.Employee;
import com.hrms.repository.CompanyDetailRepository;
import com.hrms.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/company-details")
public class CompanyDetailController {

    @Autowired
    private CompanyDetailRepository companyDetailRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @GetMapping("/missing")
    public ResponseEntity<?> getEmployeesWithoutDetails() {
        List<Employee> employees = employeeRepository.findEmployeesWithoutCompanyDetails();
        return ResponseEntity.ok(ApiResponse.success(employees));
    }

    @PostMapping("/{employeeId}")
    public ResponseEntity<?> addCompanyDetails(
            @PathVariable Long employeeId,
            @RequestBody CompanyDetail details) {
        
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new RuntimeException("Employee not found"));
        
        // Check if already exists
        companyDetailRepository.findByEmployee_Id(employeeId).ifPresent(cd -> {
            throw new RuntimeException("Company details already exist for this employee");
        });
        
        details.setEmployee(employee);
        // Ensure visionaiId and visionaiMailId are set (defaults to oryfolksId and oryfolksMailId if not provided)
        if (details.getVisionaiId() == null || details.getVisionaiId().isBlank()) {
            details.setVisionaiId(details.getOryfolksId() != null ? details.getOryfolksId() : "PENDING");
        }
        if (details.getVisionaiMailId() == null || details.getVisionaiMailId().isBlank()) {
            details.setVisionaiMailId(details.getOryfolksMailId() != null ? details.getOryfolksMailId() : "pending@visionai.com");
        }
        CompanyDetail saved = companyDetailRepository.save(details);
        
        return ResponseEntity.ok(ApiResponse.success("Company details added successfully", saved));
    }

    @GetMapping("/employee/{employeeId}")
    public ResponseEntity<?> getCompanyDetailsByEmployee(@PathVariable Long employeeId) {
        return companyDetailRepository.findByEmployee_Id(employeeId)
                .map(details -> ResponseEntity.ok(ApiResponse.success(details)))
                .orElse(ResponseEntity.notFound().build());
    }
}
