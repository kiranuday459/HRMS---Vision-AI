package com.hrms.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalTime;

public class TimesheetDTO {
    private Long id;

    @NotNull(message = "Employee ID is required")
    private Long employeeId;

    private String employeeName;
    private String employeeRole;
    // Employee account status ("ACTIVE" / "INACTIVE") so viewers (Admin/HR/RM) can render
    // a disabled-account indicator and suppress actions on disabled employees' records.
    private String employeeStatus;

    @NotNull(message = "Date is required")
    private LocalDate date;

    private LocalTime startTime;

    private LocalTime endTime;

    private Double totalHours;
    private String project;
    private String task;
    private String notes;
    private String status;
    private String managerComments;
    private String onsiteOffshore;
    private String billingLocation;
    private Boolean billable;
    private String projectName;
    private String taskDescription;
    private String category;
    private String leaveType;

    // Multi-stage approval tracking fields
    private String rmApprovedByName;
    private String rmApprovedAt;
    private String hrApprovedByName;
    private String hrApprovedAt;
    private String adminApprovedByName;
    private String adminApprovedAt;
    private String rejectionReason;
    private String rejectedByRole;
    private String rejectedByName;
    private String rejectedAt;

    // Disabled HR/RM rerouting (Part 1/2/3/8)
    private String approvalRoute;
    private Boolean skippedRM;
    private Boolean skippedHR;
    private String reroutedToRM;
    private Boolean hrDisabledReroute;
    private String hrStageApprovedByRole;

    // Getters and Setters
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

    public String getEmployeeRole() {
        return employeeRole;
    }

    public void setEmployeeRole(String employeeRole) {
        this.employeeRole = employeeRole;
    }

    public String getEmployeeStatus() {
        return employeeStatus;
    }

    public void setEmployeeStatus(String employeeStatus) {
        this.employeeStatus = employeeStatus;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalTime endTime) {
        this.endTime = endTime;
    }

    public Double getTotalHours() {
        return totalHours;
    }

    public void setTotalHours(Double totalHours) {
        this.totalHours = totalHours;
    }

    public String getProject() {
        return project;
    }

    public void setProject(String project) {
        this.project = project;
    }

    public String getTask() {
        return task;
    }

    public void setTask(String task) {
        this.task = task;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getManagerComments() {
        return managerComments;
    }

    public void setManagerComments(String managerComments) {
        this.managerComments = managerComments;
    }

    public String getOnsiteOffshore() {
        return onsiteOffshore;
    }

    public void setOnsiteOffshore(String onsiteOffshore) {
        this.onsiteOffshore = onsiteOffshore;
    }

    public String getBillingLocation() {
        return billingLocation;
    }

    public void setBillingLocation(String billingLocation) {
        this.billingLocation = billingLocation;
    }

    public Boolean getBillable() {
        return billable;
    }

    public void setBillable(Boolean billable) {
        this.billable = billable;
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public String getTaskDescription() {
        return taskDescription;
    }

    public void setTaskDescription(String taskDescription) {
        this.taskDescription = taskDescription;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getLeaveType() {
        return leaveType;
    }

    public void setLeaveType(String leaveType) {
        this.leaveType = leaveType;
    }

    // Getters and setters for multi-stage approval tracking
    public String getRmApprovedByName() {
        return rmApprovedByName;
    }

    public void setRmApprovedByName(String rmApprovedByName) {
        this.rmApprovedByName = rmApprovedByName;
    }

    public String getRmApprovedAt() {
        return rmApprovedAt;
    }

    public void setRmApprovedAt(String rmApprovedAt) {
        this.rmApprovedAt = rmApprovedAt;
    }

    public String getHrApprovedByName() {
        return hrApprovedByName;
    }

    public void setHrApprovedByName(String hrApprovedByName) {
        this.hrApprovedByName = hrApprovedByName;
    }

    public String getHrApprovedAt() {
        return hrApprovedAt;
    }

    public void setHrApprovedAt(String hrApprovedAt) {
        this.hrApprovedAt = hrApprovedAt;
    }

    public String getAdminApprovedByName() {
        return adminApprovedByName;
    }

    public void setAdminApprovedByName(String adminApprovedByName) {
        this.adminApprovedByName = adminApprovedByName;
    }

    public String getAdminApprovedAt() {
        return adminApprovedAt;
    }

    public void setAdminApprovedAt(String adminApprovedAt) {
        this.adminApprovedAt = adminApprovedAt;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public String getRejectedByRole() {
        return rejectedByRole;
    }

    public void setRejectedByRole(String rejectedByRole) {
        this.rejectedByRole = rejectedByRole;
    }

    public String getRejectedByName() {
        return rejectedByName;
    }

    public void setRejectedByName(String rejectedByName) {
        this.rejectedByName = rejectedByName;
    }

    public String getRejectedAt() {
        return rejectedAt;
    }

    public void setRejectedAt(String rejectedAt) {
        this.rejectedAt = rejectedAt;
    }

    // Disabled HR/RM rerouting getters/setters
    public String getApprovalRoute() {
        return approvalRoute;
    }

    public void setApprovalRoute(String approvalRoute) {
        this.approvalRoute = approvalRoute;
    }

    public Boolean getSkippedRM() {
        return skippedRM;
    }

    public void setSkippedRM(Boolean skippedRM) {
        this.skippedRM = skippedRM;
    }

    public Boolean getSkippedHR() {
        return skippedHR;
    }

    public void setSkippedHR(Boolean skippedHR) {
        this.skippedHR = skippedHR;
    }

    public String getReroutedToRM() {
        return reroutedToRM;
    }

    public void setReroutedToRM(String reroutedToRM) {
        this.reroutedToRM = reroutedToRM;
    }

    public Boolean getHrDisabledReroute() {
        return hrDisabledReroute;
    }

    public void setHrDisabledReroute(Boolean hrDisabledReroute) {
        this.hrDisabledReroute = hrDisabledReroute;
    }

    public String getHrStageApprovedByRole() {
        return hrStageApprovedByRole;
    }

    public void setHrStageApprovedByRole(String hrStageApprovedByRole) {
        this.hrStageApprovedByRole = hrStageApprovedByRole;
    }
}
