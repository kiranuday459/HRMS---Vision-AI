// Central config for dynamic page headings.
// Headings are driven by the logged-in role + the current section.
// To add a heading for a new page, add one line under the relevant role.

export const ROLE_LABELS = {
  HR: "HR Manager",
  EMPLOYEE: "Employee",
  REPORTING_MANAGER: "Reporting Manager",
  // ADMIN is intentionally not mapped — admin pages are out of scope for dynamic headings.
};

export const PAGE_HEADINGS = {
  EMPLOYEE: {
    dashboard: "My Dashboard",
    timesheet: "My Timesheet",
    attendance: "My Attendance",
    leave: "My Leave & Requests",
    profile: "My Profile",
  },
  HR: {
    dashboard: "Workforce Overview",
    timesheet: "My Timesheet",
    employeeList: "Employee Directory",
    attendance: "Attendance Management",
    leave: "Leave Requests & Approvals",
    profile: "My Profile",
  },
  REPORTING_MANAGER: {
    // Personal Workspace pages (/reporting-dashboard) → personal titles.
    dashboard: "My Dashboard",
    timesheet: "My Timesheet",
    leave: "My Leave & Requests",
    profile: "My Profile",
    // Team Management pages (/reporting-team) → team titles.
    teamMembers: "My Team",
    teamTimesheets: "Team Timesheets",
    teamLeaves: "Team Leave Approvals",
  },
};

// Resolve the heading title for a given role + section.
export function resolveHeading(role, section) {
  if (!role || !section) return "";
  const byRole = PAGE_HEADINGS[role];
  return (byRole && byRole[section]) || "";
}
