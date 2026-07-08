export const APPROVAL_STATUS = {
    PENDING_RM_APPROVAL: 'PENDING_RM_APPROVAL',
    PENDING_HR_APPROVAL: 'PENDING_HR_APPROVAL',
    // HR account disabled — the Reporting Manager handles the HR stage as well.
    PENDING_RM_AS_HR_APPROVAL: 'PENDING_RM_AS_HR_APPROVAL',
    PENDING_ADMIN_APPROVAL: 'PENDING_ADMIN_APPROVAL',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED'
};

const formatRoleName = (role = '') => {
    if (!role) return '';
    return role.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
};

// Human-readable label for an approver/rejecter role, used in "Approved by …" /
// "Rejected by …" status text. Keeps HR uppercase and title-cases the rest.
const roleLabel = (role = '') => {
    if (role === 'ADMIN') return 'Admin';
    if (role === 'HR') return 'HR';
    if (role === 'REPORTING_MANAGER') return 'Reporting Manager';
    return formatRoleName(role);
};

// `names` carries the actual person names resolved from the timesheet entry:
//   { approvedByName, rejectedByName }
// When present, the label shows the real name ("Approved by Jane Doe") instead of a
// generic word or a role, per the Approved/Rejected-by display requirement.
// Viewer context for a Reporting Manager looking at their OWN timesheet. Their timesheet
// skips the RM approval stage (they are the RM), so the next approver is always HR.
export const REPORTING_MANAGER_SELF = 'REPORTING_MANAGER_SELF';

// Viewer context for an HR looking at their OWN timesheet. An HR's sheet skips the RM and
// HR stages and goes straight to Admin, so any pending stage reads as "Pending Admin
// Approval" and a rejection is always by Admin.
export const HR_SELF = 'HR_SELF';

export const getTimesheetDisplayLabel = (status, viewerRole = 'EMPLOYEE', rejectedByRole = null, names = {}) => {
    if (!status) return '';

    // HR viewing their own timesheet: the only approver is Admin.
    if (viewerRole === HR_SELF) {
        switch (status) {
            case APPROVAL_STATUS.PENDING_RM_APPROVAL:
            case APPROVAL_STATUS.PENDING_HR_APPROVAL:
            case APPROVAL_STATUS.PENDING_RM_AS_HR_APPROVAL:
            case APPROVAL_STATUS.PENDING_ADMIN_APPROVAL:
                return 'Pending Admin Approval';
            case APPROVAL_STATUS.APPROVED:
                return 'Approved';
            case APPROVAL_STATUS.REJECTED:
                return 'Rejected by Admin';
            default:
                return status;
        }
    }

    // Reporting Manager viewing their own timesheet: any pending stage → HR; the RM
    // can never be the approver of their own sheet.
    if (viewerRole === REPORTING_MANAGER_SELF) {
        switch (status) {
            case APPROVAL_STATUS.PENDING_RM_APPROVAL:
            case APPROVAL_STATUS.PENDING_HR_APPROVAL:
            case APPROVAL_STATUS.PENDING_RM_AS_HR_APPROVAL:
            case APPROVAL_STATUS.PENDING_ADMIN_APPROVAL:
                return 'Pending approval from HR';
            case APPROVAL_STATUS.APPROVED:
                return names && names.approvedByName ? `Approved by ${names.approvedByName}` : 'Approved by HR';
            case APPROVAL_STATUS.REJECTED:
                return names && names.rejectedByName ? `Rejected by ${names.rejectedByName}` : 'Rejected by HR';
            default:
                return status;
        }
    }

    // Reporting Manager viewing TEAM timesheets, and HR viewing timesheets: the badge
    // must reflect the ACTUAL current approval stage, never a generic "Pending". After an
    // RM approves, the sheet moves to PENDING_HR_APPROVAL → "Pending approval from HR".
    if (viewerRole === 'REPORTING_MANAGER' || viewerRole === 'HR') {
        switch (status) {
            case APPROVAL_STATUS.PENDING_RM_APPROVAL:
                return 'Pending RM approval';
            case APPROVAL_STATUS.PENDING_HR_APPROVAL:
                return 'Pending approval from HR';
            case APPROVAL_STATUS.PENDING_RM_AS_HR_APPROVAL:
                // HR disabled — the RM is standing in for the HR stage (Part 5).
                return 'Pending Your Approval (HR Stage — HR Unavailable)';
            case APPROVAL_STATUS.PENDING_ADMIN_APPROVAL:
                return 'Pending approval from Admin';
            case APPROVAL_STATUS.APPROVED:
                // RM stood in for a disabled HR → "Approved by You (HR Stage)".
                if (names && names.hrStageByRm) return 'Approved by You (HR Stage)';
                // Otherwise reflect who actually approved: HR in the normal flow, Admin for
                // records finalised by Admin (e.g. no-RM/no-HR fallback sheets, shown as history).
                return names && names.approvedByRole ? `Approved by ${roleLabel(names.approvedByRole)}` : 'Approved by HR';
            case APPROVAL_STATUS.REJECTED:
                // rejectedByRole is the role of whoever rejected (REPORTING_MANAGER / HR / ADMIN).
                return rejectedByRole ? `Rejected by ${roleLabel(rejectedByRole)}` : 'Rejected';
            default:
                return status;
        }
    }

    // Employee viewing their OWN timesheet. The badge must reflect the actual current
    // stage — APPROVED only once HR has approved (a sheet only the RM approved is still
    // PENDING_HR_APPROVAL → "Pending approval from HR").
    if (viewerRole === 'EMPLOYEE') {
        switch (status) {
            case APPROVAL_STATUS.PENDING_RM_APPROVAL:
                return 'Pending approval from Reporting Manager';
            case APPROVAL_STATUS.PENDING_HR_APPROVAL:
                return 'Pending approval from HR';
            case APPROVAL_STATUS.PENDING_RM_AS_HR_APPROVAL:
                // HR disabled — RM handling the HR stage (Part 5, employee view).
                return 'Pending Approval (HR Unavailable — Reporting Manager handling)';
            case APPROVAL_STATUS.PENDING_ADMIN_APPROVAL:
                return 'Pending approval from Admin';
            case APPROVAL_STATUS.APPROVED:
                // Normal flow ends at HR → generic "Approved"; a no-RM/no-HR fallback sheet
                // is finalised by Admin → "Approved by Admin".
                return names && names.approvedByRole === 'ADMIN' ? 'Approved by Admin' : 'Approved';
            case APPROVAL_STATUS.REJECTED:
                return rejectedByRole ? `Rejected by ${roleLabel(rejectedByRole)}` : 'Rejected';
            default:
                return status;
        }
    }

    switch (status) {
        case APPROVAL_STATUS.PENDING_RM_APPROVAL:
            return viewerRole === 'EMPLOYEE'
                ? 'Pending approval from Reporting Manager and HR'
                : 'Pending approval from Reporting Manager';
        case APPROVAL_STATUS.PENDING_RM_AS_HR_APPROVAL:
            return viewerRole === 'EMPLOYEE'
                ? 'Pending Approval (HR Unavailable — Reporting Manager handling)'
                : 'Pending Your Approval (HR Stage — HR Unavailable)';
        case APPROVAL_STATUS.PENDING_HR_APPROVAL:
            return viewerRole === 'EMPLOYEE'
                ? 'Pending approval from HR'
                : 'Pending';
        case APPROVAL_STATUS.PENDING_ADMIN_APPROVAL:
            return viewerRole === 'EMPLOYEE'
                ? 'Pending approval from Admin'
                : 'Pending';
        case APPROVAL_STATUS.APPROVED:
            return names && names.approvedByName
                ? `Approved by ${names.approvedByName}`
                : 'Approved';
        case APPROVAL_STATUS.REJECTED:
            if (names && names.rejectedByName) {
                return `Rejected by ${names.rejectedByName}`;
            }
            return rejectedByRole
                ? `Rejected by ${formatRoleName(rejectedByRole)}`
                : 'Rejected';
        default:
            return status;
    }
};

// Picks the final approver's actual name from a set of week entries. The most senior
// approver who acted wins (Admin → HR → RM), matching the sequential approval flow.
const resolveApproverName = (entries = []) => {
    for (const e of entries) {
        const name = e?.adminApprovedByName || e?.hrApprovedByName || e?.rmApprovedByName;
        if (name) return name;
    }
    return null;
};

// Role of the FINAL approver across a week's entries (Admin → HR → RM). Used so an
// admin-approved sheet (including no-RM/no-HR fallback ones) reads "Approved by Admin"
// instead of the generic "Approved by HR".
const resolveApproverRole = (entries = []) => {
    for (const e of entries) {
        if (e?.adminApprovedByName) return 'ADMIN';
        if (e?.hrApprovedByName) return 'HR';
        if (e?.rmApprovedByName) return 'REPORTING_MANAGER';
    }
    return null;
};

export const getHighestTimesheetStatus = (entries) => {
    const statuses = (entries || []).map(e => e.status).filter(Boolean);
    if (statuses.includes(APPROVAL_STATUS.REJECTED)) return APPROVAL_STATUS.REJECTED;
    if (statuses.includes(APPROVAL_STATUS.PENDING_RM_APPROVAL)) return APPROVAL_STATUS.PENDING_RM_APPROVAL;
    if (statuses.includes(APPROVAL_STATUS.PENDING_RM_AS_HR_APPROVAL)) return APPROVAL_STATUS.PENDING_RM_AS_HR_APPROVAL;
    if (statuses.includes(APPROVAL_STATUS.PENDING_HR_APPROVAL)) return APPROVAL_STATUS.PENDING_HR_APPROVAL;
    if (statuses.includes(APPROVAL_STATUS.PENDING_ADMIN_APPROVAL)) return APPROVAL_STATUS.PENDING_ADMIN_APPROVAL;
    if (statuses.includes(APPROVAL_STATUS.APPROVED)) return APPROVAL_STATUS.APPROVED;
    return null;
};

// True if any entry in the week was approved for the HR stage by the RM standing in for a
// disabled HR — used so the week reads "Approved by You (HR Stage)".
const resolveHrStageByRm = (entries = []) =>
    (entries || []).some(e => e?.hrStageApprovedByRole === 'REPORTING_MANAGER' || e?.hrDisabledReroute);

export const getWeekStatus = (entries, viewerRole = 'EMPLOYEE') => {
    const status = getHighestTimesheetStatus(entries);
    const rejectedEntry = (entries || []).find(e => e.status === APPROVAL_STATUS.REJECTED);
    const names = {
        approvedByName: resolveApproverName(entries),
        approvedByRole: resolveApproverRole(entries),
        hrStageByRm: resolveHrStageByRm(entries),
        rejectedByName: rejectedEntry?.rejectedByName
    };
    return {
        status: status || 'NOT_FILLED',
        statusLabel: status
            ? getTimesheetDisplayLabel(status, viewerRole, rejectedEntry?.rejectedByRole, names)
            : 'Not Filled'
    };
};

// Short, readable status badge (underscores → spaces). For a Reporting Manager viewing
// their OWN timesheet, the skipped RM stage means any pending status reads as
// "PENDING HR APPROVAL" rather than the raw "PENDING_RM_APPROVAL".
export const getTimesheetStatusBadge = (status, viewerRole = 'EMPLOYEE') => {
    if (!status) return '';
    if (viewerRole === REPORTING_MANAGER_SELF) {
        switch (status) {
            case APPROVAL_STATUS.PENDING_RM_APPROVAL:
            case APPROVAL_STATUS.PENDING_HR_APPROVAL:
            case APPROVAL_STATUS.PENDING_RM_AS_HR_APPROVAL:
            case APPROVAL_STATUS.PENDING_ADMIN_APPROVAL:
                return 'PENDING HR APPROVAL';
            case APPROVAL_STATUS.APPROVED:
                return 'APPROVED';
            case APPROVAL_STATUS.REJECTED:
                return 'REJECTED';
            default:
                return String(status).replace(/_/g, ' ');
        }
    }
    return String(status).replace(/_/g, ' ');
};

export const isPendingStatus = (status) => [
    APPROVAL_STATUS.PENDING_RM_APPROVAL,
    APPROVAL_STATUS.PENDING_HR_APPROVAL,
    APPROVAL_STATUS.PENDING_RM_AS_HR_APPROVAL,
    APPROVAL_STATUS.PENDING_ADMIN_APPROVAL
].includes(status);

export const canApproveTimesheet = (status, role) => {
    // The RM approves both their own RM stage and, when HR is disabled, the HR stage.
    if (role === 'REPORTING_MANAGER') return status === APPROVAL_STATUS.PENDING_RM_APPROVAL || status === APPROVAL_STATUS.PENDING_RM_AS_HR_APPROVAL;
    if (role === 'HR') return status === APPROVAL_STATUS.PENDING_HR_APPROVAL;
    if (role === 'ADMIN') return status === APPROVAL_STATUS.PENDING_ADMIN_APPROVAL;
    return false;
};
