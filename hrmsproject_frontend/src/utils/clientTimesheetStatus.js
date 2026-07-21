// Maps a ClientTimesheet week/entry status to its label + colours.
//   NOT_STARTED -> "Not Started"       (gray)   — week exists but nothing saved
//   DRAFT       -> "Draft"             (blue)   — entries saved, not submitted
//   PENDING     -> "Pending Approval"  (amber)  — submitted, awaiting admin
//   APPROVED    -> "Approved"          (green)
//   REJECTED    -> "Rejected"          (red)
const STATUS_MAP = {
    NOT_STARTED: {
        label: "Not Started",
        text: "text-[#6B7280]",
        bg: "bg-[#F3F4F6]",
        textHex: "#6B7280",
        bgHex: "#F3F4F6",
        borderHex: "#D1D5DB",
    },
    DRAFT: {
        label: "Draft",
        text: "text-[#185FA5]",
        bg: "bg-[#EFF6FF]",
        textHex: "#185FA5",
        bgHex: "#EFF6FF",
        borderHex: "#185FA5",
    },
    PENDING: {
        label: "Pending Approval",
        text: "text-[#B45309]",
        bg: "bg-[#FEF9C3]",
        textHex: "#B45309",
        bgHex: "#FEF9C3",
        borderHex: "#F59E0B",
    },
    APPROVED: {
        label: "Approved",
        text: "text-[#16A34A]",
        bg: "bg-[#DCFCE7]",
        textHex: "#16A34A",
        bgHex: "#DCFCE7",
        borderHex: "#16A34A",
    },
    REJECTED: {
        label: "Rejected",
        text: "text-[#DC2626]",
        bg: "bg-[#FEE2E2]",
        textHex: "#DC2626",
        bgHex: "#FEE2E2",
        borderHex: "#DC2626",
    },
};

export function clientTimesheetStatusMeta(status) {
    const key = (status || "NOT_STARTED").toUpperCase();
    return STATUS_MAP[key] || STATUS_MAP.NOT_STARTED;
}

export default clientTimesheetStatusMeta;
