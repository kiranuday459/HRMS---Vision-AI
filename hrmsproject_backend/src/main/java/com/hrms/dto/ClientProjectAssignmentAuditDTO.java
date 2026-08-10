package com.hrms.dto;

import java.time.LocalDateTime;

/** One row of the Client Timesheet Admin "Audit Logs" tab. Read-only; nothing writes back. */
public class ClientProjectAssignmentAuditDTO {

    private Long id;
    private Long assignmentId;
    private Long employeeId;
    private String employeeName;
    private String clientName;
    private String projectId;
    private String projectName;
    private String action;
    private String performedByName;
    private LocalDateTime performedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAssignmentId() { return assignmentId; }
    public void setAssignmentId(Long assignmentId) { this.assignmentId = assignmentId; }

    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }

    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }

    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }

    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }

    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getPerformedByName() { return performedByName; }
    public void setPerformedByName(String performedByName) { this.performedByName = performedByName; }

    public LocalDateTime getPerformedAt() { return performedAt; }
    public void setPerformedAt(LocalDateTime performedAt) { this.performedAt = performedAt; }
}
