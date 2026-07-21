import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../utils/api";
import AdminSidebar from "../../components/AdminSidebar";
import EmployeeSelectorModal from "../../components/EmployeeSelectorModal";
import AddEmployeeModal from "../../components/AddEmployeeModal";
import HRSelectorModal from "../../components/HRSelectorModal";
import AssignEmployeeToHrModal from "../../components/AssignEmployeeToHrModal";
import AssignEmployeeToClientProjectModal from "../../components/AssignEmployeeToClientProjectModal";
import MetricCard from "../../components/MetricCard";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, Label } from 'recharts';
import { Calendar as CalendarIconSVG, Eye, ShieldCheck } from "lucide-react";
import YearlyHolidayCalendar from "../common/YearlyHolidayCalendar";
import LeaveDetailsModal from "../../components/LeaveDetailsModal";
import LeaveDecisionButtons from "../../components/LeaveDecisionButtons";
import NotificationComponent from "../../components/NotificationComponent";
import { toast } from 'react-toastify';

// Builds initials (max 2) from a full name, e.g. "Mounika K" -> "MK".
function hrInitials(name) {
  const parts = (name || "").split(" ").filter(Boolean).slice(0, 2);
  const s = parts.map((p) => p[0]).join("").toUpperCase();
  return s || "H";
}

function HRTeamDisplay() {
  const [hrTeams, setHrTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHRTeams = async () => {
      try {
        setLoading(true);
        // Each HR with the employees assigned to them (name, id, designation, status).
        const res = await api("/api/admin/hr-teams");
        const json = await res.json();
        const data = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
        setHrTeams(data);
      } catch (error) {
        console.error("Error fetching HR teams:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHRTeams();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4 opacity-30">
        <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-text">Synchronizing Team Data</p>
      </div>
    );
  }

  if (hrTeams.length === 0) {
    return (
      <div className="bg-white/50 backdrop-blur-md rounded-[32px] p-20 text-center border border-dashed border-brand-blue/20 shadow-xl shadow-brand-blue/5">
        <div className="w-16 h-16 bg-brand-blue/5 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-brand-text/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-black text-brand-text tracking-tight">Personnel Registry Empty</h3>
        <p className="text-[10px] text-brand-text/30 mt-2 font-black uppercase tracking-[0.2em]">Administrative provision required</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-text/40">HR Team &amp; Assigned Employees</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {hrTeams.map((hr) => {
          const hrDisabled = hr.status === 'INACTIVE' || hr.status === 'DISABLED';
          return (
            <div key={hr.hrEmployeeId || hr.hrId} className="bg-white rounded-xl p-4 border border-brand-blue/10 shadow-lg shadow-brand-blue/5">
              {/* HR header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-brand-blue-dark rounded-full flex items-center justify-center text-white font-black text-sm shadow-md shadow-brand-blue/10 flex-shrink-0">
                  {hrInitials(hr.hrName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-[15px] text-brand-text tracking-tight truncate">{hr.hrName}</h3>
                    <span className="text-[12px] font-bold text-brand-text/50">· {hr.hrId}</span>
                    {hrDisabled && (
                      <span className="inline-flex px-2 py-0.5 bg-[#D3D1C7] text-[#5F5E5A] text-[10px] font-medium rounded-[4px]">DISABLED ACCOUNT</span>
                    )}
                  </div>
                  <p className="text-[12px] font-bold text-brand-text/50 mt-0.5">{hr.designation}</p>
                  <p className="text-[12px] font-semibold text-brand-text/40 mt-0.5">Assigned Employees: {hr.totalAssigned}</p>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-brand-blue/10 my-3" />

              {/* Assigned employees */}
              {(!hr.assignedEmployees || hr.assignedEmployees.length === 0) ? (
                <p className="text-[12px] italic text-brand-text/40">No employees assigned to this HR yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {hr.assignedEmployees.map((emp, idx) => {
                    const empDisabled = emp.status === 'INACTIVE' || emp.status === 'DISABLED';
                    return (
                      <div key={idx} className="flex items-center gap-2 flex-wrap">
                        <span className="text-brand-text/30 text-[13px]">→</span>
                        <span className={`text-[13px] font-bold ${empDisabled ? 'text-brand-text/40' : 'text-brand-text'}`}>{emp.employeeName}</span>
                        <span className="text-[11px] font-semibold text-brand-text/40">· {emp.employeeId}</span>
                        <span className="text-[11px] font-semibold text-brand-text/40">· {emp.designation}</span>
                        {empDisabled ? (
                          <span className="inline-flex px-2 py-0.5 bg-[#D3D1C7] text-[#5F5E5A] text-[10px] font-medium rounded-[4px]">DISABLED</span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-[4px]">ACTIVE</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab || "dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingLeaveId, setRejectingLeaveId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [isHRModalOpen, setIsHRModalOpen] = useState(false);
  const [hrTeamMembers, setHrTeamMembers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveSearch, setLeaveSearch] = useState("");
  const [leaveRoleFilter, setLeaveRoleFilter] = useState("ALL");

  // Map employeeId -> role for the leave role filter
  const employeeRoleMap = employees.reduce((acc, emp) => {
    acc[emp.id] = emp.role || "EMPLOYEE";
    return acc;
  }, {});
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const [stats, setStats] = useState({
    totalEmployees: 0,
    hrUsers: 0,
    pendingLeaves: 0,
    reportingManagers: 0,
  });

  // Top-of-dashboard metric cards (Total / Present / Absent today)
  const [absentToday, setAbsentToday] = useState(0);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const [isYearlyCalendarOpen, setIsYearlyCalendarOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});
  const [hoveredLeaveData, setHoveredLeaveData] = useState(null);

  const fetchCalendarData = async (date) => {
    try {
      const year = date.getFullYear();
      const month = date.getMonth();
      const formatDateLocal = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };
      const start = formatDateLocal(new Date(year, month, 1));
      const end = formatDateLocal(new Date(year, month + 1, 0));
      const res = await api(`/api/attendance/calendar?start=${start}&end=${end}`);
      const data = await res.json();
      if (data.status === "success") {
        setCalendarData(data.data.dailyLeaves || {});
      }
    } catch (error) {
      console.error("Error fetching calendar data:", error);
    }
  };

  useEffect(() => {
    fetchCalendarData(currentDate);
  }, [currentDate]);

  const changeMonth = (offset) => {
    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(nextDate);
  };

  const navigate = useNavigate();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user")) || {};
    setCurrentUserId(userData.id || userData.userId);
  }, []);

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const response = await api("/api/leaves");
      if (response.ok) {
        const data = await response.json();
        const allLeaves = data.data || [];
        const sorted = [...allLeaves].sort((a, b) => {
          if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
          if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
          const dateA = new Date(a.startDate);
          const dateB = new Date(b.startDate);
          return dateB - dateA;
        });
        setLeaveRequests(sorted);
        const pending = allLeaves.filter(leave => leave.status === 'PENDING');
        setPendingLeaves(pending);
        setStats((prev) => ({ ...prev, pendingLeaves: pending.length }));
      }
    } catch (error) {
      console.error("Error fetching leave requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const empRes = await api("/api/employees");
        const empData = empRes.ok ? await empRes.json() : {};
        const employees = Array.isArray(empData.data) ? empData.data : [];
        setEmployees(employees);
        const activeEmployees = employees.filter(emp => {
          const isSystemAdmin = (emp.role === 'ADMIN') || (emp.firstName === 'System' && emp.lastName === 'Admin');
          return !isSystemAdmin;
        });
        const usersRes = await api("/api/users");
        const usersData = usersRes.ok ? await usersRes.json() : {};
        const users = Array.isArray(usersData) ? usersData : [];
        const hrUsers = users.filter((u) => u.role === "HR").length;
        const reportingManagers = users.filter((u) => u.role === "REPORTING_MANAGER").length;
        setStats((prev) => ({
          ...prev,
          totalEmployees: activeEmployees.length,
          hrUsers,
          reportingManagers,
        }));

        // Absent today = employees on approved leave for today's (dynamic) date.
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const attRes = await api(`/api/attendance/calendar?start=${todayStr}&end=${todayStr}`);
        const attData = attRes.ok ? await attRes.json() : {};
        const onLeaveToday = attData?.data?.dailyLeaves?.[todayStr] || [];
        setAbsentToday(Array.isArray(onLeaveToday) ? onLeaveToday.length : 0);
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setMetricsLoading(false);
      }
    };
    fetchStats();
    fetchLeaveRequests();
  }, []);

  const refreshData = async () => {
    try {
      const empRes = await api("/api/employees");
      const empData = await empRes.json();
      const employees = Array.isArray(empData.data) ? empData.data : [];
      const activeEmployees = employees.filter(emp => {
        const isSystemAdmin = (emp.role === 'ADMIN') || (emp.firstName === 'System' && emp.lastName === 'Admin');
        return !isSystemAdmin;
      });
      const usersRes = await api("/api/users");
      const usersData = await usersRes.json();
      const users = Array.isArray(usersData) ? usersData : [];
      const hrUsers = users.filter((u) => u.role === "HR").length;
      const reportingManagers = users.filter((u) => u.role === "REPORTING_MANAGER").length;
      setStats({
        totalEmployees: activeEmployees.length,
        hrUsers,
        pendingLeaves: pendingLeaves.length,
        reportingManagers,
      });
    } catch (err) {
      console.error("Refresh failed", err);
    }
  };

  const handleQuickAction = (action) => {
    if (action === "add-employee") setIsAddEmployeeModalOpen(true);
    else if (action === "create-hr") setIsHRModalOpen(true);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignHrModalOpen, setIsAssignHrModalOpen] = useState(false);
  const [isAssignClientProjectModalOpen, setIsAssignClientProjectModalOpen] = useState(false);
  const handleOpenReportingManagerModal = () => setIsModalOpen(true);
  const handleModalClose = () => setIsModalOpen(false);
  const handleAddEmployeeModalClose = () => setIsAddEmployeeModalOpen(false);
  const handleAddReportingManagers = () => setIsModalOpen(false);
  const handleHRModalClose = () => setIsHRModalOpen(false);
  const handleCreateHRUser = async () => {
    setIsHRModalOpen(false);
    await refreshData();
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
  };


  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const calculateLeaveDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    let days = 0;
    let d = new Date(start);
    while (d <= end) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) days++;
      d.setDate(d.getDate() + 1);
    }
    return days;
  };

  const handleApprove = async (leaveId) => {
    try {
      const response = await api(`/api/leaves/${leaveId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approverId: currentUserId })
      });
      if (response.ok) {
        toast.success('Leave approved successfully!');
        fetchLeaveRequests();
      }
    } catch (error) { console.error(error); }
  };

  const handleRejectClick = (leaveId) => {
    setRejectingLeaveId(leaveId);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) return toast.warning('Please provide a reason');
    try {
      const response = await api(`/api/leaves/${rejectingLeaveId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ approverId: currentUserId, reason: rejectReason })
      });
      if (response.ok) {
        toast.success('Leave rejected successfully!');
        setShowRejectModal(false);
        fetchLeaveRequests();
      }
    } catch (error) { console.error(error); }
  };

  return (
    <>
      <div className="flex h-screen w-screen bg-bg-slate flex-col md:flex-row overflow-hidden relative">
        <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />

        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <header className="bg-white py-4 px-4 md:px-6 flex flex-wrap items-center justify-between shadow-sm z-10 border-b border-[#E3E8EF] w-full">
            {activeTab === "leave-requests" ? (
                <div className="flex items-center md:gap-16 gap-6">
                  <div className="hidden sm:block">
                    <h1 className="text-xl font-black text-[#2C2C2A] tracking-tight whitespace-nowrap">Leave Records</h1>
                    <p className="text-[9px] font-black text-[#888780] uppercase tracking-[0.2em] mt-0.5 whitespace-nowrap">Enterprise Management</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="relative group w-full sm:w-48 md:w-64">
                      <input
                        type="text"
                        placeholder="Search by employee name..."
                        value={leaveSearch}
                        onChange={(e) => setLeaveSearch(e.target.value)}
                        className="w-full h-[38px] bg-[#F4F6FA] border border-[#E3E8EF] focus:border-brand-yellow rounded-xl px-4 pl-9 text-xs font-bold text-[#2C2C2A] outline-none transition-all"
                      />
                      <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#888780]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div className="flex bg-bg-slate/50 p-1 rounded-xl">
                      {["ALL", "MANAGERS", "HR"].map((role) => (
                        <button
                          key={role}
                          onClick={() => setLeaveRoleFilter(role)}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${leaveRoleFilter === role ? "bg-brand-blue-dark text-white shadow-md" : "text-brand-text/40 hover:text-brand-text hover:bg-white"}`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
            ) : (
              // ─── DEFAULT / HR BAR ───
              <>
                <div className="flex items-center gap-3 md:gap-6">
                  <div className="w-10 h-10 md:w-11 md:h-11 bg-brand-blue/5 rounded-lg md:rounded-xl flex items-center justify-center border border-brand-blue/10 shadow-sm overflow-hidden text-xs md:text-sm font-black text-brand-text">
                    {JSON.parse(localStorage.getItem("user"))?.firstName?.[0] || "A"}
                  </div>
                  <div>
                    <h1 className="text-lg md:text-xl font-black text-brand-text tracking-tight">
                      {activeTab === "hr-team" ? "HR Operations" : "Admin Dashboard"}
                    </h1>
                    <p className="hidden xs:block text-[8px] md:text-[10px] text-brand-text/40 uppercase font-black tracking-[0.2em] mt-0.5">
                      {activeTab === "hr-team" ? "Human Capital Management System" : "Enterprise Infrastructure Control"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                  {activeTab !== "hr-team" && <NotificationComponent />}
                </div>
              </>
            )}
          </header>

          <div className="flex-1 p-4 overflow-y-auto md:overflow-hidden flex flex-col">
            {activeTab === "dashboard" && (
              <div className="flex flex-col gap-4 h-full overflow-visible md:overflow-hidden">
                {/* ROW 1 - Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
                  <MetricCard
                    label="Total Employees"
                    value={stats.totalEmployees}
                    loading={metricsLoading}
                  />
                  <MetricCard
                    label="Present Today"
                    value={Math.max(0, stats.totalEmployees - absentToday)}
                    delta={`${absentToday} absent`}
                    deltaType={absentToday > 0 ? "down" : "up"}
                    loading={metricsLoading}
                  />
                  <MetricCard
                    label="Absent Today"
                    value={absentToday}
                    delta={`${Math.max(0, stats.totalEmployees - absentToday)} present`}
                    deltaType="up"
                    loading={metricsLoading}
                  />
                </div>
                {/* ROW 2 - Quick Actions | Workforce Pulse | Absence Monitor (3 equal columns) */}
                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 pb-2">
                {/* Column 1 - Quick Actions (vertical stack) */}
                <div className="bg-white/40 backdrop-blur-md rounded-[32px] p-5 border border-white/50 shadow-xl shadow-brand-blue/5 min-h-0 overflow-y-auto flex flex-col gap-4">
                  <div className="flex flex-col shrink-0">
                    <h3 className="text-brand-text text-xl font-black leading-tight tracking-tight">Quick Actions</h3>
                    <p className="text-brand-text/20 text-[9px] font-bold uppercase tracking-[0.2em] mt-1">Administrative provision tools</p>
                  </div>
                  <div className="flex flex-col gap-3 w-full">
                    <button onClick={() => handleQuickAction("add-employee")} className="group bg-white/90 hover:bg-brand-blue p-3 rounded-2xl flex items-center gap-3 transition-all duration-300 shadow-sm hover:shadow-xl border border-brand-blue/10 w-full">
                      <div className="w-12 h-12 rounded-xl bg-brand-blue/5 flex items-center justify-center text-brand-text group-hover:bg-white/10 group-hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-brand-text uppercase tracking-widest group-hover:text-white leading-none">Add Employee</p>
                        <p className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest mt-1.5 group-hover:text-white/40">New Entry</p>
                      </div>
                    </button>
                    {/* <button onClick={() => handleQuickAction("create-hr")} className="group bg-white/90 hover:bg-emerald-500 p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 shadow-sm hover:shadow-xl border border-emerald-500/10 flex-1">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/5 flex items-center justify-center text-emerald-500 group-hover:bg-white/10 group-hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-brand-text uppercase tracking-widest group-hover:text-white leading-none">Add HR</p>
                        <p className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest mt-1.5 group-hover:text-white/40">Access Level</p>
                      </div>
                    </button> */}
                    <button onClick={handleOpenReportingManagerModal} className="group bg-white/90 hover:bg-indigo-500 p-3 rounded-2xl flex items-center gap-3 transition-all duration-300 shadow-sm hover:shadow-xl border border-indigo-500/10 w-full">
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/5 flex items-center justify-center text-indigo-500 group-hover:bg-white/10 group-hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-brand-text uppercase tracking-widest group-hover:text-white leading-none">Add Reporting Manager</p>
                        <p className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest mt-1.5 group-hover:text-white/40">Team Oversight</p>
                      </div>
                    </button>
                    <button onClick={() => setIsAssignHrModalOpen(true)} className="group bg-white/90 hover:bg-brand-blue-dark p-3 rounded-2xl flex items-center gap-3 transition-all duration-300 shadow-sm hover:shadow-xl border border-brand-blue/10 w-full">
                      <div className="w-12 h-12 rounded-xl bg-brand-blue/5 flex items-center justify-center text-brand-blue-dark group-hover:bg-white/10 group-hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-brand-text uppercase tracking-widest group-hover:text-white leading-none">Assign Employees to HR</p>
                        <p className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest mt-1.5 group-hover:text-white/40">HR Routing</p>
                      </div>
                    </button>
                    <button onClick={() => setIsAssignClientProjectModalOpen(true)} className="group bg-white/90 hover:bg-brand-blue p-3 rounded-2xl flex items-center gap-3 transition-all duration-300 shadow-sm hover:shadow-xl border border-brand-blue/10 w-full">
                      <div className="w-12 h-12 rounded-xl bg-brand-blue/5 flex items-center justify-center text-brand-text group-hover:bg-white/10 group-hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7h-3V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM9 5h6v2H9V5z" /></svg>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-brand-text uppercase tracking-widest group-hover:text-white leading-none">Assign Employees to Client Project</p>
                        <p className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest mt-1.5 group-hover:text-white/40">Project Staffing</p>
                      </div>
                    </button>
                  </div>
                </div>
                  {/* Column 2 - Workforce Pulse */}
                  <div className="bg-white rounded-[32px] p-5 shadow-2xl shadow-brand-blue/5 border border-brand-blue/5 flex flex-col relative min-h-0 overflow-y-auto group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-blue/[0.01] rounded-bl-full pointer-events-none" />
                    <div className="w-full mb-2 shrink-0">
                      <h2 className="text-lg md:text-xl font-black text-brand-text tracking-tight">Workforce Pulse</h2>
                      <p className="text-[8px] md:text-[9px] font-black text-brand-text/30 uppercase tracking-[0.2em] mt-0.5">Real-time Personnel Distribution</p>
                    </div>
                    <div className="w-full flex-1 flex flex-col items-center gap-3 min-h-0">
                      <div className="w-full h-40 shrink-0 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'HRs', value: stats.hrUsers, color: '#1E3A8A' },
                                { name: 'Managers', value: stats.reportingManagers, color: '#FACC15' },
                                { name: 'Employees', value: Math.max(0, stats.totalEmployees - stats.hrUsers - stats.reportingManagers), color: '#1F2937' },
                              ]}
                              outerRadius="75%" dataKey="value" stroke="#fff" strokeWidth={3}
                            >
                              {[{ color: '#1E3A8A' }, { color: '#FACC15' }, { color: '#1F2937' }].map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-row flex-wrap gap-2 w-full shrink-0 justify-center">
                        {[{ l: 'HRs', v: stats.hrUsers, c: 'bg-[#1E3A8A]', tc: 'text-[#1E3A8A]' }, { l: 'Managers', v: stats.reportingManagers, c: 'bg-[#FACC15]', tc: 'text-[#FACC15]' }, { l: 'Employees', v: Math.max(0, stats.totalEmployees - stats.hrUsers - stats.reportingManagers), c: 'bg-[#1F2937]', tc: 'text-[#1F2937]' }].map((item, idx) => (
                          <div key={idx} className="bg-bg-slate/30 p-2 md:p-2.5 rounded-xl md:rounded-2xl flex flex-col items-start border border-brand-blue/[0.03] transition-all hover:bg-white hover:shadow-lg hover:shadow-brand-blue/5 w-[calc(33%-8px)] md:w-auto">
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${item.c}`} />
                              <span className={`text-[7px] md:text-[8px] font-black uppercase tracking-widest ${item.tc}`}>{item.l}</span>
                            </div>
                            <span className="text-xs md:text-sm font-black text-brand-text ml-3 md:ml-4">{item.v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Column 3 - Absence Monitor */}
                  <div className="bg-white rounded-[32px] shadow-2xl shadow-brand-blue/5 border border-brand-blue/5 overflow-hidden flex flex-col min-h-0">
                    <div className="p-4 border-b border-brand-blue/5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-bg-slate/30 to-white">
                      <div className="text-center sm:text-left">
                        <h2 className="text-lg font-black text-brand-text tracking-tight">Absence Monitor</h2>
                        <p className="text-[9px] font-black text-brand-text/30 uppercase tracking-[0.1em] mt-0.5">Leave Flow Management</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-bg-slate/50 p-1 rounded-lg border border-brand-blue/5">
                          <button onClick={() => changeMonth(-1)} className="w-8 h-8 md:w-6 md:h-6 rounded-md bg-white border border-brand-blue/5 flex items-center justify-center text-brand-text hover:bg-brand-blue-dark hover:text-white transition-all shadow-sm"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M15 19l-7-7 7-7" /></svg></button>
                          <div className="px-2 text-[10px] md:text-[8px] font-black text-brand-text uppercase tracking-widest min-w-[100px] md:min-w-[80px] text-center">{currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
                          <button onClick={() => changeMonth(1)} className="w-8 h-8 md:w-6 md:h-6 rounded-md bg-white border border-brand-blue/5 flex items-center justify-center text-brand-text hover:bg-brand-blue-dark hover:text-white transition-all shadow-sm"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M9 5l7 7-7 7" /></svg></button>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto">
                      <div className="grid grid-cols-5 gap-2 mb-2">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => <div key={day} className="text-center text-[9px] font-black text-brand-text uppercase tracking-[0.15em]">{day}</div>)}
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {(() => {
                          const year = currentDate.getFullYear();
                          const month = currentDate.getMonth();
                          const firstDay = new Date(year, month, 1).getDay();
                          const daysInMonth = new Date(year, month + 1, 0).getDate();
                          const startingPadding = firstDay === 0 ? 6 : firstDay - 1;
                          const cells = [];
                          for (let i = 0; i < startingPadding; i++) {
                            const padDate = new Date(year, month, 1 - (startingPadding - i));
                            if (padDate.getDay() !== 0 && padDate.getDay() !== 6) cells.push(<div key={`pad-${i}`} className="h-12 opacity-10 bg-bg-slate/5 border border-dashed border-brand-blue/5 rounded-xl" />);
                          }
                          for (let day = 1; day <= daysInMonth; day++) {
                            const dateObj = new Date(year, month, day);
                            if (dateObj.getDay() === 0 || dateObj.getDay() === 6) continue;
                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const isToday = new Date().toISOString().split('T')[0] === dateStr;
                            const onLeave = calendarData[dateStr] || [];
                            cells.push(
                              <div key={day} onMouseEnter={(e) => onLeave.length > 0 && setHoveredLeaveData({ data: onLeave, rect: e.currentTarget.getBoundingClientRect() })} onMouseLeave={() => setHoveredLeaveData(null)}
                                className={`h-12 rounded-xl border transition-all p-1.5 flex flex-col items-center justify-center relative group ${isToday ? "bg-brand-blue/5 border-brand-blue ring-2 ring-brand-blue/10" : ""} ${onLeave.length > 0 ? "bg-white border-brand-yellow/50 shadow-lg cursor-pointer" : "bg-bg-slate/30 border-transparent hover:bg-white hover:border-brand-blue/10"}`}>
                                <span className="text-xs font-black text-brand-text">{day}</span>
                                {onLeave.length > 0 && <div className="mt-0.5 px-1 py-0 bg-brand-blue/5 rounded"><span className="text-[6px] font-black text-brand-text">{onLeave.length} LEAVE</span></div>}
                              </div>
                            );
                          }
                          return cells;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "leave-requests" && (
              <div className="flex flex-col gap-6 h-full pr-2 overflow-hidden">
                <div className="bg-white rounded-[32px] shadow-2xl shadow-brand-blue/5 border border-brand-blue/5 overflow-hidden flex-1 flex flex-col min-h-0">
                  <div className="overflow-x-auto flex-1 overflow-y-auto custom-scrollbar relative">
                    {/* Desktop Table */}
                    <table className="hidden lg:table w-full text-left border-collapse">
                      <thead className="sticky top-0 z-20 bg-white">
                        <tr className="bg-brand-blue/[0.02]">
                          <th className="py-3 px-4 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5 w-20">Record ID</th>
                          <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Requester</th>
                          <th className="py-3 px-4 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5">Category</th>
                          <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5 text-center min-w-[200px]">Duration</th>
                          <th className="py-3 px-5 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5 text-center">Status</th>
                          <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-text/40 border-b border-brand-blue/5 text-right">Decision Control</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-blue/5">
                        {loading ? (
                          <tr><td colSpan={6} className="py-20 text-center text-brand-text/30 font-bold uppercase tracking-widest text-xs animate-pulse">Syncing Personnel Records...</td></tr>
                        ) : leaveRequests.filter(lv => {
                          const nameMatch = !leaveSearch || lv.employeeName.toLowerCase().includes(leaveSearch.toLowerCase());
                          const empRole = employeeRoleMap[lv.employeeId] || "";
                          const roleMatch = leaveRoleFilter === "ALL"
                            ? true
                            : leaveRoleFilter === "HR"
                              ? empRole === "HR"
                              : leaveRoleFilter === "MANAGERS"
                                ? empRole === "REPORTING_MANAGER"
                                : empRole !== "HR" && empRole !== "REPORTING_MANAGER";
                          return nameMatch && roleMatch;
                        }).map((leave) => (
                          <tr key={leave.id} className="group hover:bg-bg-slate/40 transition-all duration-300">
                            <td className="py-3 px-4"><span className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest">#{leave.id}</span></td>
                            <td className="py-3 px-6"><div className="flex flex-col"><span className="text-sm font-black text-brand-text tracking-tight uppercase">{leave.employeeName}</span></div></td>
                            <td className="py-3 px-6"><span className="px-3 py-1 bg-brand-blue/5 text-brand-text text-[8px] font-black uppercase tracking-widest rounded-lg border border-brand-blue/10">{leave.leaveType}</span></td>
                            <td className="py-3 px-6 text-center">
                              <div className="flex flex-col items-center">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-brand-text">{formatDate(leave.startDate)}</span>
                                  <span className="text-[8px] font-black text-brand-text/10 font-bold">to</span>
                                  <span className="text-[10px] font-black text-brand-text">{formatDate(leave.endDate)}</span>
                                </div>
                                <span className="mt-1 px-2 py-0.5 bg-brand-yellow text-brand-text text-[8px] font-black rounded-md">{leave.daysCount} Days</span>
                              </div>
                            </td>
                            <td className="py-3 px-6 text-center">
                              <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${leave.status === 'PENDING' ? 'bg-brand-yellow/10 text-brand-yellow-dark border-brand-yellow/20' : leave.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                {leave.status}
                              </span>
                            </td>
                            <td className="py-3 px-8 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => { setSelectedLeave(leave); setIsDetailsModalOpen(true); }} className="p-2 bg-brand-blue/5 text-brand-text rounded-lg hover:bg-brand-blue-dark hover:text-white transition-all" title="View Details" aria-label="View Details"><Eye size={16} /></button>
                                {leave.status === 'PENDING' && (
                                  <LeaveDecisionButtons
                                    onApprove={() => handleApprove(leave.id)}
                                    onReject={() => handleRejectClick(leave.id)}
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Mobile Card View */}
                    <div className="lg:hidden flex flex-col gap-4 p-4">
                      {loading ? (
                        <div className="py-20 text-center text-brand-text/30 font-bold uppercase tracking-widest text-xs animate-pulse">Syncing Personnel Records...</div>
                      ) : leaveRequests.filter(lv => {
                        const nameMatch = !leaveSearch || lv.employeeName.toLowerCase().includes(leaveSearch.toLowerCase());
                        const empRole = employeeRoleMap[lv.employeeId] || "";
                        const roleMatch = leaveRoleFilter === "ALL"
                          ? true
                          : leaveRoleFilter === "HR"
                            ? empRole === "HR"
                            : leaveRoleFilter === "MANAGERS"
                              ? empRole === "REPORTING_MANAGER"
                              : empRole !== "HR" && empRole !== "REPORTING_MANAGER";
                        return nameMatch && roleMatch;
                      }).map((leave) => (
                        <div key={leave.id} className="bg-bg-slate/40 rounded-2xl p-4 border border-brand-blue/5 space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest">#{leave.id}</span>
                              <span className="text-base font-black text-brand-text tracking-tight uppercase">{leave.employeeName}</span>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${leave.status === 'PENDING' ? 'bg-brand-yellow/10 text-brand-yellow-dark border-brand-yellow/20' : leave.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                              {leave.status}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-0.5 bg-brand-blue/5 text-brand-text text-[8px] font-black uppercase tracking-widest rounded-md border border-brand-blue/10">{leave.leaveType}</span>
                            <span className="px-2 py-0.5 bg-brand-yellow/20 text-brand-text text-[8px] font-black rounded-md">{leave.daysCount} Days</span>
                          </div>

                          <div className="flex justify-between items-center text-[10px] font-black text-brand-text/60">
                            <div className="flex items-center gap-1.5">
                              <CalendarIconSVG size={12} />
                              <span>{formatDate(leave.startDate)} - {formatDate(leave.endDate)}</span>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button onClick={() => { setSelectedLeave(leave); setIsDetailsModalOpen(true); }} className="flex-1 py-2.5 bg-brand-blue/5 text-brand-text rounded-xl flex items-center justify-center hover:bg-brand-blue-dark hover:text-white transition-all" title="View Details" aria-label="View Details"><Eye size={16} /></button>
                            {leave.status === 'PENDING' && (
                              <div className="flex-1 flex items-center justify-end gap-2">
                                <LeaveDecisionButtons
                                  onApprove={() => handleApprove(leave.id)}
                                  onReject={() => handleRejectClick(leave.id)}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "hr-team" && (
              <div className="flex flex-col gap-8 h-full overflow-y-auto pr-2">
                <HRTeamDisplay />
              </div>
            )}


          </div>
        </main>
      </div>

      <YearlyHolidayCalendar isOpen={isYearlyCalendarOpen} onClose={() => setIsYearlyCalendarOpen(false)} />

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-brand-text uppercase tracking-tight">Reject Leave Request</h3>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={255} placeholder="Enter reason for rejection" className="w-full p-3 border border-slate-200 rounded-lg mb-4 focus:ring-2 focus:ring-red-500 outline-none font-bold text-sm" rows="4" />
            <div className="flex gap-3">
              <button onClick={() => { setShowRejectModal(false); setRejectingLeaveId(null); }} className="flex-1 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition">Cancel</button>
              <button onClick={handleRejectConfirm} className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition shadow-lg">Reject</button>
            </div>
          </div>
        </div>
      )}

      <EmployeeSelectorModal open={isModalOpen} onClose={handleModalClose} onSave={handleAddReportingManagers} />
      <AddEmployeeModal open={isAddEmployeeModalOpen} onClose={handleAddEmployeeModalClose} onEmployeeCreated={refreshData} />
      <HRSelectorModal open={isHRModalOpen} onClose={handleHRModalClose} onSave={handleCreateHRUser} />
      <AssignEmployeeToHrModal open={isAssignHrModalOpen} onClose={() => setIsAssignHrModalOpen(false)} onSaved={refreshData} />
      <AssignEmployeeToClientProjectModal open={isAssignClientProjectModalOpen} onClose={() => setIsAssignClientProjectModalOpen(false)} />

      {hoveredLeaveData && createPortal(
        <div className="fixed z-[10000] pointer-events-none" style={{ top: hoveredLeaveData.rect.top - 10, left: hoveredLeaveData.rect.left + hoveredLeaveData.rect.width / 2, transform: "translate(-50%, -100%)" }}>
          <div className="w-48 bg-brand-blue rounded-2xl p-4 shadow-2xl relative">
            <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-brand-blue rotate-45" />
            <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-2 text-center">Personnel Out Today</p>
            <div className="space-y-1.5">
              {hoveredLeaveData.data.map((name, idx) => (
                <div key={idx} className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-lg">
                  <div className="w-1 h-1 rounded-full bg-brand-yellow" />
                  <span className="text-[9px] font-bold text-white whitespace-nowrap">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      <LeaveDetailsModal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} leave={selectedLeave} />
    </>
  );
}




