package com.hrms.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Transfer object for a client/project assignment. Also used as the create payload
 * from the admin "Assign employees to client project" modal (one client/project +
 * a list of employee ids + a start date).
 */
public class ClientProjectAssignmentDTO {

    private Long id;
    private Long employeeId;
    private String employeeName;
    private String clientName;
    private String projectId;
    private String projectName;
    private String taskId;
    private String taskDescription;
    private String onsiteOffshore;
    private String clientBillable;
    private String billingLocation;
    private LocalDate assignmentStartDate;
    private Boolean active;

    // Create-only: the modal assigns one client/project to many employees at once.
    private List<Long> employeeIds;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(Long employeeId) {
        this.employeeId = employeeId;
    }

    public String getEmployeeName() {
        return employeeName;
    }

    public void setEmployeeName(String employeeName) {
        this.employeeName = employeeName;
    }

    public String getClientName() {
        return clientName;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public String getTaskId() {
        return taskId;
    }

    public void setTaskId(String taskId) {
        this.taskId = taskId;
    }

    public String getTaskDescription() {
        return taskDescription;
    }

    public void setTaskDescription(String taskDescription) {
        this.taskDescription = taskDescription;
    }

    public String getOnsiteOffshore() {
        return onsiteOffshore;
    }

    public void setOnsiteOffshore(String onsiteOffshore) {
        this.onsiteOffshore = onsiteOffshore;
    }

    public String getClientBillable() {
        return clientBillable;
    }

    public void setClientBillable(String clientBillable) {
        this.clientBillable = clientBillable;
    }

    public String getBillingLocation() {
        return billingLocation;
    }

    public void setBillingLocation(String billingLocation) {
        this.billingLocation = billingLocation;
    }

    public LocalDate getAssignmentStartDate() {
        return assignmentStartDate;
    }

    public void setAssignmentStartDate(LocalDate assignmentStartDate) {
        this.assignmentStartDate = assignmentStartDate;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public List<Long> getEmployeeIds() {
        return employeeIds;
    }

    public void setEmployeeIds(List<Long> employeeIds) {
        this.employeeIds = employeeIds;
    }
}
