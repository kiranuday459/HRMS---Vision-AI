import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Search, RefreshCw, Users } from "lucide-react";
import api from "../../utils/api";
import { toast } from "react-toastify";

const fmtDate = (d) => {
    if (!d) return "—";
    const dt = new Date(String(d).split("T")[0]);
    return isNaN(dt) ? "—" : dt.toLocaleDateString("en-GB");
};

function VerificationBadge({ verified }) {
    return verified ? (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold" style={{ backgroundColor: "#DCFCE7", color: "#16A34A" }}>
            ✅ Verified
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold" style={{ backgroundColor: "#FEF9C3", color: "#B45309" }}>
            ⏳ Pending Verification
        </span>
    );
}

export default function AccessManagementTab() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [projectFilter, setProjectFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [resendingId, setResendingId] = useState(null);
    const firstLoad = useRef(true);

    const fetchRows = useCallback(async () => {
        try {
            if (firstLoad.current) setLoading(true);
            const res = await api("/api/admin/client-timesheet/assigned-employees");
            if (res.ok) {
                const data = await res.json().catch(() => []);
                setRows(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []));
            }
        } catch (err) {
            console.error("Error fetching assigned employees:", err);
        } finally {
            setLoading(false);
            firstLoad.current = false;
        }
    }, []);

    useEffect(() => {
        fetchRows();
        // Auto-refresh every 30s so verification status updates without a manual reload.
        const id = setInterval(fetchRows, 30000);
        return () => clearInterval(id);
    }, [fetchRows]);

    const projects = useMemo(
        () => Array.from(new Set(rows.map((r) => r.projectName).filter(Boolean))).sort(),
        [rows]
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (projectFilter && r.projectName !== projectFilter) return false;
            if (statusFilter === "VERIFIED" && !r.clientVerified) return false;
            if (statusFilter === "PENDING" && r.clientVerified) return false;
            if (q) {
                return (
                    (r.employeeName || "").toLowerCase().includes(q) ||
                    (r.projectName || "").toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [rows, search, projectFilter, statusFilter]);

    const handleResend = async (row) => {
        setResendingId(row.employeeId);
        try {
            const res = await api(`/api/admin/client-timesheet/resend-otp/${row.employeeId}`, { method: "POST" });
            if (res.ok) {
                toast.success(`OTP resent to ${row.employeeName}'s email`);
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error(err.message || err.error || "Could not resend OTP.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Could not resend OTP.");
        } finally {
            setResendingId(null);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    className="bg-white border border-[#E3E8EF] focus:border-brand-yellow rounded-xl px-4 py-2.5 text-xs font-bold text-brand-text outline-none transition-all"
                >
                    <option value="">All Projects</option>
                    {projects.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-white border border-[#E3E8EF] focus:border-brand-yellow rounded-xl px-4 py-2.5 text-xs font-bold text-brand-text outline-none transition-all"
                >
                    <option value="">All Statuses</option>
                    <option value="VERIFIED">Verified</option>
                    <option value="PENDING">Pending Verification</option>
                </select>
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text/30" size={15} />
                    <input
                        type="text"
                        placeholder="Search by name or project..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white border border-[#E3E8EF] focus:border-brand-yellow rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold text-brand-text outline-none transition-all"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[24px] shadow-2xl shadow-brand-blue/5 border border-brand-blue/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[820px]">
                        <thead className="bg-white">
                            <tr className="bg-brand-blue/[0.02]">
                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5 w-12">#</th>
                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Employee</th>
                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Project</th>
                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Project ID</th>
                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Assigned Date</th>
                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5 text-center">Verification Status</th>
                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-blue/5">
                            {loading ? (
                                <tr><td colSpan={7} className="py-20 text-center text-brand-text/30 font-bold uppercase tracking-widest text-xs animate-pulse">Loading...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center">
                                        <Users className="mx-auto mb-3 text-brand-text/20" size={40} />
                                        <p className="text-base font-bold text-brand-text">No employees assigned to client projects yet.</p>
                                        <p className="text-sm text-brand-text/40 mt-1">Use “Assign Employees to Client Project” to get started.</p>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((r, idx) => (
                                    <tr key={r.employeeId} className="hover:bg-bg-slate/40 transition-all">
                                        <td className="py-3 px-6 text-sm font-bold text-brand-text/40">{idx + 1}</td>
                                        <td className="py-3 px-6 text-sm font-black text-brand-text tracking-tight">{r.employeeName}</td>
                                        <td className="py-3 px-6 text-sm font-bold text-brand-text">{r.projectName || "—"}</td>
                                        <td className="py-3 px-6 text-[12px] font-bold text-brand-text/60">{r.projectId || "—"}</td>
                                        <td className="py-3 px-6 text-[12px] font-bold text-brand-text/70">{fmtDate(r.assignmentDate)}</td>
                                        <td className="py-3 px-6 text-center"><VerificationBadge verified={r.clientVerified} /></td>
                                        <td className="py-3 px-6 text-right">
                                            <button
                                                onClick={() => handleResend(r)}
                                                disabled={resendingId === r.employeeId}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest border transition-all disabled:opacity-50 ${r.clientVerified
                                                    ? "border-brand-blue/20 text-brand-blue-dark hover:bg-brand-blue-dark hover:text-white"
                                                    : "border-amber-400 text-amber-600 hover:bg-amber-500 hover:text-white"}`}
                                            >
                                                {resendingId === r.employeeId
                                                    ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                    : <RefreshCw size={13} />}
                                                Resend OTP
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
