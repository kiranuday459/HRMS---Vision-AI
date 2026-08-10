package com.hrms.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Whether an assignment may be removed, and if not, what is holding it up.
 *
 * The admin tab asks for this before opening its confirmation dialog, so a blocked removal is
 * explained up front rather than after the admin has already confirmed it. The same rule is
 * enforced again inside deactivate() — this DTO drives the message, not the decision.
 */
public class AssignmentRemovalEligibilityDTO {

    private boolean removable;
    private int pendingCount;
    /** Week start dates awaiting a decision, so the message can name them. */
    private List<LocalDate> pendingWeekStarts;
    private Long employeeId;
    private String employeeName;
    private String projectName;

    public AssignmentRemovalEligibilityDTO() {}

    public AssignmentRemovalEligibilityDTO(boolean removable, List<LocalDate> pendingWeekStarts,
                                           Long employeeId, String employeeName, String projectName) {
        this.removable = removable;
        this.pendingWeekStarts = pendingWeekStarts;
        this.pendingCount = pendingWeekStarts == null ? 0 : pendingWeekStarts.size();
        this.employeeId = employeeId;
        this.employeeName = employeeName;
        this.projectName = projectName;
    }

    public boolean isRemovable() { return removable; }
    public void setRemovable(boolean removable) { this.removable = removable; }
    public int getPendingCount() { return pendingCount; }
    public void setPendingCount(int pendingCount) { this.pendingCount = pendingCount; }
    public List<LocalDate> getPendingWeekStarts() { return pendingWeekStarts; }
    public void setPendingWeekStarts(List<LocalDate> pendingWeekStarts) { this.pendingWeekStarts = pendingWeekStarts; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }
    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }
}
