import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Eye, Trash2, Users, X, Briefcase } from "lucide-react";
import api from "../../utils/api";
import { toast } from "react-toastify";

/* ─── helpers ─────────────────────────────────────────── */
const fmtDate = (d) => {
    if (!d) return "—";
    const dt = new Date(String(d).split("T")[0]);
    return isNaN(dt) ? "—" : dt.toLocaleDateString("en-GB");
};

function StatusPill({ active }) {
    return active ? (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-600 border-emerald-100">
            Active
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-100">
            Ended
        </span>
    );
}

/* ─── Detail Drawer ───────────────────────────────────── */
function AssignmentDetailDrawer({ assignment, onClose }) {
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
        <>
            <div
                className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[180]"
                onClick={onClose}
            />
            <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-[190] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-brand-blue/5 bg-brand-blue/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue-dark">
                            <Briefcase size={18} />
                        </div>
                        <div>
                            <p className="text-base font-black text-brand-text tracking-tight">Assignment Detail</p>
                            <p className="text-[9px] font-bold text-brand-text/35 uppercase tracking-[0.18em]">
                                {assignment.active ? "Active" : "Ended"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-text/40 hover:bg-bg-slate hover:text-brand-text transition-all"
                        aria-label="Close drawer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <Field label="Employee" value={assignment.employeeName} />
                        <Field label="Status" value={assignment.active ? "Active" : "Ended"} />
                        <Field label="Client" value={assignment.clientName} />
                        <Field label="Project Name" value={assignment.projectName} />
                        <Field label="Project ID" value={assignment.projectId} />
                        <Field label="Task ID" value={assignment.taskId} />
                        <Field label="Assigned Date" value={fmtDate(assignment.assignmentStartDate)} />
                        <Field label="Billing" value={assignment.clientBillable} />
                        <Field label="Onsite / Offshore" value={assignment.onsiteOffshore} />
                        <Field label="Billing Location" value={assignment.billingLocation} />
                    </div>

                    {assignment.taskDescription && (
                        <div className="flex flex-col gap-1 pt-2">
                            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-brand-text/35">Task Description</span>
                            <p className="text-sm font-medium text-brand-text/80 whitespace-pre-wrap leading-relaxed">{assignment.taskDescription}</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

/* ─── Main Tab Component ──────────────────────────────── */
export default function AssignedMembersTab() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [clientFilter, setClientFilter] = useState("");
    const [employeeFilter, setEmployeeFilter] = useState("");
    const [detailRow, setDetailRow] = useState(null);
    const [removingId, setRemovingId] = useState(null);
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

    /* derived filter option lists */
    const clients = useMemo(
        () => Array.from(new Set(rows.map((r) => r.clientName).filter(Boolean))).sort(),
        [rows]
    );
    const employees = useMemo(
        () => Array.from(new Set(rows.map((r) => r.employeeName).filter(Boolean))).sort(),
        [rows]
    );

    const filtered = useMemo(() => {
        return rows.filter((r) => {
            if (clientFilter && r.clientName !== clientFilter) return false;
            if (employeeFilter && r.employeeName !== employeeFilter) return false;
            return true;
        });
    }, [rows, clientFilter, employeeFilter]);

    /* Remove / deactivate */
    const handleRemove = async (row) => {
        if (!window.confirm(`End assignment for ${row.employeeName} on "${row.projectName}"?`)) return;
        setRemovingId(row.id);
        try {
            const res = await api(`/api/client-project-assignments/${row.id}/deactivate`, { method: "PATCH" });
            if (res.ok) {
                toast.success(`Assignment ended for ${row.employeeName}.`);
                fetchRows();
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error(err.message || "Could not end assignment.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Could not end assignment.");
        } finally {
            setRemovingId(null);
        }
    };

    /* ── render ── */
    const selectCls =
        "bg-white border border-[#E3E8EF] focus:border-brand-yellow rounded-xl px-4 py-2.5 text-xs font-bold text-brand-text outline-none transition-all";

    return (
        <div className="flex flex-col gap-4">
            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-3">
                <select
                    id="am-client-filter"
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    className={selectCls}
                >
                    <option value="">All Clients</option>
                    {clients.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>

                <select
                    id="am-employee-filter"
                    value={employeeFilter}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                    className={selectCls}
                >
                    <option value="">All Employees</option>
                    {employees.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[24px] shadow-2xl shadow-brand-blue/5 border border-brand-blue/5 overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="overflow-x-auto overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[860px]">
                        <thead className="sticky top-0 z-10 bg-white">
                            <tr className="bg-brand-blue/[0.02]">
                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Employee</th>
                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Project Name</th>
                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Project ID</th>
                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Client</th>
                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Assigned Date</th>
                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5 text-center">Status</th>
                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5 text-right">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-brand-blue/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center text-brand-text/30 font-bold uppercase tracking-widest text-xs animate-pulse">
                                        Loading assignments…
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center">
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
                                filtered.map((r) => (
                                    <tr
                                        key={r.id}
                                        onClick={() => setDetailRow(r)}
                                        className="group hover:bg-bg-slate/40 transition-all cursor-pointer"
                                    >
                                        <td className="py-3 px-6">
                                            <span className="text-sm font-black text-brand-text tracking-tight">{r.employeeName}</span>
                                        </td>
                                        <td className="py-3 px-6">
                                            <span className="text-sm font-bold text-brand-text">{r.projectName || "—"}</span>
                                        </td>
                                        <td className="py-3 px-6">
                                            <span className="text-[12px] font-bold text-brand-text/60 font-mono">{r.projectId || "—"}</span>
                                        </td>
                                        <td className="py-3 px-6">
                                            <span className="text-[12px] font-bold text-brand-text/70">{r.clientName || "—"}</span>
                                        </td>
                                        <td className="py-3 px-6">
                                            <span className="text-[12px] font-bold text-brand-text/70">{fmtDate(r.assignmentStartDate)}</span>
                                        </td>
                                        <td className="py-3 px-6 text-center">
                                            <StatusPill active={r.active} />
                                        </td>
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

                                                {/* Remove — only shown for active assignments */}
                                                {r.active && (
                                                    <button
                                                        id={`am-remove-${r.id}`}
                                                        onClick={(ev) => { ev.stopPropagation(); handleRemove(r); }}
                                                        disabled={removingId === r.id}
                                                        className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                                        title="End assignment"
                                                        aria-label="End assignment"
                                                    >
                                                        {removingId === r.id
                                                            ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                                                            : <Trash2 size={16} />
                                                        }
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail drawer */}
            {detailRow && (
                <AssignmentDetailDrawer
                    assignment={detailRow}
                    onClose={() => setDetailRow(null)}
                />
            )}
        </div>
    );
}
