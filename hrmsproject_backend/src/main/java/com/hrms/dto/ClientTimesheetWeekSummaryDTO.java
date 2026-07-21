package com.hrms.dto;

import java.time.LocalDate;

/**
 * One row in the employee's Client Timesheet Summary list (one week).
 * `status` is the derived employee-facing status (DRAFT/PENDING/APPROVED/REJECTED);
 * the UI maps it to the label + colour. `truTimeHours` is intentionally null (shown
 * as "N/A") — it does not apply to this module.
 */
public class ClientTimesheetWeekSummaryDTO {

    private LocalDate weekStartDate;
    private LocalDate weekEndDate;
    private String status;
    private Double billableProjectHours;
    private Double nonBillableProjectHours;
    private Double timeOffHolidayHours;
    private Double truTimeHours; // always null → "N/A"

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

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Double getBillableProjectHours() {
        return billableProjectHours;
    }

    public void setBillableProjectHours(Double billableProjectHours) {
        this.billableProjectHours = billableProjectHours;
    }

    public Double getNonBillableProjectHours() {
        return nonBillableProjectHours;
    }

    public void setNonBillableProjectHours(Double nonBillableProjectHours) {
        this.nonBillableProjectHours = nonBillableProjectHours;
    }

    public Double getTimeOffHolidayHours() {
        return timeOffHolidayHours;
    }

    public void setTimeOffHolidayHours(Double timeOffHolidayHours) {
        this.timeOffHolidayHours = timeOffHolidayHours;
    }

    public Double getTruTimeHours() {
        return truTimeHours;
    }

    public void setTruTimeHours(Double truTimeHours) {
        this.truTimeHours = truTimeHours;
    }
}
