import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import DownloadClientTimesheetModal from "../components/DownloadClientTimesheetModal";
import ClientTimesheetDetailDrawer from "../components/ClientTimesheetDetailDrawer";
import AccessManagementTab from "../components/AccessManagementTab";
import AssignedMembersTab from "../components/AssignedMembersTab";
import api from "../../utils/api";
import { toast } from "react-toastify";
import { Download, Check, X, Eye } from "lucide-react";
import { projectSuffix } from "../../utils/employeeName";
import { clientTimesheetStatusMeta } from "../../utils/clientTimesheetStatus";

export default function ClientTimesheets() {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState("client-timesheets");
    // Page tab: "timesheets" (approval queue) | "assigned" (assigned members) | "access" (access management).
    const [pageTab, setPageTab] = useState(location.state?.tab === "access" ? "access" : location.state?.tab === "assigned" ? "assigned" : "timesheets");
    const [entries, setEntries] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [allClients, setAllClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);

    // Queue filters
    const [employeeFilter, setEmployeeFilter] = useState("");
    const [clientFilter, setClientFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [verificationFilter, setVerificationFilter] = useState("");

    // Reject flow
    const [rejectingId, setRejectingId] = useState(null);
    const [rejectReason, setRejectReason] = useState("");

    // Detail drawer
    const [detailId, setDetailId] = useState(null);

    const currentUserId = useMemo(() => {
        const u = JSON.parse(localStorage.getItem("user")) || {};
        return u.id || u.userId;
    }, []);

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
    };

    const fetchEntries = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (employeeFilter) params.append("employeeId", employeeFilter);
            if (clientFilter) params.append("client", clientFilter);
            if (statusFilter) params.append("status", statusFilter);
            const res = await api(`/api/client-timesheets?${params.toString()}`);
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
    }, [employeeFilter, clientFilter, statusFilter]);

    // One-time loads: employees (for filter/download dropdown) and the full client list.
    useEffect(() => {
        (async () => {
            try {
                const empRes = await api("/api/employees");
                const empJson = empRes.ok ? await empRes.json() : {};
                setEmployees(Array.isArray(empJson.data) ? empJson.data : []);
            } catch (err) {
                console.error("Error fetching employees:", err);
            }
            try {
                const res = await api("/api/client-timesheets");
                const json = res.ok ? await res.json() : {};
                const data = Array.isArray(json.data) ? json.data : [];
                const distinct = Array.from(
                    new Set(data.map((e) => e.clientName).filter(Boolean))
                ).sort();
                setAllClients(distinct);
            } catch (err) {
                console.error("Error fetching client list:", err);
            }
        })();
    }, []);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    const handleApprove = async (id) => {
        try {
            const res = await api(`/api/client-timesheets/${id}/approve`, {
                method: "POST",
                body: JSON.stringify({ reviewerId: currentUserId }),
            });
            if (res.ok) {
                toast.success("Client timesheet approved.");
                fetchEntries();
            } else {
                toast.error("Could not approve.");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleRejectConfirm = async () => {
        if (!rejectReason.trim()) return toast.warning("Please provide a reason.");
        try {
            const res = await api(`/api/client-timesheets/${rejectingId}/reject`, {
                method: "POST",
                body: JSON.stringify({ reviewerId: currentUserId, reason: rejectReason }),
            });
            if (res.ok) {
                toast.success("Client timesheet rejected.");
                setRejectingId(null);
                setRejectReason("");
                fetchEntries();
            } else {
                toast.error("Could not reject.");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const formatDate = (d) => {
        if (!d) return "";
        return new Date(String(d).split("T")[0]).toLocaleDateString("en-GB");
    };

    const statusPill = (status) => {
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

    // Verification status per employee (from /api/employees, which carries clientVerified).
    const verifiedMap = useMemo(() => {
        const m = {};
        employees.forEach((e) => { m[e.id] = !!e.clientVerified; });
        return m;
    }, [employees]);

    // Client-side verification filter applied on top of the server-fetched entries.
    const displayedEntries = useMemo(() => {
        if (!verificationFilter) return entries;
        return entries.filter((e) => {
            const v = verifiedMap[e.employeeId];
            return verificationFilter === "VERIFIED" ? v : !v;
        });
    }, [entries, verificationFilter, verifiedMap]);

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
                                {/* <select
                                value={employeeFilter}
                                onChange={(e) => setEmployeeFilter(e.target.value)}
                                className="bg-white border border-[#E3E8EF] focus:border-brand-yellow rounded-xl px-4 py-2.5 text-xs font-bold text-brand-text outline-none transition-all"
                            >
                                <option value="">All employees</option>
                                {employees
                                    .filter((e) => (e.role || "").toUpperCase() !== "ADMIN")
                                    .map((e) => (
                                        <option key={e.id} value={e.id}>{e.firstName} {e.lastName}{projectSuffix(e.clientProject)}</option>
                                    ))}
                            </select> */}
                                <select
                                    value={clientFilter}
                                    onChange={(e) => setClientFilter(e.target.value)}
                                    className="bg-white border border-[#E3E8EF] focus:border-brand-yellow rounded-xl px-4 py-2.5 text-xs font-bold text-brand-text outline-none transition-all"
                                >
                                    <option value="">All clients</option>
                                    {allClients.map((c) => (
                                        <option key={c} value={c}>{c}</option>
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
                                {/* <select
                                    value={verificationFilter}
                                    onChange={(e) => setVerificationFilter(e.target.value)}
                                    className="bg-white border border-[#E3E8EF] focus:border-brand-yellow rounded-xl px-4 py-2.5 text-xs font-bold text-brand-text outline-none transition-all"
                                >
                                    <option value="">Verification</option>
                                    <option value="VERIFIED">Verified</option>
                                    <option value="PENDING">Pending Verification</option>
                                </select> */}

                                <div className="flex flex-row gap-12 justify-end">
                                    <button
                                        onClick={() => setIsDownloadOpen(true)}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-brand-blue-dark text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:shadow-xl active:scale-95 transition-all"
                                    >
                                        <Download size={16} />
                                        Download
                                    </button>
                                </div>
                            </div>

                            {/* Download row */}


                            {/* Approval queue */}
                            <div className="bg-white rounded-[24px] shadow-2xl shadow-brand-blue/5 border border-brand-blue/5 overflow-hidden flex-1 flex flex-col min-h-0">
                                <div className="overflow-x-auto flex-1 overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse min-w-[720px]">
                                        <thead className="sticky top-0 z-10 bg-white">
                                            <tr className="bg-brand-blue/[0.02]">
                                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Employee</th>
                                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Project</th>
                                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Date</th>
                                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5 text-center">Status</th>
                                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-brand-blue/5">
                                            {loading ? (
                                                <tr><td colSpan={5} className="py-20 text-center text-brand-text/30 font-bold uppercase tracking-widest text-xs animate-pulse">Loading client timesheets...</td></tr>
                                            ) : displayedEntries.length === 0 ? (
                                                <tr><td colSpan={5} className="py-20 text-center text-brand-text/30 font-bold uppercase tracking-widest text-xs">No client timesheets found</td></tr>
                                            ) : (
                                                displayedEntries.map((e) => (
                                                    <tr
                                                        key={e.id}
                                                        onClick={() => setDetailId(e.id)}
                                                        className="group hover:bg-bg-slate/40 transition-all cursor-pointer"
                                                    >
                                                        <td className="py-3 px-6"><span className="text-sm font-black text-brand-text tracking-tight">{e.employeeName}</span></td>
                                                        <td className="py-3 px-6"><span className="text-sm font-bold text-brand-text">{e.projectName || "—"}</span></td>
                                                        <td className="py-3 px-6"><span className="text-[12px] font-bold text-brand-text/70">{formatDate(e.date)}</span></td>
                                                        <td className="py-3 px-6 text-center">{statusPill(e.status)}</td>
                                                        <td className="py-3 px-6 text-right">
                                                            <div className="flex justify-end items-center gap-2">
                                                                <button
                                                                    onClick={(ev) => { ev.stopPropagation(); setDetailId(e.id); }}
                                                                    className="p-2 bg-brand-blue/5 text-brand-blue-dark rounded-lg hover:bg-brand-blue-dark hover:text-white transition-all"
                                                                    title="View details"
                                                                    aria-label="View details"
                                                                >
                                                                    <Eye size={16} />
                                                                </button>
                                                                {(e.status || "").toUpperCase() === "PENDING" ? (
                                                                    <>
                                                                        <button
                                                                            onClick={(ev) => { ev.stopPropagation(); handleApprove(e.id); }}
                                                                            className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-all"
                                                                            title="Approve"
                                                                            aria-label="Approve"
                                                                        >
                                                                            <Check size={16} />
                                                                        </button>
                                                                        <button
                                                                            onClick={(ev) => { ev.stopPropagation(); setRejectingId(e.id); setRejectReason(""); }}
                                                                            className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                                                            title="Reject"
                                                                            aria-label="Reject"
                                                                        >
                                                                            <X size={16} />
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest">
                                                                        {e.approvedByName ? e.approvedByName : "—"}
                                                                    </span>
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
                        </div>
                    )}
                </main>
            </div>

            {/* Reject reason modal */}
            {rejectingId != null && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
                        <h3 className="text-lg font-bold mb-4 text-brand-text uppercase tracking-tight">Reject Client Timesheet</h3>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            maxLength={255}
                            placeholder="Enter reason for rejection"
                            className="w-full p-3 border border-slate-200 rounded-lg mb-4 focus:ring-2 focus:ring-red-500 outline-none font-bold text-sm"
                            rows="4"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="flex-1 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition">Cancel</button>
                            <button onClick={handleRejectConfirm} className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition shadow-lg">Reject</button>
                        </div>
                    </div>
                </div>
            )}

            <DownloadClientTimesheetModal
                isOpen={isDownloadOpen}
                onClose={() => setIsDownloadOpen(false)}
                employees={employees}
                clients={allClients}
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
