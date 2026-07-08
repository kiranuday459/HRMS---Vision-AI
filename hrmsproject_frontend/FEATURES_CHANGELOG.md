# Feature Port — ORYFOLKS → VisionAi (4 functionalities)

**Date:** 2026-06-17
**Scope:** Port only the 4 requested functionalities. No colors, layout, styling, validations, backend/API, or unrelated business logic changed. Build verified: `npm run build` → ✓ 2398 modules, ~9s.

---

## 1. Sidebar — Close/Toggle  ✅ ADDED

ORYFOLKS has a desktop sidebar collapse/expand toggle driven by the shared `useSidebarCollapsed` hook (persists to `localStorage`, broadcasts a window event so every sidebar stays in sync) with `PanelLeftClose`/`PanelLeftOpen` icons and a `w-20`↔full-width animated transition. VisionAi had no such toggle.

**Files changed:**
- `src/components/AdminSidebar.jsx` — added `useSidebarCollapsed` + `PanelLeftClose/Open` imports and `collapsed` state; desktop `md` aside now animates `md:w-20`↔`md:w-[277px]`; added the toggle button in the header; nav items + logout collapse to icon-only (with `title` tooltips) when collapsed.
- `src/components/Sidebar.jsx` (used by HR / Reporting Manager / Employee) — same toggle added to the `lg` desktop sidebar (`w-20`↔`w-64`); `NavButton` and headings collapse to icon-only/divider; logout collapses. The existing mobile drawer and `md` compact sidebar are unchanged.

All VisionAi colors/logo (`visionai-logo.png`, lavender tokens) preserved; the collapse state is shared across both sidebars exactly like ORYFOLKS.

---

## 2. Timesheet Pages — Filters  ✅ ALREADY PRESENT (no change needed)

Verified each role's timesheet page against ORYFOLKS:

| Role | Page | ORYFOLKS filters | VisionAi |
|---|---|---|---|
| Admin | `admin/AdminTimesheets.jsx` | search (name/ID), role tabs ALL/HR/RM/OTHERS | Has both **+ a Status filter** (superset) |
| HR | `hr/HrManagerTimesheets.jsx` | search only | Has search **+ Status filter** (superset) |
| Reporting Manager | `reporting/ReportingManagerTeam.jsx` (Team Timesheets) | search only | Has search **+ `tsStatusFilter`** (superset) |
| Employee | `employee/timesheet/TimesheetSummary.jsx` | status filter + reset | Identical status filter + reset |

VisionAi already implements every ORYFOLKS timesheet filter (and more). No gap to fill — no files edited.

---

## 3. Leave Pages — Filters  ✅ ALREADY PRESENT (no change needed)

| Role | Page | ORYFOLKS filters | VisionAi |
|---|---|---|---|
| Admin | `admin/AdminDashboard.jsx` (Leave Requests) | search + role pills ALL/HR/MANAGERS | Identical state, UI, and filter logic (desktop + mobile) |
| HR | `hr/HrManagerLeaves.jsx` | search + role pills ALL/REPORTING_MANAGERS/OTHERS | Identical |
| Reporting Manager | `reporting/ReportingManagerTeam.jsx` (Team Leaves) | search by name | Identical |
| Employee | `employee/LeaveRequestPage.jsx` (own history) | none (renders history directly) | Same (no filter in either) |

VisionAi already matches ORYFOLKS's leave filters for every role. No gap to fill — no files edited.

---

## 4. Admin Dashboard — Delete Employee Flow  ✅ ADDED

**ORYFOLKS flow:** the employee-list page (`admin/CandidatesPage.jsx`) deletes via a **styled confirmation modal** (not `window.confirm`) reading "Delete Employee / Are you sure you want to permanently delete this employee? This action cannot be undone." with a red **Delete** button; confirming calls `DELETE /api/employees/{id}`, optimistically removes the row, calls `refresh()`, and toasts. (SelectedEmployees.jsx / EmployeeProfile.jsx have no employee-delete action — only document delete.)

VisionAi previously used a bare `window.confirm` and did not refresh the list.

**File changed:** `src/pages/admin/CandidatesPage.jsx`
- Added `createPortal` import and a `confirmModal` state.
- Trash button now opens the styled confirmation modal instead of firing `window.confirm`.
- Added `runConfirm()` → `handleDelete(id)`; `handleDelete` keeps the **same** `DELETE /api/employees/{id}` call and now also calls `refresh()` after optimistic removal (matching ORYFOLKS).
- Modal styled with VisionAi's existing modal pattern + theme tokens (no ORYFOLKS colors).

The delete API endpoint/method/payload is unchanged; ORYFOLKS's separate enable/disable menu actions were **not** added (VisionAi has no such endpoint — that would be a backend change).

---

## Notes
- Features 2 & 3 required no code changes because VisionAi (an evolved fork) already implemented those filters, in places as a superset of ORYFOLKS. Reported honestly rather than adding redundant controls.
- No validations from the previous task were modified.
