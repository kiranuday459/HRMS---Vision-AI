package com.hrms.model;

public enum TimesheetStatus {
    PENDING_RM_APPROVAL,        // Waiting for Reporting Manager approval
    PENDING_HR_APPROVAL,        // Waiting for HR approval
    PENDING_RM_AS_HR_APPROVAL,  // HR account disabled — RM handles the HR stage as well
    PENDING_ADMIN_APPROVAL,     // Waiting for Admin approval
    APPROVED,                   // Fully approved
    REJECTED                    // Rejected at any stage
}
