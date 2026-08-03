package com.hrms.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** One Client Timesheet notification row as rendered in the module's bell panel. */
public class ClientTimesheetNotificationDTO {

    private Long id;
    private String eventType;
    private String message;
    private Long relatedEmployeeId;
    private LocalDate relatedWeekStart;
    private boolean isRead;
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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
