import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import Sidebar from "../../components/Sidebar";
import { getHrNavItems } from "../../utils/hrNav";
import NotificationComponent from "../../components/NotificationComponent";
import DisabledBadge from "../../components/DisabledBadge";
import { isDisabled } from "../../utils/employeeStatus";

export default function HrReportingManagersPage() {
  const [activeTab, setActiveTab] = useState("managers");
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [selectedEmployeeToAdd, setSelectedEmployeeToAdd] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [user, setUser] = useState({});
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

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      navigate("/login");
    }
  };

  const fetchManagers = async () => {
    setLoading(true);
    try {
      const r = await api("/api/reporting-managers");
      const json = await r.json();
      setManagers(json.data || json || []);
    } catch (err) {
      console.error("Error fetching managers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagers();
  }, []);

  const fetchAvailableEmployees = async () => {
    try {
      const r = await api("/api/reporting-managers/available-employees");
      const json = await r.json();
      setAvailableEmployees(json.data || json || []);
    } catch (err) {
      console.error("Error fetching available employees", err);
    }
  };

  useEffect(() => {
    fetchAvailableEmployees();
  }, []);

  const loadDetails = async (m) => {
    setSelected(m);
    setDetailsLoading(true);
    try {
      const resp = await api(`/api/reporting-managers/${m.id}`);
      if (resp.ok) {
        const json = await resp.json();
        setSelected((prev) => ({ ...prev, team: json.team || [] }));
      }
    } catch (err) {
      console.error("Error loading manager team", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleDelete = async (e, manager) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Are you sure you want to remove ${manager.fullName} from Reporting Managers?`
      )
    ) {
      return;
    }

    try {
      const res = await api(
        `/api/reporting-managers/${manager.id}`,
        {
          method: "DELETE",
        }
      );

      if (res.ok) {
        setManagers((prev) => prev.filter((m) => m.id !== manager.id));
        if (selected && selected.id === manager.id) {
          setSelected(null);
        }
      }
    } catch (err) {
      console.error("Error deleting manager:", err);
    }
  };

  const handleRemoveMember = async (e, memberId, memberName) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Are you sure you want to remove ${memberName} from this team?`
      )
    )
      return;

    try {
      const res = await api(`/api/reporting-managers/remove-member/${memberId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSelected((prev) => ({
          ...prev,
          team: prev.team.filter((t) => t.id !== memberId),
        }));
      }
    } catch (err) {
      console.error("Error removing team member", err);
    }
  };

  const handleAddMember = async () => {
    if (!selected || !selectedEmployeeToAdd) return;
    setAddingMember(true);
    try {
      const res = await api("/api/reporting-managers", {
        method: "POST",
        body: JSON.stringify({
          employeeId: selectedEmployeeToAdd,
          reportingManagerId: selected.id,
        }),
      });

      if (res.ok) {
        // Refresh details to show the newly assigned member immediately
        const r = await api(`/api/reporting-managers/${selected.id}`);
        const json = await r.json();
        setSelected((prev) => ({ ...prev, team: json.team || [] }));
        setSelectedEmployeeToAdd("");
        // Also refresh available employees so the assigned one drops off the list
        fetchAvailableEmployees();
      }
    } catch (err) {
      console.error("Error adding team member", err);
    } finally {
      setAddingMember(false);
    }
  };

  const navItems = getHrNavItems();

  return (
    <div className="flex h-screen w-screen bg-bg-slate flex-col md:flex-row overflow-hidden font-brand text-brand-text">
      {/* ================= SIDEBAR ================= */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleLogout={handleLogout}
        navItems={navItems}
        hideLogout={true}
      />

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Single Professional Header */}
        <header className="bg-white px-8 py-4 flex items-center justify-between shadow-sm z-10 border-b border-[#E3E8EF]">
          <div className="flex items-center gap-6">
            <div className="w-11 h-11 bg-[#F1EFE8] rounded-xl flex items-center justify-center border border-[#E3E8EF] shadow-sm overflow-hidden text-[#2C2C2A]">
              <svg
                className="w-7 h-7 text-[#5F5E5A]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-black text-[#2C2C2A] tracking-tight">
                Reporting Managers
              </h1>
              <p className="text-[10px] text-[#888780] uppercase font-black tracking-[0.2em] mt-0.5">
                {user.designation || "Human Resources Operations"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 relative" id="profile-dropdown-container">
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

        <div className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto flex flex-col">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
            {/* Managers List Section */}
            <div className="lg:col-span-1 flex flex-col space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40">Directory List</h3>
                <span className="text-[10px] font-black text-brand-text/20">{managers.length} Total</span>
              </div>

              <div className="bg-white rounded-3xl shadow-xl shadow-brand-blue/5 border border-brand-blue/5 overflow-hidden flex-1 flex flex-col">
                <div className="overflow-y-auto p-4 space-y-2 flex-1 scrollbar-hide">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-3 opacity-30 py-20">
                      <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Fetching Managers...</p>
                    </div>
                  ) : managers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-2 opacity-20 py-20 italic">
                      <p className="text-sm font-bold">No managers found</p>
                    </div>
                  ) : (
                    managers.map((m) => {
                      const mDisabled = isDisabled(m);
                      return (
                      <div
                        key={m.id}
                        onClick={() => loadDetails(m)}
                        className={`group relative cursor-pointer p-4 rounded-2xl transition-all border-2 flex items-center gap-4 ${selected && selected.id === m.id
                          ? 'bg-brand-blue-dark border-brand-blue text-white shadow-xl shadow-brand-blue/20'
                          : mDisabled
                            ? 'bg-[#F1EFE8] border-transparent hover:border-brand-blue/10 text-brand-text'
                            : 'bg-white border-transparent hover:border-brand-blue/10 hover:bg-gray-50 text-brand-text'
                          }`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow-sm transition-all ${selected && selected.id === m.id ? 'bg-white text-brand-text' : mDisabled ? 'bg-[#D3D1C7] text-[#5F5E5A]' : 'bg-brand-blue/5 text-brand-text/30 group-hover:bg-brand-blue group-hover:text-white'
                          }`}>
                          {(m.fullName || 'U').slice(0, 1)}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="flex items-center gap-2">
                            <div className={`font-bold text-sm truncate ${mDisabled && !(selected && selected.id === m.id) ? 'text-brand-text/40' : ''}`}>{m.fullName}</div>
                            {mDisabled && <DisabledBadge />}
                          </div>
                          <div className={`text-[10px] font-bold uppercase tracking-wider truncate transition-all ${selected && selected.id === m.id ? 'text-white/60' : 'text-brand-text/40 group-hover:text-brand-text/60'
                            }`}>
                            {m.corporateEmail || "No Email"}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDelete(e, m)}
                          className={`p-2 rounded-lg transition-all ${selected && selected.id === m.id
                            ? 'text-white/40 hover:text-white hover:bg-white/10'
                            : 'text-brand-text/20 hover:text-red-500 hover:bg-red-50'
                            }`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Management Panel Section */}
            <div className="lg:col-span-2 flex flex-col space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40">Team Management Audit</h3>
                {selected && !selected.loading && (
                  <span className="text-[10px] font-black text-brand-text/20">{(selected.team || []).length} Members</span>
                )}
              </div>

              <div className="bg-white rounded-[32px] shadow-2xl shadow-brand-blue/5 border border-brand-blue/5 overflow-hidden flex-1 flex flex-col relative">
                {!selected ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
                    <div className="w-32 h-32 bg-brand-blue/[0.02] rounded-full flex items-center justify-center border-2 border-dashed border-brand-blue/5">
                      <svg className="w-12 h-12 text-brand-text/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-brand-text mb-2">Team Overview</h4>
                      <p className="text-sm font-medium text-brand-text/30 max-w-xs mx-auto uppercase tracking-widest leading-relaxed">
                        Select a reporting manager to audit their hierarchical structure
                      </p>
                    </div>
                  </div>
                ) : selected.loading || detailsLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-brand-text/40 uppercase tracking-[0.3em]">Synchronizing Structure...</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    {/* Team List */}
                    <div className="flex-1 p-8 space-y-6 overflow-y-auto max-h-[500px] scrollbar-hide">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-text/30">Managed Resources ({(selected.team || []).length})</h4>

                        {/* Add Member Dropdown */}
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedEmployeeToAdd}
                            onChange={(e) => setSelectedEmployeeToAdd(e.target.value)}
                            className="bg-brand-blue/5 border-none rounded-xl px-4 py-2 text-[10px] font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all outline-none"
                          >
                            <option value="">Select Employee to Add</option>
                            {availableEmployees.filter(ae => !(selected.team || []).some(tm => tm.id === ae.id) && !ae.designation?.includes("HR") && !isDisabled(ae)).map(ae => (
                              <option key={ae.id} value={ae.id}>
                                {ae.name} ({ae.corporateEmail || ae.email})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={handleAddMember}
                            disabled={!selectedEmployeeToAdd || addingMember}
                            className={`px-4 py-2 bg-brand-yellow text-brand-text font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg hover:shadow-brand-yellow/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {addingMember ? "..." : "Add Member"}
                          </button>
                        </div>
                      </div>

                      {(!selected.team || selected.team.length === 0) ? (
                        <div className="py-20 text-center border-2 border-dashed border-brand-blue/5 rounded-[24px]">
                          <p className="text-xs font-bold text-brand-text/20 uppercase tracking-widest italic">No active resources assigned</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selected.team.filter(emp => emp.id !== selected.id).map(emp => {
                            const empDisabled = isDisabled(emp);
                            return (
                            <div key={emp.id} className={`group p-5 border rounded-[20px] flex items-center gap-4 hover:shadow-xl hover:shadow-brand-blue/5 transition-all hover:-translate-y-0.5 card-hover ${empDisabled ? 'bg-[#F1EFE8] border-brand-blue/5' : 'bg-white border-brand-blue/5'}`}>
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black transition-colors ${empDisabled ? 'bg-[#D3D1C7] text-[#5F5E5A]' : 'bg-bg-slate text-brand-text/30 group-hover:bg-brand-blue group-hover:text-white'}`}>
                                {(emp.name || 'U').slice(0, 1)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className={`font-bold truncate text-sm ${empDisabled ? 'text-brand-text/40' : 'text-brand-text'}`}>{emp.name}</div>
                                  {empDisabled && <DisabledBadge />}
                                </div>
                                <div className="text-[10px] font-bold text-brand-text/40 uppercase tracking-widest truncate">{emp.corporateEmail || "Incomplete Profile"}</div>
                              </div>
                              <button
                                onClick={(e) => handleRemoveMember(e, emp.id, emp.name)}
                                className="opacity-0 group-hover:opacity-100 p-2 bg-red-50 text-red-500 rounded-lg transition-all hover:bg-red-500 hover:text-white"
                                title="Remove from team"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>


        </div>
      </main>
    </div>
  );
}



