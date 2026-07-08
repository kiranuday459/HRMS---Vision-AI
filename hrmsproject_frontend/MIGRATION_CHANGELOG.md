# Frontend Validation + UI Migration — ORYFOLKS → VisionAi

**Date:** 2026-06-17
**Goal:** Port client-side form validations (and form UI) from `hrmsproject_oryfolks` into `hrmsproject_visionai`, **keeping VisionAi's own branding** (Fuji Lavender theme + `visionai-logo.png`) and **without touching any backend, API contract, or business logic**.

---

## Key context discovered during analysis

- **VisionAi is a rebranded fork of ORYFOLKS.** `utils/api.js`, `hooks/useEmployees.js`, and `App.css` are **byte-identical** between the two projects — the frontend↔backend API contract is shared (e.g. both use the backend field name `oryfolksId`).
- VisionAi intentionally diverged on **branding** ("Fuji Lavender" lavender theme, richer CSS tokens, `visionai-logo.png`) and on some **UI/features** (e.g. a more responsive `Sidebar` with mobile drawer + compact mode). ORYFOLKS diverged by adding a **client-side validation system**.
- VisionAi also diverged on some **data handling** (stores phone numbers *with* a `+country-code` prefix; ORYFOLKS stores digits-only and infers country by length).

### Merge policy applied
1. **Validations:** ported 100% from ORYFOLKS into every VisionAi form.
2. **Branding:** preserved VisionAi's theme/logo/colors exactly (`text-brand-text`, `bg-[#F7F5FA]`, `bg-brand-yellow`, `border/bg-brand-blue/*`); error states use ORYFOLKS's pattern `ring-2 ring-red-500 bg-red-50`.
3. **Data/API/business logic:** preserved VisionAi's exactly — no endpoint, payload, field-name, phone-format, or approval/RBAC change. ORYFOLKS feature drift that is *not* validation (e.g. the `isReadOnly` disabled-account access rule) was deliberately **not** ported.
4. All edits are **additive/surgical**; no VisionAi feature was removed.

---

## New files added (validation infrastructure — brand-neutral, copied from ORYFOLKS)

| File | Purpose |
|---|---|
| `src/utils/formValidation.js` | All field validators + sanitizers (name, email, mobile country-aware, Aadhaar, PAN, passport, address, file upload, DOB, emergency relationship, required, char counters). |
| `src/hooks/useFormValidation.js` | Reusable form-state/validation hook. |
| `src/hooks/useSidebarCollapsed.js` | Shared sidebar collapse state (dependency of ported components). |
| `src/components/FormValidation.jsx` | `FormFieldError`, `FormFieldWrapper`, `FileUploadValidationInfo`, `CharacterCounter`, `ValidationSummary`. |
| `src/components/LeaveDecisionButtons.jsx` | Shared approve/reject controls (dependency). |
| `src/styles/formValidation.css` | Error/counter/validation styling (semantic colors, no brand tokens). |

---

## Files modified (validations added/updated)

| File | Validations added | UI |
|---|---|---|
| `pages/login/LoginPage.jsx` | Surfaces backend error message on failed login (parity). Existing required guards kept. | Branding untouched. |
| `pages/login/ForgotPassword.jsx` | **No change** — already at parity (password-match + required + email type). | — |
| `pages/admin/EmployeeProfile.jsx` | First/Middle/Last name + emergency name (alpha-only, max 32), personal email, mobile/alternate/emergency phone (country-aware exact-length), Aadhaar (12 digits), PAN (regex), passport (8–9 alnum), current/permanent/emergency address (max 252 + counter), DOB (18–120, not future), emergency relationship (select). Per-field error display, `onBlur`, `maxLength`. | Error styling only; VisionAi logo/colors/payload/`oryfolksId`/phone-prefix preserved. `isReadOnly` drift NOT ported. |
| `pages/employee/EmployeeOwnProfile.jsx` | Same field set as above **plus** education year ranges and employment date/email checks, with a validate-all gate blocking save on errors. | Same constraints; VisionAi phone-prefix storage preserved. |
| `components/AddEmployeeModal.jsx` | Names (alpha, max 32), personal + corporate email, country-aware phone, DOB (18–120/not-future), gender/role required, Company ID required, designation/joining-date required. Validate-all gates on step-next and submit. | Branding/payload/`oryfolksId` preserved. |
| `components/CompanyDetailsModal.jsx` | Added real-time email-format validation (Company ID/designation/date required were already at parity). | — |
| `pages/employee/LeaveRequestPage.jsx` | Leave type required, start/end date required + end ≥ start, reason required + `maxLength 255` + character counter; submit blocked when invalid. Existing weekend/holiday onBlur logic preserved. | Leave-balance/LOP/probation business logic untouched. |
| `components/DownloadTimesheetModal.jsx` | From/To date range: required, valid bounds, `from ≤ to` (submit-time guards + min/max). | — |
| `pages/employee/timesheet/WeeklyTimesheetGrid.jsx` | Hour inputs: numeric-only sanitize + keystroke blocking + `maxLength 2`; Project ID/Name/Task ID/Comment text inputs `maxLength 32`; Project ID & Name required when a row has hours. | Daily-hours/probation/leave business logic untouched. |
| `pages/admin/AdminDashboard.jsx` | Reject-reason textarea `maxLength 255` (required guard already existed). | — |

---

## Verified at parity (no change needed)

`pages/employee/EmployeeTimesheet.jsx`, `pages/common/YearlyHolidayCalendar.jsx`, and the approval-reason guards in `HrManagerLeaves`, `HrManagerTimesheets`, `AdminTimesheets`, `ReportingManagerTeam` — VisionAi already enforces the same client-side checks ORYFOLKS does (ORYFOLKS does not cap those reason textareas either).

---

## Build status

`npm run build` → **✓ 2397 modules transformed, built in ~10s** (output bundles `visionai-logo`, confirming branding intact). Only warning is Vite's pre-existing chunk-size notice.

---

## UI-parity scope note

The dominant, unambiguous request — **all client-side validations** — is fully migrated and building. For broader visual/layout "UI parity" on non-form pages (dashboards, sidebars, tables, view-only modals), VisionAi has **already** rebranded those screens with its own (and in places more evolved) design. Forcing wholesale ORYFOLKS layout parity there would revert VisionAi's deliberate branding/features, which conflicts with the "keep VisionAi branding" decision. Those screens were therefore left on VisionAi's current design. If specific pages should be restructured to match ORYFOLKS's layout, they can be done individually on request.
