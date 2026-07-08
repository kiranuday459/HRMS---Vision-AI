// Single source of truth for detecting a disabled/inactive employee across the app.
// Different API responses expose the state differently:
//   - `active` (Boolean) on the main EmployeeDTO and reporting DTOs
//   - `status` ("ACTIVE" | "INACTIVE") on /api/admin/hr-teams
//   - `employeeStatus` ("ACTIVE" | "INACTIVE") on timesheet rows
// isDisabled() normalizes all of them so every page can check one way.
export const isDisabled = (e) =>
  !!e &&
  (e.active === false ||
    e.status === "INACTIVE" ||
    e.status === "DISABLED" ||
    e.employeeStatus === "INACTIVE" ||
    e.employeeStatus === "DISABLED");

export default isDisabled;
