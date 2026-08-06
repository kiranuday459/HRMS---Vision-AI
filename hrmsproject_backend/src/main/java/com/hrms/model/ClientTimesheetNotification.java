package com.hrms.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Notification for the Client Timesheet workspace only. Deliberately a separate table
 * from `notifications` (the main HRMS bell): the two panels are independent systems, and
 * the HRMS endpoint returns a user's rows unfiltered — sharing a table would surface
 * client-timesheet activity in the HRMS bell and merge the two.
 *
 * Rows are written as a side effect of existing actions (submit / approve / reject /
 * assign / verify); nothing here participates in those decisions.
 */
@Entity
@Table(name = "client_timesheet_notifications")
public class ClientTimesheetNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Recipient. Admin-facing events fan out to one row per ADMIN user.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @NotNull
    private User user;

    // TIMESHEET_SUBMITTED / TIMESHEET_RESUBMITTED / TIMESHEET_APPROVED /
    // TIMESHEET_REJECTED / PROJECT_ASSIGNED / ACCOUNT_VERIFIED
    @Column(length = 48)
    private String eventType;

    @Column(columnDefinition = "TEXT")
    private String message;

    // Context for the row; nullable because not every event relates to a week.
    private Long relatedEmployeeId;
    private LocalDate relatedWeekStart;

    @Column(nullable = false)
    private boolean isRead = false;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now(java.time.ZoneOffset.UTC);
        }
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Long getRelatedEmployeeId() {
        return relatedEmployeeId;
    }

    public void setRelatedEmployeeId(Long relatedEmployeeId) {
        this.relatedEmployeeId = relatedEmployeeId;
    }

    public LocalDate getRelatedWeekStart() {
        return relatedWeekStart;
    }

    public void setRelatedWeekStart(LocalDate relatedWeekStart) {
        this.relatedWeekStart = relatedWeekStart;
    }

    public boolean isRead() {
        return isRead;
    }

    public void setRead(boolean read) {
        this.isRead = read;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
