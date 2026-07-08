package com.hrms.dto;

import java.time.LocalDateTime;

public class EmployeeDocumentDTO {
    private Long id;
    private String documentType;
    private String documentName;
    private String fileName;
    private String fileUrl;
    private String contentType;
    private Long fileSize;
    private LocalDateTime uploadedAt;

    public EmployeeDocumentDTO() {
    }

    public EmployeeDocumentDTO(Long id, String documentType, String documentName, String fileName, String fileUrl, String contentType, Long fileSize, LocalDateTime uploadedAt) {
        this.id = id;
        this.documentType = documentType;
        this.documentName = documentName;
        this.fileName = fileName;
        this.fileUrl = fileUrl;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.uploadedAt = uploadedAt;
    }

    public static EmployeeDocumentDTOBuilder builder() {
        return new EmployeeDocumentDTOBuilder();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public static class EmployeeDocumentDTOBuilder {
        private Long id;
        private String documentType;
        private String documentName;
        private String fileName;
        private String fileUrl;
        private String contentType;
        private Long fileSize;
        private LocalDateTime uploadedAt;

        EmployeeDocumentDTOBuilder() {
        }

        public EmployeeDocumentDTOBuilder id(Long id) {
            this.id = id;
            return this;
            
        }

        public EmployeeDocumentDTOBuilder documentType(String documentType) {
            this.documentType = documentType;
            return this;
        }

        public EmployeeDocumentDTOBuilder documentName(String documentName) {
            this.documentName = documentName;
            return this;
        }

        public EmployeeDocumentDTOBuilder fileName(String fileName) {
            this.fileName = fileName;
            return this;
        }

        public EmployeeDocumentDTOBuilder fileUrl(String fileUrl) {
            this.fileUrl = fileUrl;
            return this;
        }

        public EmployeeDocumentDTOBuilder contentType(String contentType) {
            this.contentType = contentType;
            return this;
        }

        public EmployeeDocumentDTOBuilder fileSize(Long fileSize) {
            this.fileSize = fileSize;
            return this;
        }

        public EmployeeDocumentDTOBuilder uploadedAt(LocalDateTime uploadedAt) {
            this.uploadedAt = uploadedAt;
            return this;
        }

        public EmployeeDocumentDTO build() {
            return new EmployeeDocumentDTO(id, documentType, documentName, fileName, fileUrl, contentType, fileSize, uploadedAt);
        }
    }
}
