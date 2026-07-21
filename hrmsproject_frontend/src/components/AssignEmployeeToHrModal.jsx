import React, { useEffect, useMemo, useState } from "react";
import { Shield, X, Search, Check } from "lucide-react";
import { toast } from "react-toastify";
import api from "../utils/api";
import DisabledBadge from "./DisabledBadge";
import { isDisabled } from "../utils/employeeStatus";
import { ProjectSuffix } from "../utils/employeeName";

/**
 * Admin tool: assign existing employees to an existing HR user.
 * Once assigned, that employee's timesheet & leave at the HR approval stage route to
 * this HR only (see backend filterForHr). Only the hr field is touched here — the
 * reporting manager and the approval flow are left exactly as they are.
 */
export default function AssignEmployeeToHrModal({ open, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Raw data
  const [employees, setEmployees] = useState([]);
  // Map of employeeId -> hrId (current HR assignment), from /assignments
  const [assignmentMap, setAssignmentMap] = useState({});

  // Selections
  const [selectedHrId, setSelectedHrId] = useState("");
  const [search, setSearch] = useState("");
  const [checkedIds, setCheckedIds] = useState(new Set()); // unassigned employees to assign

  const fullName = (e) => `${e.firstName || ""}${e.lastName ? ` ${e.lastName}` : ""}`.trim();

  useEffect(() => {
    if (!open) return;
    setSelectedHrId("");
    setSearch("");
    setCheckedIds(new Set());
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, assignRes] = await Promise.all([
        api("/api/employees"),
        api("/api/reporting-managers/assignments"),
      ]);

      const empJson = await empRes.json();
      const empList = empJson.data || empJson || [];
      setEmployees(Array.isArray(empList) ? empList : []);

      const assignJson = await assignRes.json();
      const assignList = Array.isArray(assignJson) ? assignJson : (assignJson.data || []);
      const map = {};
      assignList.forEach((a) => {
        if (a.employeeId != null) map[a.employeeId] = a.hrId != null ? a.hrId : null;
      });
      setAssignmentMap(map);
    } catch (err) {
      console.error("Failed to load assignment data", err);
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  // All ACTIVE users with the HR role (shown in the Select HR dropdown). Inactive/disabled HR are hidden.
  const hrUsers = useMemo(
    () => employees.filter((e) => e.role === "HR" && e.active !== false),
    [employees]
  );

  // Employees that appear in the assign list (everyone except HR users and admins). Disabled/inactive
  // employees are still shown (with a DISABLED badge) but are not selectable.
  const assignableEmployees = useMemo(
    () => employees.filter((e) => e.role !== "HR" && e.role !== "ADMIN"),
    [employees]
  );

  // Unassigned employees (not yet assigned to ANY HR) — the pool for new assignment.
  const unassignedEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignableEmployees
      .filter((e) => assignmentMap[e.id] == null)
      .filter((e) => {
        if (!q) return true;
        return (
          fullName(e).toLowerCase().includes(q) ||
          (e.oryfolksId || "").toLowerCase().includes(q) ||
          (e.designation || "").toLowerCase().includes(q)
        );
      });
  }, [assignableEmployees, assignmentMap, search]);

  // Select-all only applies to selectable (non-disabled) employees.
  const selectableUnassigned = unassignedEmployees.filter((e) => !isDisabled(e));
  const allUnassignedSelected =
    selectableUnassigned.length > 0 &&
    selectableUnassigned.every((e) => checkedIds.has(e.id));

  const toggleCheck = (id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allUnassignedSelected) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(selectableUnassigned.map((e) => e.id)));
    }
  };

  const handleSave = async () => {
    if (!selectedHrId) {
      toast.error("Please select an HR first");
      return;
    }
    const hrId = Number(selectedHrId);
    const toAssign = [...checkedIds];

    if (toAssign.length === 0) {
      toast.info("No changes to save");
      return;
    }

    setSaving(true);
    try {
      for (const employeeId of toAssign) {
        await api("/api/reporting-managers/assign-hr", {
          method: "POST",
          body: JSON.stringify({ employeeId, hrId }),
        });
      }
      toast.success("HR assignments saved");
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error("Failed to save assignments", err);
      toast.error("Failed to save assignments");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const sectionHeader = "text-[11px] font-black uppercase tracking-[0.18em] text-brand-text/40";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-brand-blue/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full max-w-[600px] rounded-xl shadow-2xl border border-brand-blue/5 flex flex-col max-h-[90vh] modal-scale">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 p-5 border-b border-brand-blue/5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue-dark">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-brand-text tracking-tight">Assign Employees to HR</h3>
              <p className="text-[10px] font-bold text-brand-text/30 uppercase tracking-[0.15em] mt-0.5">Manage HR assignments</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-text/40 hover:bg-bg-slate hover:text-brand-text transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Step 1 — Select HR */}
          <div className="space-y-2">
            <label className={sectionHeader}>Select HR</label>
            <select
              value={selectedHrId}
              onChange={(e) => {
                setSelectedHrId(e.target.value);
                setCheckedIds(new Set());
              }}
              className="w-full px-4 py-3 bg-bg-slate/50 border border-brand-blue/10 rounded-lg text-sm font-bold text-brand-text outline-none focus:border-brand-blue-dark/30 transition-all"
            >
              <option value="">Select HR...</option>
              {hrUsers.map((hr) => (
                <option key={hr.id} value={hr.id}>
                  {fullName(hr)}{hr.oryfolksId ? ` · ${hr.oryfolksId}` : ""}
                </option>
              ))}
            </select>
            {!loading && hrUsers.length === 0 && (
              <p className="text-[11px] text-brand-text/40 italic">No HR users found. Create an HR user first.</p>
            )}
          </div>

          {selectedHrId && (
            <>
              {/* Assign New Employees */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={sectionHeader}>Assign New Employees</label>
                  {unassignedEmployees.length > 0 && (
                    <button
                      onClick={toggleSelectAll}
                      className="text-[10px] font-black uppercase tracking-widest text-brand-blue-dark hover:underline"
                    >
                      {allUnassignedSelected ? "Deselect All" : "Select All"}
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text/20" size={15} />
                  <input
                    type="text"
                    placeholder="Search by name or ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-bg-slate/50 border border-brand-blue/10 rounded-lg text-[12px] font-medium outline-none focus:border-brand-blue-dark/30 transition-all placeholder:text-brand-text/20"
                  />
                </div>

                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {loading ? (
                    <p className="text-[12px] text-brand-text/40 italic py-2">Loading employees...</p>
                  ) : unassignedEmployees.length === 0 ? (
                    <p className="text-[12px] text-brand-text/40 italic py-2">No unassigned employees found</p>
                  ) : (
                    unassignedEmployees.map((e) => {
                      const empDisabled = isDisabled(e);
                      const checked = !empDisabled && checkedIds.has(e.id);
                      return (
                        <label
                          key={e.id}
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
                            onChange={() => !empDisabled && toggleCheck(e.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-bold truncate ${empDisabled ? "text-[#5F5E5A]" : "text-brand-text"}`}>{fullName(e)}<ProjectSuffix project={e.clientProject} /></p>
                              {empDisabled && <DisabledBadge />}
                            </div>
                            <p className="text-[11px] text-brand-text/40 font-medium truncate">
                              {[e.oryfolksId, e.designation].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
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
            disabled={saving || !selectedHrId}
            className="px-6 py-2.5 rounded-lg bg-brand-blue-dark text-white text-[12px] font-black uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Assignments"}
          </button>
        </div>
      </div>
    </div>
  );
}
