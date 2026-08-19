package com.hrms.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A client timesheet entry — completely separate from {@link Timesheet}.
 * Its own table (client_timesheets), its own status enum and lifecycle. The only
 * relationships are the same employee_id reference other tables use and an optional
 * approver (User). Nothing here reads from or writes to the timesheets table.
 */
@Entity
@Table(name = "client_timesheets")
public class ClientTimesheet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "employee_id", nullable = false)
    @NotNull
    private Employee employee;

    @NotNull
    private LocalDate date;

    private String clientName;
    private String projectName;

    // Legacy admin-facing task field; the week entry mirrors taskDescription into it, so the
    // two must stay the same width — a value that fits one and not the other fails the insert
    // on whichever is narrower.
    //
    // 512 for a 256-character field, deliberately. Sizing the column to exactly the limit is
    // what broke this twice: with column == limit there is no margin, and a description at the
    // documented 256 passed the UI counter and the service-layer check and still came back as
    // "too long to save". The service layer is the contract; the column is storage and should
    // never be the thing that rejects a valid value. See migration_task_text_headroom.sql.
    @Column(length = 512)
    private String task;

    private Double hours;

    private Boolean billable;

    @Column(columnDefinition = "TEXT")
    private String notes;

    // ---- Employee client-timesheet (week entry) fields — all additive/nullable ----
    // The week this line belongs to (Saturday start / Friday end). Used to group line
    // rows into the employee's weekly view; also filterable independently.
    private LocalDate weekStartDate;
    private LocalDate weekEndDate;

    // Optional link to the week header record (client_timesheet_weeks).
    private Long weekId;

    // Stable id grouping day-level lines into one UI row (supports multiple rows per project).
    private String projectRowId;

    // Project / task metadata mirrored from the employee's client-project assignment.
    private String projectId;

    @Column(length = 255)
    private String taskId;

    // Comfortably wider than the agreed 256-character limit, not equal to it — see
    // migration_task_text_headroom.sql. "At least as wide as the limit" was the old rule and it
    // was not enough: at exactly 256 a maximum-length description still failed the insert.
    @Column(length = 512)
    private String taskDescription;

    private String onsiteOffshore;

    // Narrower than the JPA default — must match migration_add_client_timesheet_entry_columns.sql.
    @Column(length = 64)
    private String billingLocation;

    @Column(columnDefinition = "TEXT")
    private String comment;

    /**
     * Why this leave was taken. Set only on time-off lines (category != PROJECT); always null
     * on project work, which carries {@link #comment} instead.
     *
     * Deliberately a separate field from comment rather than a reuse of it. A row comment
     * explains project work to the reviewer; this answers a different question, is required
     * where a comment is optional, and the two would otherwise overwrite each other on a week
     * carrying both.
     *
     * Scoped per leave type per week, matching how comment is scoped per project row: the
     * value is written onto every day line of that type in the week, so any one of them can
     * answer for the row. Same 512 headroom over the agreed 256-character limit as the other
     * long-text columns — see migration_task_text_headroom.sql for why the column is not sized
     * to exactly the limit.
     */
    @Column(length = 512)
    private String leaveReason;

    // PROJECT for billable/non-billable project work, or a time-off type:
    // SICK / HOLIDAY / PTO / LOP / EARNED.
    private String category;

    @Enumerated(EnumType.STRING)
    private ClientTimesheetStatus status = ClientTimesheetStatus.PENDING;

    @Column(length = 512)
    private String rejectionReason;

    @ManyToOne
    @JoinColumn(name = "approved_by_id")
    private User approvedBy;

    private LocalDateTime submittedAt;
    private LocalDateTime reviewedAt;

    @PrePersist
    protected void onCreate() {
        if (submittedAt == null) {
            submittedAt = LocalDateTime.now();
        }
        if (status == null) {
            status = ClientTimesheetStatus.PENDING;
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

    public String getClientName() {
        return clientName;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public String getTask() {
        return task;
    }

    public void setTask(String task) {
        this.task = task;
    }

    public Double getHours() {
        return hours;
    }

    public void setHours(Double hours) {
        this.hours = hours;
    }

    public Boolean getBillable() {
        return billable;
    }

    public void setBillable(Boolean billable) {
        this.billable = billable;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public ClientTimesheetStatus getStatus() {
        return status;
    }

    public void setStatus(ClientTimesheetStatus status) {
        this.status = status;
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

    public Long getWeekId() {
        return weekId;
    }

    public void setWeekId(Long weekId) {
        this.weekId = weekId;
    }

    public String getProjectRowId() {
        return projectRowId;
    }

    public void setProjectRowId(String projectRowId) {
        this.projectRowId = projectRowId;
    }

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
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

    public String getBillingLocation() {
        return billingLocation;
    }

    public void setBillingLocation(String billingLocation) {
        this.billingLocation = billingLocation;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public String getLeaveReason() {
        return leaveReason;
    }

    public void setLeaveReason(String leaveReason) {
        this.leaveReason = leaveReason;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }
}
