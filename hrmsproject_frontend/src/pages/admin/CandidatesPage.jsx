import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import AdminSidebar from "../../components/AdminSidebar";
import { useNavigate } from "react-router-dom";
import useEmployees from "../../hooks/useEmployees";
import api from "../../utils/api";
import DisabledBadge from "../../components/DisabledBadge";
import { ProjectSuffix } from "../../utils/employeeName";

export default function CandidatesPage() {
  const { employees, loading, error, refresh } = useEmployees();
  const [localEmployees, setLocalEmployees] = useState([]);
  const [assignmentsMap, setAssignmentsMap] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState({});
  // 3-dot options menu: { id, rect } of the currently open employee row
  const [openMenu, setOpenMenu] = useState(null);
  // Confirmation popup: { type: 'disable' | 'enable' | 'delete', emp }
  const [confirmModal, setConfirmModal] = useState(null);
  // Blocking modal shown when disable/delete is prevented by pending approvals:
  // { type: 'disable' | 'delete', timesheets, leaves }
  const [pendingBlock, setPendingBlock] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user")) || {};
    setUser(userData);
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

  const closeMenu = () => setOpenMenu(null);

  const toggleMenu = (empId, e) => {
    e && e.stopPropagation();
    if (openMenu && openMenu.id === empId) {
      setOpenMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenMenu({ id: empId, rect });
  };

  const handleViewProfile = (emp) => {
    navigate(`/admin/employee/${emp.id}`, { state: emp });
  };

  const handleStatusChange = async (emp, active) => {
    try {
      const res = await api(`/api/employees/${emp.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to update status");
      }
      setLocalEmployees((prev) =>
        prev.map((p) => (p.id === emp.id ? { ...p, active } : p))
      );
      refresh();
      showToast(
        active ? "Employee enabled successfully" : "Employee disabled successfully",
        "success"
      );
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to update status", "error");
    }
  };

  const handleDelete = async (empId) => {
    try {
      const res = await api(`/api/employees/${empId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to delete");
      }
      setLocalEmployees((prev) => prev.filter((p) => p.id !== empId));
      refresh();
      showToast("Employee deleted successfully", "success");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to delete employee", "error");
    }
  };

  // Before disabling or deleting, check the backend for pending timesheets/leaves.
  // If any exist, show a blocking modal instead of the confirmation dialog. The
  // backend enforces this too; this pre-check is only for immediate, clearer UX.
  const requestDestructiveAction = async (type, emp) => {
    try {
      const res = await api(`/api/employees/${emp.id}/pending-check`);
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        const summary = body?.data || {};
        if (summary.hasPending) {
          setPendingBlock({
            type,
            timesheets: summary.pendingTimesheets || 0,
            leaves: summary.pendingLeaves || 0,
          });
          return;
        }
      }
      // If the check itself failed, fall through to the confirmation dialog —
      // the backend will still block the action if pending items exist.
    } catch (err) {
      console.error("Pending-approval check failed", err);
    }
    setConfirmModal({ type, emp });
  };

  // Execute the action confirmed in the popup
  const runConfirm = () => {
    if (!confirmModal) return;
    const { type, emp } = confirmModal;
    if (type === "disable") handleStatusChange(emp, false);
    else if (type === "enable") handleStatusChange(emp, true);
    else if (type === "delete") handleDelete(emp.id);
    setConfirmModal(null);
  };

  // Copy for the confirmation popup, keyed by action type
  const confirmCopy = {
    disable: {
      title: "Disable Employee",
      message: "Are you sure you want to disable this employee?",
      confirmLabel: "Confirm",
      confirmClass: "bg-amber-500 hover:bg-amber-600",
    },
    enable: {
      title: "Enable Employee",
      message: "Are you sure you want to enable this employee?",
      confirmLabel: "Confirm",
      confirmClass: "bg-emerald-500 hover:bg-emerald-600",
    },
    delete: {
      title: "Delete Employee",
      message:
        "Are you sure you want to permanently delete this employee? This action cannot be undone.",
      confirmLabel: "Delete",
      confirmClass: "bg-red-500 hover:bg-red-600",
    },
  };

  return (
    <div className="flex h-screen w-screen bg-bg-slate flex-col md:flex-row overflow-hidden font-brand text-brand-text">
      {/* Sidebar */}
      <AdminSidebar
        activeTab="candidates"
        setActiveTab={() => { }}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Premium Header */}
        <header className="bg-white px-8 py-4 flex items-center justify-between shadow-sm z-10 border-b border-[#E3E8EF]">
          <div className="flex items-center gap-6">
            <div className="w-11 h-11 bg-[#F1EFE8] rounded-xl flex items-center justify-center border border-[#E3E8EF] shadow-sm overflow-hidden text-sm font-black text-[#2C2C2A]">
              {user.photoPath ? (
                <img src={user.photoPath} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                (user.firstName?.[0] || user.fullName?.[0]) || "A"
              )}
            </div>
            <div>
              <h1 className="text-xl font-black text-[#2C2C2A] tracking-tight">Candidates Directory</h1>
              <p className="text-[10px] text-[#888780] uppercase font-black tracking-[0.2em] mt-0.5">
                Resource Infrastructure Audit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Search Bar in Header Top Right */}
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
          </div>
        </header>

        <div className="flex-1 p-3 md:p-6 space-y-4 overflow-y-auto flex flex-col">
          {/* Table Container */}
          <div className="bg-white rounded-[32px] shadow-2xl shadow-brand-blue/5 border border-brand-blue/5 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-brand-blue/5 flex items-center justify-between bg-bg-slate/30">
              <div>
                <h2 className="text-2xl font-black text-brand-text tracking-tight">Employee Registry</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-brand-blue/5 text-brand-text px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {filteredEmployees.length} Total Records
                </span>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-210px)] scrollbar-hide">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-30">
                  <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Synchronizing Database...</p>
                </div>
              ) : error ? (
                <div className="py-20 text-center">
                  <p className="text-red-500 font-bold">{error}</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse border-spacing-0">
                  <thead>
                    <tr className="bg-brand-blue/[0.02]">
                      <th className="py-5 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40 border-b border-brand-blue/5">EMP ID</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40 border-b border-brand-blue/5">Member Identity</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40 border-b border-brand-blue/5">Professional Role</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40 border-b border-brand-blue/5">Hierarchy Lead</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40 border-b border-brand-blue/5">HR Liaison</th>
                      <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40 border-b border-brand-blue/5">Communication</th>
                      <th className="py-5 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/40 border-b border-brand-blue/5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-blue/5">
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center italic text-brand-text/20 font-bold uppercase tracking-widest text-xs">
                          No matching personnel found in directory
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const isInactive = emp.active === false;
                        return (
                        <tr
                          key={emp.id}
                          className={`group transition-all cursor-pointer ${isInactive ? "bg-gray-100 opacity-60 grayscale hover:opacity-80" : "hover:bg-bg-slate/50"}`}
                          onClick={() => navigate(`/admin/employee/${emp.id}`, { state: emp })}
                        >
                          <td className="py-5 px-8">
                            <span className="text-xs font-black text-brand-text/30 group-hover:text-brand-text transition-colors">
                              {emp.oryfolksId || "PENDING"}
                            </span>
                          </td>
                          <td className="py-5 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-brand-blue/5 rounded-xl flex items-center justify-center text-[11px] font-black text-brand-text group-hover:bg-brand-blue group-hover:text-white transition-all shadow-sm">
                                {(emp.firstName?.[0] || "U")}
                              </div>
                              <span className="text-sm font-bold text-brand-text tracking-tight">
                                {`${emp.firstName || ""} ${emp.lastName || ""}`}<ProjectSuffix project={emp.clientProject} />
                              </span>
                              {isInactive && <DisabledBadge />}
                            </div>
                          </td>
                          <td className="py-5 px-6">
                            <span className="inline-flex px-3 py-1 bg-brand-yellow/10 text-brand-text text-[9px] font-black uppercase tracking-widest rounded-full border border-brand-yellow/20">
                              {emp.role || 'Personnel'}
                            </span>
                          </td>
                          <td className="py-5 px-6">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-brand-text/60 tabular-nums uppercase tracking-tight">
                                {emp.role === 'HR' ? adminName :
                                  emp.role === 'REPORTING_MANAGER' ? (assignmentsMap[emp.id]?.hrName || 'HR Coordinator') :
                                    (assignmentsMap[emp.id]?.managerName || 'Unassigned')}
                              </span>
                              <span className="text-[9px] font-bold text-brand-text/20 uppercase tracking-widest">Structural Lead</span>
                            </div>
                          </td>
                          <td className="py-5 px-6">
                            <span className="text-xs font-bold text-brand-text/60 tabular-nums">
                              {assignmentsMap[emp.id]?.hrName || '–'}
                            </span>
                          </td>
                          <td className="py-5 px-6">
                            <span className="text-xs font-bold text-brand-text/40 group-hover:text-brand-text/70 transition-colors tabular-nums underline decoration-brand-blue/5 decoration-2 underline-offset-4">
                              {emp.corporateEmail || "Await Provision"}
                            </span>
                          </td>
                          <td className="py-5 px-8 text-center">
                            <button
                              onClick={(e) => toggleMenu(emp.id, e)}
                              className={`p-2.5 rounded-xl transition-all shadow-sm ${openMenu && openMenu.id === emp.id ? "bg-brand-blue text-white" : "bg-brand-blue/5 text-brand-text hover:bg-brand-blue hover:text-white"}`}
                              title="Options"
                              aria-label="Options"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="5" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="12" cy="19" r="2" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </main>

      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-6 py-3 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest animate-in slide-in-from-right duration-300 ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
          {toast.message}
        </div>
      )}

      {/* 3-dot options menu (portal so it is never clipped by the scroll container) */}
      {openMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[140]" onClick={closeMenu} />
          {(() => {
            const emp = localEmployees.find((e) => e.id === openMenu.id);
            if (!emp) return null;
            const isInactive = emp.active === false;
            const left = Math.max(8, openMenu.rect.right - 192);
            return (
              <div
                className="fixed z-[150] w-48 bg-white rounded-2xl shadow-2xl border border-brand-blue/10 py-2 animate-in fade-in zoom-in duration-150 origin-top-right"
                style={{ top: openMenu.rect.bottom + 6, left }}
              >
                {isInactive ? (
                  <>
                    <button
                      onClick={() => { closeMenu(); setConfirmModal({ type: "enable", emp }); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Enable
                    </button>
                    <button
                      onClick={() => { closeMenu(); handleViewProfile(emp); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-brand-text hover:bg-bg-slate transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      View Profile
                    </button>
                    <div className="h-px bg-brand-blue/5 mx-2 my-1" />
                    <button
                      onClick={() => { closeMenu(); requestDestructiveAction("delete", emp); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { closeMenu(); requestDestructiveAction("disable", emp); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                      Disable
                    </button>
                    <div className="h-px bg-brand-blue/5 mx-2 my-1" />
                    <button
                      onClick={() => { closeMenu(); requestDestructiveAction("delete", emp); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete
                    </button>
                  </>
                )}
              </div>
            );
          })()}
        </>,
        document.body
      )}

      {/* Confirmation popup */}
      {confirmModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4" onClick={() => setConfirmModal(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black mb-3 text-brand-text uppercase tracking-tight">
              {confirmCopy[confirmModal.type].title}
            </h3>
            <p className="text-sm font-bold text-brand-text/60 mb-6 leading-relaxed">
              {confirmCopy[confirmModal.type].message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={runConfirm}
                className={`flex-1 text-white px-4 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition shadow-lg ${confirmCopy[confirmModal.type].confirmClass}`}
              >
                {confirmCopy[confirmModal.type].confirmLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Blocking modal — disable/delete prevented by pending approvals */}
      {pendingBlock && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4" onClick={() => setPendingBlock(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border-t-4 border-amber-500" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-2.99L13.74 4a2 2 0 00-3.48 0L3.33 16.01A2 2 0 005.07 19z" /></svg>
              </div>
              <h3 className="text-lg font-black text-brand-blue uppercase tracking-tight">
                Cannot {pendingBlock.type === "delete" ? "Delete" : "Disable"} Account
              </h3>
            </div>
            <p className="text-sm font-bold text-brand-blue/70 mb-3 leading-relaxed">
              This employee has pending approvals that must be resolved first:
            </p>
            <ul className="text-sm font-bold text-brand-blue/80 mb-4 space-y-1 list-disc list-inside">
              <li>{pendingBlock.timesheets} pending timesheet(s)</li>
              <li>{pendingBlock.leaves} pending leave(s)</li>
            </ul>
            <p className="text-xs font-bold text-brand-blue/50 mb-6 leading-relaxed">
              Please ensure all timesheets and leaves are approved or rejected before {pendingBlock.type === "delete" ? "deleting" : "disabling"} this account.
            </p>
            <button
              onClick={() => setPendingBlock(null)}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition shadow-lg"
            >
              OK
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}



