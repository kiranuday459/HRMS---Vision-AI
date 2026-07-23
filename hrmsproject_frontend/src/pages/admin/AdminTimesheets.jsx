
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/AdminSidebar";
import WeeklyTimesheetGrid from "../employee/timesheet/WeeklyTimesheetGrid";
import { toast } from "react-toastify";
import { Search, Filter, Clock, Download } from "lucide-react";
import api from "../../utils/api";
import DownloadTimesheetModal from "../../components/DownloadTimesheetModal";
import { ProjectSuffix } from "../../utils/employeeName";
import RejectRequestModal from "../../components/RejectRequestModal";

export default function AdminTimesheets() {
    const [activeTab, setActiveTab] = useState("timesheets");
    const [user, setUser] = useState({});
    const [loading, setLoading] = useState(true);
    const [timesheets, setTimesheets] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [tsFilter, setTsFilter] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("All");
    const [tsSubView, setTsSubView] = useState('summary'); // 'summary' or 'grid'
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [groupedWeeks, setGroupedWeeks] = useState([]);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    // Rejection reason modal for admin action on HR timesheets: holds the week being rejected.
    const [rejectModal, setRejectModal] = useState(null);
    const [rejectReason, setRejectReason] = useState("");
    const [rejectSubmitting, setRejectSubmitting] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const userData = JSON.parse(localStorage.getItem("user")) || {};
        setUser(userData);
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch Employees to know their roles
            const empRes = await api("/api/employees");
            const empJson = await empRes.json();
            const empList = empJson.data || empJson || [];
            if (Array.isArray(empList)) {
                setEmployees(empList);
            }

            const tsRes = await api("/api/timesheets?size=10000");

            if (tsRes.ok) {
                const tsJson = await tsRes.json();
                const allTs = tsJson.data || tsJson || [];

                if (Array.isArray(allTs)) {
                    setTimesheets(allTs);
                    const grouped = groupIntoWeeks(allTs);
                    setGroupedWeeks(grouped);
                }
            }
        } catch (err) {
            console.error("Error fetching data", err);
        } finally {
            setLoading(false);
        }
    };

    const groupIntoWeeks = (data) => {
        const weeksMap = {};

        const parseDateLocal = (d) => {
            if (!d) return new Date();
            if (d instanceof Date) return new Date(d);
            const s = d.toString().split('T')[0];
            const parts = s.split('-');
            if (parts.length === 3) {
                return new Date(parts[0], parts[1] - 1, parts[2]);
            }
            return new Date(d);
        };

        const getSaturday = (d) => {
            const date = parseDateLocal(d);
            const day = date.getDay();
            const diff = (day + 1) % 7;
            date.setDate(date.getDate() - diff);
            date.setHours(0, 0, 0, 0);
            return date;
        };

        const formatShortDate = (date) => {
            const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            return `${date.getDate().toString().padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
        };

        const getLocalDateStr = (date) => {
            if (!date) return "";
            if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
                return date.split('T')[0];
            }
            const d = date instanceof Date ? date : new Date(date);
            const year = d.getFullYear();
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        data.forEach(entry => {
            const sat = getSaturday(entry.date);
            const weekKey = getLocalDateStr(sat);

            if (!weeksMap[weekKey]) {
                const fri = new Date(sat);
                fri.setDate(sat.getDate() + 6);
                weeksMap[weekKey] = {
                    weekKey,
                    start: sat,
                    end: fri,
                    startDateStr: formatShortDate(sat),
                    endDateStr: formatShortDate(fri),
                    employees: {}
                };
            }

            const week = weeksMap[weekKey];
            const empId = entry.employeeId;

            if (!week.employees[empId]) {
                week.employees[empId] = {
                    employeeId: empId,
                    employeeName: entry.employeeName,
                    employeeRole: entry.employeeRole || '',
                    employeeStatus: entry.employeeStatus || 'ACTIVE',
                    billableHrs: 0,
                    nonBillableHrs: 0,
                    timeOffHrs: 0,
                    status: 'Approved',
                    entries: []
                };
            }

            const empWeek = week.employees[empId];
            empWeek.entries.push(entry);

            if (entry.category === 'TRUTIME') { /* ignore or add to non-billable */ }
            else if (['HOLIDAY', 'TIMEOFF', 'LEAVE', 'Sick Leave', 'Casual Leave', 'Earned Leave'].some(c => entry.category?.includes(c))) empWeek.timeOffHrs += entry.totalHours;
            else if (entry.billable) empWeek.billableHrs += entry.totalHours;
            else empWeek.nonBillableHrs += entry.totalHours;

            // Preserve actual workflow status codes so admin can approve the correct stage
            if (entry.status === 'PENDING_RM_APPROVAL') {
                empWeek.status = 'PENDING_RM_APPROVAL';
            } else if (entry.status === 'PENDING_HR_APPROVAL' && empWeek.status !== 'PENDING_RM_APPROVAL') {
                empWeek.status = 'PENDING_HR_APPROVAL';
            } else if (entry.status === 'PENDING_ADMIN_APPROVAL' && empWeek.status !== 'PENDING_RM_APPROVAL' && empWeek.status !== 'PENDING_HR_APPROVAL') {
                empWeek.status = 'PENDING_ADMIN_APPROVAL';
            } else if (entry.status === 'REJECTED' && !['PENDING_RM_APPROVAL', 'PENDING_HR_APPROVAL', 'PENDING_ADMIN_APPROVAL'].includes(empWeek.status)) {
                empWeek.status = 'REJECTED';
            } else if (entry.status === 'APPROVED' && !['PENDING_RM_APPROVAL', 'PENDING_HR_APPROVAL', 'PENDING_ADMIN_APPROVAL', 'REJECTED'].includes(empWeek.status)) {
                empWeek.status = 'APPROVED';
            }
        });

        const result = Object.values(weeksMap).map(w => ({
            ...w,
            employeeList: Object.values(w.employees).sort((a, b) => a.employeeName.localeCompare(b.employeeName))
        }));

        return result.sort((a, b) => b.start - a.start);
    };

    const getStatusLabel = (status) => {
        if (status === 'PENDING_RM_APPROVAL' || status === 'PENDING_HR_APPROVAL' || status === 'PENDING_ADMIN_APPROVAL') {
            return 'Pending';
        }
        if (status === 'REJECTED') return 'Rejected';
        if (status === 'APPROVED') return 'Approved';
        return status;
    };

    // Admin-facing status text. For HR employees, the final approver is the Admin, so the
    // label calls that out explicitly (per spec). All other roles keep the generic label
    // so the RM → HR flow display is unchanged.
    const getStatusDisplay = (status, role) => {
        if (role === 'HR') {
            if (status === 'PENDING_ADMIN_APPROVAL') return 'Pending Admin Approval';
            if (status === 'APPROVED') return 'Approved by Admin';
            if (status === 'REJECTED') return 'Rejected by Admin';
        }
        return getStatusLabel(status);
    };

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
    };


    const handleApproveWeek = async (week) => {
        try {
            // Admin can approve ANY pending timesheet, regardless of the stage it currently
            // sits at (RM / HR / Admin). This is an Admin-only override; RM/HR flows unchanged.
            const adminApprovableEntries = week.entries.filter(e =>
                ['PENDING_RM_APPROVAL', 'PENDING_HR_APPROVAL', 'PENDING_ADMIN_APPROVAL'].includes(e.status)
            );

            if (adminApprovableEntries.length === 0) {
                toast.info("No pending timesheets in this week.");
                return;
            }

            setLoading(true);
            for (const entry of adminApprovableEntries) {
                await api(`/api/timesheets/${entry.id}/approve`, {
                    method: 'POST',
                    body: JSON.stringify({ reviewerId: user.id })
                });
            }
            toast.success("Timesheet approved successfully");
            await fetchData();
            setTsSubView('summary');
        } catch (err) {
            console.error(err);
            toast.error("Error approving timesheets");
        } finally {
            setLoading(false);
        }
    };

    // Open the rejection-reason modal (spec: required reason before rejecting).
    const handleRejectWeek = (week) => {
        setRejectReason("");
        setRejectModal(week);
    };

    // Confirm rejection from the modal — reason is required.
    const confirmRejectWeek = async (reason) => {
        const week = rejectModal;
        if (!week) return;

        // Admin can reject ANY pending timesheet, regardless of its current stage
        // (RM / HR / Admin). Admin-only override; RM/HR flows unchanged.
        const adminRejectableEntries = week.entries.filter(e =>
            ['PENDING_RM_APPROVAL', 'PENDING_HR_APPROVAL', 'PENDING_ADMIN_APPROVAL'].includes(e.status)
        );

        if (adminRejectableEntries.length === 0) {
            toast.info("No pending timesheets to reject.");
            setRejectModal(null);
            return;
        }

        try {
            setRejectSubmitting(true);
            setLoading(true);
            for (const entry of adminRejectableEntries) {
                await api(`/api/timesheets/${entry.id}/reject`, {
                    method: 'POST',
                    body: JSON.stringify({ reviewerId: user.id, reason })
                });
            }
            toast.success("Timesheet rejected");
            setRejectModal(null);
            await fetchData();
            setTsSubView('summary');
        } catch (err) {
            console.error(err);
            toast.error("Error rejecting timesheets");
        } finally {
            setRejectSubmitting(false);
            setLoading(false);
        }
    };

    const filteredWeeks = groupedWeeks.map(week => {
        const filteredEmployees = week.employeeList.filter(emp => {
            const profile = employees.find(e => e.id === emp.employeeId);
            const matchesSearch = !tsFilter ||
                (emp.employeeName && emp.employeeName.toLowerCase().includes(tsFilter.toLowerCase())) ||
                emp.employeeId.toString().includes(tsFilter) ||
                (profile?.officeId && profile.officeId.toLowerCase().includes(tsFilter.toLowerCase()));

            if (!matchesSearch) return false;

            const employeeStatusLabel = getStatusLabel(emp.status);
            if (statusFilter !== "All" && employeeStatusLabel !== statusFilter) return false;

            if (roleFilter === "ALL") return true;

            const role = profile?.role?.toUpperCase() || "";

            if (roleFilter === "HR") return role === "HR";
            if (roleFilter === "RM") return role === "REPORTING_MANAGER";
            if (roleFilter === "OTHERS") return role !== "HR" && role !== "REPORTING_MANAGER" && role !== "ADMIN";

            return true;
        });
        return { ...week, filteredEmployees };
    }).filter(week => week.filteredEmployees.length > 0);

    return (
        <div className="flex min-h-screen bg-bg-slate font-brand text-brand-text">
            <AdminSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onLogout={handleLogout}
            />

            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Standardized Header */}
                <header className="bg-white px-4 md:px-8 py-4 flex flex-wrap items-center justify-between shadow-sm z-10 border-b border-[#E3E8EF]">
                    <div className="flex items-center gap-6">
                        <div className="w-11 h-11 bg-[#F1EFE8] rounded-xl flex items-center justify-center border border-[#E3E8EF] shadow-sm overflow-hidden text-sm font-black text-[#2C2C2A]">
                            {user.photoPath ? (
                                <img src={user.photoPath} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                (user.firstName?.[0] || user.fullName?.[0]) || "A"
                            )}
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-[#2C2C2A] tracking-tight">Enterprise Timesheets</h1>
                            <p className="text-[10px] text-[#888780] uppercase font-black tracking-[0.2em] mt-0.5">
                                Personnel Resource Audit
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-bg-slate/50 p-1 rounded-xl border border-brand-blue/5">
                            <div className="px-4 py-1.5 flex items-center gap-2">
                                <Clock size={14} className="text-brand-text/40" />
                                <span className="text-[10px] font-black text-brand-text uppercase tracking-widest">{groupedWeeks.length} Weeks Recorded</span>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 p-4 md:p-10 overflow-y-auto">
                    <div className="max-w-[1200px] mx-auto animate-in fade-in duration-500">
                        {tsSubView === 'summary' ? (
                            <>
                                <div className="bg-white rounded-[24px] p-4 shadow-xl border border-brand-blue/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                                    <div className="flex bg-bg-slate/50 p-1.5 rounded-2xl overflow-x-auto scrollbar-hide">
                                        {["ALL", "HR", "RM", "OTHERS"].map((role) => (
                                            <button
                                                key={role}
                                                onClick={() => setRoleFilter(role)}
                                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${roleFilter === role
                                                    ? "bg-brand-blue-dark text-white shadow-lg shadow-brand-blue/20"
                                                    : "text-brand-text/40 hover:text-brand-text hover:bg-white"
                                                    }`}
                                            >
                                                {role === "RM" ? "REPORTING MANAGERS" : role === "OTHERS" ? "OTHER DEPTS" : role}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex-1 min-w-[280px] relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text/20" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search by personnel, ID or office..."
                                            value={tsFilter}
                                            onChange={(e) => setTsFilter(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3 bg-bg-slate/50 border border-brand-blue/5 rounded-2xl text-[11px] font-bold outline-none focus:border-brand-blue-dark/20 transition-all placeholder:text-brand-text/20"
                                        />
                                    </div>

                                    <div className="flex items-center gap-2 min-w-[170px]">
                                        <label htmlFor="admin-status-filter" className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/50">Status</label>
                                        <select
                                            id="admin-status-filter"
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            className="h-10 rounded-2xl border border-brand-blue/10 bg-white px-3 text-xs font-bold text-brand-text outline-none focus:ring-2 focus:ring-brand-blue/5 shadow-sm"
                                        >
                                            <option>All</option>
                                            <option>Pending</option>
                                            <option>Approved</option>
                                            <option>Rejected</option>
                                        </select>
                                    </div>

                                    <button
                                        onClick={() => setIsDownloadModalOpen(true)}
                                        className="bg-brand-blue-dark text-white px-3 py-3 rounded-2xl shadow-xl shadow-brand-blue/10 active:scale-95 transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest hover:brightness-110"
                                    >
                                        <Download size={14} />
                                        Download Timesheet
                                    </button>
                                </div>

                                <div className="space-y-8">
                                    {loading ? (
                                        <div className="py-20 flex flex-col items-center justify-center space-y-4 bg-white rounded-[32px] border border-brand-blue/5 shadow-sm">
                                            <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
                                            <p className="text-brand-text/40 font-bold uppercase tracking-widest text-[10px]">Processing Personnel Data...</p>
                                        </div>
                                    ) : filteredWeeks.length === 0 ? (
                                        <div className="py-20 text-center bg-white rounded-[32px] border-2 border-dashed border-brand-blue/5">
                                            <p className="text-brand-text/20 font-bold uppercase tracking-widest text-xs italic">No matching records found in archive.</p>
                                        </div>
                                    ) : (
                                        filteredWeeks.map((week, wIdx) => (
                                            <div key={wIdx} className="bg-white rounded-[32px] shadow-xl border border-brand-blue/5 overflow-hidden">
                                                <div className="bg-white p-3 px-6 flex items-center justify-between border-b border-brand-blue/5">
                                                    <div>
                                                        <h3 className="text-brand-text font-black text-sm tracking-tight uppercase">Week of {week.startDateStr}</h3>
                                                        <p className="text-brand-text/40 text-[9px] font-bold uppercase tracking-widest leading-none">{week.startDateStr} — {week.endDateStr}</p>
                                                    </div>
                                                    <div className="bg-brand-blue/5 px-3 py-1 rounded-lg border border-brand-blue/10">
                                                        <span className="text-brand-text font-black text-xs">{week.filteredEmployees.length}</span>
                                                        <span className="text-brand-text/40 text-[8px] font-bold uppercase tracking-widest ml-2">Resources Recorded</span>
                                                    </div>
                                                </div>

                                                <div className="p-4 grid grid-cols-1 gap-2">
                                                    {week.filteredEmployees.map((emp, eIdx) => {
                                                        const isDisabled = emp.employeeStatus === 'INACTIVE' || emp.employeeStatus === 'DISABLED';
                                                        return (
                                                        <div
                                                            key={eIdx}
                                                            onClick={() => {
                                                                setSelectedWeek({
                                                                    ...week,
                                                                    entries: emp.entries,
                                                                    status: emp.status,
                                                                    employeeId: emp.employeeId,
                                                                    employeeName: emp.employeeName,
                                                                    employeeRole: emp.employeeRole,
                                                                    employeeStatus: emp.employeeStatus,
                                                                    startDate: week.startDateStr,
                                                                    endDate: week.endDateStr
                                                                });
                                                                setTsSubView('grid');
                                                            }}
                                                            className={`group p-4 rounded-2xl flex items-center gap-4 border border-transparent transition-all cursor-pointer ${isDisabled ? 'bg-[#F1EFE8]' : 'bg-bg-slate/30 hover:bg-white hover:border-brand-blue/10 hover:shadow-xl hover:shadow-brand-blue/5'}`}
                                                        >
                                                            <div className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black transition-all shadow-sm ${isDisabled ? 'text-brand-text/20' : 'text-brand-text/30 group-hover:bg-brand-blue group-hover:text-white'}`}>
                                                                {emp.employeeName?.[0]}
                                                            </div>

                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className={`font-black text-sm uppercase tracking-tight ${isDisabled ? 'text-brand-text/40' : 'text-brand-text'}`}>{emp.employeeName}<ProjectSuffix project={employees.find(x => String(x.id) === String(emp.employeeId))?.clientProject} /></h4>
                                                                    <span className="text-[10px] font-bold text-brand-text/20 uppercase tracking-widest">ID: {(() => {
                                                                        const profile = employees.find(e => e.id === emp.employeeId);
                                                                        return profile?.oryfolksId || emp.employeeId;
                                                                    })()}</span>
                                                                    {isDisabled && (
                                                                        <span className="inline-flex px-2 py-0.5 bg-[#D3D1C7] text-[#5F5E5A] text-[10px] font-medium rounded-[4px]">DISABLED ACCOUNT</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-3 mt-1">
                                                                    <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${getStatusLabel(emp.status) === 'Approved' ? 'bg-emerald-100 text-emerald-600' :
                                                                        getStatusLabel(emp.status) === 'Rejected' ? 'bg-rose-100 text-rose-600' :
                                                                            'bg-amber-100 text-amber-600'
                                                                        }`}>
                                                                        {getStatusDisplay(emp.status, emp.employeeRole)}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className={`hidden md:flex items-center gap-6 pr-6 ${isDisabled ? 'opacity-60 grayscale' : ''}`}>
                                                                <div className="text-center">
                                                                    <p className="text-xs font-black text-brand-text">{emp.billableHrs.toFixed(1)}</p>
                                                                    <p className="text-[8px] font-black text-brand-text/20 uppercase tracking-widest">Billable</p>
                                                                </div>
                                                                <div className="text-center">
                                                                    <p className="text-xs font-black text-brand-text">{emp.nonBillableHrs.toFixed(1)}</p>
                                                                    <p className="text-[8px] font-black text-brand-text/20 uppercase tracking-widest">Non-Bill</p>
                                                                </div>
                                                                <div className="text-center border-l border-brand-blue/5 pl-6">
                                                                    <p className="text-sm font-black text-indigo-600">{(emp.billableHrs + emp.nonBillableHrs + emp.timeOffHrs).toFixed(1)}</p>
                                                                    <p className="text-[8px] font-black text-indigo-600/30 uppercase tracking-widest">Total</p>
                                                                </div>
                                                            </div>

                                                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-brand-text/20 group-hover:bg-brand-blue group-hover:text-white transition-all shadow-sm">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col gap-6">
                                <WeeklyTimesheetGrid
                                    weekData={selectedWeek}
                                    onBack={() => setTsSubView('summary')}
                                    employeeId={selectedWeek.employeeId}
                                    readOnly={true}
                                    approvedLeaves={[]}
                                    canApprove={['PENDING_RM_APPROVAL', 'PENDING_HR_APPROVAL', 'PENDING_ADMIN_APPROVAL'].includes(selectedWeek?.status)}
                                    canReject={['PENDING_RM_APPROVAL', 'PENDING_HR_APPROVAL', 'PENDING_ADMIN_APPROVAL'].includes(selectedWeek?.status)}
                                    disabledAccount={selectedWeek?.employeeStatus === 'INACTIVE' || selectedWeek?.employeeStatus === 'DISABLED'}
                                    onApprove={() => handleApproveWeek(selectedWeek)}
                                    onReject={() => handleRejectWeek(selectedWeek)}
                                />
                                <div className="flex justify-end gap-4 p-8 bg-white rounded-[32px] border border-brand-blue/5 shadow-xl">
                                    <p className="text-xs font-bold text-brand-text/30 italic uppercase">
                                        Audit recorded for {selectedWeek.employeeName} — Week of {selectedWeek.startDate}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <DownloadTimesheetModal
                isOpen={isDownloadModalOpen}
                onClose={() => setIsDownloadModalOpen(false)}
                employees={employees}
            />

            <RejectRequestModal
                isOpen={!!rejectModal}
                onClose={() => setRejectModal(null)}
                onConfirm={confirmRejectWeek}
                submitting={rejectSubmitting}
            />
        </div>
    );
}




