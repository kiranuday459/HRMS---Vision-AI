package com.hrms.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "timesheets")
public class Timesheet {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "employee_id", nullable = false)
    @NotNull
    private Employee employee;

    @NotNull
    private LocalDate date;

    private LocalTime startTime;

    private LocalTime endTime;

    private Double totalHours;

    private String project;
    private String task;
    private String notes;

    @Enumerated(EnumType.STRING)
    private TimesheetStatus status = TimesheetStatus.PENDING_RM_APPROVAL;

    private String managerComments;

    private LocalDateTime submittedAt;

    @ManyToOne
    @JoinColumn(name = "reviewed_by_id")
    private User reviewedBy;

    private LocalDateTime reviewedAt;

    // Multi-stage approval tracking fields
    @ManyToOne
    @JoinColumn(name = "rm_approved_by_id")
    private User rmApprovedBy;

    private LocalDateTime rmApprovedAt;

    @ManyToOne
    @JoinColumn(name = "hr_approved_by_id")
    private User hrApprovedBy;

    private LocalDateTime hrApprovedAt;

    @ManyToOne
    @JoinColumn(name = "admin_approved_by_id")
    private User adminApprovedBy;

    private LocalDateTime adminApprovedAt;

    private String rejectionReason;
    private String rejectedByRole; // RM, HR, ADMIN
    private LocalDateTime rejectedAt;

    // Set when an item that was waiting with Admin (no-RM/no-HR fallback) is moved into the
    // RM/HR flow because an approver was assigned after submission. Audit only — the live
    // routing is driven by `status`.
    private Boolean transferredFromAdmin;
    private LocalDateTime transferredAt;

    // ---- Disabled HR/RM rerouting (Part 1/2/8) ----
    // How this record is routed: FULL_FLOW | HR_DIRECT | RM_HANDLES_ALL | ADMIN_DIRECT.
    // Only set to a non-default value when an assigned approver is DISABLED; the normal and
    // the pure-unassigned fallback flows leave it FULL_FLOW.
    private String approvalRoute;
    private Boolean skippedRM;
    private Boolean skippedHR;
    private String skippedRMReason;
    private String skippedHRReason;
    // The RM (employee id, as String) now handling the HR stage because HR is disabled.
    private String reroutedToRM;
    // True once this record was approved for the HR stage by the RM standing in for a
    // disabled HR (or is currently routed that way).
    private Boolean hrDisabledReroute;

    // Who approved the HR stage when the RM stood in for a disabled HR.
    @ManyToOne
    @JoinColumn(name = "hr_stage_approved_by_id")
    private User hrStageApprovedBy;
    private String hrStageApprovedByRole; // "HR" or "REPORTING_MANAGER"
    private LocalDateTime hrStageApprovedAt;

    private String onsiteOffshore;
    private String billingLocation;
    private Boolean billable;
    private String projectName;
    private String taskDescription;
    private String category; // PROJECT, TRUTIME, HOLIDAY, LEAVE
    private String leaveType; // S, C, E

    @PrePersist
    protected void onCreate() {
        submittedAt = LocalDateTime.now();
        // Only calculate totalHours from times if totalHours was NOT already set directly.
        // This prevents @PrePersist from overwriting a totalHours that was explicitly provided.
        if (totalHours == null && startTime != null && endTime != null) {
            long minutes = java.time.Duration.between(startTime, endTime).toMinutes();
            totalHours = minutes / 60.0;
        }
    }

    // Getters and Setters
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

    public TimesheetStatus getStatus() {
        return status;
    }

    public void setStatus(TimesheetStatus status) {
        this.status = status;
    }

    public String getManagerComments() {
        return managerComments;
    }

    public void setManagerComments(String managerComments) {
        this.managerComments = managerComments;
    }

    public LocalDateTime getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(LocalDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }

    public User getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(User reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(LocalDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
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
    public User getRmApprovedBy() {
        return rmApprovedBy;
    }

    public void setRmApprovedBy(User rmApprovedBy) {
        this.rmApprovedBy = rmApprovedBy;
    }

    public LocalDateTime getRmApprovedAt() {
        return rmApprovedAt;
    }

    public void setRmApprovedAt(LocalDateTime rmApprovedAt) {
        this.rmApprovedAt = rmApprovedAt;
    }

    public User getHrApprovedBy() {
        return hrApprovedBy;
    }

    public void setHrApprovedBy(User hrApprovedBy) {
        this.hrApprovedBy = hrApprovedBy;
    }

    public LocalDateTime getHrApprovedAt() {
        return hrApprovedAt;
    }

    public void setHrApprovedAt(LocalDateTime hrApprovedAt) {
        this.hrApprovedAt = hrApprovedAt;
    }

    public User getAdminApprovedBy() {
        return adminApprovedBy;
    }

    public void setAdminApprovedBy(User adminApprovedBy) {
        this.adminApprovedBy = adminApprovedBy;
    }

    public LocalDateTime getAdminApprovedAt() {
        return adminApprovedAt;
    }

    public void setAdminApprovedAt(LocalDateTime adminApprovedAt) {
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

    public LocalDateTime getRejectedAt() {
        return rejectedAt;
    }

    public void setRejectedAt(LocalDateTime rejectedAt) {
        this.rejectedAt = rejectedAt;
    }

    // ---- Disabled HR/RM rerouting getters/setters ----
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

    public String getSkippedRMReason() {
        return skippedRMReason;
    }

    public void setSkippedRMReason(String skippedRMReason) {
        this.skippedRMReason = skippedRMReason;
    }

    public String getSkippedHRReason() {
        return skippedHRReason;
    }

    public void setSkippedHRReason(String skippedHRReason) {
        this.skippedHRReason = skippedHRReason;
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

    public User getHrStageApprovedBy() {
        return hrStageApprovedBy;
    }

    public void setHrStageApprovedBy(User hrStageApprovedBy) {
        this.hrStageApprovedBy = hrStageApprovedBy;
    }

    public String getHrStageApprovedByRole() {
        return hrStageApprovedByRole;
    }

    public void setHrStageApprovedByRole(String hrStageApprovedByRole) {
        this.hrStageApprovedByRole = hrStageApprovedByRole;
    }

    public LocalDateTime getHrStageApprovedAt() {
        return hrStageApprovedAt;
    }

    public void setHrStageApprovedAt(LocalDateTime hrStageApprovedAt) {
        this.hrStageApprovedAt = hrStageApprovedAt;
    }

    public Boolean getTransferredFromAdmin() {
        return transferredFromAdmin;
    }

    public void setTransferredFromAdmin(Boolean transferredFromAdmin) {
        this.transferredFromAdmin = transferredFromAdmin;
    }

    public LocalDateTime getTransferredAt() {
        return transferredAt;
    }

    public void setTransferredAt(LocalDateTime transferredAt) {
        this.transferredAt = transferredAt;
    }
}
