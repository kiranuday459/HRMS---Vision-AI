package com.hrms.dto;

import java.time.LocalDate;

/** One assigned-employee row for the admin Access Management table. */
public class AssignedEmployeeDTO {

    private Long employeeId;
    // The HRMS-facing employee ID (company_details.oryfolks_id, e.g. "001") — what the admin
    // recognises. Distinct from employeeId above, which is the internal database key.
    private String oryfolksId;
    private String employeeName;
    private String role;
    private String projectName;
    private String projectId;
    private LocalDate assignmentDate;
    private Boolean clientVerified;
    // Whether the employee is still active in HRMS. Consumers that are pickers filter these
    // out; the Access Management table keeps showing them, flagged as disabled.
    private Boolean employeeActive;

    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }
    public String getOryfolksId() { return oryfolksId; }
    public void setOryfolksId(String oryfolksId) { this.oryfolksId = oryfolksId; }
    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public LocalDate getAssignmentDate() { return assignmentDate; }
    public void setAssignmentDate(LocalDate assignmentDate) { this.assignmentDate = assignmentDate; }
    public Boolean getClientVerified() { return clientVerified; }
    public void setClientVerified(Boolean clientVerified) { this.clientVerified = clientVerified; }
    public Boolean getEmployeeActive() { return employeeActive; }
    public void setEmployeeActive(Boolean employeeActive) { this.employeeActive = employeeActive; }
}
