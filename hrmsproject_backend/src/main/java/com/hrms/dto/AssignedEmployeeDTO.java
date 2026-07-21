package com.hrms.dto;

import java.time.LocalDate;

/** One assigned-employee row for the admin Access Management table. */
public class AssignedEmployeeDTO {

    private Long employeeId;
    private String employeeName;
    private String projectName;
    private String projectId;
    private LocalDate assignmentDate;
    private Boolean clientVerified;

    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }
    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public LocalDate getAssignmentDate() { return assignmentDate; }
    public void setAssignmentDate(LocalDate assignmentDate) { this.assignmentDate = assignmentDate; }
    public Boolean getClientVerified() { return clientVerified; }
    public void setClientVerified(Boolean clientVerified) { this.clientVerified = clientVerified; }
}
