import React, { useState, useEffect } from "react";
import api from "../../utils/api";

import { useNavigate, useLocation } from "react-router-dom";
import Logo from '../../assets/visionai-logo.png';
import WeeklyTimesheetGrid from "../employee/timesheet/WeeklyTimesheetGrid";
import { toast } from "react-toastify";
import Sidebar from "../../components/Sidebar";
import { getRmNavItems } from "../../utils/rmNav";
import { getWeekStatus, APPROVAL_STATUS } from "../../utils/timesheetStatus";
import { getLeaveStatusLabel, isHrDisabledReroute } from "../../utils/leaveStatus";
import { Eye } from "lucide-react";
import LeaveDetailsModal from "../../components/LeaveDetailsModal";
import LeaveDecisionButtons from "../../components/LeaveDecisionButtons";
import HrRerouteBanner from "../../components/HrRerouteBanner";
import NotificationComponent from "../../components/NotificationComponent";
import { ROLE_LABELS, resolveHeading } from "../../config/pageHeadings";


export default function ReportingManagerTeam() {
    const navigate = useNavigate();
    const location = useLocation();
    const [teamMembers, setTeamMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [view, setView] = useState('team'); // 'team', 'timesheets', or 'leaves'
    const [leaves, setLeaves] = useState([]);
    const [leavesLoading, setLeavesLoading] = useState(false);
    const [leavesError, setLeavesError] = useState(null);
    const [leavesFilter, setLeavesFilter] = useState("");
    const [leaveStatusFilter, setLeaveStatusFilter] = useState("All");
    const storedUser = JSON.parse(localStorage.getItem("user")) || {};
    const initialManagerId = storedUser.employeeId || storedUser.id || storedUser.userId || null;

    const [managerId, setManagerId] = useState(initialManagerId);
    const [userLoading, setUserLoading] = useState(!initialManagerId);
    const [teamTimesheets, setTeamTimesheets] = useState([]);
    const [tsLoading, setTsLoading] = useState(false);
    const [tsError, setTsError] = useState(null);
    const [tsFilter, setTsFilter] = useState("");
    const [tsStatusFilter, setTsStatusFilter] = useState("All");
    const [user, setUser] = useState(storedUser);
    const [tsSubView, setTsSubView] = useState('summary'); // 'summary' or 'grid'
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [groupedWeeks, setGroupedWeeks] = useState([]);
    const [selectedLeave, setSelectedLeave] = useState(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);


    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const viewParam = params.get('view');
        if (viewParam && ['team', 'timesheets', 'leaves'].includes(viewParam)) {
            setView(viewParam);
            if (viewParam === 'timesheets' && managerId) fetchTeamTimesheets(managerId);
            if (viewParam === 'leaves' && managerId) fetchLeaves(managerId);
        }
    }, [location.search, managerId]);

    useEffect(() => {
        if (managerId) {
            fetchTeam(managerId);
        }

        const fetchEmployeeProfile = async () => {
            try {
                const response = await api("/me/employee");
                if (response.ok) {
                    const result = await response.json();
                    const employeeData = result.data || result;
                    if (employeeData && employeeData.id) {
                        setManagerId(employeeData.id);
                        if (!managerId) fetchTeam(employeeData.id);

                        const stored = JSON.parse(localStorage.getItem("user")) || {};
                        const newUser = {
                            ...stored,
                            firstName: employeeData.firstName || stored.firstName,
                            lastName: employeeData.lastName || stored.lastName,
                            fullName: employeeData.firstName ? `${employeeData.firstName} ${employeeData.lastName}` : (stored.fullName || "Reporting Manager"),
                            designation: employeeData.designation || stored.designation,
                            role: stored.role || "REPORTING_MANAGER"
                        };
                        setUser(newUser);
                        localStorage.setItem("user", JSON.stringify(newUser));
                        setUserLoading(false);
                    }
                }
            } catch (err) {
                console.error("🔴 Error fetching employee profile:", err);
            } finally {
                setUserLoading(false);
            }
        };

        fetchEmployeeProfile();
        const handleClickOutside = (event) => {
            if (!event.target.closest("#profile-dropdown-container")) {
                setIsProfileDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [managerId]);


    const fetchLeaves = async (managerId) => {
        setLeavesLoading(true);
        setLeavesError(null);
        try {
            const res = await api(`/api/leaves/manager/${managerId}/team-leaves`);
            if (res.ok) {
                let api = await res.json();
                let data = (api && api.data) ? api.data : [];
                data = (data || []).sort((a, b) => {
                    if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
                    if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
                    return new Date(b.startDate) - new Date(a.startDate);
                });
                setLeaves(data);
            } else {
                setLeavesError("Failed to load leaves. Try again later.");
            }
        } catch (err) {
            setLeavesError("Server error. Try again later.");
        } finally {
            setLeavesLoading(false);
        }
    };

    const fetchTeamTimesheets = async (managerId) => {
        setTsLoading(true);
        setTsError(null);
        try {
            const res = await api(`/api/timesheets/manager/${managerId}/team-timesheets`);
            if (res.ok) {
                const api = await res.json();
                const allEntries = api.data || [];
                setTeamTimesheets(allEntries);
                const grouped = groupTeamIntoWeeks(allEntries);
                setGroupedWeeks(grouped);
            } else {
                setTsError("Failed to load team timesheets.");
            }
        } catch (err) {
            setTsError("Server error loading timesheets.");
        } finally {
            setTsLoading(false);
        }
    };

    const fetchTeam = async (managerId) => {
        setLoading(true);
        setError(null);
        try {
            const res = await api(`/api/reporting-managers/${managerId}`);
            if (res.ok) {
                const data = await res.json();
                const team = (data.team || []).filter(member => member.id !== managerId);
                setTeamMembers(team);
            } else {
                setError("Failed to load team data. Please try again later.");
            }
        } catch (err) {
            console.error("Error fetching team:", err);
            setError("Server connection failed. Please check your network.");
        } finally {
            setLoading(false);
        }
    };

    const handleApproveTimesheet = async (id) => {
        try {
            const response = await api(`/api/timesheets/${id}/approve`, {
                method: 'POST',
                body: JSON.stringify({ reviewerId: managerId, comments: "Approved by manager" })
            });
            if (response.ok) {
                if (managerId) fetchTeamTimesheets(managerId);
            }
        } catch (err) {
            console.error("Error approving timesheet:", err);
        }
    };

    const handleRejectTimesheet = async (id) => {
        const reason = window.prompt("Enter reason for rejection:", "Rejected by manager");
        if (reason === null) return;
        try {
            const response = await api(`/api/timesheets/${id}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reviewerId: managerId, reason: reason })
            });
            if (response.ok) {
                if (managerId) fetchTeamTimesheets(managerId);
            }
        } catch (err) {
            console.error("Error rejecting timesheet:", err);
        }
    };

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
    };


    const formatDateTime = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const calculateLeaveDays = (startDate, endDate) => {
        if (!startDate || !endDate) return 1;
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffTime = Math.abs(end - start);
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        } catch (e) {
            return 1;
        }
    };

    const groupTeamIntoWeeks = (data) => {
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
                    employeeStatus: entry.employeeStatus || 'ACTIVE',
                    hrDisabledReroute: false,
                    billableHrs: 0,
                    nonBillableHrs: 0,
                    timeOffHrs: 0,
                    status: 'Approved',
                    entries: []
                };
            }
            const empWeek = week.employees[empId];
            empWeek.entries.push(entry);
            // Flag the week when any entry is on the HR-disabled reroute path (Part 3/6).
            if (entry.hrDisabledReroute || entry.status === APPROVAL_STATUS.PENDING_RM_AS_HR_APPROVAL) {
                empWeek.hrDisabledReroute = true;
            }
            if (entry.category === 'TRUTIME') { }
            else if (['HOLIDAY', 'TIMEOFF', 'LEAVE', 'Sick Leave', 'Casual Leave', 'Earned Leave'].some(c => entry.category?.includes(c))) empWeek.timeOffHrs += entry.totalHours;
            else if (entry.billable) empWeek.billableHrs += entry.totalHours;
            else empWeek.nonBillableHrs += entry.totalHours;

            if (entry.status === APPROVAL_STATUS.PENDING_RM_APPROVAL) empWeek.status = APPROVAL_STATUS.PENDING_RM_APPROVAL;
            else if (entry.status === APPROVAL_STATUS.PENDING_HR_APPROVAL && empWeek.status !== APPROVAL_STATUS.PENDING_RM_APPROVAL) empWeek.status = APPROVAL_STATUS.PENDING_HR_APPROVAL;
            else if (entry.status === APPROVAL_STATUS.PENDING_ADMIN_APPROVAL && ![APPROVAL_STATUS.PENDING_RM_APPROVAL, APPROVAL_STATUS.PENDING_HR_APPROVAL].includes(empWeek.status)) empWeek.status = APPROVAL_STATUS.PENDING_ADMIN_APPROVAL;
            else if (entry.status === APPROVAL_STATUS.REJECTED && ![APPROVAL_STATUS.PENDING_RM_APPROVAL, APPROVAL_STATUS.PENDING_HR_APPROVAL, APPROVAL_STATUS.PENDING_ADMIN_APPROVAL].includes(empWeek.status)) empWeek.status = APPROVAL_STATUS.REJECTED;
            else if (entry.status === APPROVAL_STATUS.APPROVED && ![APPROVAL_STATUS.PENDING_RM_APPROVAL, APPROVAL_STATUS.PENDING_HR_APPROVAL, APPROVAL_STATUS.PENDING_ADMIN_APPROVAL, APPROVAL_STATUS.REJECTED].includes(empWeek.status)) empWeek.status = APPROVAL_STATUS.APPROVED;

            const weekStatus = getWeekStatus(empWeek.entries, 'REPORTING_MANAGER');
            empWeek.status = weekStatus.status;
            empWeek.statusLabel = weekStatus.statusLabel;
        });

        const result = Object.values(weeksMap).map(w => ({
            ...w,
            employeeList: Object.values(w.employees).sort((a, b) => (a.employeeName || "").localeCompare(b.employeeName || ""))
        }));
        return result.sort((a, b) => b.start - a.start);
    };

    const handleApproveWeek = async (week) => {
        try {
            // The RM acts on their RM stage and, when HR is disabled, the stand-in HR stage.
            const pendingEntries = week.entries.filter(e => e.status === APPROVAL_STATUS.PENDING_RM_APPROVAL || e.status === APPROVAL_STATUS.PENDING_RM_AS_HR_APPROVAL);
            if (pendingEntries.length === 0) {
                toast.info("No pending entries to approve in this week.");
                return;
            }
            setTsLoading(true);
            for (const entry of pendingEntries) {
                await api(`/api/timesheets/${entry.id}/approve`, {
                    method: 'POST',
                    body: JSON.stringify({ reviewerId: managerId, comments: "Approved by manager" })
                });
            }
            toast.success(`Week approved for ${week.employeeName}`);
            await fetchTeamTimesheets(managerId);
            setTsSubView('summary');
        } catch (err) {
            toast.error("Error approving week");
        } finally {
            setTsLoading(false);
        }
    };

    const handleRejectWeek = async (week) => {
        const reason = window.prompt("Enter reason for rejection:", "Rejected by manager");
        if (reason === null) return;
        try {
            const pendingEntries = week.entries.filter(e => e.status === APPROVAL_STATUS.PENDING_RM_APPROVAL || e.status === APPROVAL_STATUS.PENDING_RM_AS_HR_APPROVAL);
            setTsLoading(true);
            for (const entry of pendingEntries) {
                await api(`/api/timesheets/${entry.id}/reject`, {
                    method: 'POST',
                    body: JSON.stringify({ reviewerId: managerId, reason: reason })
                });
            }
            toast.success(`Week rejected for ${week.employeeName}`);
            await fetchTeamTimesheets(managerId);
            setTsSubView('summary');
        } catch (err) {
            toast.error("Error rejecting week");
        } finally {
            setTsLoading(false);
        }
    };

    const navItems = getRmNavItems(view === 'team' ? 'team' : view === 'timesheets' ? 'team-timesheets' : 'team-leaves');

    const headingSection = { team: 'teamMembers', timesheets: 'teamTimesheets', leaves: 'teamLeaves' }[view];
    const ribbonUser = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}") || {}; } catch { return {}; } })();
    const ribbonTitle = resolveHeading(ribbonUser.role, headingSection);
    const ribbonRoleLabel = ROLE_LABELS[ribbonUser.role] || ribbonUser.role || "";
    const ribbonName = ribbonUser.fullName || `${ribbonUser.firstName || ""} ${ribbonUser.lastName || ""}`.trim();

    return (
        <div className="flex flex-col md:flex-row w-full min-h-screen bg-bg-slate font-brand text-brand-text">
            <Sidebar
                activeTab={view === 'team' ? 'team' : view === 'timesheets' ? 'team-timesheets' : 'team-leaves'}
                setActiveTab={(tab) => {
                    if (tab === 'team') setView('team');
                    else if (tab === 'team-timesheets') setView('timesheets');
                    else if (tab === 'team-leaves') setView('leaves');
                }}
                handleLogout={handleLogout}
                navItems={navItems}
                hideLogout={true}
            />


            <main className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="bg-white px-4 md:px-8 py-4 flex flex-wrap items-center justify-between shadow-sm z-10 border-b border-[#E3E8EF]">
                    <div className="flex items-center gap-6">
                        <div className="w-11 h-11 bg-[#F1EFE8] rounded-xl flex items-center justify-center border border-[#E3E8EF] shadow-sm overflow-hidden text-sm font-black text-[#2C2C2A]">
                            {user.photoPath ? (
                                <img src={user.photoPath} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                (user.firstName?.[0] || user.fullName?.[0]) || "M"
                            )}
                        </div>
                        <div>
                            <h1 className="text-[16px] font-medium text-brand-text tracking-tight leading-tight">
                                {ribbonTitle}
                            </h1>
                            <p className="text-[12px] text-brand-text-secondary mt-0.5">
                                {ribbonRoleLabel}{ribbonRoleLabel && ribbonName ? " · " : ""}{ribbonName}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 relative" id="profile-dropdown-container">
                        <NotificationComponent />
                        <button
                            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                            className="w-10 h-10 rounded-full border-2 border-brand-blue/10 overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-md flex items-center justify-center bg-white p-0"
                            title="View Profile"
                        >
                            {user.photoPath ? (
                                <img src={user.photoPath} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <svg className="w-6 h-6 text-brand-text/20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                            )}
                        </button>

                        {/* Dropdown Menu */}
                        {isProfileDropdownOpen && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-brand-blue/5 py-2 z-[100] animate-in fade-in zoom-in duration-200 origin-top-right">
                                <button
                                    onClick={() => {
                                        navigate("/reporting-dashboard?tab=profile");
                                        setIsProfileDropdownOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-brand-text hover:bg-bg-slate transition-colors"
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="12" cy="7" r="4"></circle>
                                    </svg>
                                    My Profile
                                </button>
                                <div className="h-px bg-brand-blue/5 mx-2 my-1"></div>
                                <button
                                    onClick={() => {
                                        setIsProfileDropdownOpen(false);
                                        handleLogout();
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                        <polyline points="16 17 21 12 16 7"></polyline>
                                        <line x1="21" y1="12" x2="9" y2="12"></line>
                                    </svg>
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>

                </header>


                <div className="flex-1 p-4 md:p-8 overflow-y-auto">
                    {view === 'team' && (
                        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl border border-brand-blue/5 p-6 md:p-10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-yellow/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {loading ? (
                                    <div className="col-span-full py-20 flex flex-col items-center justify-center space-y-4">
                                        <div className="w-12 h-12 border-4 border-brand-yellow/30 border-t-brand-yellow rounded-full animate-spin" />
                                        <p className="text-brand-text/40 font-bold uppercase tracking-widest text-[10px]">Fetching Team Members...</p>
                                    </div>
                                ) : error ? (
                                    <div className="col-span-full py-20 text-center space-y-4">
                                        <div className="text-red-500 font-bold uppercase tracking-widest text-xs">{error}</div>
                                        <button onClick={() => fetchTeam(managerId)} className="btn-primary text-[10px]">Retry</button>
                                    </div>
                                ) : teamMembers.length === 0 ? (
                                    <div className="col-span-full py-20 text-center">
                                        <p className="text-brand-text/30 font-bold uppercase tracking-widest text-xs italic">No team members assigned yet.</p>
                                    </div>
                                ) : (
                                    teamMembers.map((member) => (
                                        <div key={member.id} className="bg-bg-slate p-6 rounded-2xl border border-brand-blue/5 flex flex-col items-center text-center group card-hover relative">
                                            <div className="w-14 h-14 bg-white rounded-2xl mb-4 flex items-center justify-center p-3 text-brand-text/20 group-hover:bg-brand-yellow group-hover:text-brand-text transition-all duration-300 shadow-sm border border-brand-blue/5">
                                                <svg fill="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                </svg>
                                            </div>
                                            <h2 className="text-sm font-bold text-brand-text leading-tight mb-0.5">{member.name || member.fullName}</h2>
                                            {member.active === false && (
                                                <span className="inline-flex px-2 py-0.5 mb-1 bg-[#D3D1C7] text-[#5F5E5A] text-[10px] font-medium rounded-[4px]">DISABLED</span>
                                            )}
                                            <p className="text-[10px] text-brand-text/40 font-bold mb-4 tracking-wider">ID: {member.id}</p>
                                            <div className="w-full space-y-3 pt-4 border-t border-brand-blue/5 mt-auto">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[8px] uppercase font-bold text-brand-text/30 tracking-[0.2em] mb-1">Position</span>
                                                    <span className="text-[11px] font-bold text-brand-text/70 leading-tight">{member.role || "Employee"}</span>
                                                </div>
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className="text-[10px] font-semibold text-brand-text/50 truncate w-full px-2">{member.corporateEmail || "Not Available"}</span>
                                                    <button onClick={() => navigate(`/admin/employee/${member.id}`)} className="w-full py-2 bg-brand-blue-dark text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-blue-hover transition-all active:scale-95 shadow-md">View Profile</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                    {view === 'timesheets' && (
                        <div className="max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {tsSubView === 'summary' ? (
                                <>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 mb-8">
                                    <input type="text" placeholder="Filter by Name or ID..." value={tsFilter} onChange={(e) => setTsFilter(e.target.value)} className="w-full sm:w-64 h-10 bg-white border border-brand-blue/10 rounded-xl px-4 text-xs font-bold text-brand-text outline-none focus:ring-2 focus:ring-brand-blue/5 shadow-sm" />
                                    <div className="flex items-center gap-2">
                                        <label htmlFor="rm-status-filter" className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/50">Status</label>
                                        <select
                                            id="rm-status-filter"
                                            value={tsStatusFilter}
                                            onChange={(e) => setTsStatusFilter(e.target.value)}
                                            className="h-10 rounded-xl border border-brand-blue/10 bg-white px-3 text-xs font-bold text-brand-text outline-none focus:ring-2 focus:ring-brand-blue/5 shadow-sm"
                                        >
                                            <option>All</option>
                                            <option>Pending</option>
                                            <option>Approved</option>
                                            <option>Rejected</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-8">
                                        {tsLoading ? (
                                            <div className="py-20 flex flex-col items-center justify-center space-y-4 bg-white rounded-[32px] border border-brand-blue/5 shadow-sm">
                                                <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
                                                <p className="text-brand-text/40 font-bold uppercase tracking-widest text-[10px]">Filtering Team Evidence...</p>
                                            </div>
                                        ) : groupedWeeks.length === 0 ? (
                                            <div className="py-20 text-center bg-white rounded-[32px] border-2 border-dashed border-brand-blue/5">
                                                <p className="text-brand-text/20 font-bold uppercase tracking-widest text-xs italic">No team timesheet records found.</p>
                                            </div>
                                        ) : (
                                            groupedWeeks.map(week => {
                                                const filteredEmployees = week.employeeList.filter(emp => {
                                                    const matchesSearch = !tsFilter || emp.employeeName.toLowerCase().includes(tsFilter.toLowerCase()) || emp.employeeId.toString().includes(tsFilter);
                                                    const matchesStatus = tsStatusFilter === "All" ||
                                                        (tsStatusFilter === "Pending" && [
                                                            APPROVAL_STATUS.PENDING_RM_APPROVAL,
                                                            APPROVAL_STATUS.PENDING_HR_APPROVAL,
                                                            APPROVAL_STATUS.PENDING_RM_AS_HR_APPROVAL,
                                                            APPROVAL_STATUS.PENDING_ADMIN_APPROVAL
                                                        ].includes(emp.status)) ||
                                                        (tsStatusFilter === "Approved" && emp.status === APPROVAL_STATUS.APPROVED) ||
                                                        (tsStatusFilter === "Rejected" && emp.status === APPROVAL_STATUS.REJECTED);
                                                    return matchesSearch && matchesStatus;
                                                });
                                                return { ...week, filteredEmployees };
                                            }).filter(week => week.filteredEmployees.length > 0).map((week, wIdx) => (
                                                <div key={wIdx} className="bg-white rounded-[32px] shadow-xl border border-brand-blue/5 overflow-hidden">
                                                    <div className="bg-white p-3 px-6 flex items-center justify-between border-b border-brand-blue/5">
                                                        <div>
                                                            <h3 className="text-brand-text font-black text-sm uppercase">Week of {week.startDateStr}</h3>
                                                            <p className="text-brand-text/40 text-[9px] font-bold uppercase tracking-widestLeading-none">{week.startDateStr} — {week.endDateStr}</p>
                                                        </div>
                                                        <div className="bg-brand-blue/5 px-3 py-1 rounded-lg border border-brand-blue/10">
                                                            <span className="text-brand-text font-black text-xs">{week.filteredEmployees.length}</span>
                                                            <span className="text-brand-text/40 text-[8px] font-bold uppercase tracking-widest ml-2">Team Members Recorded</span>
                                                        </div>
                                                    </div>
                                                    <div className="p-4 grid grid-cols-1 gap-2">
                                                        {week.filteredEmployees.map((emp, eIdx) => {
                                                            const isDisabled = emp.employeeStatus === 'INACTIVE' || emp.employeeStatus === 'DISABLED';
                                                            return (
                                                            <div key={eIdx} onClick={() => { setSelectedWeek({ ...week, entries: emp.entries, status: emp.status, statusLabel: emp.statusLabel, employeeId: emp.employeeId, employeeName: emp.employeeName, employeeStatus: emp.employeeStatus, hrDisabledReroute: emp.hrDisabledReroute, startDate: week.startDateStr, endDate: week.endDateStr }); setTsSubView('grid'); }} className={`group p-4 rounded-2xl flex items-center gap-4 border border-transparent transition-all cursor-pointer ${isDisabled ? 'bg-[#F1EFE8]' : 'bg-bg-slate/30 hover:bg-white hover:border-brand-blue/10 hover:shadow-xl'}`}>
                                                                <div className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black transition-all shadow-sm ${isDisabled ? 'text-brand-text/20' : 'text-brand-text/30 group-hover:bg-brand-blue group-hover:text-white'}`}>{emp.employeeName?.[0]}</div>
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <h4 className={`font-black text-sm uppercase tracking-tight ${isDisabled ? 'text-brand-text/40' : 'text-brand-text'}`}>{emp.employeeName}</h4>
                                                                        <span className="text-[10px] font-bold text-brand-text/20 uppercase tracking-widest">ID: {emp.employeeId}</span>
                                                                        {isDisabled && (
                                                                            <span className="inline-flex px-2 py-0.5 bg-[#D3D1C7] text-[#5F5E5A] text-[10px] font-medium rounded-[4px]">DISABLED ACCOUNT</span>
                                                                        )}
                                                                    </div>
                                                                    <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase inline-block mt-1 ${emp.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : emp.status === 'REJECTED' ? 'bg-rose-100 text-rose-600' : (emp.status === 'PENDING_HR_APPROVAL' || emp.status === 'PENDING_RM_AS_HR_APPROVAL') ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>{emp.statusLabel || emp.status}</div>
                                                                    {emp.hrDisabledReroute && (
                                                                        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                                                                            <HrRerouteBanner variant="row" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className={`hidden md:flex items-center gap-6 pr-6 ${isDisabled ? 'opacity-60 grayscale' : ''}`}>
                                                                    <div className="text-center"><p className="text-xs font-black text-brand-text">{emp.billableHrs.toFixed(1)}</p><p className="text-[8px] font-black text-brand-text/20 uppercase tracking-widest">Billable</p></div>
                                                                    <div className="text-center"><p className="text-xs font-black text-brand-text">{emp.nonBillableHrs.toFixed(1)}</p><p className="text-[8px] font-black text-brand-text/20 uppercase tracking-widest">Non-Bill</p></div>
                                                                    <div className="text-center border-l border-brand-blue/5 pl-6"><p className="text-sm font-black text-indigo-600">{(emp.billableHrs + emp.nonBillableHrs + emp.timeOffHrs).toFixed(1)}</p><p className="text-[8px] font-black text-indigo-600/30 uppercase tracking-widest">Total</p></div>
                                                                </div>
                                                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-brand-text/20 group-hover:bg-brand-blue group-hover:text-white transition-all shadow-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg></div>
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
                                    employeeId={selectedWeek.employeeId}
                                    readOnly={true}
                                    approvedLeaves={[]}
                                    canApprove={selectedWeek?.status === APPROVAL_STATUS.PENDING_RM_APPROVAL || selectedWeek?.status === APPROVAL_STATUS.PENDING_RM_AS_HR_APPROVAL}
                                    canReject={selectedWeek?.status === APPROVAL_STATUS.PENDING_RM_APPROVAL || selectedWeek?.status === APPROVAL_STATUS.PENDING_RM_AS_HR_APPROVAL}
                                    disabledAccount={selectedWeek?.employeeStatus === 'INACTIVE' || selectedWeek?.employeeStatus === 'DISABLED'}
                                    hrDisabledReroute={selectedWeek?.hrDisabledReroute}
                                    hrRerouteEmployeeName={selectedWeek?.employeeName}
                                    onBack={() => setTsSubView('summary')}
                                    onApprove={() => handleApproveWeek(selectedWeek)}
                                    onReject={() => handleRejectWeek(selectedWeek)}
                                />
                                </div>
                            )}
                        </div>
                    )}
                    {view === 'leaves' && (
                        <div className="max-w-[1200px] mx-auto">
                            <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-4 mb-8">
                                <input type="text" placeholder="Filter by name..." value={leavesFilter} onChange={(e) => setLeavesFilter(e.target.value)} className="w-full sm:w-[268px] h-[47px] bg-white border-2 border-transparent focus:border-brand-yellow rounded-2xl px-5 text-sm font-bold text-brand-text outline-none transition-all shadow-sm" />
                                <div className="flex items-center gap-2">
                                    <label htmlFor="rm-leave-status-filter" className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/50">Status</label>
                                    <select
                                        id="rm-leave-status-filter"
                                        value={leaveStatusFilter}
                                        onChange={(e) => setLeaveStatusFilter(e.target.value)}
                                        className="h-[47px] rounded-2xl border border-brand-blue/10 bg-white px-3 text-[11px] font-bold text-brand-text outline-none focus:ring-2 focus:ring-brand-blue/10"
                                    >
                                        <option>All</option>
                                        <option>Pending</option>
                                        <option>Approved</option>
                                        <option>Rejected</option>
                                    </select>
                                </div>
                            </div>
                            <div className="bg-white rounded-[20px] shadow-xl overflow-hidden border border-brand-blue/5">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-bg-slate/50">
                                            <tr className="text-brand-text/40 font-black uppercase tracking-[0.15em] text-[11px]">
                                                <th className="p-5 px-8">Emp ID</th><th className="p-5 px-6">Name</th><th className="p-5 px-6">Type</th><th className="p-5 px-6 text-center">Dates</th><th className="p-5 px-6 text-center">Status</th><th className="p-5 px-8 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-brand-blue/5">
                                            {leavesLoading ? (<tr><td colSpan="6" className="p-20 text-center animate-pulse">Loading Team Leaves...</td></tr>) : leavesError ? (<tr><td colSpan="6" className="p-20 text-center text-red-500">{leavesError}</td></tr>) : leaves.length === 0 ? (<tr><td colSpan="6" className="p-20 text-center italic">No leave requests found.</td></tr>) : (
                                                leaves.filter(lv => (leaveStatusFilter === "All" || (lv.status || '').toUpperCase() === leaveStatusFilter.toUpperCase()) && (!leavesFilter || lv.employeeName.toLowerCase().includes(leavesFilter.toLowerCase()))).map((leave) => {
                                                    const isDisabled = leave.employeeStatus === 'INACTIVE' || leave.employeeStatus === 'DISABLED';
                                                    return (
                                                    <tr key={leave.id} className={`transition-colors font-medium ${isDisabled ? 'bg-[#F1EFE8]' : 'hover:bg-bg-slate/40'}`}>
                                                        <td className="p-5 px-8 text-xs font-black text-brand-text/40">#{leave.employeeId}</td>
                                                        <td className={`p-5 px-6 font-bold uppercase text-xs ${isDisabled ? 'text-brand-text/40' : 'text-brand-text'}`}>
                                                            <div className="flex items-center gap-2">
                                                                <span>{leave.employeeName}</span>
                                                                {isDisabled && (
                                                                    <span className="inline-flex px-2 py-0.5 bg-[#D3D1C7] text-[#5F5E5A] text-[10px] font-medium rounded-[4px] normal-case tracking-normal">DISABLED ACCOUNT</span>
                                                                )}
                                                            </div>
                                                            {isHrDisabledReroute(leave) && (
                                                                <div className="mt-1.5 normal-case tracking-normal font-normal">
                                                                    <HrRerouteBanner variant="row" />
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-5 px-6 text-brand-text/70 text-xs font-bold">{leave.type || leave.leaveType}</td>
                                                        <td className="p-5 px-6 text-brand-text/60 text-xs text-center">{leave.startDate}{leave.endDate && leave.endDate !== leave.startDate ? ` → ${leave.endDate}` : ''}</td>
                                                        <td className="p-5 px-6 text-center"><span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${leave.status === 'PENDING' ? 'bg-brand-yellow/10 text-brand-yellow-dark' : leave.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{getLeaveStatusLabel(leave, 'REPORTING_MANAGER')}</span></td>
                                                        <td className="p-5 px-8 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedLeave(leave);
                                                                        setIsDetailsModalOpen(true);
                                                                    }}
                                                                    className="p-2 bg-brand-blue/5 text-brand-text rounded-lg hover:bg-brand-blue-dark hover:text-white transition-all shadow-sm"
                                                                    title="View Details"
                                                                >
                                                                    <Eye size={14} />
                                                                </button>
                                                                {leave.status === 'PENDING' && !isDisabled && (
                                                                    <LeaveDecisionButtons
                                                                        onApprove={async () => { await api(`/api/leaves/${leave.id}/approve`, { method: 'POST', body: JSON.stringify({ approverId: managerId }) }); fetchLeaves(managerId); }}
                                                                        onReject={async () => { await api(`/api/leaves/${leave.id}/reject`, { method: 'POST', body: JSON.stringify({ approverId: managerId, reason: "Rejected by manager" }) }); fetchLeaves(managerId); }}
                                                                    />
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <LeaveDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                leave={selectedLeave}
            />
        </div>
    );
}




