package com.hrms.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "employee_documents")
public class EmployeeDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    @JsonIgnore
    private Employee employee;

    private String documentType; // e.g., "EDU_10TH", "EDU_12TH", "GRADUATION", "TECHNICAL", "EMPLOYMENT", "OTHER"
    private String documentName; // The original name or a label
    private String fileName;     // The actual file name stored on disk
    private String fileUrl;      // The URL to access the file
    private String contentType;  // image/jpeg, application/pdf, etc.
    private Long fileSize;

    private LocalDateTime uploadedAt;

    public EmployeeDocument() {
    }

    public EmployeeDocument(Long id, Employee employee, String documentType, String documentName, String fileName, String fileUrl, String contentType, Long fileSize, LocalDateTime uploadedAt) {
        this.id = id;
        this.employee = employee;
        this.documentType = documentType;
        this.documentName = documentName;
        this.fileName = fileName;
        this.fileUrl = fileUrl;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.uploadedAt = uploadedAt;
    }

    public static EmployeeDocumentBuilder builder() {
        return new EmployeeDocumentBuilder();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Employee getEmployee() {
        return employee;
    }

    public void setEmployee(Employee employee) {
        this.employee = employee;
    }

    public String getDocumentType() {
        return documentType;
    }

    public void setDocumentType(String documentType) {
        this.documentType = documentType;
    }

    public String getDocumentName() {
        return documentName;
    }

    public void setDocumentName(String documentName) {
        this.documentName = documentName;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getFileUrl() {
        return fileUrl;
    }

    public void setFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public Long getFileSize() {
        return fileSize;
    }

    public void setFileSize(Long fileSize) {
        this.fileSize = fileSize;
    }

    public LocalDateTime getUploadedAt() {
        return uploadedAt;
    }

    public void setUploadedAt(LocalDateTime uploadedAt) {
        this.uploadedAt = uploadedAt;
    }

    @PrePersist
    protected void onCreate() {
        uploadedAt = LocalDateTime.now();
    }

    public static class EmployeeDocumentBuilder {
        private Long id;
        private Employee employee;
        private String documentType;
        private String documentName;
        private String fileName;
        private String fileUrl;
        private String contentType;
        private Long fileSize;
        private LocalDateTime uploadedAt;

        EmployeeDocumentBuilder() {
        }

        public EmployeeDocumentBuilder id(Long id) {
            this.id = id;
            return this;
        }

        public EmployeeDocumentBuilder employee(Employee employee) {
            this.employee = employee;
            return this;
        }

        public EmployeeDocumentBuilder documentType(String documentType) {
            this.documentType = documentType;
            return this;
        }

        public EmployeeDocumentBuilder documentName(String documentName) {
            this.documentName = documentName;
            return this;
        }

        public EmployeeDocumentBuilder fileName(String fileName) {
            this.fileName = fileName;
            return this;
        }

        public EmployeeDocumentBuilder fileUrl(String fileUrl) {
            this.fileUrl = fileUrl;
            return this;
        }

        public EmployeeDocumentBuilder contentType(String contentType) {
            this.contentType = contentType;
            return this;
        }

        public EmployeeDocumentBuilder fileSize(Long fileSize) {
            this.fileSize = fileSize;
            return this;
        }

        public EmployeeDocumentBuilder uploadedAt(LocalDateTime uploadedAt) {
            this.uploadedAt = uploadedAt;
            return this;
        }

        public EmployeeDocument build() {
            return new EmployeeDocument(id, employee, documentType, documentName, fileName, fileUrl, contentType, fileSize, uploadedAt);
        }
    }
}
