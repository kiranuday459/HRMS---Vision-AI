import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCw } from "lucide-react";
import api from "../../utils/api";
import { clientTimesheetStatusMeta } from "../../utils/clientTimesheetStatus";
import { clientTimesheetBase, roleDashboardPath } from "../../utils/clientTimesheetNav";

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
const fmtRange = (ymd) => {
    if (!ymd) return "";
    const [y, m, d] = String(ymd).split("T")[0].split("-").map(Number);
    return `${String(d).padStart(2, "0")}-${MON[m - 1]}-${y}`;
};
const num = (v) => (v == null ? "0.00" : Number(v).toFixed(2));

// The month a week is filed under, as "YYYY-MM".
//
// A week runs Saturday→Friday and can straddle two months — 29-AUG-2026 To 04-SEP-2026 has
// three days in August and four in September — so it is filed under whichever month holds the
// majority of its seven days. A 7-day span splits at worst 3/4, so the 4th day always lands in
// the majority month: the midpoint alone decides it and there is no tie to break.
//
// The point of one-week-one-month is that picking June shows June's four or five weeks and
// nothing else, rather than a straddling week surfacing under two different months.
const weekMonthKey = (ymd) => {
    if (!ymd) return "";
    const [y, m, d] = String(ymd).split("T")[0].split("-").map(Number);
    // Day-of-month overflow rolls into the next month on its own, which is exactly what a
    // week starting on the 29th needs.
    const mid = new Date(y, m - 1, d + 3);
    return `${mid.getFullYear()}-${String(mid.getMonth() + 1).padStart(2, "0")}`;
};
const monthKeyLabel = (key) => {
    const [y, m] = key.split("-").map(Number);
    return `${MONTH_FULL[m - 1]} ${y}`;
};

// Employee sidebar nav (shared shape with the dashboard); Client Timesheet is active here.
function useNavItems() {
    const clock = (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
        </svg>
    );
    return [
        {
            tab: "dashboard", label: "Dashboard", to: roleDashboardPath(),
            icon: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>),
        },
        { tab: "timesheet", label: "Timesheet", to: `${roleDashboardPath()}?tab=timesheet`, icon: clock },
        {
            tab: "client-timesheet", label: "Client Timesheet", to: clientTimesheetBase(),
            icon: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline><path d="M8 3h8"></path></svg>),
        },
        {
            tab: "leave", label: "Leave Request", to: `${roleDashboardPath()}?tab=leave`,
            icon: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>),
        },
    ];
}

const SummaryCell = ({ value, label }) => (
    <div className="flex-1 min-w-[130px] px-4 py-3 border-l border-[#E3E8EF] flex flex-col items-center justify-center text-center">
        <span className="text-sm font-bold text-brand-text">{value}</span>
        <span className="text-[11px] text-brand-text/40 mt-0.5">{label}</span>
    </div>
);

export default function ClientTimesheetSummary() {
    const navigate = useNavigate();
    const navItems = useNavItems();
    const [weeks, setWeeks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchBy, setSearchBy] = useState("");
    const [appliedFilter, setAppliedFilter] = useState("");
    // "" = All months. Otherwise a "YYYY-MM" key matched against each week's home month.
    const [monthFilter, setMonthFilter] = useState("");

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
    };

    const fetchWeeks = async () => {
        try {
            setLoading(true);
            const res = await api("/api/client-timesheets/weeks");
            if (res.ok) {
                const json = await res.json().catch(() => ({}));
                setWeeks(Array.isArray(json.data) ? json.data : []);
            } else {
                // Without this the empty state reads as "you have no assignment" whenever
                // the request fails — a very different problem with the same appearance.
                console.error(`Client timesheet weeks request failed (${res.status}); showing empty state.`);
            }
        } catch (err) {
            console.error("Error fetching client timesheet weeks:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchWeeks(); }, []);

    // Only the months the employee actually has weeks for, newest first to match the order the
    // weeks themselves are listed in. Derived from the loaded weeks rather than a fixed rolling
    // window, so the dropdown can never offer a month that would come back empty.
    const monthOptions = useMemo(() => {
        const keys = [...new Set(weeks.map((w) => weekMonthKey(w.weekStartDate)).filter(Boolean))];
        keys.sort((a, b) => b.localeCompare(a));
        return keys.map((key) => ({ key, label: monthKeyLabel(key) }));
    }, [weeks]);

    // Status and month are independent conditions on the same list, so a week has to clear both
    // — "August 2026" + "Not Started" means August weeks with that status, not either one.
    const filteredWeeks = useMemo(() => {
        return weeks.filter((w) => {
            if (appliedFilter && (w.status || "").toUpperCase() !== appliedFilter) return false;
            if (monthFilter && weekMonthKey(w.weekStartDate) !== monthFilter) return false;
            return true;
        });
    }, [weeks, appliedFilter, monthFilter]);

    // A filter hiding everything is a different situation from having no assignment at all, and
    // the two must not share the "contact your admin" copy — that would read as an access
    // problem when the employee has merely picked a quiet month.
    const filtersActive = Boolean(appliedFilter || monthFilter);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                {/* No separate page header: the top bar already carries the "Client Timesheets"
                    branding and the active tab, so a second "Timesheets" title only repeated it.
                    "Timesheet Summary" below is the single page heading. */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    {/* Section heading + search row */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                        <h1 className="text-2xl font-black text-brand-text tracking-tight">Timesheet Summary</h1>
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Sits left of the status filter and matches it exactly, so the two
                                read as one filter row rather than a control bolted on. */}
                            <select
                                value={monthFilter}
                                onChange={(e) => setMonthFilter(e.target.value)}
                                className="min-w-[180px] bg-white border border-[#E3E8EF] focus:border-brand-yellow rounded-md px-3 py-2 text-sm font-semibold text-brand-text outline-none transition-all"
                                aria-label="Filter by month"
                            >
                                <option value="">All months</option>
                                {monthOptions.map((m) => (
                                    <option key={m.key} value={m.key}>{m.label}</option>
                                ))}
                            </select>
                            {/* The dropdown labels itself, so the separate "Search By" label and
                                the Search button are gone — one control for one action. */}
                            <select
                                value={searchBy}
                                onChange={(e) => { setSearchBy(e.target.value); setAppliedFilter(e.target.value); }}
                                className="min-w-[180px] bg-white border border-[#E3E8EF] focus:border-brand-yellow rounded-md px-3 py-2 text-sm font-semibold text-brand-text outline-none transition-all"
                                aria-label="Filter by status"
                            >
                                <option value="">All</option>
                                <option value="DRAFT">Pending</option>
                                <option value="PENDING">Submitted for Approval</option>
                                <option value="APPROVED">Approved</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                            <button
                                onClick={() => { setSearchBy(""); setAppliedFilter(""); setMonthFilter(""); fetchWeeks(); }}
                                className="w-9 h-9 flex items-center justify-center bg-[#2C2C2A] hover:bg-black text-white rounded-md transition-all active:scale-95"
                                title="Reset"
                                aria-label="Reset"
                            >
                                <RotateCw size={16} />
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-20 text-center text-brand-text/30 font-bold uppercase tracking-widest text-xs animate-pulse">Loading timesheets...</div>
                    ) : filteredWeeks.length === 0 ? (
                        <div className="bg-white rounded-xl border border-dashed border-[#E3E8EF] p-16 text-center">
                            {filtersActive ? (
                                <>
                                    <p className="text-base font-bold text-brand-text">No timesheets match these filters</p>
                                    <p className="text-sm text-brand-text/40 mt-2">Try a different month or status, or reset the filters to see every week.</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-base font-bold text-brand-text">No client timesheets to show</p>
                                    <p className="text-sm text-brand-text/40 mt-2">You don't have an active client project assignment yet. Contact your admin to be assigned to a client project.</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {filteredWeeks.map((w) => {
                                const meta = clientTimesheetStatusMeta(w.status);
                                return (
                                    <div
                                        key={w.weekStartDate}
                                        className="bg-white rounded-md border border-[#E3E8EF] border-l-4 shadow-sm flex flex-col lg:flex-row lg:items-stretch overflow-hidden"
                                        style={{ borderLeftColor: meta.borderHex }}
                                    >
                                        {/* Left: date + status */}
                                        <div className="flex-1 px-5 py-4 flex flex-col justify-center min-w-[240px]">
                                            <button
                                                onClick={() => navigate(`${clientTimesheetBase()}/${String(w.weekStartDate).split("T")[0]}`)}
                                                className="text-left text-[15px] font-bold text-blue-600 hover:underline"
                                            >
                                                {fmtRange(w.weekStartDate)} To {fmtRange(w.weekEndDate)}
                                            </button>
                                            <span className={`text-sm font-semibold mt-1 ${meta.text}`}>{meta.label}</span>
                                            {/* Rejected weeks show why, so the employee knows what to fix
                                                before resubmitting. */}
                                            {w.rejectionReason && (
                                                <p className="mt-1 text-[13px] text-[#b91c1c] leading-snug">
                                                    <span className="font-semibold">Reason:</span> {w.rejectionReason}
                                                </p>
                                            )}
                                        </div>
                                        {/* Right: summary columns */}
                                        <div className="flex flex-wrap lg:flex-nowrap">
                                            <SummaryCell value={num(w.billableProjectHours)} label="Billable Project Hrs" />
                                            <SummaryCell value={num(w.nonBillableProjectHours)} label="Non-Billable Project Hrs" />
                                            <SummaryCell value={num(w.timeOffHolidayHours)} label="Time off/Holiday Hrs" />
                                            <SummaryCell value={w.truTimeHours == null ? "N/A" : num(w.truTimeHours)} label="Tru Time Hours" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
