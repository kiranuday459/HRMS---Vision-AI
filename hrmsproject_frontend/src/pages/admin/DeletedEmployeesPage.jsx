import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Trash2, User, Building2, Calendar, Mail, Phone, Briefcase } from "lucide-react";
import api from "../../utils/api";
import AdminSidebar from "../../components/AdminSidebar";
import Sidebar from "../../components/Sidebar";
import { getHrNavItems } from "../../utils/hrNav";

const fmt = (v) => v || "—";
const fmtDate = (d) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return String(d).split("T")[0]; }
};
const fmtDateTime = (d) => {
    if (!d) return "—";
    try {
        return new Date(d).toLocaleString("en-GB", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    } catch { return String(d).split("T")[0]; }
};

const ROLE_LABELS = {
    ADMIN: "Admin",
    HR: "HR",
    REPORTING_MANAGER: "Reporting Manager",
    EMPLOYEE: "Employee",
};

function DetailRow({ label, value }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-2 border-b border-slate-100 last:border-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 w-36 shrink-0 pt-0.5">{label}</span>
            <span className="text-sm font-semibold text-slate-700 break-all">{value}</span>
        </div>
    );
}

function EmployeeCard({ emp, onClick }) {
    const fullName = [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(" ");
    return (
        <button
            onClick={onClick}
            className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-red-200 transition-all duration-200 p-4 text-left group"
        >
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors">
                    <Trash2 size={16} className="text-red-400" />
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-slate-800 truncate">{fullName}</p>
                        {emp.role && (
                            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md">
                                {ROLE_LABELS[emp.role] || emp.role}
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{fmt(emp.corporateId)} · {fmt(emp.designation)}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{fmt(emp.department)}</p>
                </div>
                {/* Deleted at */}
                <div className="text-right shrink-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-red-400">Deleted</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{fmtDateTime(emp.deletedAt)}</p>
                </div>
            </div>
        </button>
    );
}

function DetailModal({ emp, onClose }) {
    if (!emp) return null;
    const fullName = [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(" ");
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 bg-red-50/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                            <Trash2 size={18} className="text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-base font-black text-slate-800 truncate">{fullName}</h2>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mt-0.5">Deleted Record · Read-only</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl hover:bg-red-100 transition-colors text-slate-400 hover:text-red-500"
                            aria-label="Close"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 p-5 space-y-5">
                    {/* Identity */}
                    <section>
                        <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                            <User size={10} /> Identity
                        </h3>
                        <div className="bg-slate-50 rounded-xl px-4 py-1">
                            <DetailRow label="Full Name" value={fullName} />
                            <DetailRow label="Personal Email" value={fmt(emp.email)} />
                            <DetailRow label="Phone" value={fmt(emp.phoneNumber)} />
                            <DetailRow label="Role" value={ROLE_LABELS[emp.role] || fmt(emp.role)} />
                        </div>
                    </section>

                    {/* Company Record */}
                    <section>
                        <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                            <Building2 size={10} /> Company Record
                        </h3>
                        <div className="bg-slate-50 rounded-xl px-4 py-1">
                            <DetailRow label="Corporate ID" value={fmt(emp.corporateId)} />
                            <DetailRow label="Corporate Email" value={fmt(emp.corporateEmail)} />
                            <DetailRow label="VisionAI ID" value={fmt(emp.visionaiId)} />
                            <DetailRow label="VisionAI Email" value={fmt(emp.visionaiEmail)} />
                            <DetailRow label="Designation" value={fmt(emp.designation)} />
                            {/* <DetailRow label="Department" value={fmt(emp.department)} /> */}
                        </div>
                    </section>

                    {/* Dates */}
                    <section>
                        <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                            <Calendar size={10} /> Dates
                        </h3>
                        <div className="bg-slate-50 rounded-xl px-4 py-1">
                            {/* <DetailRow label="Hire Date" value={fmtDate(emp.hireDate)} /> */}
                            <DetailRow label="Joining Date" value={fmtDate(emp.joiningDate)} />
                            <DetailRow label="End Date" value={fmtDate(emp.endDate)} />
                            <DetailRow label="Deleted At" value={fmtDateTime(emp.deletedAt)} />
                        </div>
                    </section>

                    {/* Client Project */}
                    {(emp.clientProject || emp.clientProjectId) && (
                        <section>
                            <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                                <Briefcase size={10} /> Client Project
                            </h3>
                            <div className="bg-slate-50 rounded-xl px-4 py-1">
                                <DetailRow label="Project" value={fmt(emp.clientProject)} />
                                <DetailRow label="Project ID" value={fmt(emp.clientProjectId)} />
                            </div>
                        </section>
                    )}
                </div>

                {/* Footer — read-only notice */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
                    <p className="text-[10px] text-slate-400 text-center font-semibold">
                        This is an archived snapshot. No actions are available on deleted records.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function DeletedEmployeesPage() {
    const navigate = useNavigate();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(null);
    const [activeTab, setActiveTab] = useState("dashboard");

    const user = (() => {
        try { return JSON.parse(localStorage.getItem("user")) || {}; } catch { return {}; }
    })();
    const isHr = user.role === "HR";

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const res = await api("/api/admin/deleted-employees");
                if (res.ok) {
                    const json = await res.json().catch(() => ({}));
                    setRecords(Array.isArray(json.data) ? json.data : []);
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        })();
    }, []);

    const filtered = records.filter((r) => {
        const name = [r.firstName, r.middleName, r.lastName].filter(Boolean).join(" ").toLowerCase();
        const q = search.toLowerCase();
        return (
            name.includes(q) ||
            (r.corporateId || "").toLowerCase().includes(q) ||
            (r.designation || "").toLowerCase().includes(q) ||
            // (r.department || "").toLowerCase().includes(q) ||
            (r.email || "").toLowerCase().includes(q)
        );
    });

    const handleBack = () => navigate(isHr ? "/hr/actions" : "/admin/dashboard");

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    };

    return (
        <div className="flex h-screen w-screen bg-bg-slate flex-col md:flex-row overflow-hidden relative">
            {isHr ? (
                <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} handleLogout={handleLogout} navItems={getHrNavItems()} hideLogout={true} />
            ) : (
                <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />
            )}

            <main className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="sticky top-0 z-30 bg-white py-4 px-4 md:px-6 flex items-center justify-between shadow-sm border-b border-[#E3E8EF]">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleBack}
                            className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
                            aria-label="Go back"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-lg font-black text-slate-800 tracking-tight">Deleted Employees</h1>
                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em]">Read-only archive</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                        <Trash2 size={14} className="text-red-300" />
                        {loading ? "Loading…" : `${records.length} record${records.length !== 1 ? "s" : ""}`}
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    {/* Search */}
                    <div className="mb-5 relative max-w-md">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, ID, designation, department…"
                            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 transition-all"
                        />
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-24 text-slate-400">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-red-400 rounded-full animate-spin mr-3" />
                            <span className="text-sm font-semibold">Loading archive…</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                                <Trash2 size={28} className="text-slate-300" />
                            </div>
                            <p className="text-slate-500 font-bold text-sm">
                                {search ? "No matching records found" : "No deleted employees yet"}
                            </p>
                            <p className="text-slate-400 text-xs mt-1">
                                {search ? "Try a different search term" : "Deleted employee records will appear here"}
                            </p>
                        </div>
                    ) : (
                        <div>
                            {filtered.map((emp) => (
                                <EmployeeCard key={emp.id} emp={emp} onClick={() => setSelected(emp)} />
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Detail modal */}
            {selected && <DetailModal emp={selected} onClose={() => setSelected(null)} />}
        </div>
    );
}
