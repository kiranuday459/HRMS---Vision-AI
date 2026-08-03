// Role-aware paths for the shared Client Timesheet module. Unified workspace routes
// live under /client-timesheet/*; legacy role-prefixed paths redirect here.

export const CLIENT_TIMESHEET_DASHBOARD = "/client-timesheet/dashboard";
export const CLIENT_TIMESHEET_ADMIN = "/client-timesheet/admin";

const readRole = () => {
    try {
        return (JSON.parse(localStorage.getItem("user") || "{}").role || "").toUpperCase();
    } catch {
        return "";
    }
};

/** Primary dashboard route for the Client Timesheet workspace (role-aware). */
export function clientTimesheetDashboardPath() {
    return readRole() === "ADMIN" ? CLIENT_TIMESHEET_ADMIN : CLIENT_TIMESHEET_DASHBOARD;
}

/** Base path for summary/entry pages within the client workspace. */
export function clientTimesheetBase() {
    return CLIENT_TIMESHEET_DASHBOARD;
}

/** Build the week entry path for a given week start date. */
export function clientTimesheetWeekPath(weekStart) {
    return `${CLIENT_TIMESHEET_DASHBOARD}/${weekStart}`;
}

/** Dashboard to return to when exiting the Client Timesheet workspace. */
export function roleDashboardPath() {
    const role = readRole();
    if (role === "ADMIN") return "/admin";
    if (role === "HR") return "/hr";
    if (role === "REPORTING_MANAGER") return "/manager";
    return "/employee";
}
