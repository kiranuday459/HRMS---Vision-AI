import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCw } from "lucide-react";
import api from "../../utils/api";
import { clientTimesheetStatusMeta } from "../../utils/clientTimesheetStatus";

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const fmtRange = (ymd) => {
    if (!ymd) return "";
    const [y, m, d] = String(ymd).split("T")[0].split("-").map(Number);
    return `${String(d).padStart(2, "0")}-${MON[m - 1]}-${y}`;
};
const num = (v) => (v == null ? "0.00" : Number(v).toFixed(2));

// Employee sidebar nav (shared shape with the dashboard); Client Timesheet is active here.
function useNavItems() {
    const clock = (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
        </svg>
    );
    return [
        {
            tab: "dashboard", label: "Dashboard", to: "/employee",
            icon: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>),
        },
        { tab: "timesheet", label: "Timesheet", to: "/employee?tab=timesheet", icon: clock },
        {
            tab: "client-timesheet", label: "Client Timesheet", to: "/employee/client-timesheet",
            icon: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline><path d="M8 3h8"></path></svg>),
        },
        {
            tab: "leave", label: "Leave Request", to: "/employee?tab=leave",
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
            }
        } catch (err) {
            console.error("Error fetching client timesheet weeks:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchWeeks(); }, []);

    const filteredWeeks = useMemo(() => {
        if (!appliedFilter) return weeks;
        return weeks.filter((w) => (w.status || "").toUpperCase() === appliedFilter);
    }, [weeks, appliedFilter]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="bg-white py-4 px-4 md:px-8 border-b border-[#E3E8EF] shadow-sm">
                    <h1 className="text-2xl font-black text-brand-text tracking-tight">Timesheets</h1>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    {/* Section heading + search row */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                        <h2 className="text-xl font-bold text-brand-text">Timesheet Summary</h2>
                        <div className="flex items-center gap-3">
                            <label className="text-sm font-bold text-brand-text/60 whitespace-nowrap">Search By</label>
                            <select
                                value={searchBy}
                                onChange={(e) => setSearchBy(e.target.value)}
                                className="min-w-[160px] bg-white border border-[#E3E8EF] focus:border-brand-yellow rounded-md px-3 py-2 text-sm font-semibold text-brand-text outline-none transition-all"
                            >
                                <option value="">— Select —</option>
                                <option value="DRAFT">Pending</option>
                                <option value="PENDING">Submitted for Approval</option>
                                <option value="APPROVED">Approved</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                            <button
                                onClick={() => setAppliedFilter(searchBy)}
                                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm font-bold transition-all active:scale-95"
                            >
                                Search
                            </button>
                            <button
                                onClick={() => { setSearchBy(""); setAppliedFilter(""); fetchWeeks(); }}
                                className="w-9 h-9 flex items-center justify-center bg-[#2C2C2A] hover:bg-black text-white rounded-md transition-all active:scale-95"
                                title="Reset"
                                aria-label="Reset"
                            >
                                <RotateCw size={16} />
                            </button>
                        </div>
                    </div>

                    <p className="text-[13px] text-brand-text/50 mb-4">
                        Please follow basic troubleshooting if you face any discrepancies in accessing the page.
                    </p>

                    {loading ? (
                        <div className="py-20 text-center text-brand-text/30 font-bold uppercase tracking-widest text-xs animate-pulse">Loading timesheets...</div>
                    ) : filteredWeeks.length === 0 ? (
                        <div className="bg-white rounded-xl border border-dashed border-[#E3E8EF] p-16 text-center">
                            <p className="text-base font-bold text-brand-text">No client timesheets to show</p>
                            <p className="text-sm text-brand-text/40 mt-2">You don't have an active client project assignment yet. Contact your admin to be assigned to a client project.</p>
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
                                                onClick={() => navigate(`/employee/client-timesheet/${String(w.weekStartDate).split("T")[0]}`)}
                                                className="text-left text-[15px] font-bold text-blue-600 hover:underline"
                                            >
                                                {fmtRange(w.weekStartDate)} To {fmtRange(w.weekEndDate)}
                                            </button>
                                            <span className={`text-sm font-semibold mt-1 ${meta.text}`}>{meta.label}</span>
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
