/**
 * Maximum character lengths for the free-text Client Timesheet fields.
 *
 * Single source of truth for the frontend: every input that writes one of these fields caps
 * itself here (hard stop via maxLength) and shows a live counter, so the four screens that
 * collect them cannot drift apart.
 *
 * These are mirrored server-side — ClientTimesheetWeekService.FIELD limits,
 * ClientTimesheetService.reject() and ClientProjectAssignmentService — because the frontend
 * cap is a convenience, not the contract: a direct API call must still be rejected with a
 * 400. Keep the two sides in step when changing a number here.
 *
 * The 256-char fields are backed by columns widened to VARCHAR(256) in
 * migration_widen_client_timesheet_text_columns.sql; don't raise a limit past its column.
 */
export const FIELD_LIMITS = {
    COMMENT: 256,
    REJECTION_REASON: 256,
    PROJECT_NAME: 50,
    PROJECT_ID: 25,
    TASK_DESCRIPTION: 256,
    TASK_ID: 25,
    // Frontend-only cap: the server still accepts up to its VARCHAR(64) column width, so
    // values longer than this that were saved from other screens keep loading and saving
    // fine — this only stops the Client Timesheet entry grid from typing new ones.
    BILLING_LOCATION: 25,
};

export default FIELD_LIMITS;
