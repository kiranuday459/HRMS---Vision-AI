package com.hrms.dto;

/**
 * One line of the Monday admin summary's "did not submit" list: who, which week, and exactly
 * which days they left blank.
 *
 * Fields arrive pre-formatted. The summary is a rendered email, not an API payload, and
 * building the strings where the dates are known keeps a single spelling of "Mon 3-Aug" across
 * the admin's list and the employee's own reminder.
 */
public class ClientTimesheetPendingDTO {

    private String employeeName;
    private String employeeId;
    private String weekRange;
    /** Comma-separated, e.g. "Mon 3-Aug, Tue 4-Aug, Wed 5-Aug". Never blank — an employee with
     *  no missing days is not on this list. */
    private String missingDays;

    public ClientTimesheetPendingDTO() {
    }

    public ClientTimesheetPendingDTO(String employeeName, String employeeId, String weekRange, String missingDays) {
        this.employeeName = employeeName;
        this.employeeId = employeeId;
        this.weekRange = weekRange;
        this.missingDays = missingDays;
    }

    public String getEmployeeName() {
        return employeeName;
    }

    public void setEmployeeName(String employeeName) {
        this.employeeName = employeeName;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(String employeeId) {
        this.employeeId = employeeId;
    }

    public String getWeekRange() {
        return weekRange;
    }

    public void setWeekRange(String weekRange) {
        this.weekRange = weekRange;
    }

    public String getMissingDays() {
        return missingDays;
    }

    public void setMissingDays(String missingDays) {
        this.missingDays = missingDays;
    }
}
