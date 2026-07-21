package com.hrms.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Week header for an employee's client timesheet (Saturday start → Friday end).
 * Records the draft/submitted intent, running totals and submit/review timestamps.
 * The individual day/project line rows live in {@link ClientTimesheet} (linked by
 * week_id). The employee-facing final status is derived by merging this header's
 * status with the line rows' admin decisions, so the existing admin approve/reject
 * (which act per line row) never has to change.
 */
@Entity
@Table(name = "client_timesheet_weeks",
        uniqueConstraints = @UniqueConstraint(columnNames = { "employee_id", "weekStartDate" }))
public class ClientTimesheetWeek {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "employee_id", nullable = false)
    @NotNull
    private Employee employee;

    @NotNull
    private LocalDate weekStartDate;

    @NotNull
    private LocalDate weekEndDate;

    @Enumerated(EnumType.STRING)
    private ClientTimesheetStatus status = ClientTimesheetStatus.DRAFT;

    private Double totalBillableHours = 0.0;
    private Double totalNonBillableHours = 0.0;
    private Double totalTimeoffHours = 0.0;
    private Double grandTotal = 0.0;

    private LocalDateTime submittedAt;
    private LocalDateTime reviewedAt;
    private String rejectionReason;

    @ManyToOne
    @JoinColumn(name = "approved_by_id")
    private User approvedBy;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
        if (status == null) {
            status = ClientTimesheetStatus.DRAFT;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
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

    public LocalDate getWeekStartDate() {
        return weekStartDate;
    }

    public void setWeekStartDate(LocalDate weekStartDate) {
        this.weekStartDate = weekStartDate;
    }

    public LocalDate getWeekEndDate() {
        return weekEndDate;
    }

    public void setWeekEndDate(LocalDate weekEndDate) {
        this.weekEndDate = weekEndDate;
    }

    public ClientTimesheetStatus getStatus() {
        return status;
    }

    public void setStatus(ClientTimesheetStatus status) {
        this.status = status;
    }

    public Double getTotalBillableHours() {
        return totalBillableHours;
    }

    public void setTotalBillableHours(Double totalBillableHours) {
        this.totalBillableHours = totalBillableHours;
    }

    public Double getTotalNonBillableHours() {
        return totalNonBillableHours;
    }

    public void setTotalNonBillableHours(Double totalNonBillableHours) {
        this.totalNonBillableHours = totalNonBillableHours;
    }

    public Double getTotalTimeoffHours() {
        return totalTimeoffHours;
    }

    public void setTotalTimeoffHours(Double totalTimeoffHours) {
        this.totalTimeoffHours = totalTimeoffHours;
    }

    public Double getGrandTotal() {
        return grandTotal;
    }

    public void setGrandTotal(Double grandTotal) {
        this.grandTotal = grandTotal;
    }

    public LocalDateTime getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(LocalDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(LocalDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public User getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(User approvedBy) {
        this.approvedBy = approvedBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
