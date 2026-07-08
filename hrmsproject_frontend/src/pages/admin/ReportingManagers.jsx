import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/AdminSidebar";
import api from "../../utils/api";
import DisabledBadge from "../../components/DisabledBadge";
import { isDisabled } from "../../utils/employeeStatus";

function ManagerRow({ m, onClick }) {
  return (
    <div onClick={() => onClick(m)} className="cursor-pointer p-3 hover:bg-gray-50 border rounded flex items-center gap-3">
      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-sm font-semibold">{(m.fullName || 'U').slice(0, 1)}</div>
      <div className="flex-1">
        <div className="font-medium">{m.fullName}</div>
        <div className="text-sm text-gray-500">{m.corporateEmail || "Not Available"}</div>
      </div>
    </div>
  );
}

export default function ReportingManagers() {
  const [activeTab, setActiveTab] = useState("reporting-managers");
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [selectedEmployeeToAdd, setSelectedEmployeeToAdd] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const navigate = useNavigate();

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
      const data = await r.json();
      setManagers(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchManagers(); }, []);

  const fetchAvailableEmployees = async () => {
    try {
      const r = await api("/api/reporting-managers/available-employees");
      const data = await r.json();
      setAvailableEmployees(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAvailableEmployees();
  }, []);

  const loadDetails = (manager) => {
    if (selected && selected.id === manager.id) return;
    setSelected({ ...manager, loading: true });
    setDetailsLoading(true);
    api(`/api/reporting-managers/${manager.id}`)
      .then((r) => r.json())
      .then((data) => setSelected(data))
      .catch((e) => {
        console.error(e);
        setSelected(null);
      })
      .finally(() => setDetailsLoading(false));
  };

  const handleDelete = async (e, manager) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to remove ${manager.fullName} from Reporting Managers?`)) {
      return;
    }

    try {
      const res = await api(`/api/reporting-managers/${manager.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setManagers(prev => prev.filter(m => m.id !== manager.id));
        if (selected && selected.id === manager.id) {
          setSelected(null);
        }
      } else {
        const errorText = await res.text();
        console.error("DELETE FAILED:", errorText);
      }
    } catch (err) {
      console.error("Error deleting manager:", err);
    }
  };

  const handleRemoveMember = async (e, memberId, memberName) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this team?`)) return;

    try {
      const res = await api(`/api/reporting-managers/remove-member/${memberId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setSelected(prev => ({
          ...prev,
          team: prev.team.filter(t => t.id !== memberId)
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
        method: 'POST',
        body: JSON.stringify({
          employeeId: selectedEmployeeToAdd,
          reportingManagerId: selected.id
        }),
      });

      if (res.ok) {
        // Refresh details to show new member
        const r = await api(`/api/reporting-managers/${selected.id}`);
        const data = await r.json();
        setSelected(data);
        setSelectedEmployeeToAdd("");
        // Also refresh available employees list
        fetchAvailableEmployees();
      }
    } catch (err) {
      console.error("Error adding team member", err);
    } finally {
      setAddingMember(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-bg-slate flex-col md:flex-row overflow-hidden font-brand text-brand-text">
      {/* ================= SIDEBAR ================= */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Single Professional Header */}
        <header className="bg-white px-8 py-4 flex items-center justify-between shadow-sm z-10 border-b border-[#E3E8EF]">
          <div className="flex items-center gap-6">
            <div className="w-11 h-11 bg-[#F1EFE8] rounded-xl flex items-center justify-center border border-[#E3E8EF] shadow-sm overflow-hidden text-sm font-black text-[#2C2C2A]">
              {(JSON.parse(localStorage.getItem("user"))?.firstName?.[0]) || "A"}
            </div>
            <div>
              <h1 className="text-xl font-black text-[#2C2C2A] tracking-tight">Reporting Manager</h1>
              <p className="text-[10px] text-[#888780] uppercase font-black tracking-[0.2em] mt-0.5">
                Manager & Team Administration
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2 bg-brand-yellow text-brand-blue font-black rounded-xl text-[11px] uppercase tracking-widest shadow-lg shadow-brand-yellow/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
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
                <div className="overflow-y-auto p-4 space-y-2 flex-1 max-h-[calc(100vh-220px)]">
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
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40">Team Management</h3>
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
                            {availableEmployees.filter(ae => !selected.team.some(tm => tm.id === ae.id) && !ae.designation?.includes("HR") && !isDisabled(ae)).map(ae => (
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




