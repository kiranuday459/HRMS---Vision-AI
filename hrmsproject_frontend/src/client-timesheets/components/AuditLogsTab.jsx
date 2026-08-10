import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, RefreshCw, ScrollText } from "lucide-react";
import api from "../../utils/api";
import { toast } from "react-toastify";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "07-Aug-2026, 20:07" — the same shape the notification panel uses, minus seconds, which no
 * staffing decision is precise enough to need.
 *
 * performedAt is a Jackson-serialised LocalDateTime with no zone marker, written in server
 * local time (LocalDateTime.now()), so it is read as-is rather than being marked UTC — the
 * opposite of the notification timestamps, which the server writes with ZoneOffset.UTC.
 */
const fmtWhen = (value) => {
    if (!value) return "—";
    const [datePart, timePart = ""] = String(value).split("T");
    const [y, m, d] = datePart.split("-");
    if (!y || !m || !d) return "—";
    const hhmm = timePart.slice(0, 5);
    return `${d}-${MONTHS[Number(m) - 1]}-${y}${hhmm ? `, ${hhmm}` : ""}`;
};

/**
 * How each logged action reads, and its badge colour. Assigned and re-assigned are both
 * "they are on the project now" so they share the green family, with re-assigned distinct
 * enough to be told apart at a glance from a first assignment.
 */
const ACTIONS = {
    ASSIGNED: { label: "Assigned", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    REMOVED: { label: "Removed", cls: "bg-red-50 text-red-600 border-red-200" },
    REASSIGNED: { label: "Re-assigned", cls: "bg-blue-50 text-blue-700 border-blue-200" },
};
const actionMeta = (a) => ACTIONS[String(a || "").toUpperCase()]
    || { label: a || "—", cls: "bg-slate-100 text-slate-600 border-slate-200" };

/**
 * Read-only staffing history: who was assigned to which client project, removed from it, or
 * re-added, by which admin and when. Newest first, straight from the server's ordering.
 *
 * Deliberately has no actions on it. It is the record of what the Assigned Members tab did,
 * not a second place to do it — nothing here edits, retries or deletes an entry.
 */
export default function AuditLogsTab() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const fetchLogs = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api("/api/client-project-assignments/audit");
            if (res.ok) {
                const json = await res.json().catch(() => ({}));
                setLogs(Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []));
            } else {
                toast.error(`Could not load audit logs (${res.status}).`);
            }
        } catch (err) {
            console.error("Error fetching assignment audit logs:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    // Employee or project, matching the search on the Assigned Members and Timesheets tabs.
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return logs;
        return logs.filter((l) =>
            [l.employeeName, l.projectName, l.projectId, l.clientName, l.performedByName]
                .some((v) => String(v || "").toLowerCase().includes(q))
        );
    }, [logs, search]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                {/* Fixed w-64, matching the search inputs on the Assigned Members and Access
                    Management tabs. It used to be flex-1, which stretched it across the whole
                    row — far wider than the query it holds. */}
                <div className="relative w-64 max-w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text/20" size={15} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by employee, project or admin..."
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E3E8EF] rounded-lg text-[13px] font-medium outline-none focus:border-brand-blue-dark/30 transition-all placeholder:text-brand-text/20"
                    />
                </div>
                <button
                    onClick={fetchLogs}
                    disabled={loading}
                    className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E3E8EF] bg-white text-[11px] font-black uppercase tracking-widest text-brand-text/60 hover:text-brand-text hover:border-brand-blue/20 transition-all disabled:opacity-40"
                >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    Refresh
                </button>
            </div>

            <div className="bg-white border border-[#E3E8EF] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[820px]">
                        <thead>
                            <tr className="bg-bg-slate/50 text-[10px] uppercase tracking-widest text-brand-text/40">
                                <th className="px-5 py-3 font-black">Employee</th>
                                <th className="px-5 py-3 font-black">Project</th>
                                <th className="px-5 py-3 font-black">Action</th>
                                <th className="px-5 py-3 font-black">Date</th>
                                <th className="px-5 py-3 font-black">By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} className="px-5 py-10 text-center text-[13px] font-bold text-brand-text/30">Loading...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-12 text-center">
                                        <ScrollText size={22} className="mx-auto mb-2 text-brand-text/15" />
                                        <p className="text-[13px] font-bold text-brand-text/30">
                                            {logs.length === 0
                                                ? "No assignment activity recorded yet."
                                                : "No entries match that search."}
                                        </p>
                                    </td>
                                </tr>
                            ) : filtered.map((l) => {
                                const meta = actionMeta(l.action);
                                return (
                                    <tr key={l.id} className="border-t border-[#E3E8EF] text-[13px]">
                                        <td className="px-5 py-3.5 font-bold text-brand-text">{l.employeeName || "—"}</td>
                                        <td className="px-5 py-3.5 text-brand-text/70">
                                            {l.projectName || "—"}
                                            {l.projectId && (
                                                <span className="block text-[11px] text-brand-text/35">{l.projectId}</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${meta.cls}`}>
                                                {meta.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-brand-text/70 whitespace-nowrap">{fmtWhen(l.performedAt)}</td>
                                        {/* An action taken without a resolvable session shows a dash rather than
                                            a guess — the log says what it knows and no more. */}
                                        <td className="px-5 py-3.5 text-brand-text/70">{l.performedByName || "—"}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
