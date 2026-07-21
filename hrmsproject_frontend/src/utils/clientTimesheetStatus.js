// Maps a ClientTimesheet week status to its employee-facing label + colours.
// DRAFT   -> "Pending"                (green)   — not yet submitted
// PENDING -> "Submitted for Approval" (orange)  — awaiting admin review
// APPROVED-> "Approved"               (green)
// REJECTED-> "Rejected"               (red)
const STATUS_MAP = {
    DRAFT: {
        label: "Pending",
        text: "text-emerald-600",
        border: "border-l-emerald-500",
        borderHex: "#10b981",
    },
    PENDING: {
        label: "Submitted for Approval",
        text: "text-orange-500",
        border: "border-l-orange-500",
        borderHex: "#f97316",
    },
    APPROVED: {
        label: "Approved",
        text: "text-emerald-600",
        border: "border-l-emerald-500",
        borderHex: "#10b981",
    },
    REJECTED: {
        label: "Rejected",
        text: "text-red-500",
        border: "border-l-red-500",
        borderHex: "#ef4444",
    },
};

export function clientTimesheetStatusMeta(status) {
    const key = (status || "DRAFT").toUpperCase();
    return STATUS_MAP[key] || STATUS_MAP.DRAFT;
}

export default clientTimesheetStatusMeta;
