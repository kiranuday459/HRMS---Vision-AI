import React, { useEffect, useMemo, useState } from "react";
import { Briefcase, X, Search, Check } from "lucide-react";
import { toast } from "react-toastify";
import api from "../utils/api";
import DisabledBadge from "./DisabledBadge";
import { isDisabled } from "../utils/employeeStatus";
import { ProjectSuffix } from "../utils/employeeName";

/**
 * Admin tool: assign existing employees to a client / project.
 *
 * UI-ONLY at this stage — this modal collects the client, project and the selected
 * employees, validates the input and confirms with a toast. It intentionally does NOT
 * persist anything yet (no data model / API change). When a backend mapping table and
 * endpoint are introduced, wire the POST call in `handleSave` where marked below.
 */
export default function AssignEmployeeToClientProjectModal({ open, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [employees, setEmployees] = useState([]);

  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [assignmentStartDate, setAssignmentStartDate] = useState("");
  const [search, setSearch] = useState("");
  const [checkedIds, setCheckedIds] = useState(new Set());

  const fullName = (e) => `${e.firstName || ""}${e.lastName ? ` ${e.lastName}` : ""}`.trim();

  useEffect(() => {
    if (!open) return;
    setProjectId("");
    setProjectName("");
    setAssignmentStartDate("");
    setSearch("");
    setCheckedIds(new Set());
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const empRes = await api("/api/employees");
      const empJson = await empRes.json();
      const empList = empJson.data || empJson || [];
      setEmployees(Array.isArray(empList) ? empList : []);
    } catch (err) {
      console.error("Failed to load employees", err);
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  // Everyone except admins is assignable to a client project.
  const assignableEmployees = useMemo(
    () => employees.filter((e) => e.role !== "ADMIN"),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignableEmployees.filter((e) => {
      if (!q) return true;
      return (
        fullName(e).toLowerCase().includes(q) ||
        (e.oryfolksId || "").toLowerCase().includes(q) ||
        (e.designation || "").toLowerCase().includes(q)
      );
    });
  }, [assignableEmployees, search]);

  const selectable = filteredEmployees.filter((e) => !isDisabled(e));
  const allSelected = selectable.length > 0 && selectable.every((e) => checkedIds.has(e.id));

  const toggleCheck = (id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(selectable.map((e) => e.id)));
    }
  };

  const handleSave = async () => {
    if (!projectName.trim()) {
      toast.error("Please enter a project name");
      return;
    }
    if (!assignmentStartDate) {
      toast.error("Please select an assignment start date");
      return;
    }
    if (checkedIds.size === 0) {
      toast.error("Please select at least one employee");
      return;
    }

    setSaving(true);
    try {
      const res = await api("/api/admin/assign-client-project", {
        method: "POST",
        body: JSON.stringify({
          projectName: projectName.trim(),
          projectId: projectId.trim() || null,
          assignmentStartDate,
          employeeIds: [...checkedIds],
        }),
      });
      if (res.ok) {
        // Prefer the server's message (it confirms a verification OTP was emailed); fall
        // back to a local confirmation if absent.
        const data = await res.json().catch(() => ({}));
        const count = checkedIds.size;
        let message = data.message;
        if (!message) {
          if (count === 1) {
            const only = employees.find((e) => checkedIds.has(e.id));
            const name = only ? fullName(only) : "Employee";
            message = `${name} assigned to ${projectName.trim()} successfully. A verification OTP has been sent to their registered email.`;
          } else {
            message = `${count} employees assigned to ${projectName.trim()} successfully. A verification OTP has been sent to their registered emails.`;
          }
        }
        toast.success(message);
        if (onSaved) onSaved();
        onClose();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Failed to save assignment");
      }
    } catch (err) {
      console.error("Failed to save assignment", err);
      toast.error("Failed to save assignment");
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
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-brand-text tracking-tight">Assign Employees to Client Project</h3>
              <p className="text-[10px] font-bold text-brand-text/30 uppercase tracking-[0.15em] mt-0.5">Project staffing</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-text/40 hover:bg-bg-slate hover:text-brand-text transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Client + Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={sectionHeader}>Project</label>
              <input
                type="text"
                placeholder="e.g. Website Revamp"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-3 bg-bg-slate/50 border border-brand-blue/10 rounded-lg text-sm font-bold text-brand-text outline-none focus:border-brand-blue-dark/30 transition-all placeholder:text-brand-text/20 placeholder:font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className={sectionHeader}>Project ID</label>
              <input
                type="text"
                placeholder="e.g. 1000488399"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-4 py-3 bg-bg-slate/50 border border-brand-blue/10 rounded-lg text-sm font-bold text-brand-text outline-none focus:border-brand-blue-dark/30 transition-all placeholder:text-brand-text/20 placeholder:font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className={sectionHeader}>Assignment start date</label>
              <input
                type="date"
                value={assignmentStartDate}
                onChange={(e) => setAssignmentStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-bg-slate/50 border border-brand-blue/10 rounded-lg text-sm font-bold text-brand-text outline-none focus:border-brand-blue-dark/30 transition-all"
              />
              <p className="text-[10px] text-brand-text/40 font-medium">Employees can only log client hours on or after this date.</p>
            </div>
          </div>

          {/* Employees */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={sectionHeader}>Assign Employees</label>
              {filteredEmployees.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="text-[10px] font-black uppercase tracking-widest text-brand-blue-dark hover:underline"
                >
                  {allSelected ? "Deselect All" : "Select All"}
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
              ) : filteredEmployees.length === 0 ? (
                <p className="text-[12px] text-brand-text/40 italic py-2">No employees found</p>
              ) : (
                filteredEmployees.map((e) => {
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
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-brand-blue-dark text-white text-[12px] font-black uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Assignments"}
          </button>
        </div>
      </div>
    </div>
  );
}
