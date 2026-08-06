import { useState, useEffect, useMemo } from "react";
import { X, Check } from "lucide-react";
import api from "../../utils/api";
import { toast } from "react-toastify";
import { clientTimesheetStatusMeta } from "../../utils/clientTimesheetStatus";
import ClientTimesheetConfirmModal from "./ClientTimesheetConfirmModal";
import RowCommentsPanel from "./RowCommentsPanel";
import CharCounter from "../../components/CharCounter";
import DisabledBadge from "../../components/DisabledBadge";
import { FIELD_LIMITS } from "../../utils/fieldLimits";

const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const TIMEOFF_LABELS = { SICK: "Paid Sick Leave", HOLIDAY: "Holiday (Public/National)", PTO: "Paid Time Off", LOP: "Unpaid Leave (LOP)", EARNED: "Leave (Earned)" };
const TIMEOFF_ORDER = ["SICK", "HOLIDAY", "PTO", "LOP", "EARNED"];
// Daily regular capacity shared by leave and worked hours; anything past it is overtime.
const REGULAR_HOURS_PER_DAY = 8;

const parseLocal = (ymd) => { const [y, m, d] = String(ymd).split("T")[0].split("-").map(Number); return new Date(y, m - 1, d); };
const fmtRange = (ymd) => { if (!ymd) return ""; const [y, m, d] = String(ymd).split("T")[0].split("-").map(Number); return `${String(d).padStart(2, "0")}-${MON[m - 1]}-${y}`; };
const fmtSubmitted = (v) => { if (!v) return "—"; const d = new Date(v); return isNaN(d) ? String(v).split("T")[0] : d.toLocaleDateString("en-GB"); };
const billableLabel = (v) => (v === "NON_BILLABLE" ? "Non-Billable" : v === "BILLABLE" ? "Billable" : v || "—");
const onsiteLabel = (v) => (v === "OFFSHORE" ? "Offshore" : v === "ONSITE" ? "Onsite" : v || "—");
const hourCell = (h) => (h && Number(h) > 0 ? Number(h) : "");

function StatusPill({ status }) {
    const meta = clientTimesheetStatusMeta(status);
    return (
        <span
            className="px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
            style={{ backgroundColor: meta.bgHex, color: meta.textHex, borderColor: meta.borderHex }}
        >
            {meta.label}
        </span>
    );
}

export default function ClientTimesheetDetailDrawer({ timesheetId, onClose, onActioned }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState("");
    const [acting, setActing] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [confirmingApprove, setConfirmingApprove] = useState(false);
    // Final "are you sure" after the reason is typed. Cancelling returns to the reason box
    // with the text intact rather than discarding it.
    const [confirmingReject, setConfirmingReject] = useState(false);

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
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start); d.setDate(start.getDate() + i);
            const g = d.getDay();
            return { dom: d.getDate(), wd: WD[g], isWeekend: g === 0 || g === 6 };
        });
    }, [detail]);

    const handleApprove = async () => {
        setActing(true);
        try {
            const res = await api(`/api/client-timesheets/${timesheetId}/approve`, { method: "POST", body: JSON.stringify({ reviewerId: currentUserId }) });
            if (res.ok) { toast.success("Client timesheet approved."); setStatus("APPROVED"); setConfirmingApprove(false); onActioned && onActioned(); }
            else toast.error("Could not approve.");
        } catch (err) { console.error(err); } finally { setActing(false); }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) return toast.warning("Please provide a reason.");
        setActing(true);
        try {
            const res = await api(`/api/client-timesheets/${timesheetId}/reject`, { method: "POST", body: JSON.stringify({ reviewerId: currentUserId, reason: rejectReason }) });
            if (res.ok) { toast.success("Client timesheet rejected."); setStatus("REJECTED"); setConfirmingReject(false); setRejecting(false); setRejectReason(""); onActioned && onActioned(); }
            else toast.error("Could not reject.");
        } catch (err) { console.error(err); } finally { setActing(false); }
    };

    const projectRows = detail?.projectRows || [];
    const timeOffRows = TIMEOFF_ORDER.map((type) => (detail?.timeOffRows || []).find((t) => (t.type || "").toUpperCase() === type) || { type, days: [] });
    const dayHours = (row) => days.map((_, i) => (row.days && row.days[i] ? Number(row.days[i].hours) || 0 : 0));
    const rowTotal = (row) => dayHours(row).reduce((s, h) => s + h, 0);

    // Per-day OT, derived from the same saved day hours the employee's Time Entry page uses
    // — only the week-level total is stored, so both sides compute the daily split the same
    // way. Rule (mirrors EntryPage.dayBreakdown and the server's applyRegularAndOvertime):
    // full-day leave (>= 8h) earns no OT; otherwise OT is the worked hours beyond the day's
    // remaining regular capacity. Weekends never carry OT. Read-only here, as everywhere.
    const hoursAt = (rows, i) => rows.reduce((s, r) => s + (r.days && r.days[i] ? Number(r.days[i].hours) || 0 : 0), 0);
    const otByDay = days.map((d, i) => {
        if (d.isWeekend) return 0;
        const leave = hoursAt(timeOffRows, i);
        if (leave >= REGULAR_HOURS_PER_DAY) return 0;
        return Math.max(0, hoursAt(projectRows, i) - (REGULAR_HOURS_PER_DAY - leave));
    });
    const totalOt = otByDay.reduce((s, h) => s + h, 0);

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="client-timesheet-detail-title"
                className="relative w-full max-w-[min(1100px,90vw)] max-h-[90vh] bg-white shadow-2xl rounded-xl flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="p-5 border-b border-[#E3E8EF] flex items-center justify-between bg-bg-slate/30 shrink-0">
                    <div>
                        <h2 id="client-timesheet-detail-title" className="text-lg font-black text-brand-text tracking-tight">Client Timesheet Detail</h2>
                        <p className="text-[9px] font-black text-brand-text/40 uppercase tracking-[0.2em] mt-0.5">Read-only</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-brand-blue/5 rounded-xl transition-all" aria-label="Close"><X size={20} /></button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center text-brand-text/30 font-bold uppercase tracking-widest text-xs animate-pulse min-h-[200px]">Loading...</div>
                ) : !detail ? (
                    <div className="flex-1 flex items-center justify-center text-brand-text/40 text-sm min-h-[200px]">No detail available.</div>
                ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto p-5 md:p-6">
                        {/* Meta */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
                            <Meta
                                label="Employee"
                                value={
                                    <>
                                        {detail.employeeName}
                                        {/* Retained history for a disabled account — flagged so the
                                            reviewer knows the person is no longer active in HRMS. */}
                                        {detail.employeeActive === false && <DisabledBadge className="ml-2 align-middle" />}
                                    </>
                                }
                            />
                            <Meta label="Project" value={detail.projectName || "—"} />
                            <Meta label="Project ID" value={detail.projectId || "—"} />
                            <Meta label="Week" value={`${fmtRange(detail.weekStartDate)} to ${fmtRange(detail.weekEndDate)}`} />
                            <Meta label="Submitted" value={fmtSubmitted(detail.submittedAt)} />
                            <div className="flex items-center gap-3"><span className="text-brand-text/40 font-semibold w-24">Status</span><StatusPill status={status} /></div>
                            {/* The decision itself: who reviewed the week and when. Both were
                                recorded against the line all along but never shown here. */}
                            <Meta label="Reviewed by" value={detail.approvedByName || "—"} />
                            <Meta label="Reviewed on" value={fmtSubmitted(detail.reviewedAt)} />
                            {/* The date this employee's client work starts — days before it are
                                locked on the entry grid, which explains any empty leading days. */}
                            <Meta label="Assigned from" value={fmtRange(detail.earliestAssignmentDate) || "—"} />
                        </div>

                        {/* Why this week was rejected — the record of the decision. */}
                        {/* Shown whenever a reason exists, not only while the status is still
                            REJECTED. A rejected week that the employee has since corrected and
                            resubmitted reads as PENDING but still carries the reason — hiding it
                            then left the reviewer with no idea what was wrong last time. */}
                        {detail.rejectionReason && (
                            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-red-600">Rejection reason</p>
                                <p className="mt-1 text-sm text-red-700 leading-relaxed">{detail.rejectionReason}</p>
                            </div>
                        )}

                        {/* Project table (read-only) */}
                        <div className="border border-[#E3E8EF] rounded-xl overflow-hidden">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead>
                                    <tr className="bg-brand-blue-dark text-white text-[9px] uppercase tracking-wide">
                                        <th className="px-2 py-2 font-bold w-[7%]">Project ID</th>
                                        <th className="px-2 py-2 font-bold w-[9%]">Project Name</th>
                                        <th className="px-2 py-2 font-bold w-[7%]">Task ID</th>
                                        <th className="px-2 py-2 font-bold w-[12%]">Task Description</th>
                                        <th className="px-2 py-2 font-bold w-[8%]">Onsite/Offshore</th>
                                        <th className="px-2 py-2 font-bold w-[8%]">Client Billable</th>
                                        <th className="px-2 py-2 font-bold w-[7%]">Billing Location</th>
                                        {days.map((d, i) => (<th key={i} className="px-0.5 py-2 font-bold text-center w-[4%]"><div>{d.dom}</div><div className="text-[7px] opacity-80">{d.wd}</div></th>))}
                                        <th className="px-1 py-2 font-bold text-center w-[5%]">Total</th>
                                        {/* Widened from 4% (icon-only) to fit readable comment text;
                                            the column widths now total 100%. */}
                                        <th className="px-1 py-2 font-bold w-[9%]">Comment</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projectRows.length === 0 ? (
                                        <tr><td colSpan={9 + days.length} className="px-4 py-6 text-center text-sm text-brand-text/40">No project entries.</td></tr>
                                    ) : projectRows.map((r, idx) => (
                                        <tr key={idx} className="border-b border-[#E3E8EF] text-[10px]">
                                            <td className="px-2 py-1.5 font-semibold text-brand-text truncate" title={r.projectId || ""}>{r.projectId || "—"}</td>
                                            <td className="px-2 py-1.5 text-brand-text/80 truncate" title={r.projectName || ""}>{r.projectName || "—"}</td>
                                            <td className="px-2 py-1.5 text-brand-text/60 truncate" title={r.taskId || ""}>{r.taskId || "—"}</td>
                                            <td className="px-2 py-1.5 text-brand-text/60 truncate" title={r.taskDescription || ""}>{r.taskDescription || "—"}</td>
                                            <td className="px-2 py-1.5 text-brand-text/70">{onsiteLabel(r.onsiteOffshore)}</td>
                                            <td className="px-2 py-1.5 text-brand-text/70">{billableLabel(r.clientBillable)}</td>
                                            <td className="px-2 py-1.5 text-brand-text/70 truncate" title={r.billingLocation || ""}>{r.billingLocation || "—"}</td>
                                            {dayHours(r).map((h, i) => (<td key={i} className="px-0.5 py-1.5 text-center text-brand-text">{hourCell(h)}</td>))}
                                            <td className="px-1 py-1.5 text-center font-bold text-brand-text">{rowTotal(r).toFixed(2)}</td>
                                            {/* The comment text itself, not just an icon: a `title`
                                                attribute on an <svg> is not rendered as a tooltip by
                                                browsers, so the reviewer previously had no way to read
                                                what the employee wrote. Full text is also listed in the
                                                Row Comments panel below the table. */}
                                            <td className="px-1 py-1.5">
                                                {r.comment
                                                    ? <span className="block truncate text-brand-text/70" title={r.comment}>{r.comment}</span>
                                                    : <span className="block text-center text-brand-text/30">—</span>}
                                            </td>
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

                        {/* Per-row comments in full, read-only. Same component and position as the
                            employee's Time Entry page, so a comment reads identically on both sides. */}
                        <RowCommentsPanel rows={projectRows} className="mt-6" />

                        {/* OT hours (read-only) — same position and shape as the employee's
                            Time Entry page, between the project table and Holiday/Time off. */}
                        <div className="mt-6 border border-[#E3E8EF] rounded-xl overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-[#E3E8EF] flex items-baseline gap-3">
                                <h3 className="text-xs font-black text-brand-text uppercase tracking-wide">OT Hours</h3>
                                <span className="text-[10px] text-brand-text/40">
                                    Calculated — hours beyond the 8h daily regular capacity (leave included)
                                </span>
                            </div>
                            <table className="w-full border-collapse table-fixed">
                                <thead>
                                    <tr className="text-[9px] text-brand-text/40 uppercase">
                                        <th className="px-3 py-2 text-right font-bold w-[22%]"></th>
                                        {days.map((d, i) => (<th key={i} className="px-0.5 py-2 font-bold text-center w-[9%]"><div className="text-brand-text/70">{d.dom}</div><div className="text-[7px]">{d.wd}</div></th>))}
                                        <th className="px-1 py-2 font-bold text-center w-[8%]">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-[#E3E8EF] text-[10px]">
                                        <td className="px-3 py-1.5 text-right font-semibold text-brand-text/70">Overtime (&gt;8h/day)</td>
                                        {otByDay.map((h, i) => (
                                            <td key={i} className="px-0.5 py-1.5 text-center">
                                                <span className={h > 0 ? "font-bold text-amber-700" : "text-brand-text/30"}>
                                                    {h > 0 ? h.toFixed(2) : "—"}
                                                </span>
                                            </td>
                                        ))}
                                        <td className="px-1 py-1.5 text-center font-bold text-amber-600">{totalOt.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Holiday / Time off (read-only) */}
                        <div className="mt-6 border border-[#E3E8EF] rounded-xl overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-[#E3E8EF]"><h3 className="text-xs font-black text-brand-text uppercase tracking-wide">Holiday/Time off</h3></div>
                            <table className="w-full border-collapse table-fixed">
                                <thead>
                                    <tr className="text-[9px] text-brand-text/40 uppercase">
                                        <th className="px-3 py-2 text-right font-bold w-[22%]"></th>
                                        {days.map((d, i) => (<th key={i} className="px-0.5 py-2 font-bold text-center w-[9%]"><div className="text-brand-text/70">{d.dom}</div><div className="text-[7px]">{d.wd}</div></th>))}
                                        <th className="px-1 py-2 font-bold text-center w-[8%]">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {timeOffRows.map((r) => (
                                        <tr key={r.type} className="border-b border-[#E3E8EF] text-[10px]">
                                            <td className="px-3 py-1.5 text-right font-semibold text-brand-text/70">{TIMEOFF_LABELS[r.type]}</td>
                                            {dayHours(r).map((h, i) => (<td key={i} className="px-0.5 py-1.5 text-center text-brand-text">{hourCell(h)}</td>))}
                                            <td className="px-1 py-1.5 text-center font-bold text-brand-text">{rowTotal(r).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals */}
                        <div className="mt-5 flex flex-col gap-1 text-sm items-end">
                            {/* The billable / non-billable split is what the client is invoiced
                                on. It was in the payload but only ever rendered as one summed
                                figure, so the reviewer couldn't see the breakdown they approve. */}
                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Billable Hours:</span><span className="font-black text-brand-text w-16 text-right">{(detail.totalBillableHours || 0).toFixed(2)}</span></div>
                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Non-Billable Hours:</span><span className="font-black text-brand-text w-16 text-right">{(detail.totalNonBillableHours || 0).toFixed(2)}</span></div>
                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Total Project Related Hours:</span><span className="font-black text-brand-text w-16 text-right">{((detail.totalBillableHours || 0) + (detail.totalNonBillableHours || 0)).toFixed(2)}</span></div>
                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Total Holiday/Time off Hours:</span><span className="font-black text-brand-text w-16 text-right">{(detail.totalTimeOffHours || 0).toFixed(2)}</span></div>
                            {/* Server-computed 8h/day split, so the reviewer sees what the
                                employee saw on the entry page. */}
                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Total Regular Hours:</span><span className="font-black text-brand-text w-16 text-right">{(detail.totalRegularHours || 0).toFixed(2)}</span></div>
                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Total OT Hours:</span><span className="font-black text-amber-600 w-16 text-right">{(detail.totalOtHours || 0).toFixed(2)}</span></div>
                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Grand Total:</span><span className="font-black text-brand-text w-16 text-right">{(detail.grandTotal || 0).toFixed(2)}</span></div>
                        </div>
                    </div>
                )}

                {/* Actions footer */}
                {!loading && detail && (
                    <div className="p-5 border-t border-[#E3E8EF] bg-bg-slate/30 shrink-0">
                        {status === "PENDING" ? (
                            rejecting ? (
                                <div className="space-y-3">
                                    <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={FIELD_LIMITS.REJECTION_REASON} placeholder="Enter reason for rejection" rows="3" className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none font-bold text-sm" />
                                    <CharCounter value={rejectReason} max={FIELD_LIMITS.REJECTION_REASON} />
                                    <div className="flex justify-end gap-3">
                                        <button onClick={() => { setRejecting(false); setRejectReason(""); }} className="px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-brand-text/50 hover:bg-bg-slate transition">Cancel</button>
                                        {/* Opens the final confirmation rather than rejecting outright. */}
                                        <button onClick={() => setConfirmingReject(true)} disabled={acting || !rejectReason.trim()} title={!rejectReason.trim() ? "Enter a rejection reason first" : undefined} className="px-6 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest transition disabled:opacity-40 disabled:cursor-not-allowed">Reject</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setRejecting(true)} disabled={acting} className="px-6 py-2.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white text-[11px] font-black uppercase tracking-widest transition disabled:opacity-40 flex items-center gap-2"><X size={15} /> Reject</button>
                                    <button onClick={() => setConfirmingApprove(true)} disabled={acting} className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest transition disabled:opacity-40 flex items-center gap-2"><Check size={15} /> Approve</button>
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
            </div>

            <ClientTimesheetConfirmModal
                isOpen={confirmingApprove}
                onClose={() => setConfirmingApprove(false)}
                onConfirm={handleApprove}
                submitting={acting}
                title="Approve Client Timesheet"
                message={`Are you sure you want to approve this client timesheet for ${detail?.employeeName || "this employee"} (${fmtRange(detail?.weekStartDate)} to ${fmtRange(detail?.weekEndDate)})? Once approved the employee can no longer edit it.`}
                confirmLabel="Approve"
            />

            {/* Reject confirmation — the last step, after the reason has been entered.
                Cancelling returns to the reason box with the text still there. */}
            <ClientTimesheetConfirmModal
                isOpen={confirmingReject}
                onClose={() => setConfirmingReject(false)}
                onConfirm={handleReject}
                submitting={acting}
                destructive
                title="Reject Client Timesheet"
                message={`Are you sure you want to reject this client timesheet for ${detail?.employeeName || "this employee"} (${fmtRange(detail?.weekStartDate)} to ${fmtRange(detail?.weekEndDate)})? They will be notified and can correct and resubmit it.`}
                confirmLabel="Reject"
            />
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
