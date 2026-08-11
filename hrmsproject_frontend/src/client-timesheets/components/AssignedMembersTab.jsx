import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Eye, UserMinus, UserPlus, Users, X, Briefcase, Search } from "lucide-react";
import api from "../../utils/api";
import { toast } from "react-toastify";
import DisabledBadge from "../../components/DisabledBadge";
import ClientTimesheetConfirmModal from "./ClientTimesheetConfirmModal";
import { roleLabel } from "../../utils/roleLabel";

/* ─── helpers ─────────────────────────────────────────── */
const fmtDate = (d) => {
    if (!d) return "—";
    const dt = new Date(String(d).split("T")[0]);
    return isNaN(dt) ? "—" : dt.toLocaleDateString("en-GB");
};

// createdAt is a timestamp, not a plain date — keep the time, it is an audit value.
const fmtDateTime = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    return isNaN(dt) ? "—" : `${dt.toLocaleDateString("en-GB")} ${dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

/**
 * "Removed", not the old "Ended": the badge now reports a deliberate admin action that also
 * took the employee's Client Timesheet access away, and it reads next to a Re-add button that
 * puts both back. Slate rather than amber, so it reads as switched-off rather than as a
 * warning about something still in progress.
 */
/**
 * Why a removal was refused. Counts weeks, not day rows — a normal five-day week is one
 * timesheet to the admin who reviews it, and "5 timesheets pending" for a single week would
 * send them looking for four that do not exist. The week starts are named so the card is
 * findable in the queue.
 */
function blockedMessage({ employeeName, projectName, blockingCount, blockingWeekStarts }) {
    const n = blockingCount || 0;
    const weeks = (blockingWeekStarts || []).map(fmtDate).join(", ");
    return `Can't remove ${employeeName} from ${projectName || "this project"} — they have `
        + `${n} timesheet${n === 1 ? "" : "s"} still open`
        + (weeks ? ` (week${n === 1 ? "" : "s"} starting ${weeks})` : "")
        + `. ${n === 1 ? "It is" : "They are"} either pending approval or rejected and not yet `
        + `resubmitted. Please see ${n === 1 ? "it" : "them"} through to approved, then remove them.`;
}

/** Client-timesheet verification state, as the Access Management tab showed it. */
function VerificationBadge({ verified }) {
    return verified ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap" style={{ backgroundColor: "#DCFCE7", color: "#16A34A" }}>
            ✅ Verified
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap" style={{ backgroundColor: "#FEF9C3", color: "#B45309" }}>
            ⏳ Pending
        </span>
    );
}

function StatusPill({ active }) {
    return active ? (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-600 border-emerald-100">
            Active
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-slate-100 text-slate-500 border-slate-200">
            Removed
        </span>
    );
}

/* ─── Detail Modal ────────────────────────────────────── */
/**
 * Centered dialog (not a right-edge drawer) so it matches the other detail and
 * confirmation dialogs in this module. Content is unchanged — position only.
 */
function AssignmentDetailModal({ assignment, onClose }) {
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    if (!assignment) return null;

    const Field = ({ label, value }) => (
        <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-brand-text/35">{label}</span>
            <span className="text-sm font-bold text-brand-text">{(value && value !== "DFLT") ? value : "—"}</span>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="assignment-detail-title"
                className="relative z-10 w-full max-w-lg max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-brand-blue/5 bg-brand-blue/[0.02] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue-dark">
                            <Briefcase size={18} />
                        </div>
                        <div>
                            <p id="assignment-detail-title" className="text-base font-black text-brand-text tracking-tight">Assignment Detail</p>
                            <p className="text-[9px] font-bold text-brand-text/35 uppercase tracking-[0.18em]">
                                {assignment.active ? "Active" : "Removed"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-text/40 hover:bg-bg-slate hover:text-brand-text transition-all"
                        aria-label="Close dialog"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <Field
                            label="Employee"
                            value={
                                <>
                                    {assignment.employeeName}
                                    {/* Assignment history is kept for a disabled account; the badge
                                        explains why they can't be picked for a new project. */}
                                    {assignment.employeeActive === false && <DisabledBadge className="ml-2 align-middle" />}
                                </>
                            }
                        />
                        <Field label="Status" value={assignment.active ? "Active" : "Removed"} />
                        <Field label="Client" value={assignment.clientName} />
                        <Field label="Project Name" value={assignment.projectName} />
                        <Field label="Project ID" value={assignment.projectId} />
                        <Field label="Task ID" value={assignment.taskId} />
                        <Field label="Assigned Date" value={fmtDate(assignment.assignmentStartDate)} />
                        <Field label="Billing" value={assignment.clientBillable} />
                        <Field label="Onsite / Offshore" value={assignment.onsiteOffshore} />
                        <Field label="Billing Location" value={assignment.billingLocation} />
                        {/* Audit trail — who staffed this project and when the record was created,
                            as distinct from the assignment's own start date above. */}
                        <Field label="Assigned By" value={assignment.assignedByName} />
                        <Field label="Created On" value={fmtDateTime(assignment.createdAt)} />
                    </div>

                    {assignment.taskDescription && (
                        <div className="flex flex-col gap-1 pt-2">
                            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-brand-text/35">Task Description</span>
                            <p className="text-sm font-medium text-brand-text/80 whitespace-pre-wrap leading-relaxed">{assignment.taskDescription}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Main Tab Component ──────────────────────────────── */
/**
 * `onReviewPending` — optional; switches the page to the Timesheets tab with its status filter
 * set to Pending Approval, so a blocked removal can be resolved without hunting for the week.
 * Optional because the tab is also mounted on its own in tests and harnesses.
 */
export default function AssignedMembersTab({ onReviewPending }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [detailRow, setDetailRow] = useState(null);
    // employeeId → EmployeeDTO, for the Employee ID / Role / Verification columns.
    const [employeeById, setEmployeeById] = useState(new Map());
    // ALL | ACTIVE | REMOVED. Removed assignments stay in the list as the record of who was on
    // what, so the filter is what keeps the list readable once they accumulate.
    const [statusFilter, setStatusFilter] = useState("ALL");
    // The row whose remove/re-add is awaiting confirmation: { row, action }. Both go through
    // the module's own confirm dialog rather than window.confirm — removing revokes a person's
    // access, which is not a decision to take on a browser-chrome prompt.
    const [pendingAction, setPendingAction] = useState(null);
    const [actingId, setActingId] = useState(null);
    // A removal the server refused because the employee still has weeks in flight — pending
    // approval, or rejected and not yet resubmitted:
    // { employeeName, projectName, blockingCount, blockingWeekStarts }. Shown instead of the
    // confirmation dialog — there is nothing to confirm.
    const [blockedRemoval, setBlockedRemoval] = useState(null);
    // Set while the pre-check is in flight, so the Remove button can't be double-fired.
    const [checkingId, setCheckingId] = useState(null);
    const firstLoad = useRef(true);

    const fetchRows = useCallback(async () => {
        try {
            if (firstLoad.current) setLoading(true);
            const res = await api("/api/client-project-assignments");
            if (res.ok) {
                const json = await res.json().catch(() => []);
                const data = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
                setRows(data);
            }
        } catch (err) {
            console.error("Error fetching assignments:", err);
        } finally {
            setLoading(false);
            firstLoad.current = false;
        }
    }, []);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    /**
     * The employee-level facts this table absorbed from the Access Management tab — HRMS
     * employee ID, role and client-verification state — keyed by employee id.
     *
     * Read from /api/employees, NOT the assigned-employees endpoint the old tab used. That one
     * lists only employees whose client access is currently on, and removing an assignment
     * turns that off, so every Removed row would have shown three blank cells — and Removed
     * rows are precisely what this table exists to keep. /api/employees carries all three
     * fields for everyone, assigned or not.
     */
    useEffect(() => {
        (async () => {
            try {
                const res = await api("/api/employees");
                if (!res.ok) return;
                const json = await res.json().catch(() => ({}));
                const list = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
                setEmployeeById(new Map(list.map((e) => [e.id, e])));
            } catch (err) {
                // Non-fatal: the three joined columns fall back to "—" and every existing
                // column, and every action, still works.
                console.error("Error fetching employees for the assigned-members join:", err);
            }
        })();
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (statusFilter === "ACTIVE" && !r.active) return false;
            if (statusFilter === "REMOVED" && r.active) return false;
            if (q) {
                return (
                    (r.employeeName || "").toLowerCase().includes(q) ||
                    (r.projectName || "").toLowerCase().includes(q) ||
                    (r.clientName || "").toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [rows, search, statusFilter]);

    /**
     * Remove asks first. An employee cannot be taken off a project while one of their weeks is
     * still sitting in the approval queue — that week would be stranded, awaiting a decision
     * for a project nobody is on. Checking before the dialog opens means the admin is told why
     * instead of confirming a removal that is then refused.
     *
     * Re-add has no such gate and goes straight to its confirmation.
     */
    const startRemoval = async (row) => {
        setCheckingId(row.id);
        try {
            const res = await api(`/api/client-project-assignments/${row.id}/removal-eligibility`);
            const body = await res.json().catch(() => ({}));
            const info = body.data || {};
            if (res.ok && info.removable === false) {
                setBlockedRemoval({
                    employeeName: info.employeeName || row.employeeName,
                    projectName: info.projectName || row.projectName,
                    blockingCount: info.blockingCount || 0,
                    blockingWeekStarts: info.blockingWeekStarts || [],
                });
                return;
            }
            // Eligible, or the check itself failed. A failed check must not stop the admin:
            // deactivate re-runs the same rule and refuses there if it has to.
            setPendingAction({ row, action: "remove" });
        } catch (err) {
            console.error(err);
            setPendingAction({ row, action: "remove" });
        } finally {
            setCheckingId(null);
        }
    };

    /**
     * Remove and re-add share this: same endpoint shape, same refresh, and the server owns the
     * message — it is the side that knows access was revoked or that an OTP went out, so
     * echoing its text keeps the toast truthful if those rules ever change.
     */
    const runAction = async () => {
        if (!pendingAction) return;
        const { row, action } = pendingAction;
        const endpoint = action === "remove" ? "deactivate" : "reactivate";
        setActingId(row.id);
        try {
            const res = await api(`/api/client-project-assignments/${row.id}/${endpoint}`, { method: "PATCH" });
            const body = await res.json().catch(() => ({}));
            if (res.ok) {
                toast.success(body.message || (action === "remove"
                    ? `${row.employeeName} removed from ${row.projectName}.`
                    : `${row.employeeName} re-added to ${row.projectName}.`));
                setPendingAction(null);
                fetchRows();
            } else {
                // The re-add path can legitimately fail — the employee may have been disabled
                // in HRMS or picked up another project since. Surface the server's reason.
                toast.error(body.message || `Could not ${action === "remove" ? "remove" : "re-add"} ${row.employeeName}.`);
            }
        } catch (err) {
            console.error(err);
            toast.error(`Could not ${action === "remove" ? "remove" : "re-add"} ${row.employeeName}.`);
        } finally {
            setActingId(null);
        }
    };

    const confirmCopy = () => {
        if (!pendingAction) return { title: "", message: "", confirmLabel: "", destructive: false };
        const { row, action } = pendingAction;
        const project = row.projectName || "this project";
        return action === "remove"
            ? {
                title: "Remove from project",
                // Spells out the consequence that is not visible in the row: this is an access
                // change, not just a status change. And the reassurance that it is reversible
                // and non-destructive, which is what stops an admin hesitating over it.
                message: `Are you sure you want to remove ${row.employeeName} from ${project}? `
                    + `Their Client Timesheet access is revoked immediately and they will not be able to enter new time. `
                    + `Timesheets they have already submitted are kept, and you can re-add them later.`,
                confirmLabel: "Remove",
                destructive: true,
            }
            : {
                title: "Re-add to project",
                message: `Re-add ${row.employeeName} to ${project}? `
                    + `Client Timesheet access is restored and a fresh verification OTP is sent to their corporate email.`,
                confirmLabel: "Re-add",
                destructive: false,
            };
    };

    /* ── render ── */
    const selectCls =
        "bg-white border border-[#E3E8EF] focus:border-brand-yellow rounded-xl px-4 py-2.5 text-xs font-bold text-brand-text outline-none transition-all";

    return (
        // flex-1/min-h-0 so the card below is bounded by the panel's height rather than growing
        // to fit every row. That is what keeps the table's own horizontal scrollbar on screen:
        // an unbounded container puts it below the last row, reachable only after scrolling the
        // whole list down.
        <div className="flex flex-col gap-4 flex-1 min-h-0">
            {/* Filter row */}
            <div className="flex flex-wrap items-center justify-end gap-3 w-full shrink-0">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={`${selectCls} ml-auto`}
                    aria-label="Filter by assignment status"
                >
                    <option value="ALL">All</option>
                    <option value="ACTIVE">Active only</option>
                    <option value="REMOVED">Removed only</option>
                </select>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text/30" size={15} />
                    <input
                        type="text"
                        placeholder="Search by name, project or client..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white border border-[#E3E8EF] focus:border-brand-yellow rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold text-brand-text outline-none transition-all"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[24px] shadow-2xl shadow-brand-blue/5 border border-brand-blue/5 overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                    {/* px-3, not the px-6 this table used with seven columns: ten columns at 48px
                        of horizontal padding each would not fit a standard window, and the point
                        of merging the two tabs is one table you can read without dragging it
                        sideways. min-w is the floor at which every cell still fits its content —
                        overflow-x-auto below that rather than truncating anything. */}
                    <table className="w-full text-left border-collapse min-w-[1100px]">
                        <thead className="sticky top-0 z-10 bg-white">
                            <tr className="bg-brand-blue/[0.02]">
                                <th className="py-3 px-3 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5 whitespace-nowrap">Employee ID</th>
                                <th className="py-3 px-3 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Employee Name</th>
                                <th className="py-3 px-3 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Role</th>
                                <th className="py-3 px-3 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Project Name</th>
                                <th className="py-3 px-3 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Project ID</th>
                                <th className="py-3 px-3 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Client</th>
                                <th className="py-3 px-3 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5 whitespace-nowrap">Assigned Date</th>
                                <th className="py-3 px-3 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5 text-center">Verification</th>
                                <th className="py-3 px-3 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5 text-center">Status</th>
                                <th className="py-3 px-3 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5 text-right">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-brand-blue/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="py-20 text-center text-brand-text/30 font-bold uppercase tracking-widest text-xs animate-pulse">
                                        Loading assignments…
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-16 text-center">
                                        <Users className="mx-auto mb-3 text-brand-text/20" size={40} />
                                        <p className="text-base font-bold text-brand-text">No assignments found.</p>
                                        <p className="text-sm text-brand-text/40 mt-1">
                                            Use{" "}
                                            <span className="font-black text-brand-blue-dark">
                                                "Assign Employees to Client Project"
                                            </span>{" "}
                                            on the main dashboard to get started.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((r) => {
                                    // The employee behind this assignment, for the three columns
                                    // carried over from Access Management. Absent only while the
                                    // employee list is still loading, or if that request failed.
                                    const emp = employeeById.get(r.employeeId);
                                    return (
                                    <tr
                                        key={r.id}
                                        onClick={() => setDetailRow(r)}
                                        className="group hover:bg-bg-slate/40 transition-all cursor-pointer"
                                    >
                                        {/* The HRMS employee ID, not a row index — it identifies the
                                            person and stays the same however the list is filtered.
                                            Falls back to a dash rather than the internal database
                                            key, which would mean nothing to the admin. */}
                                        <td className="py-3 px-3">
                                            <span className="text-[12px] font-bold text-brand-text/70 tabular-nums whitespace-nowrap">{emp?.oryfolksId || "—"}</span>
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className="inline-flex items-center gap-2">
                                                <span className="text-sm font-black text-brand-text tracking-tight">{r.employeeName}</span>
                                                {/* Assignment history is kept for a disabled account; the badge
                                                    explains why they can't be picked for a new project. */}
                                                {r.employeeActive === false && <DisabledBadge />}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className="text-[12px] font-bold text-brand-text/70 whitespace-nowrap">{emp ? roleLabel(emp.role) : "—"}</span>
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className="text-sm font-bold text-brand-text">{r.projectName || "—"}</span>
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className="text-[12px] font-bold text-brand-text/60 font-mono">{r.projectId || "—"}</span>
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className="text-[12px] font-bold text-brand-text/70">{r.clientName || "—"}</span>
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className="text-[12px] font-bold text-brand-text/70 whitespace-nowrap">{fmtDate(r.assignmentStartDate)}</span>
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <VerificationBadge verified={Boolean(emp?.clientVerified)} />
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <StatusPill active={r.active} />
                                        </td>
                                        {/* Remove and Re-add are mutually exclusive — an assignment
                                            is either on or off, so the row shows the one action its
                                            state allows rather than a disabled pair. */}
                                        <td className="py-3 px-6 text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                {/* View details */}
                                                <button
                                                    id={`am-view-${r.id}`}
                                                    onClick={(ev) => { ev.stopPropagation(); setDetailRow(r); }}
                                                    className="p-2 bg-brand-blue/5 text-brand-blue-dark rounded-lg hover:bg-brand-blue-dark hover:text-white transition-all"
                                                    title="View details"
                                                    aria-label="View assignment details"
                                                >
                                                    <Eye size={16} />
                                                </button>

                                                {r.active ? (
                                                    <button
                                                        id={`am-remove-${r.id}`}
                                                        onClick={(ev) => { ev.stopPropagation(); startRemoval(r); }}
                                                        disabled={actingId === r.id || checkingId === r.id}
                                                        className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                                        title="Remove from project (revokes Client Timesheet access)"
                                                        aria-label={`Remove ${r.employeeName} from ${r.projectName || "project"}`}
                                                    >
                                                        {(actingId === r.id || checkingId === r.id)
                                                            ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                                                            : <UserMinus size={16} />
                                                        }
                                                    </button>
                                                ) : (
                                                    <button
                                                        id={`am-readd-${r.id}`}
                                                        onClick={(ev) => { ev.stopPropagation(); setPendingAction({ row: r, action: "readd" }); }}
                                                        disabled={actingId === r.id || r.employeeActive === false}
                                                        className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                                        title={r.employeeActive === false
                                                            ? "This employee is disabled in HRMS and cannot be re-added"
                                                            : "Re-add to project (restores Client Timesheet access)"}
                                                        aria-label={`Re-add ${r.employeeName} to ${r.projectName || "project"}`}
                                                    >
                                                        {actingId === r.id
                                                            ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                                                            : <UserPlus size={16} />
                                                        }
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail modal */}
            {detailRow && (
                <AssignmentDetailModal
                    assignment={detailRow}
                    onClose={() => setDetailRow(null)}
                />
            )}

            {/* Remove / re-add confirmation — the module's own dialog, same one the approve
                and reject decisions use. */}
            <ClientTimesheetConfirmModal
                isOpen={!!pendingAction}
                onClose={() => setPendingAction(null)}
                onConfirm={runAction}
                submitting={actingId != null}
                {...confirmCopy()}
            />

            {/* Blocked removal. Not a confirmation — there is no version of this the admin can
                say yes to, so the primary button leads to the fix rather than to the action. */}
            <ClientTimesheetConfirmModal
                isOpen={!!blockedRemoval}
                onClose={() => setBlockedRemoval(null)}
                onConfirm={() => {
                    setBlockedRemoval(null);
                    if (onReviewPending) onReviewPending();
                }}
                title="Can't remove yet"
                message={blockedRemoval ? blockedMessage(blockedRemoval) : ""}
                confirmLabel={onReviewPending ? "Review pending timesheets" : "OK"}
            />
        </div>
    );
}
