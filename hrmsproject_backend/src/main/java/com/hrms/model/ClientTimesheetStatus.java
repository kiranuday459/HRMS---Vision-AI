package com.hrms.model;

/**
 * Approval status for a client timesheet entry. Kept fully independent from the
 * existing {@link TimesheetStatus} so the client_timesheets feature shares no
 * logic or lifecycle with the internal timesheets table.
 */
public enum ClientTimesheetStatus {
    // Not yet submitted by the employee (employee-facing label: "Pending").
    DRAFT,
    // Submitted for admin approval (employee-facing label: "Submitted for Approval").
    // This is the state the admin approval queue treats as awaiting review.
    PENDING,
    APPROVED,
    REJECTED
}
