package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.dto.EmployeeDocumentDTO;
import com.hrms.model.Employee;
import com.hrms.model.EmployeeDocument;
import com.hrms.model.User;
import com.hrms.model.UserPrincipal;
import com.hrms.repository.EmployeeDocumentRepository;
import com.hrms.repository.EmployeeRepository;
import com.hrms.service.FileStorageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/documents")
public class EmployeeDocumentController {

    @Autowired
    private FileStorageService fileStorageService;

    @Autowired
    private EmployeeDocumentRepository documentRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam("documentType") String documentType,
            @RequestParam("documentName") String documentName,
            @RequestParam(value = "employeeId", required = false) Long employeeId,
            Authentication authentication) {

        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Not authenticated"));
        }

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        User currentUser = principal.getUser();
        
        Employee employee;
        if (employeeId != null) {
            employee = employeeRepository.findById(employeeId)
                    .orElseThrow(() -> new RuntimeException("Employee profile not found"));

            boolean isOwner = employee.getUser() != null && employee.getUser().getId().equals(currentUser.getId());
            String roleName = currentUser.getRole().name();

            // Allow if owner OR if ADMIN, HR, or REPORTING_MANAGER
            if (!isOwner && !roleName.equals("ADMIN") && !roleName.equals("HR") && !roleName.equals("REPORTING_MANAGER")) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Insufficient permissions to upload for other employees"));
            }
        } else {
            // Default to current user's employee profile
            employee = employeeRepository.findByUser_Id(currentUser.getId())
                    .orElseThrow(() -> new RuntimeException("Employee profile not found"));
        }

        try {
            String fileName = fileStorageService.storeFile(file, "employee_" + employee.getId());
            
            String fileDownloadUri = ServletUriComponentsBuilder.fromCurrentContextPath()
                    .path("/api/uploads/")
                    .path(fileName)
                    .toUriString();

            EmployeeDocument document = EmployeeDocument.builder()
                    .employee(employee)
                    .documentType(documentType)
                    .documentName(documentName)
                    .fileName(fileName)
                    .fileUrl(fileDownloadUri)
                    .contentType(file.getContentType())
                    .fileSize(file.getSize())
                    .build();

            EmployeeDocument saved = documentRepository.save(document);

            EmployeeDocumentDTO dto = EmployeeDocumentDTO.builder()
                    .id(saved.getId())
                    .documentType(saved.getDocumentType())
                    .documentName(saved.getDocumentName())
                    .fileName(saved.getFileName())
                    .fileUrl(saved.getFileUrl())
                    .contentType(saved.getContentType())
                    .fileSize(saved.getFileSize())
                    .uploadedAt(saved.getUploadedAt())
                    .build();

            return ResponseEntity.ok(ApiResponse.success("Document uploaded successfully", dto));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Could not upload the file: " + e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<?> getMyDocuments(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Not authenticated"));
        }

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        User user = principal.getUser();
        Employee employee = employeeRepository.findByUser_Id(user.getId())
                .orElseThrow(() -> new RuntimeException("Employee profile not found"));

        List<EmployeeDocument> documents = documentRepository.findByEmployeeId(employee.getId());
        List<EmployeeDocumentDTO> dtos = documents.stream().map(doc -> EmployeeDocumentDTO.builder()
                .id(doc.getId())
                .documentType(doc.getDocumentType())
                .documentName(doc.getDocumentName())
                .fileName(doc.getFileName())
                .fileUrl(doc.getFileUrl())
                .contentType(doc.getContentType())
                .fileSize(doc.getFileSize())
                .uploadedAt(doc.getUploadedAt())
                .build()).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(dtos));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDocument(@PathVariable Long id, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Not authenticated"));
        }

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        User currentUser = principal.getUser();

        EmployeeDocument document = documentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Document not found"));

        // Allow if it's the current user's document OR if the user is an ADMIN
        boolean isOwner = false;
        try {
            Employee currentEmployee = employeeRepository.findByUser_Id(currentUser.getId()).orElse(null);
            if (currentEmployee != null && document.getEmployee().getId().equals(currentEmployee.getId())) {
                isOwner = true;
            }
        } catch (Exception ignored) {}

        String roleName = currentUser.getRole().name();
        if (!isOwner && !roleName.equals("ADMIN") && !roleName.equals("HR") && !roleName.equals("REPORTING_MANAGER")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("You don't have permission to delete this document"));
        }

        documentRepository.delete(document);
        // Note: In a real app, you might also want to delete the file from the filesystem.
        
        return ResponseEntity.ok(ApiResponse.success("Document deleted successfully", null));
    }
}
