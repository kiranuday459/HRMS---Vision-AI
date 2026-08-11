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
    private int blockingCount;
    /**
     * Week start dates that are blocking the removal, so the message can name them. Named
     * "blocking" rather than "pending" because a rejected week counts too — it is waiting on the
     * employee to resubmit, not finished.
     */
    private List<LocalDate> blockingWeekStarts;
    private Long employeeId;
    private String employeeName;
    private String projectName;

    public AssignmentRemovalEligibilityDTO() {}

    public AssignmentRemovalEligibilityDTO(boolean removable, List<LocalDate> blockingWeekStarts,
                                           Long employeeId, String employeeName, String projectName) {
        this.removable = removable;
        this.blockingWeekStarts = blockingWeekStarts;
        this.blockingCount = blockingWeekStarts == null ? 0 : blockingWeekStarts.size();
        this.employeeId = employeeId;
        this.employeeName = employeeName;
        this.projectName = projectName;
    }

    public boolean isRemovable() { return removable; }
    public void setRemovable(boolean removable) { this.removable = removable; }
    public int getBlockingCount() { return blockingCount; }
    public void setBlockingCount(int blockingCount) { this.blockingCount = blockingCount; }
    public List<LocalDate> getBlockingWeekStarts() { return blockingWeekStarts; }
    public void setBlockingWeekStarts(List<LocalDate> blockingWeekStarts) { this.blockingWeekStarts = blockingWeekStarts; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }
    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }
}
