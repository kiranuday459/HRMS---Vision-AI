package com.hrms.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "leaves")
public class Leave {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne
    @JoinColumn(name = "employee_id", nullable = false)
    @NotNull
    @JsonIgnore
    private Employee employee;
    
    @NotNull
    private LocalDate startDate;
    
    @NotNull
    private LocalDate endDate;
    
    @Enumerated(EnumType.STRING)
    private LeaveType leaveType;
    
    private String reason;
    
    @Enumerated(EnumType.STRING)
    private LeaveStatus status = LeaveStatus.PENDING;
    
    private String rejectionReason;
    
    @ManyToOne
    @JoinColumn(name = "approved_by_id")
    private User approvedBy;
    
    private LocalDateTime submittedAt;
    
    private LocalDateTime reviewedAt;
    
    private Double daysCount;
    
    @Column(columnDefinition = "TEXT")
    private String sessionData;

    @OneToMany(mappedBy = "leave", cascade = CascadeType.ALL, orphanRemoval = true)
    private java.util.List<LeaveDayDetail> dayDetails = new java.util.ArrayList<>();

    // Set when a leave that was implicitly with Admin (no-RM/no-HR employee) is handed to
    // the RM/HR flow because an approver was assigned after submission. Audit only.
    private Boolean transferredFromAdmin;
    private LocalDateTime transferredAt;

    // ---- Disabled HR/RM rerouting (Part 4/8) ----
    // Leaves are single-stage (status PENDING → APPROVED/REJECTED). When HR is disabled and
    // the RM stands in (approvalRoute = RM_HANDLES_ALL), the leave stays PENDING while the RM
    // approves in two steps, tracked by approvalStage: null/"PENDING_RM_APPROVAL" = RM stage,
    // "PENDING_RM_AS_HR_APPROVAL" = HR stage. Normal leaves leave approvalRoute null/FULL_FLOW
    // and approvalStage null — completely unchanged single-approval behaviour.
    private String approvalStage;
    private String approvalRoute; // FULL_FLOW | HR_DIRECT | RM_HANDLES_ALL | ADMIN_DIRECT
    private Boolean skippedRM;
    private Boolean skippedHR;
    private String skippedRMReason;
    private String skippedHRReason;
    private String reroutedToRM; // RM employee id (String) handling the HR stage
    private Boolean hrDisabledReroute;
    private String hrStageApprovedByName;
    private String hrStageApprovedByRole; // "HR" or "REPORTING_MANAGER"
    private LocalDateTime hrStageApprovedAt;

    @PrePersist
    protected void onCreate() {
        submittedAt = LocalDateTime.now();
    }
    
    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Employee getEmployee() { return employee; }
    public void setEmployee(Employee employee) { this.employee = employee; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public LeaveType getLeaveType() { return leaveType; }
    public void setLeaveType(LeaveType leaveType) { this.leaveType = leaveType; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public LeaveStatus getStatus() { return status; }
    public void setStatus(LeaveStatus status) { this.status = status; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    public User getApprovedBy() { return approvedBy; }
    public void setApprovedBy(User approvedBy) { this.approvedBy = approvedBy; }
    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(LocalDateTime submittedAt) { this.submittedAt = submittedAt; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public Double getDaysCount() { return daysCount; }
    public void setDaysCount(Double daysCount) { this.daysCount = daysCount; }
    public String getSessionData() { return sessionData; }
    public void setSessionData(String sessionData) { this.sessionData = sessionData; }
    public java.util.List<LeaveDayDetail> getDayDetails() { return dayDetails; }
    public void setDayDetails(java.util.List<LeaveDayDetail> dayDetails) { this.dayDetails = dayDetails; }
    public Boolean getTransferredFromAdmin() { return transferredFromAdmin; }
    public void setTransferredFromAdmin(Boolean transferredFromAdmin) { this.transferredFromAdmin = transferredFromAdmin; }
    public LocalDateTime getTransferredAt() { return transferredAt; }
    public void setTransferredAt(LocalDateTime transferredAt) { this.transferredAt = transferredAt; }

    // ---- Disabled HR/RM rerouting getters/setters ----
    public String getApprovalStage() { return approvalStage; }
    public void setApprovalStage(String approvalStage) { this.approvalStage = approvalStage; }
    public String getApprovalRoute() { return approvalRoute; }
    public void setApprovalRoute(String approvalRoute) { this.approvalRoute = approvalRoute; }
    public Boolean getSkippedRM() { return skippedRM; }
    public void setSkippedRM(Boolean skippedRM) { this.skippedRM = skippedRM; }
    public Boolean getSkippedHR() { return skippedHR; }
    public void setSkippedHR(Boolean skippedHR) { this.skippedHR = skippedHR; }
    public String getSkippedRMReason() { return skippedRMReason; }
    public void setSkippedRMReason(String skippedRMReason) { this.skippedRMReason = skippedRMReason; }
    public String getSkippedHRReason() { return skippedHRReason; }
    public void setSkippedHRReason(String skippedHRReason) { this.skippedHRReason = skippedHRReason; }
    public String getReroutedToRM() { return reroutedToRM; }
    public void setReroutedToRM(String reroutedToRM) { this.reroutedToRM = reroutedToRM; }
    public Boolean getHrDisabledReroute() { return hrDisabledReroute; }
    public void setHrDisabledReroute(Boolean hrDisabledReroute) { this.hrDisabledReroute = hrDisabledReroute; }
    public String getHrStageApprovedByName() { return hrStageApprovedByName; }
    public void setHrStageApprovedByName(String hrStageApprovedByName) { this.hrStageApprovedByName = hrStageApprovedByName; }
    public String getHrStageApprovedByRole() { return hrStageApprovedByRole; }
    public void setHrStageApprovedByRole(String hrStageApprovedByRole) { this.hrStageApprovedByRole = hrStageApprovedByRole; }
    public LocalDateTime getHrStageApprovedAt() { return hrStageApprovedAt; }
    public void setHrStageApprovedAt(LocalDateTime hrStageApprovedAt) { this.hrStageApprovedAt = hrStageApprovedAt; }
}
