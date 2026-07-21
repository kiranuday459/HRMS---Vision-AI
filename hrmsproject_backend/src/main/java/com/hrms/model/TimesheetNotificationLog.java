package com.hrms.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "timesheet_notification_logs",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = {"employee_id", "week_start", "notification_type"})
       })
public class TimesheetNotificationLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = true)
    private Employee employee;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Column(name = "notification_type", nullable = false)
    private String notificationType; // WEEKLY_REMINDER, ADMIN_SUMMARY

    private LocalDateTime sentAt;

    public TimesheetNotificationLog() {}

    public TimesheetNotificationLog(Employee employee, LocalDate weekStart, String notificationType, LocalDateTime sentAt) {
        this.employee = employee;
        this.weekStart = weekStart;
        this.notificationType = notificationType;
        this.sentAt = sentAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Employee getEmployee() { return employee; }
    public void setEmployee(Employee employee) { this.employee = employee; }

    public LocalDate getWeekStart() { return weekStart; }
    public void setWeekStart(LocalDate weekStart) { this.weekStart = weekStart; }

    public String getNotificationType() { return notificationType; }
    public void setNotificationType(String notificationType) { this.notificationType = notificationType; }

    public LocalDateTime getSentAt() { return sentAt; }
    public void setSentAt(LocalDateTime sentAt) { this.sentAt = sentAt; }
}
