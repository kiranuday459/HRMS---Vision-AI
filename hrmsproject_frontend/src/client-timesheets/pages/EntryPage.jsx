import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessageSquare, Plus, Minus, ArrowLeft, X } from "lucide-react";
import api from "../../utils/api";
import { toast } from "react-toastify";
import { clientTimesheetStatusMeta } from "../../utils/clientTimesheetStatus";

const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const TIMEOFF_LABELS = {
    SICK: "Paid Sick Leave",
    HOLIDAY: "Holiday (Public/National)",
    PTO: "Paid Time Off",
    LOP: "Unpaid Leave (LOP)",
    EARNED: "Leave (Earned)",
};
const TIMEOFF_ORDER = ["SICK", "HOLIDAY", "PTO", "LOP", "EARNED"];

const parseLocal = (ymd) => {
    const [y, m, d] = String(ymd).split("T")[0].split("-").map(Number);
    return new Date(y, m - 1, d);
};
const toYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const numOr0 = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

function useNavItems() {
    const clock = (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>);
    return [
        { tab: "dashboard", label: "Dashboard", to: "/employee", icon: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>) },
        { tab: "timesheet", label: "Timesheet", to: "/employee?tab=timesheet", icon: clock },
        { tab: "client-timesheet", label: "Client Timesheet", to: "/employee/client-timesheet", icon: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline><path d="M8 3h8"></path></svg>) },
        { tab: "leave", label: "Leave Request", to: "/employee?tab=leave", icon: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>) },
    ];
}

export default function ClientTimesheetEntry() {
    const { weekStart } = useParams();
    const navigate = useNavigate();
    const navItems = useNavItems();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [meta, setMeta] = useState({ employeeName: "", weekStartDate: weekStart, weekEndDate: "", status: "DRAFT", earliestAssignmentDate: null });
    const [projectRows, setProjectRows] = useState([]);
    const [timeOffRows, setTimeOffRows] = useState([]);
    const [commentModal, setCommentModal] = useState({ open: false, index: -1, text: "" });

    const todayYMD = toYMD(new Date());

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
    };

    // 7 day columns from the week start (Saturday → Friday).
    const days = useMemo(() => {
        const start = parseLocal(meta.weekStartDate || weekStart);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start); d.setDate(start.getDate() + i);
            return { ymd: toYMD(d), dom: d.getDate(), wd: WD[d.getDay()] };
        });
    }, [meta.weekStartDate, weekStart]);

    const applyDetail = (dto) => {
        setMeta({
            employeeName: dto.employeeName || "",
            weekStartDate: String(dto.weekStartDate).split("T")[0],
            weekEndDate: String(dto.weekEndDate).split("T")[0],
            status: dto.status || "DRAFT",
            earliestAssignmentDate: dto.earliestAssignmentDate ? String(dto.earliestAssignmentDate).split("T")[0] : null,
        });
        const mapDays = (arr) => (arr || []).map((d) => ({ date: String(d.date).split("T")[0], hours: d.hours ? String(d.hours) : "" }));
        setProjectRows((dto.projectRows || []).map((r) => ({
            projectId: r.projectId || "",
            projectName: r.projectName || "",
            taskId: r.taskId || "",
            taskDescription: r.taskDescription || "",
            onsiteOffshore: r.onsiteOffshore || "ONSITE",
            clientBillable: r.clientBillable || "BILLABLE",
            billingLocation: r.billingLocation && r.billingLocation !== "DFLT" ? r.billingLocation : "",
            comment: r.comment || "",
            assignmentStartDate: r.assignmentStartDate ? String(r.assignmentStartDate).split("T")[0] : null,
            days: mapDays(r.days),
        })));
        setTimeOffRows(TIMEOFF_ORDER.map((type) => {
            const found = (dto.timeOffRows || []).find((t) => (t.type || "").toUpperCase() === type);
            return { type, days: found ? mapDays(found.days) : days.map((d) => ({ date: d.ymd, hours: "" })) };
        }));
    };

    const fetchDetail = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api(`/api/client-timesheets/weeks/${weekStart}`);
            if (res.ok) {
                const json = await res.json().catch(() => ({}));
                if (json.data) applyDetail(json.data);
            } else {
                toast.error("Could not load the week.");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekStart]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);

    const weekEditable = meta.status !== "PENDING" && meta.status !== "APPROVED";

    const isDayEditable = (ymd, rowGate) => {
        if (!weekEditable) return false;
        if (!rowGate) return false;
        return ymd >= rowGate && ymd <= todayYMD;
    };

    const setProjectDay = (rowIdx, dayIdx, value) => {
        setProjectRows((prev) => prev.map((r, i) => i !== rowIdx ? r : {
            ...r, days: r.days.map((d, j) => j !== dayIdx ? d : { ...d, hours: value }),
        }));
    };
    const setTimeOffDay = (rowIdx, dayIdx, value) => {
        setTimeOffRows((prev) => prev.map((r, i) => i !== rowIdx ? r : {
            ...r, days: r.days.map((d, j) => j !== dayIdx ? d : { ...d, hours: value }),
        }));
    };
    const setRowField = (rowIdx, field, value) => {
        setProjectRows((prev) => prev.map((r, i) => i !== rowIdx ? r : { ...r, [field]: value }));
    };

    const addRow = (rowIdx) => {
        setProjectRows((prev) => {
            const base = prev[rowIdx] || prev[0];
            if (!base) return prev;
            const clone = { ...base, comment: "", days: days.map((d) => ({ date: d.ymd, hours: "" })) };
            const next = [...prev];
            next.splice(rowIdx + 1, 0, clone);
            return next;
        });
    };
    const removeRow = (rowIdx) => setProjectRows((prev) => prev.filter((_, i) => i !== rowIdx));

    const rowTotal = (row) => row.days.reduce((s, d) => s + numOr0(d.hours), 0);
    const totalBillable = projectRows.filter((r) => r.clientBillable !== "NON_BILLABLE").reduce((s, r) => s + rowTotal(r), 0);
    const totalNonBillable = projectRows.filter((r) => r.clientBillable === "NON_BILLABLE").reduce((s, r) => s + rowTotal(r), 0);
    const totalProject = totalBillable + totalNonBillable;
    const totalTimeOff = timeOffRows.reduce((s, r) => s + rowTotal(r), 0);
    const grandTotal = totalProject + totalTimeOff;

    const buildPayload = () => ({
        weekStartDate: meta.weekStartDate,
        weekEndDate: meta.weekEndDate,
        projectRows: projectRows.map((r) => ({
            projectId: r.projectId, projectName: r.projectName, taskId: r.taskId,
            taskDescription: r.taskDescription, onsiteOffshore: r.onsiteOffshore,
            clientBillable: r.clientBillable, billingLocation: r.billingLocation, comment: r.comment,
            assignmentStartDate: r.assignmentStartDate,
            days: r.days.map((d) => ({ date: d.date, hours: numOr0(d.hours) })),
        })),
        timeOffRows: timeOffRows.map((r) => ({
            type: r.type, days: r.days.map((d) => ({ date: d.date, hours: numOr0(d.hours) })),
        })),
    });

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await api("/api/client-timesheets/save-draft", { method: "POST", body: JSON.stringify(buildPayload()) });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
                toast.success("Draft saved.");
                if (json.data) applyDetail(json.data);
            } else {
                toast.error(json.error || json.message || "Could not save draft.");
            }
        } catch (err) { console.error(err); toast.error("Save failed."); } finally { setSaving(false); }
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            const res = await api(`/api/client-timesheets/weeks/${weekStart}/submit`, { method: "PATCH", body: JSON.stringify(buildPayload()) });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
                toast.success("Submitted for approval.");
                if (json.data) applyDetail(json.data);
            } else {
                toast.error(json.error || json.message || "Could not submit.");
            }
        } catch (err) { console.error(err); toast.error("Submit failed."); } finally { setSaving(false); }
    };

    const openComment = (index) => setCommentModal({ open: true, index, text: projectRows[index]?.comment || "" });
    const saveComment = () => {
        setRowField(commentModal.index, "comment", commentModal.text);
        setCommentModal({ open: false, index: -1, text: "" });
    };

    const statusMeta = clientTimesheetStatusMeta(meta.status);
    const noAssignment = !meta.earliestAssignmentDate && projectRows.length === 0;

    const dayCell = (ymd, value, editable, onChange) => (
        <input
            type="number" min="0" step="0.25"
            value={value}
            disabled={!editable}
            onChange={(e) => onChange(e.target.value)}
            title={editable ? undefined : "Not available — you were not assigned before this date"}
            className={`w-14 text-center text-xs font-semibold rounded border px-1 py-1.5 outline-none transition-all ${editable
                ? "bg-white border-[#E3E8EF] focus:border-brand-yellow text-brand-text"
                : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"}`}
        />
    );

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="bg-white py-4 px-4 md:px-8 border-b border-[#E3E8EF] shadow-sm flex items-center gap-3">
                    <button onClick={() => navigate("/employee/client-timesheet")} className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#F1EFE8] text-[#5F5E5A] hover:bg-[#E3E8EF] transition-all" title="Back" aria-label="Back">
                        <ArrowLeft size={18} />
                    </button>
                    <h1 className="text-xl font-black text-brand-text tracking-tight">Time Entry Page</h1>
                    <span className={`ml-2 text-xs font-bold ${statusMeta.text}`}>{statusMeta.label}</span>
                </header>

                <div className="flex-1 overflow-auto p-4 md:p-8">
                    {loading ? (
                        <div className="py-20 text-center text-brand-text/30 font-bold uppercase tracking-widest text-xs animate-pulse">Loading...</div>
                    ) : (
                        <>
                            {/* Top meta */}
                            <div className="mb-6">
                                <h2 className="text-lg font-bold text-brand-text">{meta.employeeName}</h2>
                                <div className="flex flex-wrap gap-x-10 gap-y-1 mt-2 text-sm text-brand-text/70">
                                    <span><span className="font-semibold text-brand-text/50">Period End Date:</span> {meta.weekEndDate}</span>
                                    <span><span className="font-semibold text-brand-text/50">Version:</span> Original</span>
                                    <span><span className="font-semibold text-brand-text/50">Time Report ID:</span> NEXT</span>
                                </div>
                            </div>

                            {noAssignment ? (
                                <div className="bg-white rounded-xl border border-dashed border-[#E3E8EF] p-16 text-center">
                                    <p className="text-base font-bold text-brand-text">No client project to log against</p>
                                    <p className="text-sm text-brand-text/40 mt-2">You don't have an active client project assignment. Contact your admin to be assigned before entering hours.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Project table */}
                                    <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm overflow-x-auto">
                                        <table className="w-full text-left border-collapse min-w-[1100px]">
                                            <thead>
                                                <tr className="bg-brand-blue-dark text-white text-[11px] uppercase tracking-wide">
                                                    <th className="px-3 py-3 font-bold">Project ID</th>
                                                    <th className="px-3 py-3 font-bold">Project Name</th>
                                                    <th className="px-3 py-3 font-bold">Task/Activity ID</th>
                                                    <th className="px-3 py-3 font-bold">Task/Activity Description</th>
                                                    <th className="px-3 py-3 font-bold">Onsite/Offshore</th>
                                                    <th className="px-3 py-3 font-bold">Client Billable</th>
                                                    <th className="px-3 py-3 font-bold">Billing Location</th>
                                                    {days.map((d) => (
                                                        <th key={d.ymd} className="px-1 py-3 font-bold text-center">
                                                            <div>{d.dom}</div><div className="text-[9px] opacity-80">{d.wd}</div>
                                                        </th>
                                                    ))}
                                                    <th className="px-2 py-3 font-bold text-center">Total Hours</th>
                                                    <th className="px-2 py-3 font-bold text-center">Comment</th>
                                                    <th className="px-2 py-3"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {projectRows.map((r, rowIdx) => {
                                                    const gate = r.assignmentStartDate || meta.earliestAssignmentDate;
                                                    return (
                                                        <tr key={rowIdx} className="border-b border-[#E3E8EF]">
                                                            <td className="px-3 py-2 text-xs font-semibold text-brand-text">{r.projectId || "—"}</td>
                                                            <td className="px-3 py-2 text-xs text-brand-text/80 max-w-[150px]">{r.projectName || "—"}</td>
                                                            <td className="px-3 py-2 text-xs text-brand-text/60">{r.taskId || "—"}</td>
                                                            <td className="px-3 py-2 text-xs text-brand-text/60 max-w-[150px]">{r.taskDescription || "—"}</td>
                                                            <td className="px-2 py-2">
                                                                <select disabled={!weekEditable} value={r.onsiteOffshore} onChange={(e) => setRowField(rowIdx, "onsiteOffshore", e.target.value)} className="text-xs border border-[#E3E8EF] rounded px-1 py-1 outline-none disabled:bg-gray-100 disabled:text-gray-400">
                                                                    <option value="ONSITE">Onsite</option>
                                                                    <option value="OFFSHORE">Offshore</option>
                                                                </select>
                                                            </td>
                                                            <td className="px-2 py-2">
                                                                <select disabled={!weekEditable} value={r.clientBillable} onChange={(e) => setRowField(rowIdx, "clientBillable", e.target.value)} className="text-xs border border-[#E3E8EF] rounded px-1 py-1 outline-none disabled:bg-gray-100 disabled:text-gray-400">
                                                                    <option value="BILLABLE">Billable</option>
                                                                    <option value="NON_BILLABLE">Non-Billable</option>
                                                                </select>
                                                            </td>
                                                            <td className="px-2 py-2">
                                                                <input disabled={!weekEditable} value={r.billingLocation} onChange={(e) => setRowField(rowIdx, "billingLocation", e.target.value)} className="w-16 text-xs border border-[#E3E8EF] rounded px-1 py-1 outline-none disabled:bg-gray-100 disabled:text-gray-400" />
                                                            </td>
                                                            {r.days.map((d, dayIdx) => (
                                                                <td key={d.date} className="px-1 py-2 text-center">
                                                                    {dayCell(d.date, d.hours, isDayEditable(d.date, gate), (v) => setProjectDay(rowIdx, dayIdx, v))}
                                                                </td>
                                                            ))}
                                                            <td className="px-2 py-2 text-center text-xs font-bold text-brand-text">{rowTotal(r).toFixed(2)}</td>
                                                            <td className="px-2 py-2 text-center">
                                                                <button onClick={() => openComment(rowIdx)} className={`p-1.5 rounded transition-all ${r.comment ? "text-emerald-600 bg-emerald-50" : "text-brand-text/40 hover:bg-bg-slate"}`} title="Comment" aria-label="Comment">
                                                                    <MessageSquare size={16} />
                                                                </button>
                                                            </td>
                                                            <td className="px-2 py-2 whitespace-nowrap">
                                                                <div className="flex items-center gap-1">
                                                                    <button onClick={() => addRow(rowIdx)} disabled={!weekEditable} className="w-6 h-6 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-40" title="Add row"><Plus size={14} /></button>
                                                                    <button onClick={() => removeRow(rowIdx)} disabled={!weekEditable} className="w-6 h-6 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all disabled:opacity-40" title="Remove row"><Minus size={14} /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {projectRows.length === 0 && (
                                                    <tr><td colSpan={7 + days.length + 3} className="px-4 py-8 text-center text-sm text-brand-text/40">No project rows. Use “+” to add one.</td></tr>
                                                )}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-bg-slate/40">
                                                    <td colSpan={7 + days.length} className="px-3 py-2 text-right text-xs font-bold text-brand-text/60 uppercase tracking-wide">Total Project Related Hours</td>
                                                    <td className="px-2 py-2 text-center text-sm font-black text-brand-text">{totalProject.toFixed(2)}</td>
                                                    <td colSpan={2}></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* Holiday / Time off */}
                                    <div className="mt-8 bg-white rounded-xl border border-[#E3E8EF] shadow-sm overflow-x-auto">
                                        <div className="px-4 py-3 border-b border-[#E3E8EF]">
                                            <h3 className="text-sm font-black text-brand-text uppercase tracking-wide">Holiday/Time off</h3>
                                        </div>
                                        <table className="w-full border-collapse min-w-[900px]">
                                            <thead>
                                                <tr className="text-[11px] text-brand-text/40 uppercase">
                                                    <th className="px-4 py-2 text-right font-bold w-[280px]"></th>
                                                    {days.map((d) => (
                                                        <th key={d.ymd} className="px-1 py-2 font-bold text-center">
                                                            <div className="text-brand-text/70">{d.dom}</div><div className="text-[9px]">{d.wd}</div>
                                                        </th>
                                                    ))}
                                                    <th className="px-2 py-2 font-bold text-center">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {timeOffRows.map((r, rowIdx) => {
                                                    const gate = meta.earliestAssignmentDate;
                                                    return (
                                                        <tr key={r.type} className="border-b border-[#E3E8EF]">
                                                            <td className="px-4 py-2 text-right text-sm font-semibold text-brand-text/70">{TIMEOFF_LABELS[r.type]}</td>
                                                            {r.days.map((d, dayIdx) => (
                                                                <td key={d.date} className="px-1 py-2 text-center">
                                                                    {dayCell(d.date, d.hours, isDayEditable(d.date, gate), (v) => setTimeOffDay(rowIdx, dayIdx, v))}
                                                                </td>
                                                            ))}
                                                            <td className="px-2 py-2 text-center text-xs font-bold text-brand-text">{rowTotal(r).toFixed(2)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Totals + actions */}
                                    <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div className="flex flex-col gap-1 text-sm">
                                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Total Holiday/Time off Hours:</span><span className="font-black text-brand-text">{totalTimeOff.toFixed(2)}</span></div>
                                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Grand Total:</span><span className="font-black text-brand-text">{grandTotal.toFixed(2)}</span></div>
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            <button onClick={() => toast.info("Totals updated.")} className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95">Update Totals</button>
                                            <button onClick={handleSave} disabled={saving || !weekEditable} className="px-5 py-2.5 rounded-lg bg-[#2C2C2A] hover:bg-black text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40">Save</button>
                                            <button onClick={handleSubmit} disabled={saving || !weekEditable} className="px-6 py-2.5 rounded-lg bg-brand-blue-dark hover:brightness-110 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-brand-blue/20 transition-all active:scale-95 disabled:opacity-40">Submit</button>
                                        </div>
                                    </div>
                                    {!weekEditable && (
                                        <p className="mt-3 text-xs text-brand-text/40">This week is {statusMeta.label.toLowerCase()} and can no longer be edited.</p>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* Comment modal */}
            {commentModal.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-brand-text">Row Comment</h3>
                            <button onClick={() => setCommentModal({ open: false, index: -1, text: "" })} className="text-brand-text/40 hover:text-brand-text"><X size={18} /></button>
                        </div>
                        <textarea
                            value={commentModal.text}
                            onChange={(e) => setCommentModal((p) => ({ ...p, text: e.target.value }))}
                            maxLength={500}
                            disabled={!weekEditable}
                            placeholder="Add a comment for this project row"
                            className="w-full p-3 border border-slate-200 rounded-lg mb-4 focus:ring-2 focus:ring-brand-yellow outline-none text-sm disabled:bg-gray-100"
                            rows="4"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setCommentModal({ open: false, index: -1, text: "" })} className="flex-1 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold uppercase text-[10px] tracking-widest hover:bg-slate-200 transition">Cancel</button>
                            <button onClick={saveComment} disabled={!weekEditable} className="flex-1 bg-brand-blue-dark text-white px-4 py-2 rounded-lg font-bold uppercase text-[10px] tracking-widest hover:brightness-110 transition disabled:opacity-40">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
