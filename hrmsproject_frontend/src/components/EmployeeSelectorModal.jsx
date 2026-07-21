import React, { useEffect, useState } from "react";
import { Users, X, Search, Check } from "lucide-react";
import useEmployees from "../hooks/useEmployees";
import { ProjectSuffix, projectSuffix } from "../utils/employeeName";
import api from "../utils/api";
import DisabledBadge from "./DisabledBadge";
import { isDisabled } from "../utils/employeeStatus";

export default function EmployeeSelectorModal({ open, onClose, onSave }) {
  const [employees, setEmployees] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState({});
  const [managerId, setManagerId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [existingManagers, setExistingManagers] = useState(new Set());
  const [assignedEmployees, setAssignedEmployees] = useState(new Set());

  const { employees: fetchedEmployees } = useEmployees();

  useEffect(() => {
    if (!open) return;

    if (fetchedEmployees && fetchedEmployees.length) {
      const list = fetchedEmployees
        .filter(e => {
          const isSystemAdmin = (e.role === 'ADMIN') || (e.firstName === 'System' && e.lastName === 'Admin');
          const isHR = (e.role === 'HR');
          // Disabled/inactive users are still shown (with a DISABLED badge) but are not selectable.
          return !isSystemAdmin && !isHR;
        })
        .map((e) => ({
          id: e.id,
          name: `${e.firstName || ""}${e.lastName ? ` ${e.lastName}` : ""}`.trim(),
          email: e.email || "",
          corporateEmail: e.corporateEmail,
          oryfolksId: e.oryfolksId,
          designation: e.designation,
          active: e.active,
          clientProject: e.clientProject,
        }));
      setEmployees(list);
    } else {
      setEmployees([]);
    }

    // Fetch existing managers to exclude them
    api("/api/reporting-managers")
      .then(res => res.json())
      .then(data => {
        const set = new Set();
        if (Array.isArray(data)) {
          data.forEach(m => set.add(m.id));
        }
        setExistingManagers(set);
      })
      .catch(err => console.error("Failed to fetch existing managers", err));

    // Fetch all assignments to find currently assigned employees
    api("/api/reporting-managers/assignments")
      .then(res => res.json())
      .then(data => {
        const set = new Set();
        if (Array.isArray(data)) {
          data.forEach(a => {
            // If employee has a manager, they are assigned. 
            // Note: Data is EmployeeReportingDTO { employeeId, reportingManagerId, ... }
            if (a.reportingManagerId) {
              set.add(a.employeeId);
            }
          });
        }
        setAssignedEmployees(set);
      })
      .catch(err => console.error("Failed to fetch assignments", err));

  }, [open, fetchedEmployees]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected({});
      setManagerId(null);
    }
  }, [open]);

  // Clear selection when manager changes to prevent bleed-over
  const handleManagerChange = (e) => {
    const val = e.target.value ? Number(e.target.value) : null;
    setManagerId(val);
    setSelected({}); // RESET selected team when manager changes
  };

  const toggleSelect = (id) => setSelected((p) => ({ ...p, [id]: !p[id] }));

  // FILTER LOGIC:
  // 1. Must match search query
  // 2. Must NOT be an existing manager (cannot report to someone else if they are a manager? - assuming simple hierarchy for now or per requirement)
  // 3. Must NOT be already assigned to another manager (unless they are selected in THIS session, unlikely for new assignment)
  // 4. Must NOT be the currently selected manager (cannot report to self)
  // Actually, we want to hide "Assigned" employees from the list so they can't be picked.
  const filtered = employees.filter((e) =>
    (e.name.toLowerCase().includes(query.toLowerCase()) ||
      (e.email || "").toLowerCase().includes(query.toLowerCase())) &&
    !existingManagers.has(e.id) &&
    !assignedEmployees.has(e.id) && // Hide assigned employees
    e.id !== managerId // Hide the selected manager themselves
  );

  const filteredTeam = filtered; // No need to filter managerId again if we did it above

  // Select All / Deselect All over the currently visible (filtered) unassigned list.
  // UI affordance only — toggles the existing `selected` state, no logic/API change.
  // Select-all only applies to selectable (non-disabled) employees.
  const selectableTeam = filteredTeam.filter((e) => !isDisabled(e));
  const allFilteredSelected = selectableTeam.length > 0 && selectableTeam.every((e) => selected[e.id]);
  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected((p) => {
        const next = { ...p };
        selectableTeam.forEach((e) => { next[e.id] = false; });
        return next;
      });
    } else {
      setSelected((p) => {
        const next = { ...p };
        selectableTeam.forEach((e) => { next[e.id] = true; });
        return next;
      });
    }
  };

  const handleSave = async () => {
    const team = employees.filter((e) => selected[e.id]);
    const manager = employees.find((e) => e.id === managerId) || null;
    const payload = { manager, team };

    if (!manager) {
      alert('Please select a reporting manager');
      return;
    }

    if (team.length === 0) {
      alert('Please select at least one team member');
      return;
    }

    setSaving(true);

    // REMOVED LOCAL STORAGE SAVING
    // try { localStorage.setItem("selectedReportingManagers", JSON.stringify(payload)); }
    // catch (e) { console.error("Failed to persist selected employees", e); }

    // POST each assignment to backend
    for (const emp of team) {
      try {
        const res = await api('/api/reporting-managers', {
          method: 'POST',
          body: JSON.stringify({
            employeeId: emp.id,
            reportingManagerId: manager.id,
            hrId: null,
          }),
        });
        const text = await res.text().catch(() => null);
        if (!res.ok) {
          console.error(`Failed to save assignment for employee ${emp.id}`, res.status, text);
        } else {
          console.log(`Saved assignment for employee ${emp.id}`, text);
        }
      } catch (e) {
        console.error(`Error saving assignment for employee ${emp.id}:`, e);
      }
    }

    setSaving(false);
    alert('Reporting manager assignments saved successfully!');
    // Clear State
    setSelected({});
    setManagerId(null);
    localStorage.removeItem("selectedReportingManagers"); // Explicitly clear if it exists

    if (onSave) onSave(payload);
    onClose();
  };

  if (!open) return null;

  // Calculate if save should be enabled
  const teamSize = Object.values(selected).filter(Boolean).length;
  const isSaveDisabled = saving || !managerId || teamSize === 0;

  const sectionHeader = "text-[11px] font-black uppercase tracking-[0.18em] text-brand-text/40";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-brand-blue/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full max-w-[600px] rounded-xl shadow-2xl border border-brand-blue/5 flex flex-col max-h-[80vh] modal-scale">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 p-5 border-b border-brand-blue/5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue-dark">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-brand-text tracking-tight">Assign Employees to Manager</h3>
              <p className="text-[10px] font-bold text-brand-text/30 uppercase tracking-[0.15em] mt-0.5">Manage Manager Assignments</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-text/40 hover:bg-bg-slate hover:text-brand-text transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Select Manager */}
          <div className="space-y-2">
            <label className={sectionHeader}>Select Manager</label>
            <select
              value={managerId || ""}
              onChange={handleManagerChange}
              className="w-full px-4 py-3 bg-bg-slate/50 border border-brand-blue/10 rounded-lg text-sm font-bold text-brand-text outline-none focus:border-brand-blue-dark/30 transition-all"
            >
              <option value="">Select Manager...</option>
              {employees
                .filter(emp => !existingManagers.has(emp.id))
                .map((emp) => (
                  // Disabled employees cannot be assigned as a reporting manager.
                  <option key={emp.id} value={emp.id} disabled={isDisabled(emp)}>
                    {emp.name}{projectSuffix(emp.clientProject)}{isDisabled(emp) ? " — DISABLED" : ""}{emp.oryfolksId ? ` · ${emp.oryfolksId}` : ""}
                  </option>
                ))}
            </select>
          </div>

          {/* Assign New Employees */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={sectionHeader}>Assign New Employees</label>
              {filteredTeam.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="text-[10px] font-black uppercase tracking-widest text-brand-blue-dark hover:underline"
                >
                  {allFilteredSelected ? "Deselect All" : "Select All"}
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text/20" size={15} />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-bg-slate/50 border border-brand-blue/10 rounded-lg text-[12px] font-medium outline-none focus:border-brand-blue-dark/30 transition-all placeholder:text-brand-text/20"
              />
            </div>

            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {filteredTeam.length === 0 ? (
                <p className="text-[12px] text-brand-text/40 italic py-2">No unassigned employees found</p>
              ) : (
                filteredTeam.map((emp) => {
                  const empDisabled = isDisabled(emp);
                  const checked = !empDisabled && !!selected[emp.id];
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-center gap-3 border-[0.5px] rounded-lg p-3 transition-all ${empDisabled ? "bg-[#F1EFE8] border-brand-blue/10 cursor-not-allowed" : checked ? "bg-brand-blue/[0.03] border-brand-blue-dark/40 cursor-pointer" : "bg-white border-brand-blue/10 hover:border-brand-blue/20 cursor-pointer"}`}
                    >
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ${empDisabled ? "bg-[#D3D1C7] border-[#D3D1C7]" : checked ? "bg-brand-blue-dark border-brand-blue-dark text-white" : "border-brand-blue/20 bg-white"}`}
                      >
                        {checked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                      </span>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={checked}
                        disabled={empDisabled}
                        onChange={() => !empDisabled && toggleSelect(emp.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-bold truncate ${empDisabled ? "text-[#5F5E5A]" : "text-brand-text"}`}>{emp.name}<ProjectSuffix project={emp.clientProject} /></p>
                          {empDisabled && <DisabledBadge />}
                        </div>
                        <p className="text-[11px] text-brand-text/40 font-medium truncate">
                          {[emp.oryfolksId, emp.designation].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-brand-blue/5">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-[12px] font-black uppercase tracking-widest text-brand-text/60 hover:bg-bg-slate transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="px-6 py-2.5 rounded-lg bg-brand-blue-dark text-white text-[12px] font-black uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Assignments"}
          </button>
        </div>
      </div>
    </div>
  );
}



