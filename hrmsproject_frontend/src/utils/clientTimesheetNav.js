// Role-aware paths for the shared Client Timesheet module. The Summary/Entry pages are
// reused by both employees (/employee/...) and reporting managers (/reporting-dashboard/...);
// these helpers pick the correct base path from the logged-in user's role so the same
// components work under either route tree.

const readRole = () => {
    try {
        return (JSON.parse(localStorage.getItem("user") || "{}").role || "").toUpperCase();
    } catch {
        return "";
    }
};

/** Base path for the Client Timesheet summary/entry pages for the current user's role. */
export function clientTimesheetBase() {
    return readRole() === "REPORTING_MANAGER"
        ? "/reporting-dashboard/client-timesheet"
        : "/employee/client-timesheet";
}

/** Dashboard to fall back to when Client Timesheet access is denied. */
export function roleDashboardPath() {
    return readRole() === "REPORTING_MANAGER" ? "/manager" : "/employee";
}
