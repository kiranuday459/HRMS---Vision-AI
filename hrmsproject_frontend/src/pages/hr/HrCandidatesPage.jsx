import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import useEmployees from "../../hooks/useEmployees";
import { getHrNavItems } from "../../utils/hrNav";
import NotificationComponent from "../../components/NotificationComponent";
import { ROLE_LABELS, resolveHeading } from "../../config/pageHeadings";
import api from "../../utils/api";
import DisabledBadge from "../../components/DisabledBadge";
import { ProjectSuffix } from "../../utils/employeeName";

export default function HrCandidatesPage() {
  const { employees, loading, error, refresh } = useEmployees();
  const [localEmployees, setLocalEmployees] = useState([]);
  const [assignmentsMap, setAssignmentsMap] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("candidates");
  const [user, setUser] = useState({});
  const ribbonUser = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}") || {}; } catch { return {}; } })();
  const ribbonTitle = resolveHeading(ribbonUser.role, "employeeList");
  const ribbonRoleLabel = ROLE_LABELS[ribbonUser.role] || ribbonUser.role || "";
  const ribbonName = ribbonUser.fullName || `${ribbonUser.firstName || ""} ${ribbonUser.lastName || ""}`.trim();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user")) || {};
    setUser(userData);

    const handleClickOutside = (event) => {
      if (!event.target.closest("#profile-dropdown-container")) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Always pull fresh employee data on load so Admin's enable/disable/delete
  // changes are reflected immediately for HR — no manual refresh required.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalEmployees(employees || []);
  }, [employees]);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const res = await api("/api/reporting-managers/assignments");
        if (!res.ok) return;
        const list = await res.json();
        const map = {};
        (list || []).forEach((it) => {
          if (it && it.employeeId) {
            map[it.employeeId] = {
              managerName: it.reportingManagerName || null,
              managerEmail: it.reportingManagerEmail || null,
              managerRole: it.reportingManagerRole || null,
              hrName: it.hrName || null,
              hrRole: it.hrRole || null,
            };
          }
        });
        setAssignmentsMap(map);
      } catch (e) {
        console.error("Failed to load assignments", e);
      }
    };

    fetchAssignments();
  }, []);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      navigate("/login");
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredEmployees = (localEmployees || []).filter((emp) => {
    const fullName = `${emp.firstName || ""} ${emp.lastName || ""}`.toLowerCase();
    const email = (emp.email || "").toLowerCase();
    const id = emp.id ? String(emp.id) : "";
    const oryfolksId = emp.oryfolksId ? String(emp.oryfolksId).toLowerCase() : "";
    const corporateEmail = (emp.corporateEmail || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    const isSystemAdmin = (emp.role === 'ADMIN') || (emp.firstName === 'System' && emp.lastName === 'Admin');
    if (isSystemAdmin) return false;

    // Status filter: an employee with active === false is treated as Inactive.
    const status = emp.active === false ? "Inactive" : "Active";
    const statusMatch = statusFilter === "All" || status === statusFilter;
    if (!statusMatch) return false;

    return (
      id.includes(term) ||
      oryfolksId.includes(term) ||
      fullName.includes(term) ||
      email.includes(term) ||
      corporateEmail.includes(term)
    );
  });

  const adminUser = (localEmployees || []).find(e => e.role === 'ADMIN' || (e.firstName === 'System' && e.lastName === 'Admin'));
  const adminName = adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : 'Admin';

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const navItems = getHrNavItems();

  return (
    <div className="flex h-screen bg-bg-slate font-brand text-brand-text overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleLogout={handleLogout}
        navItems={navItems}
        hideLogout={true}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Premium Header */}
        <header className="bg-white px-8 py-4 flex items-center justify-between shadow-sm z-10 border-b border-[#E3E8EF]">
          <div className="flex items-center gap-6">
            <div className="w-11 h-11 bg-[#F1EFE8] rounded-xl flex items-center justify-center border border-[#E3E8EF] shadow-sm overflow-hidden text-[#2C2C2A]">
              <svg
                className="w-7 h-7 text-[#5F5E5A]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
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

          <div className="flex items-center gap-6 relative" id="profile-dropdown-container">
            <div className="hidden md:flex items-center bg-[#F4F6FA] border border-[#E3E8EF] rounded-2xl px-4 py-2 w-64 focus-within:w-80 transition-all duration-300">
              <svg className="w-4 h-4 text-[#888780] mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                className="bg-transparent border-none outline-none text-xs text-[#2C2C2A] placeholder-[#888780] w-full font-bold"
                placeholder="Search candidates by name or ID..."
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
            <NotificationComponent />
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="w-10 h-10 rounded-full border-2 border-[#E3E8EF] overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-md flex items-center justify-center bg-[#F1EFE8] p-0"
              title="View Profile"
            >
              {user.photoPath ? (
                <img src={user.photoPath} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-6 h-6 text-[#5F5E5A]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              )}
            </button>

            {/* Dropdown Menu */}
            {isProfileDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-brand-blue/5 py-2 z-[100] animate-in fade-in zoom-in duration-200 origin-top-right">
                <button
                  onClick={() => {
                    navigate("/hr?tab=profile");
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


        <div className="flex-1 overflow-auto p-3 md:p-6 flex flex-col space-y-4">
          <div className="bg-white rounded-[32px] shadow-2xl shadow-brand-blue/5 border border-brand-blue/5 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-brand-blue/5 flex items-center justify-between bg-bg-slate/30">
              <div>
                <h2 className="text-2xl font-black text-brand-text tracking-tight">Active Candidates</h2>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-bg-slate border border-brand-blue/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-brand-text outline-none cursor-pointer focus:border-brand-blue/30 transition-all"
                >
                  <option value="All">All</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                <span className="bg-brand-blue/5 text-brand-text px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {filteredEmployees.length} Resources
                </span>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-210px)] scrollbar-hide">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-30">
                  <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-text">Syncing Database...</p>
                </div>
              ) : error ? (
                <div className="py-20 text-center">
                  <p className="text-red-500 font-bold">{error}</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse border-spacing-0">
                  <thead>
                    <tr className="bg-brand-blue/[0.02]">
                      <th className="py-5 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40 border-b border-brand-blue/5">Record ID</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40 border-b border-brand-blue/5">Member Name</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40 border-b border-brand-blue/5">Corporate Role</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40 border-b border-brand-blue/5">Status</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40 border-b border-brand-blue/5">Hierarchy Lead</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40 border-b border-brand-blue/5">HR Coordinator</th>
                      <th className="py-5 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40 border-b border-brand-blue/5">Corporate Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-blue/5">
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center italic text-brand-text/20 font-bold uppercase tracking-widest text-xs">
                          No personnel found matching search criteria
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <tr
                          key={emp.id}
                          className={`group hover:bg-bg-slate/50 transition-all cursor-pointer ${emp.active === false ? 'opacity-60' : ''}`}
                          onClick={() => navigate(`/admin/employee/${emp.id}`, { state: emp })}
                        >
                          <td className="py-5 px-8">
                            <span className="text-xs font-black text-brand-text/30 group-hover:text-brand-text">
                              {emp.oryfolksId || "PENDING"}
                            </span>
                          </td>
                          <td className="py-5 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-brand-blue/5 rounded-xl flex items-center justify-center text-[10px] font-black text-brand-text group-hover:bg-brand-blue group-hover:text-white transition-all shadow-sm">
                                {(emp.firstName?.[0] || emp.lastName?.[0] || 'U')}
                              </div>
                              <span className="text-sm font-bold text-brand-text tracking-tight">
                                {`${emp.firstName || ""} ${emp.lastName || ""}`}<ProjectSuffix project={emp.clientProject} />
                              </span>
                              {emp.active === false && (
<DisabledBadge />
                              )}
                            </div>
                          </td>
                          <td className="py-5 px-6">
                            <span className="px-3 py-1 bg-brand-yellow/10 text-brand-text text-[9px] font-black uppercase tracking-widest rounded-full border border-brand-yellow/20">
                              {emp.role || 'Personnel'}
                            </span>
                          </td>
                          <td className="py-5 px-6">
                            <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border ${emp.active === false ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                              {emp.active === false ? 'Inactive' : 'Active'}
                            </span>
                          </td>
                          <td className="py-5 px-6">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-brand-text/60 tabular-nums uppercase tracking-tight">
                                {emp.role === 'HR' ? adminName :
                                  emp.role === 'REPORTING_MANAGER' ? (assignmentsMap[emp.id]?.hrName || 'HR Coordinator') :
                                    (assignmentsMap[emp.id]?.managerName || 'Unassigned')}
                              </span>
                              <span className="text-[9px] font-black text-brand-text/10 uppercase tracking-[0.1em]">Structural Lead</span>
                            </div>
                          </td>
                          <td className="py-5 px-6 text-xs font-bold text-brand-text/60">
                            {assignmentsMap[emp.id]?.hrName || '–'}
                          </td>
                          <td className="py-5 px-8">
                            <span className="text-xs font-bold text-brand-text/40 group-hover:text-brand-text transition-colors underline decoration-brand-blue/5 decoration-2 underline-offset-4 line-clamp-1">
                              {emp.corporateEmail || "await@provisioning.org"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

        {toast && (
          <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest animate-in slide-in-from-right duration-300 ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
            {toast.message}
          </div>
        )}
      </main>
    </div>
  );
}



