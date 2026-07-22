import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import DownloadClientTimesheetModal from "../components/DownloadClientTimesheetModal";
import ClientTimesheetDetailDrawer from "../components/ClientTimesheetDetailDrawer";
import AccessManagementTab from "../components/AccessManagementTab";
import AssignedMembersTab from "../components/AssignedMembersTab";
import api from "../../utils/api";
import { toast } from "react-toastify";
import { Download, Check, X, Eye } from "lucide-react";
import { clientTimesheetStatusMeta } from "../../utils/clientTimesheetStatus";

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

export default function ClientTimesheets() {
    const location = useLocation();
    // Page tab: "timesheets" (approval queue) | "assigned" (assigned members) | "access" (access management).
    const [pageTab, setPageTab] = useState(location.state?.tab === "access" ? "access" : location.state?.tab === "assigned" ? "assigned" : "timesheets");
    const [entries, setEntries] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);

    // Queue filters (applied at the block level)
    const [projectFilter, setProjectFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    // Reject flow — holds the week block being rejected (all its day IDs).
    const [rejectingBlock, setRejectingBlock] = useState(null);
    const [rejectReason, setRejectReason] = useState("");
    const [acting, setActing] = useState(false);

    // Detail drawer (opened with any day ID from the block — the drawer loads the whole week).
    const [detailId, setDetailId] = useState(null);

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
        });
        return Array.from(map.values())
            .map((b) => ({ ...b, status: resolveWeekStatus(b.statuses) }))
            .sort((a, b) =>
                a.weekStart < b.weekStart ? 1
                    : a.weekStart > b.weekStart ? -1
                        : (a.employeeName || "").localeCompare(b.employeeName || "")
            );
    }, [entries]);

    // Distinct project names for the filter dropdown.
    const projectOptions = useMemo(
        () => Array.from(new Set(entries.map((e) => e.projectName).filter(Boolean))).sort(),
        [entries]
    );

    // Block-level filtering by project + resolved status.
    const displayedBlocks = useMemo(
        () => blocks.filter((b) =>
            (!projectFilter || (b.projectName || "") === projectFilter) &&
            (!statusFilter || b.status === statusFilter)
        ),
        [blocks, projectFilter, statusFilter]
    );

    // Approve every day in the week block, then refresh.
    const handleApproveBlock = async (block) => {
        if (acting) return;
        try {
            setActing(true);
            await Promise.all(
                block.timesheetIds.map((id) =>
                    api(`/api/client-timesheets/${id}/approve`, {
                        method: "POST",
                        body: JSON.stringify({ reviewerId: currentUserId }),
                    })
                )
            );
            toast.success("Week approved.");
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
            await Promise.all(
                rejectingBlock.timesheetIds.map((id) =>
                    api(`/api/client-timesheets/${id}/reject`, {
                        method: "POST",
                        body: JSON.stringify({ reviewerId: currentUserId, reason: rejectReason }),
                    })
                )
            );
            toast.success("Week rejected.");
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
                    <header className="bg-white pt-4 px-4 md:px-6 shadow-sm z-10 border-b border-[#E3E8EF] w-full">
                        <div>
                            <h1 className="text-xl font-black text-brand-text tracking-tight">Client timesheets</h1>
                            <p className="text-[9px] font-black text-brand-text/40 uppercase tracking-[0.2em] mt-0.5">Approvals and Export</p>
                        </div>
                        {/* Tabs */}
                        <div className="flex gap-1 mt-4">
                            {[
                                { id: "timesheets", label: "Timesheets" },
                                { id: "assigned", label: "Assigned Members" },
                                { id: "access", label: "Access Management" },
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
                    </header>

                    {pageTab === "access" ? (
                        <div className="flex-1 p-4 overflow-y-auto">
                            <AccessManagementTab />
                        </div>
                    ) : pageTab === "assigned" ? (
                        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
                            <AssignedMembersTab />
                        </div>
                    ) : (
                        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
                            {/* Filters */}
                            <div className="flex flex-wrap gap-3">
                                <select
                                    value={projectFilter}
                                    onChange={(e) => setProjectFilter(e.target.value)}
                                    className="bg-white border border-[#E3E8EF] focus:border-brand-yellow rounded-xl px-4 py-2.5 text-xs font-bold text-brand-text outline-none transition-all"
                                >
                                    <option value="">All projects</option>
                                    {projectOptions.map((p) => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="bg-white border border-[#E3E8EF] focus:border-brand-yellow rounded-xl px-4 py-2.5 text-xs font-bold text-brand-text outline-none transition-all"
                                >
                                    <option value="">All statuses</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="APPROVED">Approved</option>
                                    <option value="REJECTED">Rejected</option>
                                </select>

                                <div className="flex flex-row gap-12 justify-end ml-auto">
                                    <button
                                        onClick={() => setIsDownloadOpen(true)}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-brand-blue-dark text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:shadow-xl active:scale-95 transition-all"
                                    >
                                        <Download size={16} />
                                        Download
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
                                    <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1">
                                        {displayedBlocks.map((block) => {
                                            const meta = clientTimesheetStatusMeta(block.status);
                                            const isPending = block.status === "PENDING";
                                            return (
                                                <div
                                                    key={block.key}
                                                    className="bg-white rounded-xl border border-[#E3E8EF] border-l-4 shadow-sm flex flex-col lg:flex-row lg:items-stretch overflow-hidden"
                                                    style={{ borderLeftColor: meta.borderHex }}
                                                >
                                                    {/* Left: employee, project, week range, status */}
                                                    <div className="flex-1 px-5 py-4 flex flex-col justify-center min-w-[240px] gap-1.5">
                                                        <div className="flex items-baseline gap-2 flex-wrap">
                                                            <span className="text-[14px] font-black text-brand-text tracking-tight">{block.employeeName}</span>
                                                            {block.projectName && (
                                                                <span className="text-[13px] font-normal text-brand-text/40">· {block.projectName}</span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => setDetailId(block.timesheetIds[0])}
                                                            className="text-left text-[15px] font-bold text-blue-600 hover:underline w-fit"
                                                        >
                                                            {fmtRange(block.weekStart)} To {fmtRange(block.weekEnd)}
                                                        </button>
                                                        <div>{statusBadge(block.status)}</div>
                                                    </div>

                                                    {/* Middle: hours summary */}
                                                    <div className="flex flex-wrap lg:flex-nowrap items-stretch">
                                                        <SummaryCell value={num(block.billableHours)} label="Billable Hrs" />
                                                        <SummaryCell value={num(block.nonBillableHours)} label="Non-Billable Hrs" />
                                                        <SummaryCell value={num(block.timeOffHours)} label="Time Off/Holiday" />
                                                        <SummaryCell value={num(block.totalHours)} label="Total" />
                                                    </div>

                                                    {/* Right: actions */}
                                                    <div className="flex items-center justify-end gap-2 px-5 py-4 border-t lg:border-t-0 lg:border-l border-[#E3E8EF] min-w-[140px]">
                                                        <button
                                                            onClick={() => setDetailId(block.timesheetIds[0])}
                                                            className="p-2 bg-brand-blue/5 text-brand-blue-dark rounded-lg hover:bg-brand-blue-dark hover:text-white transition-all"
                                                            title="View details"
                                                            aria-label="View details"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                        {isPending ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleApproveBlock(block)}
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
                            maxLength={255}
                            placeholder="Enter reason for rejection"
                            className="w-full p-3 border border-slate-200 rounded-lg mb-4 focus:ring-2 focus:ring-red-500 outline-none font-bold text-sm"
                            rows="4"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { setRejectingBlock(null); setRejectReason(""); }} className="flex-1 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition">Cancel</button>
                            <button onClick={handleRejectConfirm} disabled={acting} className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition shadow-lg disabled:opacity-50">Reject</button>
                        </div>
                    </div>
                </div>
            )}

            <DownloadClientTimesheetModal
                isOpen={isDownloadOpen}
                onClose={() => setIsDownloadOpen(false)}
                employees={employees}
            />

            {detailId != null && (
                <ClientTimesheetDetailDrawer
                    timesheetId={detailId}
                    onClose={() => setDetailId(null)}
                    onActioned={fetchEntries}
                />
            )}
        </>
    );
}
