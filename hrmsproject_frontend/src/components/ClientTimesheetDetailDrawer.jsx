import { useState, useEffect, useMemo } from "react";
import { X, Check, MessageSquare } from "lucide-react";
import api from "../utils/api";
import { toast } from "react-toastify";

const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const TIMEOFF_LABELS = { SICK: "Paid Sick Leave", HOLIDAY: "Holiday (Public/National)", PTO: "Paid Time Off", LOP: "Unpaid Leave (LOP)", EARNED: "Leave (Earned)" };
const TIMEOFF_ORDER = ["SICK", "HOLIDAY", "PTO", "LOP", "EARNED"];

const parseLocal = (ymd) => { const [y, m, d] = String(ymd).split("T")[0].split("-").map(Number); return new Date(y, m - 1, d); };
const fmtRange = (ymd) => { if (!ymd) return ""; const [y, m, d] = String(ymd).split("T")[0].split("-").map(Number); return `${String(d).padStart(2, "0")}-${MON[m - 1]}-${y}`; };
const fmtSubmitted = (v) => { if (!v) return "—"; const d = new Date(v); return isNaN(d) ? String(v).split("T")[0] : d.toLocaleDateString("en-GB"); };
const billableLabel = (v) => (v === "NON_BILLABLE" ? "Non-Billable" : v === "BILLABLE" ? "Billable" : v || "—");
const onsiteLabel = (v) => (v === "OFFSHORE" ? "Offshore" : v === "ONSITE" ? "Onsite" : v || "—");
const hourCell = (h) => (h && Number(h) > 0 ? Number(h) : "");

function StatusPill({ status }) {
    const s = (status || "").toUpperCase();
    const cls = s === "APPROVED" ? "bg-emerald-50 text-emerald-600 border-emerald-100"
        : s === "REJECTED" ? "bg-red-50 text-red-600 border-red-100"
            : "bg-brand-yellow/10 text-brand-yellow-dark border-brand-yellow/20";
    return <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${cls}`}>{s || "—"}</span>;
}

export default function ClientTimesheetDetailDrawer({ timesheetId, onClose, onActioned }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState("");
    const [acting, setActing] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState("");

    const currentUserId = useMemo(() => { const u = JSON.parse(localStorage.getItem("user")) || {}; return u.id || u.userId; }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const res = await api(`/api/admin/client-timesheets/${timesheetId}`);
                if (res.ok) {
                    const json = await res.json().catch(() => ({}));
                    if (!cancelled && json.data) { setDetail(json.data); setStatus((json.data.status || "").toUpperCase()); }
                } else {
                    toast.error("Could not load timesheet detail.");
                }
            } catch (err) { console.error(err); } finally { if (!cancelled) setLoading(false); }
        })();
        return () => { cancelled = true; };
    }, [timesheetId]);

    const days = useMemo(() => {
        if (!detail?.weekStartDate) return [];
        const start = parseLocal(detail.weekStartDate);
        return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return { dom: d.getDate(), wd: WD[d.getDay()] }; });
    }, [detail]);

    const handleApprove = async () => {
        setActing(true);
        try {
            const res = await api(`/api/client-timesheets/${timesheetId}/approve`, { method: "POST", body: JSON.stringify({ reviewerId: currentUserId }) });
            if (res.ok) { toast.success("Client timesheet approved."); setStatus("APPROVED"); onActioned && onActioned(); }
            else toast.error("Could not approve.");
        } catch (err) { console.error(err); } finally { setActing(false); }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) return toast.warning("Please provide a reason.");
        setActing(true);
        try {
            const res = await api(`/api/client-timesheets/${timesheetId}/reject`, { method: "POST", body: JSON.stringify({ reviewerId: currentUserId, reason: rejectReason }) });
            if (res.ok) { toast.success("Client timesheet rejected."); setStatus("REJECTED"); setRejecting(false); setRejectReason(""); onActioned && onActioned(); }
            else toast.error("Could not reject.");
        } catch (err) { console.error(err); } finally { setActing(false); }
    };

    const projectRows = detail?.projectRows || [];
    const timeOffRows = TIMEOFF_ORDER.map((type) => (detail?.timeOffRows || []).find((t) => (t.type || "").toUpperCase() === type) || { type, days: [] });
    const dayHours = (row) => days.map((_, i) => (row.days && row.days[i] ? Number(row.days[i].hours) || 0 : 0));
    const rowTotal = (row) => dayHours(row).reduce((s, h) => s + h, 0);

    return (
        <div className="fixed inset-0 z-[300] flex">
            <div className="flex-1 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
            <aside className="w-full max-w-[880px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="p-5 border-b border-[#E3E8EF] flex items-center justify-between bg-bg-slate/30">
                    <div>
                        <h2 className="text-lg font-black text-brand-text tracking-tight">Client Timesheet Detail</h2>
                        <p className="text-[9px] font-black text-brand-text/40 uppercase tracking-[0.2em] mt-0.5">Read-only</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-brand-blue/5 rounded-xl transition-all" aria-label="Close"><X size={20} /></button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center text-brand-text/30 font-bold uppercase tracking-widest text-xs animate-pulse">Loading...</div>
                ) : !detail ? (
                    <div className="flex-1 flex items-center justify-center text-brand-text/40 text-sm">No detail available.</div>
                ) : (
                    <div className="flex-1 overflow-auto p-5 md:p-6">
                        {/* Meta */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
                            <Meta label="Employee" value={detail.employeeName} />
                            <Meta label="Project" value={detail.projectName || "—"} />
                            <Meta label="Project ID" value={detail.projectId || "—"} />
                            <Meta label="Week" value={`${fmtRange(detail.weekStartDate)} to ${fmtRange(detail.weekEndDate)}`} />
                            <Meta label="Submitted" value={fmtSubmitted(detail.submittedAt)} />
                            <div className="flex items-center gap-3"><span className="text-brand-text/40 font-semibold w-24">Status</span><StatusPill status={status} /></div>
                        </div>

                        {/* Project table (read-only) */}
                        <div className="border border-[#E3E8EF] rounded-xl overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[1000px]">
                                <thead>
                                    <tr className="bg-brand-blue-dark text-white text-[10px] uppercase tracking-wide">
                                        <th className="px-3 py-2.5 font-bold">Project ID</th>
                                        <th className="px-3 py-2.5 font-bold">Project Name</th>
                                        <th className="px-3 py-2.5 font-bold">Task ID</th>
                                        <th className="px-3 py-2.5 font-bold">Task Description</th>
                                        <th className="px-3 py-2.5 font-bold">Onsite/Offshore</th>
                                        <th className="px-3 py-2.5 font-bold">Client Billable</th>
                                        <th className="px-3 py-2.5 font-bold">Billing Location</th>
                                        {days.map((d, i) => (<th key={i} className="px-1 py-2.5 font-bold text-center"><div>{d.dom}</div><div className="text-[8px] opacity-80">{d.wd}</div></th>))}
                                        <th className="px-2 py-2.5 font-bold text-center">Total</th>
                                        <th className="px-2 py-2.5 font-bold text-center">Comment</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projectRows.length === 0 ? (
                                        <tr><td colSpan={9 + days.length} className="px-4 py-6 text-center text-sm text-brand-text/40">No project entries.</td></tr>
                                    ) : projectRows.map((r, idx) => (
                                        <tr key={idx} className="border-b border-[#E3E8EF] text-xs">
                                            <td className="px-3 py-2 font-semibold text-brand-text">{r.projectId || "—"}</td>
                                            <td className="px-3 py-2 text-brand-text/80">{r.projectName || "—"}</td>
                                            <td className="px-3 py-2 text-brand-text/60">{r.taskId || "—"}</td>
                                            <td className="px-3 py-2 text-brand-text/60">{r.taskDescription || "—"}</td>
                                            <td className="px-3 py-2 text-brand-text/70">{onsiteLabel(r.onsiteOffshore)}</td>
                                            <td className="px-3 py-2 text-brand-text/70">{billableLabel(r.clientBillable)}</td>
                                            <td className="px-3 py-2 text-brand-text/70">{r.billingLocation || "—"}</td>
                                            {dayHours(r).map((h, i) => (<td key={i} className="px-1 py-2 text-center text-brand-text">{hourCell(h)}</td>))}
                                            <td className="px-2 py-2 text-center font-bold text-brand-text">{rowTotal(r).toFixed(2)}</td>
                                            <td className="px-2 py-2 text-center">{r.comment ? <MessageSquare size={14} className="inline text-emerald-600" title={r.comment} /> : <span className="text-brand-text/30">—</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-bg-slate/40 text-xs">
                                        <td colSpan={7 + days.length} className="px-3 py-2 text-right font-bold text-brand-text/60 uppercase tracking-wide">Total Project Related Hours</td>
                                        <td className="px-2 py-2 text-center font-black text-brand-text">{(detail.totalBillableHours + detail.totalNonBillableHours || projectRows.reduce((s, r) => s + rowTotal(r), 0)).toFixed(2)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Holiday / Time off (read-only) */}
                        <div className="mt-6 border border-[#E3E8EF] rounded-xl overflow-x-auto">
                            <div className="px-4 py-2.5 border-b border-[#E3E8EF]"><h3 className="text-xs font-black text-brand-text uppercase tracking-wide">Holiday/Time off</h3></div>
                            <table className="w-full border-collapse min-w-[820px]">
                                <thead>
                                    <tr className="text-[10px] text-brand-text/40 uppercase">
                                        <th className="px-4 py-2 text-right font-bold w-[260px]"></th>
                                        {days.map((d, i) => (<th key={i} className="px-1 py-2 font-bold text-center"><div className="text-brand-text/70">{d.dom}</div><div className="text-[8px]">{d.wd}</div></th>))}
                                        <th className="px-2 py-2 font-bold text-center">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {timeOffRows.map((r) => (
                                        <tr key={r.type} className="border-b border-[#E3E8EF] text-xs">
                                            <td className="px-4 py-2 text-right font-semibold text-brand-text/70">{TIMEOFF_LABELS[r.type]}</td>
                                            {dayHours(r).map((h, i) => (<td key={i} className="px-1 py-2 text-center text-brand-text">{hourCell(h)}</td>))}
                                            <td className="px-2 py-2 text-center font-bold text-brand-text">{rowTotal(r).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals */}
                        <div className="mt-5 flex flex-col gap-1 text-sm items-end">
                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Total Project Related Hours:</span><span className="font-black text-brand-text w-16 text-right">{(detail.totalBillableHours + detail.totalNonBillableHours).toFixed(2)}</span></div>
                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Total Holiday/Time off Hours:</span><span className="font-black text-brand-text w-16 text-right">{(detail.totalTimeOffHours || 0).toFixed(2)}</span></div>
                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Grand Total:</span><span className="font-black text-brand-text w-16 text-right">{(detail.grandTotal || 0).toFixed(2)}</span></div>
                        </div>
                    </div>
                )}

                {/* Actions footer */}
                {!loading && detail && (
                    <div className="p-5 border-t border-[#E3E8EF] bg-bg-slate/30">
                        {status === "PENDING" ? (
                            rejecting ? (
                                <div className="space-y-3">
                                    <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={255} placeholder="Enter reason for rejection" rows="3" className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none font-bold text-sm" />
                                    <div className="flex justify-end gap-3">
                                        <button onClick={() => { setRejecting(false); setRejectReason(""); }} className="px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-brand-text/50 hover:bg-bg-slate transition">Cancel</button>
                                        <button onClick={handleReject} disabled={acting} className="px-6 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest transition disabled:opacity-40">Confirm Reject</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setRejecting(true)} disabled={acting} className="px-6 py-2.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white text-[11px] font-black uppercase tracking-widest transition disabled:opacity-40 flex items-center gap-2"><X size={15} /> Reject</button>
                                    <button onClick={handleApprove} disabled={acting} className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest transition disabled:opacity-40 flex items-center gap-2"><Check size={15} /> Approve</button>
                                </div>
                            )
                        ) : (
                            <div className="flex justify-end items-center gap-3">
                                <span className="text-[10px] font-bold text-brand-text/40 uppercase tracking-widest">Reviewed</span>
                                <StatusPill status={status} />
                            </div>
                        )}
                    </div>
                )}
            </aside>
        </div>
    );
}

function Meta({ label, value }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-brand-text/40 font-semibold w-24 shrink-0">{label}</span>
            <span className="font-bold text-brand-text">{value}</span>
        </div>
    );
}
