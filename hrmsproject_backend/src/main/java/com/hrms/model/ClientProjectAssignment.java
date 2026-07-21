package com.hrms.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Assignment of an employee to a client / project, created by the admin. Drives the
 * employee Client Timesheet entry rows and the "cannot enter before assignment date"
 * gate. Fully independent of the internal timesheets feature; the only relationships
 * are the standard employee_id reference and an optional assigned-by user.
 */
@Entity
@Table(name = "client_project_assignments")
public class ClientProjectAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "employee_id", nullable = false)
    @NotNull
    private Employee employee;

    private String clientName;
    private String projectId;
    private String projectName;
    private String taskId;
    private String taskDescription;

    // ONSITE / OFFSHORE
    private String onsiteOffshore;

    // BILLABLE / NON_BILLABLE
    private String clientBillable;

    private String billingLocation;

    // The earliest date this employee may log hours against this project.
    @NotNull
    private LocalDate assignmentStartDate;

    private Boolean active = true;

    @ManyToOne
    @JoinColumn(name = "assigned_by_id")
    private User assignedBy;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
        if (active == null) {
            active = true;
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

    public User getAssignedBy() {
        return assignedBy;
    }

    public void setAssignedBy(User assignedBy) {
        this.assignedBy = assignedBy;
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
