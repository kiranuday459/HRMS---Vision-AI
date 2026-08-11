/**
 * The display name for an employee's HRMS role.
 *
 * Deliberately NOT the ROLE_LABELS map in config/pageHeadings.js: that one is for the
 * dashboard ribbon and reads HR as "HR Manager", where the employee-facing records call the
 * same role plain "HR". Two callers now share this — the Access Management tab's Role column
 * and the timesheet Excel export's Department cell — and they have to agree, because the
 * export is meant to print exactly what that column shows.
 *
 * Unknown roles fall through unchanged rather than being forced to "Employee", so a role added
 * later shows up as itself instead of silently mislabelling someone.
 */
export const roleLabel = (role) => {
    const r = (role || "").toUpperCase();
    if (r === "REPORTING_MANAGER") return "Reporting Manager";
    if (r === "HR") return "HR";
    if (r === "EMPLOYEE") return "Employee";
    return role || "Employee";
};
