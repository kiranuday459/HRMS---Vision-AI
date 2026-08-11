import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DownloadClientTimesheetModal from "../components/DownloadClientTimesheetModal";
import ClientTimesheetDetailDrawer from "../components/ClientTimesheetDetailDrawer";
import AssignedMembersTab from "../components/AssignedMembersTab";
import AuditLogsTab from "../components/AuditLogsTab";
import AssignEmployeeToClientProjectModal from "../../components/AssignEmployeeToClientProjectModal";
import ClientTimesheetConfirmModal from "../components/ClientTimesheetConfirmModal";
import { approveWeek, rejectWeek } from "../utils/clientTimesheetReview";
import api from "../../utils/api";
import { toast } from "react-toastify";
import { Download, Check, X, Briefcase } from "lucide-react";
import { clientTimesheetStatusMeta } from "../../utils/clientTimesheetStatus";
import { CLIENT_TIMESHEET_ADMIN } from "../../utils/clientTimesheetNav";
import CharCounter from "../../components/CharCounter";
import DisabledBadge from "../../components/DisabledBadge";
import { FIELD_LIMITS } from "../../utils/fieldLimits";

// ── Date helpers (treat YYYY-MM-DD as local, avoid timezone shifts) ──
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const toYMD = (dt) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};
// "2026-07-13" → "13-JUL-2026"
const fmtRange = (ymd) => {
    if (!ymd) return "";
    const [y, m, d] = String(ymd).split("T")[0].split("-").map(Number);
    return `${String(d).padStart(2, "0")}-${MON[m - 1]}-${y}`;
};
const num = (v) => (v == null ? "0.00" : Number(v).toFixed(2));

// Saturday-start week (matches the backend week definition) → YMD string.
const weekStartOf = (ymd) => {
    const [y, m, d] = String(ymd).split("T")[0].split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const offset = (dt.getDay() - 6 + 7) % 7; // Saturday = 6
    dt.setDate(dt.getDate() - offset);
    return toYMD(dt);
};
const addDays = (ymd, n) => {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    return toYMD(dt);
};

// Time-off row categories (everything else is billable/non-billable project work).
const TIMEOFF = new Set(["SICK", "HOLIDAY", "PTO", "LOP", "EARNED"]);

// One summary metric cell inside a week block (mirrors the employee summary card).
const SummaryCell = ({ value, label }) => (
    <div className="flex-1 min-w-[120px] px-4 py-3 border-l border-[#E3E8EF] flex flex-col items-center justify-center text-center">
        <span className="text-base font-bold text-brand-text">{value}</span>
        <span className="text-[11px] uppercase tracking-wide text-brand-text/40 mt-0.5">{label}</span>
    </div>
);

// Admin approval queue: only timesheets the employee has submitted for review.
const ADMIN_QUEUE_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED"]);

export default function ClientTimesheets() {
    const location = useLocation();
    const navigate = useNavigate();
    // Page tab: "timesheets" (approval queue) | "assigned" (assigned members) | "access" (access management).
    const [pageTab, setPageTab] = useState(location.state?.tab === "access" ? "access" : location.state?.tab === "assigned" ? "assigned" : "timesheets");
    const [entries, setEntries] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

    // Queue filters (applied at the block level)
    const [statusFilter, setStatusFilter] = useState("");

    // Approve flow — holds the week block awaiting confirmation.
    const [approvingBlock, setApprovingBlock] = useState(null);
    // Reject flow — holds the week block being rejected (all its day IDs).
    const [rejectingBlock, setRejectingBlock] = useState(null);
    // Final "are you sure" after the reason is typed. Cancelling it drops back to the reason
    // dialog with the text intact rather than throwing the reason away.
    const [confirmingReject, setConfirmingReject] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [acting, setActing] = useState(false);

    // Detail drawer (opened with any day ID from the block — the drawer loads the whole week).
    const [detailId, setDetailId] = useState(null);
    // Every day ID in the opened week. The drawer reviews the whole week, exactly as the
    // row-level buttons do, so it needs the same list rather than the one ID it was opened on.
    const [detailIds, setDetailIds] = useState([]);
    const openDetail = (block) => { setDetailIds(block.timesheetIds); setDetailId(block.timesheetIds[0]); };

    const currentUserId = useMemo(() => {
        const u = JSON.parse(localStorage.getItem("user")) || {};
        return u.id || u.userId;
    }, []);

    // Fetch the full day-level list once; grouping + filtering happen client-side so a
    // week block always reflects all of its days regardless of the active filters.
    const fetchEntries = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api("/api/client-timesheets");
            if (res.ok) {
                const json = await res.json().catch(() => ({}));
                const data = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
                setEntries(data);
            }
        } catch (err) {
            console.error("Error fetching client timesheets:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // One-time load: employees (for the download modal's department lookup).
    useEffect(() => {
        (async () => {
            try {
                const empRes = await api("/api/employees");
                const empJson = empRes.ok ? await empRes.json() : {};
                setEmployees(Array.isArray(empJson.data) ? empJson.data : []);
            } catch (err) {
                console.error("Error fetching employees:", err);
            }
        })();
    }, []);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    // Resolve a week's block status from its day statuses (matches backend deriveStatus:
    // rejected > pending > all-approved > all-not-started > draft).
    const resolveWeekStatus = (statuses) => {
        if (statuses.some((s) => s === "REJECTED")) return "REJECTED";
        if (statuses.some((s) => s === "PENDING")) return "PENDING";
        if (statuses.length && statuses.every((s) => s === "APPROVED")) return "APPROVED";
        if (statuses.length && statuses.every((s) => s === "NOT_STARTED")) return "NOT_STARTED";
        return "DRAFT";
    };

    // Group flat day records into weekly blocks (per employee + week).
    const blocks = useMemo(() => {
        const map = new Map();
        entries.forEach((r) => {
            const ws = r.weekStartDate ? String(r.weekStartDate).split("T")[0] : weekStartOf(r.date);
            const key = `${r.employeeId}_${ws}`;
            let b = map.get(key);
            if (!b) {
                b = {
                    key,
                    employeeId: r.employeeId,
                    employeeName: r.employeeName,
                    // Same for every row of one employee, so the first row settles it.
                    employeeActive: r.employeeActive,
                    projectName: r.projectName || "",
                    weekStart: ws,
                    weekEnd: r.weekEndDate ? String(r.weekEndDate).split("T")[0] : addDays(ws, 6),
                    billableHours: 0,
                    nonBillableHours: 0,
                    timeOffHours: 0,
                    totalHours: 0,
                    timesheetIds: [],
                    statuses: [],
                    approvedByName: null,
                    rejectionReason: null,
                };
                map.set(key, b);
            }
            const h = Number(r.hours) || 0;
            const cat = (r.category || "").toUpperCase();
            if (TIMEOFF.has(cat)) b.timeOffHours += h;
            else if (r.billable === true) b.billableHours += h;
            else b.nonBillableHours += h;
            b.totalHours += h;
            b.timesheetIds.push(r.id);
            b.statuses.push((r.status || "").toUpperCase());
            if (!b.projectName && r.projectName) b.projectName = r.projectName;
            if (!b.approvedByName && r.approvedByName) b.approvedByName = r.approvedByName;
            // Reject writes the same reason onto every day row of the week, so the first
            // non-blank one represents the week's most recent rejection.
            if (!b.rejectionReason && r.rejectionReason) b.rejectionReason = r.rejectionReason;
        });
        return Array.from(map.values())
            .map((b) => ({ ...b, status: resolveWeekStatus(b.statuses) }))
            .sort((a, b) =>
                a.weekStart < b.weekStart ? 1
                    : a.weekStart > b.weekStart ? -1
                        : (a.employeeName || "").localeCompare(b.employeeName || "")
            );
    }, [entries]);

    // Block-level filtering: submitted states only (exclude employee drafts / not started).
    const displayedBlocks = useMemo(
        () => blocks.filter((b) =>
            ADMIN_QUEUE_STATUSES.has(b.status) &&
            (!statusFilter || b.status === statusFilter)
        ),
        [blocks, statusFilter]
    );

    // Approve every day in the week block, then refresh. Only reached once the admin
    // confirms in the approve dialog.
    const handleApproveBlock = async (block) => {
        if (acting || !block) return;
        try {
            setActing(true);
            await approveWeek(block.timesheetIds, currentUserId);
            toast.success("Week approved.");
            setApprovingBlock(null);
            fetchEntries();
        } catch (err) {
            console.error(err);
            toast.error("Could not approve the week.");
        } finally {
            setActing(false);
        }
    };

    // Reject every day in the week block with the given reason, then refresh.
    const handleRejectConfirm = async () => {
        if (!rejectReason.trim()) return toast.warning("Please provide a reason.");
        if (!rejectingBlock) return;
        try {
            setActing(true);
            await rejectWeek(rejectingBlock.timesheetIds, currentUserId, rejectReason);
            toast.success("Week rejected.");
            setConfirmingReject(false);
            setRejectingBlock(null);
            setRejectReason("");
            fetchEntries();
        } catch (err) {
            console.error(err);
            toast.error("Could not reject the week.");
        } finally {
            setActing(false);
        }
    };

    const statusBadge = (status) => {
        const meta = clientTimesheetStatusMeta(status);
        return (
            <span
                className="px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
                style={{ backgroundColor: meta.bgHex, color: meta.textHex, borderColor: meta.borderHex }}
            >
                {meta.label}
            </span>
        );
    };

    return (
        <>
            <div className="flex flex-col h-full min-h-0 overflow-hidden">
                <main className="flex-1 flex flex-col h-full overflow-hidden">
                    <header className="bg-white pt-4 px-4 md:px-6 shadow-sm z-10 border-b border-[#E3E8EF] w-full flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                        <div>

                            {/* Tabs */}
                            <div className="flex gap-1 mt-2">
                                {[
                                    { id: "timesheets", label: "Timesheets" },
                                    // Assigned Members absorbed the Access Management tab: the two
                                    // listed the same assignments, one showing project/status and
                                    // the other employee id/role/verification. One table now
                                    // carries both sets of columns.
                                    { id: "assigned", label: "Assigned Members" },
                                    { id: "audit", label: "Audit Logs" },
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setPageTab(t.id)}
                                        className={`px-5 py-2.5 text-[12px] font-black uppercase tracking-widest border-b-2 transition-all ${pageTab === t.id
                                            ? "border-brand-blue-dark text-brand-blue-dark"
                                            : "border-transparent text-brand-text/40 hover:text-brand-text"}`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="mb-3 shrink-0">
                            <button
                                onClick={() => setIsAssignModalOpen(true)}
                                className="group bg-[#0B2545] hover:bg-[#071A32] text-white px-4 py-2.5 rounded-2xl flex items-center gap-3 shadow-md hover:shadow-xl transition-all duration-300 active:scale-[0.98] border border-white/10"
                            >
                                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0 group-hover:bg-white/20 transition-colors">
                                    <Briefcase className="w-5 h-5" />
                                </div>
                                <div className="text-left leading-tight">
                                    <p className="text-[12px] font-black tracking-wider uppercase text-white">
                                        ASSIGN PROJECTS
                                    </p>
                                    <p className="text-[10px] font-bold tracking-widest uppercase text-white/50 mt-0.5">
                                        PROJECT STAFFING
                                    </p>
                                </div>
                            </button>
                        </div>
                    </header>

                    {pageTab === "audit" ? (
                        // overflow-hidden (not auto), matching the Timesheets panel below: the
                        // tab's own table owns the scrolling, so its horizontal scrollbar sits at
                        // the bottom of the visible panel instead of below every row.
                        <div className="flex-1 min-h-0 p-4 overflow-hidden flex flex-col">
                            <AuditLogsTab />
                        </div>
                    ) : pageTab === "assigned" ? (
                        // Same as above: the panel does not scroll, the table inside it does, so
                        // the horizontal scrollbar stays on screen at any vertical position.
                        <div className="flex-1 min-h-0 p-4 overflow-hidden flex flex-col gap-4">
                            {/* A removal blocked by a week still awaiting a decision hands the
                                admin straight to the queue that holds it, filtered to what is
                                pending, rather than leaving them to find it. Uses the tab and
                                filter that already exist — neither is changed by this. */}
                            <AssignedMembersTab
                                onReviewPending={() => { setPageTab("timesheets"); setStatusFilter("PENDING"); }}
                            />
                        </div>
                    ) : (
                        // overflow-hidden (not auto): the filter row stays put and the card
                        // list below owns the only scrollbar. Two nested scroll containers
                        // used to fight each other and clip the cards at the viewport edge.
                        <div className="flex-1 min-h-0 p-4 overflow-hidden flex flex-col gap-4">
                            {/* Filters */}
                            <div className="flex flex-wrap gap-3 items-center justify-between w-full">
                                {/* Moved down out of the dark top bar; same destination as the
                                    tab it replaces. mr-auto keeps it left while the filter and
                                    download controls stay grouped on the right. */}
                                <button
                                    type="button"
                                    onClick={() => navigate(CLIENT_TIMESHEET_ADMIN)}
                                    className="mr-auto px-1 text-[13px] font-bold uppercase tracking-widest text-brand-text/60 hover:text-brand-blue-dark transition-colors"
                                >
                                    Admin Dashboard
                                </button>
                                <div className="flex items-center gap-3 ml-auto">
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="bg-white border border-[#E3E8EF] focus:border-brand-yellow rounded-xl px-4 py-2.5 text-xs font-bold text-brand-text outline-none transition-all"
                                    >
                                        <option value="">All</option>
                                        <option value="PENDING">Pending Approval</option>
                                        <option value="APPROVED">Approved</option>
                                        <option value="REJECTED">Rejected</option>
                                    </select>
                                    <button
                                        onClick={() => setIsDownloadOpen(true)}
                                        className="flex items-center justify-center w-[38px] h-[38px] bg-brand-blue-dark text-white rounded-xl shadow-lg shadow-brand-blue/20 hover:shadow-xl active:scale-95 transition-all shrink-0"
                                        title="Download"
                                        aria-label="Download"
                                    >
                                        <Download size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Approval queue — one card per week block */}
                            <div className="flex-1 flex flex-col min-h-0">
                                {loading ? (
                                    <div className="py-20 text-center text-brand-text/30 font-bold uppercase tracking-widest text-xs animate-pulse">Loading client timesheets...</div>
                                ) : displayedBlocks.length === 0 ? (
                                    <div className="py-20 text-center text-brand-text/30 font-bold uppercase tracking-widest text-xs">No client timesheets found</div>
                                ) : (
                                    // flex-1 + min-h-0 give the list a real height to scroll
                                    // within, so it works the same for 5 cards or 50; pb-1
                                    // keeps the last card's border/shadow off the clip edge.
                                    <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1 pb-1">
                                        {displayedBlocks.map((block) => {
                                            const meta = clientTimesheetStatusMeta(block.status);
                                            const isPending = block.status === "PENDING";
                                            return (
                                                // shrink-0 is what makes the scroll actually work. The
                                                // list above is a column flex container, so each card is
                                                // a flex item with the default flex-shrink: 1 — and this
                                                // card's own overflow-hidden drops its automatic minimum
                                                // size to 0. Without shrink-0 the cards therefore squash
                                                // toward zero height to fit the container instead of
                                                // overflowing it, so the content never exceeds the box,
                                                // no scrollbar ever appears, and past ~15 rows the cards
                                                // collapse into unreadable slivers (with 50 the gap-3
                                                // spacing alone fills the viewport).
                                                <div
                                                    key={block.key}
                                                    className="shrink-0 bg-white rounded-xl border border-[#E3E8EF] border-l-4 shadow-sm flex flex-col lg:flex-row lg:items-stretch overflow-hidden"
                                                    style={{ borderLeftColor: meta.borderHex }}
                                                >
                                                    {/* Left: employee, project, week range, status */}
                                                    <div className="flex-1 px-5 py-4 flex flex-col justify-center min-w-[240px] gap-1.5">
                                                        <div className="flex items-baseline gap-2 flex-wrap">
                                                            <span className="text-[14px] font-black text-brand-text tracking-tight">{block.employeeName}</span>
                                                            {/* Kept in the queue so the work stays reviewable, but flagged —
                                                                a disabled employee can still have timesheets awaiting a decision. */}
                                                            {block.employeeActive === false && <DisabledBadge />}
                                                            {block.projectName && (
                                                                <span className="text-[13px] font-normal text-brand-text/40">· {block.projectName}</span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => openDetail(block)}
                                                            className="text-left text-[15px] font-bold text-blue-600 hover:underline w-fit"
                                                        >
                                                            {fmtRange(block.weekStart)} To {fmtRange(block.weekEnd)}
                                                        </button>
                                                        <div>{statusBadge(block.status)}</div>
                                                        {/* Keeps a visible record of why a week was rejected,
                                                            not just that it was. */}
                                                        {block.status === "REJECTED" && block.rejectionReason && (
                                                            <p className="text-[12px] text-[#b91c1c] leading-snug">
                                                                <span className="font-semibold">Reason:</span> {block.rejectionReason}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Middle: hours summary */}
                                                    <div className="flex flex-wrap lg:flex-nowrap items-stretch">
                                                        <SummaryCell value={num(block.billableHours)} label="Billable Hrs" />
                                                        <SummaryCell value={num(block.nonBillableHours)} label="Non-Billable Hrs" />
                                                        <SummaryCell value={num(block.timeOffHours)} label="Time Off/Holiday" />
                                                        <SummaryCell value={num(block.totalHours)} label="Total" />
                                                    </div>

                                                    {/* Right: actions */}
                                                    {/* No view icon: the week's date range above is itself a
                                                        link into the same detail dialog, so the icon was a
                                                        second control for one action. openDetail is unchanged
                                                        and still reached from that link. */}
                                                    <div className="flex items-center justify-center gap-2 px-5 py-4 border-t lg:border-t-0 lg:border-l border-[#E3E8EF] min-w-[140px]">
                                                        {isPending ? (
                                                            <>
                                                                <button
                                                                    onClick={() => setApprovingBlock(block)}
                                                                    disabled={acting}
                                                                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-50"
                                                                    title="Approve week"
                                                                    aria-label="Approve week"
                                                                >
                                                                    <Check size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => { setRejectingBlock(block); setRejectReason(""); }}
                                                                    disabled={acting}
                                                                    className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                                                                    title="Reject week"
                                                                    aria-label="Reject week"
                                                                >
                                                                    <X size={16} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest text-right">
                                                                {block.approvedByName ? block.approvedByName : "—"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Approve confirmation */}
            <ClientTimesheetConfirmModal
                isOpen={approvingBlock != null}
                onClose={() => setApprovingBlock(null)}
                onConfirm={() => handleApproveBlock(approvingBlock)}
                submitting={acting}
                title="Approve Client Timesheet"
                message={approvingBlock
                    ? `Are you sure you want to approve this client timesheet for ${approvingBlock.employeeName} (${fmtRange(approvingBlock.weekStart)} to ${fmtRange(approvingBlock.weekEnd)})? Once approved the employee can no longer edit it.`
                    : ""}
                confirmLabel="Approve"
            />

            {/* Reject confirmation — the last step, shown once a reason has been entered.
                Cancelling returns to the reason dialog underneath with the text still there. */}
            <ClientTimesheetConfirmModal
                isOpen={confirmingReject}
                onClose={() => setConfirmingReject(false)}
                onConfirm={handleRejectConfirm}
                submitting={acting}
                destructive
                title="Reject Client Timesheet"
                message={rejectingBlock
                    ? `Are you sure you want to reject this client timesheet for ${rejectingBlock.employeeName} (${fmtRange(rejectingBlock.weekStart)} to ${fmtRange(rejectingBlock.weekEnd)})? They will be notified and can correct and resubmit it.`
                    : ""}
                confirmLabel="Reject"
            />

            {/* Reject reason modal */}
            {rejectingBlock != null && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
                        <h3 className="text-lg font-bold mb-1 text-brand-text uppercase tracking-tight">Reject Client Timesheet Week</h3>
                        <p className="text-[12px] text-brand-text/50 mb-4">
                            {rejectingBlock.employeeName} · {fmtRange(rejectingBlock.weekStart)} To {fmtRange(rejectingBlock.weekEnd)}
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            maxLength={FIELD_LIMITS.REJECTION_REASON}
                            placeholder="Enter reason for rejection"
                            className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none font-bold text-sm"
                            rows="4"
                        />
                        <div className="mb-4">
                            <CharCounter value={rejectReason} max={FIELD_LIMITS.REJECTION_REASON} />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => { setRejectingBlock(null); setRejectReason(""); }} className="flex-1 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition">Cancel</button>
                            {/* Opens the final confirmation rather than rejecting outright. */}
                            <button onClick={() => setConfirmingReject(true)} disabled={acting || !rejectReason.trim()} title={!rejectReason.trim() ? "Enter a rejection reason first" : undefined} className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">Reject</button>
                        </div>
                    </div>
                </div>
            )}

            <DownloadClientTimesheetModal
                isOpen={isDownloadOpen}
                onClose={() => setIsDownloadOpen(false)}
                employees={employees}
            />

            <AssignEmployeeToClientProjectModal
                open={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                onSaved={() => {
                    fetchEntries();
                }}
            />

            {detailId != null && (
                <ClientTimesheetDetailDrawer
                    timesheetId={detailId}
                    timesheetIds={detailIds}
                    onClose={() => setDetailId(null)}
                    onActioned={fetchEntries}
                />
            )}
        </>
    );
}
