// Builds the "Approved by <name>" / "Rejected by <name>" label for a leave, using the
// actual person who acted (leave.approvedBy holds the approver's full name on approval
// and the rejecter's full name on rejection). Returns null when no one has acted yet.
export const getLeaveActionLabel = (leave) => {
    if (!leave || !leave.approvedBy) return null;
    const status = (leave.status || '').toUpperCase();
    if (status === 'REJECTED') return `Rejected by ${leave.approvedBy}`;
    if (status === 'APPROVED') return `Approved by ${leave.approvedBy}`;
    return leave.approvedBy;
};

// True when this leave is on the HR-disabled reroute path (the RM is standing in for a
// disabled HR). Used to show the info banner and the special status text.
export const isHrDisabledReroute = (leave) =>
    !!leave && (leave.hrDisabledReroute === true || leave.approvalRoute === 'RM_HANDLES_ALL');

// Status label for a leave, honouring the HR-disabled two-stage reroute (Part 5).
// viewerRole: 'EMPLOYEE' (own view) or 'REPORTING_MANAGER' (team view). Falls back to the
// plain status for every normal leave, keeping existing behaviour unchanged.
export const getLeaveStatusLabel = (leave, viewerRole = 'EMPLOYEE') => {
    if (!leave) return '';
    const status = (leave.status || '').toUpperCase();
    const reroute = isHrDisabledReroute(leave);

    if (status === 'PENDING') {
        if (reroute) {
            const atHrStage = leave.approvalStage === 'PENDING_RM_AS_HR_APPROVAL';
            if (viewerRole === 'REPORTING_MANAGER') {
                return atHrStage
                    ? 'Pending Your Approval (HR Stage — HR Unavailable)'
                    : 'Pending Your Approval';
            }
            return 'Pending Approval (HR Unavailable — Reporting Manager handling)';
        }
        if (viewerRole === 'REPORTING_MANAGER') return 'Pending Your Approval';
        return 'Pending Approval';
    }
    if (status === 'APPROVED') {
        if (reroute && leave.hrStageApprovedByRole === 'REPORTING_MANAGER' && viewerRole === 'REPORTING_MANAGER') {
            return 'Approved by You (HR Stage)';
        }
        return 'Approved';
    }
    if (status === 'REJECTED') return 'Rejected';
    return status;
};
