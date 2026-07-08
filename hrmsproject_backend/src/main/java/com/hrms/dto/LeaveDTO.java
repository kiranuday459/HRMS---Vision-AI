package com.hrms.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class LeaveDTO {
    private Long id;
    
    @NotNull(message = "Employee ID is required")
    private Long employeeId;
    
    private String employeeName;
    // Employee account status ("ACTIVE" / "INACTIVE") so viewers (Admin/HR/RM) can render
    // a disabled-account indicator and suppress actions on disabled employees' records.
    private String employeeStatus;

    @NotNull(message = "Start date is required")
    private LocalDate startDate;
    
    @NotNull(message = "End date is required")
    private LocalDate endDate;
    
    @NotNull(message = "Leave type is required")
    private String leaveType;
    
    private String reason;
    private String status;
    // Who this leave is currently routed to, derived from the employee's current assignment:
    // "ADMIN" when the employee has no RM and no HR (fallback), else "RM". Lets the Admin
    // view hide approve/reject once an RM/HR is assigned, while still showing it read-only.
    private String routedTo;
    // True once the leave was handed from Admin to the RM/HR flow after an approver was
    // assigned post-submission (audit).
    private Boolean transferredFromAdmin;
    private String rejectionReason;
    private LocalDateTime submittedAt;
    private String approvedBy;
    private LocalDateTime reviewedAt;
    private Double daysCount;
    private java.util.Map<String, String> sessionData;
    
    private Double casualLeavesRemaining;
    private Double sickLeavesRemaining;
    private Double earnedLeavesRemaining;
    private Double maternityLeavesRemaining;
    private Double paternityLeavesRemaining;
    private Double bereavementLeavesRemaining;
    private Double casualLeavesCarriedForward;
    private Double earnedLeavesCarriedForward;

    // Disabled HR/RM rerouting (Part 4/5/8)
    private String approvalStage;
    private String approvalRoute;
    private Boolean skippedRM;
    private Boolean skippedHR;
    private String reroutedToRM;
    private Boolean hrDisabledReroute;
    private String hrStageApprovedByRole;

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }
    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
    public String getEmployeeStatus() { return employeeStatus; }
    public void setEmployeeStatus(String employeeStatus) { this.employeeStatus = employeeStatus; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public String getLeaveType() { return leaveType; }
    public void setLeaveType(String leaveType) { this.leaveType = leaveType; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getRoutedTo() { return routedTo; }
    public void setRoutedTo(String routedTo) { this.routedTo = routedTo; }
    public Boolean getTransferredFromAdmin() { return transferredFromAdmin; }
    public void setTransferredFromAdmin(Boolean transferredFromAdmin) { this.transferredFromAdmin = transferredFromAdmin; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(LocalDateTime submittedAt) { this.submittedAt = submittedAt; }
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
 
    public Double getCasualLeavesRemaining() { return casualLeavesRemaining; }
    public void setCasualLeavesRemaining(Double casualLeavesRemaining) { this.casualLeavesRemaining = casualLeavesRemaining; }
    public Double getSickLeavesRemaining() { return sickLeavesRemaining; }
    public void setSickLeavesRemaining(Double sickLeavesRemaining) { this.sickLeavesRemaining = sickLeavesRemaining; }
    public Double getEarnedLeavesRemaining() { return earnedLeavesRemaining; }
    public void setEarnedLeavesRemaining(Double earnedLeavesRemaining) { this.earnedLeavesRemaining = earnedLeavesRemaining; }
    public Double getMaternityLeavesRemaining() { return maternityLeavesRemaining; }
    public void setMaternityLeavesRemaining(Double v) { this.maternityLeavesRemaining = v; }
    public Double getPaternityLeavesRemaining() { return paternityLeavesRemaining; }
    public void setPaternityLeavesRemaining(Double v) { this.paternityLeavesRemaining = v; }
    public Double getBereavementLeavesRemaining() { return bereavementLeavesRemaining; }
    public void setBereavementLeavesRemaining(Double v) { this.bereavementLeavesRemaining = v; }
    public Double getCasualLeavesCarriedForward() { return casualLeavesCarriedForward; }
    public void setCasualLeavesCarriedForward(Double v) { this.casualLeavesCarriedForward = v; }
    public Double getEarnedLeavesCarriedForward() { return earnedLeavesCarriedForward; }
    public void setEarnedLeavesCarriedForward(Double v) { this.earnedLeavesCarriedForward = v; }
    public Double getDaysCount() { return daysCount; }
    public void setDaysCount(Double daysCount) { this.daysCount = daysCount; }
    public java.util.Map<String, String> getSessionData() { return sessionData; }
    public void setSessionData(java.util.Map<String, String> sessionData) { this.sessionData = sessionData; }

    // Disabled HR/RM rerouting getters/setters
    public String getApprovalStage() { return approvalStage; }
    public void setApprovalStage(String approvalStage) { this.approvalStage = approvalStage; }
    public String getApprovalRoute() { return approvalRoute; }
    public void setApprovalRoute(String approvalRoute) { this.approvalRoute = approvalRoute; }
    public Boolean getSkippedRM() { return skippedRM; }
    public void setSkippedRM(Boolean skippedRM) { this.skippedRM = skippedRM; }
    public Boolean getSkippedHR() { return skippedHR; }
    public void setSkippedHR(Boolean skippedHR) { this.skippedHR = skippedHR; }
    public String getReroutedToRM() { return reroutedToRM; }
    public void setReroutedToRM(String reroutedToRM) { this.reroutedToRM = reroutedToRM; }
    public Boolean getHrDisabledReroute() { return hrDisabledReroute; }
    public void setHrDisabledReroute(Boolean hrDisabledReroute) { this.hrDisabledReroute = hrDisabledReroute; }
    public String getHrStageApprovedByRole() { return hrStageApprovedByRole; }
    public void setHrStageApprovedByRole(String hrStageApprovedByRole) { this.hrStageApprovedByRole = hrStageApprovedByRole; }
}

