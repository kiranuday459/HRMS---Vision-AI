package com.hrms.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * One immutable row per staffing decision: an employee assigned to a client project, removed
 * from it, or re-added to it.
 *
 * A separate event table rather than columns on {@link ClientProjectAssignment}, because the
 * same assignment can be removed and re-added any number of times. "removed_by"/"removed_at"
 * columns would only ever hold the most recent of those and the earlier history would be
 * overwritten — which is the opposite of what an audit log is for.
 *
 * Names are snapshotted alongside the ids on purpose. The log records what was true when the
 * action happened, so a later rename (or a project the employee has since left) must not
 * rewrite history. The ids are kept for filtering and for joining back to the live records.
 *
 * Nothing updates or deletes these rows; the only writes are appends from
 * ClientProjectAssignmentService.
 */
@Entity
@Table(name = "client_project_assignment_audit")
public class ClientProjectAssignmentAudit {

    /** An employee was assigned to a client project. */
    public static final String ACTION_ASSIGNED = "ASSIGNED";
    /** An admin ended an assignment, revoking Client Timesheet access with it. */
    public static final String ACTION_REMOVED = "REMOVED";
    /** An admin put a previously removed assignment back. */
    public static final String ACTION_REASSIGNED = "REASSIGNED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The assignment this event happened to. Not a FK — the log outlives its subject. */
    private Long assignmentId;

    private Long employeeId;

    @Column(length = 128)
    private String employeeName;

    @Column(length = 255)
    private String clientName;

    @Column(length = 25)
    private String projectId;

    @Column(length = 50)
    private String projectName;

    /** One of ACTION_ASSIGNED / ACTION_REMOVED / ACTION_REASSIGNED. */
    @Column(length = 16, nullable = false)
    private String action;

    /** The admin who performed it. Null only if the action arrived without a session. */
    private Long performedById;

    @Column(length = 128)
    private String performedByName;

    @Column(nullable = false)
    private LocalDateTime performedAt;

    @PrePersist
    protected void onCreate() {
        if (performedAt == null) {
            performedAt = LocalDateTime.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAssignmentId() { return assignmentId; }
    public void setAssignmentId(Long assignmentId) { this.assignmentId = assignmentId; }

    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }

    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }

    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }

    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }

    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public Long getPerformedById() { return performedById; }
    public void setPerformedById(Long performedById) { this.performedById = performedById; }

    public String getPerformedByName() { return performedByName; }
    public void setPerformedByName(String performedByName) { this.performedByName = performedByName; }

    public LocalDateTime getPerformedAt() { return performedAt; }
    public void setPerformedAt(LocalDateTime performedAt) { this.performedAt = performedAt; }
}
