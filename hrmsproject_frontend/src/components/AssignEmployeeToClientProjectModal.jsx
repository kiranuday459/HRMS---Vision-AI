import React, { useEffect, useMemo, useState } from "react";
import { Briefcase, X, Search, Check } from "lucide-react";
import { toast } from "react-toastify";
import api from "../utils/api";
import { isDisabled } from "../utils/employeeStatus";
import CharCounter from "./CharCounter";
import { FIELD_LIMITS } from "../utils/fieldLimits";

// Roles that may hold a client project assignment. Mirrors ASSIGNABLE_ROLES in
// ClientProjectAssignmentService — Admin and HR are never assignable.
const ASSIGNABLE_ROLES = new Set(["EMPLOYEE", "REPORTING_MANAGER"]);

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
  // Employee ids holding a live client project assignment — excluded from the picker.
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState(new Set());
  const [clientName, setClientName] = useState("");
  const [clientOptions, setClientOptions] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [assignmentStartDate, setAssignmentStartDate] = useState("");
  const [search, setSearch] = useState("");
  const [checkedIds, setCheckedIds] = useState(new Set());

  const fullName = (e) => `${e.firstName || ""}${e.lastName ? ` ${e.lastName}` : ""}`.trim();

  // "2026-06-01" → "01-Jun-2026". Only for messages; the input keeps the ISO value.
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formatDMY = (ymd) => {
    if (!ymd) return "";
    const [y, m, d] = ymd.split("-");
    return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
  };
  const joiningOf = (e) => (e?.joiningDate ? String(e.joiningDate).split("T")[0] : null);

  useEffect(() => {
    if (!open) return;
    setClientName("");
    setProjectId("");
    setProjectName("");
    setAssignmentStartDate("");
    setSearch("");
    setCheckedIds(new Set());
    fetchData();
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const empRes = await api("/api/employees");
      const empJson = await empRes.json();
      const empList = empJson.data || empJson || [];
      setEmployees(Array.isArray(empList) ? empList : []);

      const assignRes = await api("/api/client-project-assignments");
      const assignJson = await assignRes.json();
      const assignList = Array.isArray(assignJson.data) ? assignJson.data : (Array.isArray(assignJson) ? assignJson : []);
      const distinctClients = Array.from(new Set(assignList.map(a => a.clientName).filter(Boolean))).sort();
      setClientOptions(distinctClients);
      // One active project per employee: anyone holding a live assignment drops out of the
      // picker. Keyed on the assignment's own `active` flag, so ending an assignment puts
      // that employee back in the list.
      setAssignedEmployeeIds(new Set(
        assignList.filter((a) => a.active).map((a) => a.employeeId).filter((id) => id != null)
      ));
    } catch (err) {
      console.error("Failed to load data", err);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Who can be assigned to a client project. All three exclusions are re-checked server-side
  // in ClientProjectAssignmentService.requireAssignable — this list is the convenience, that
  // is the rule.
  //   role      — only Employees and Reporting Managers do client work; Admin and HR never do.
  //   disabled  — an account disabled in HRMS drops out of every picker automatically.
  //   assigned  — one active project per employee, for now.
  const assignableEmployees = useMemo(
    () => employees.filter((e) =>
      ASSIGNABLE_ROLES.has((e.role || "").toUpperCase()) &&
      !isDisabled(e) &&
      !assignedEmployeeIds.has(e.id)
    ),
    [employees, assignedEmployeeIds]
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

  // An employee cannot be put on a client project before they joined VisionAI HRMS. One date
  // is applied to every employee ticked below, so the floor is the LATEST joining date among
  // them — a date that is fine for an April joiner is still invalid for a June one.
  // joiningDate already rides along on /api/employees (EmployeeService fills it from the
  // employee's CompanyDetail), so no extra fetch is needed. Employees whose joining date was
  // never recorded contribute nothing and are left to the server's own guard.
  const joiningFloorEmployee = useMemo(() => {
    let latest = null;
    employees.forEach((e) => {
      if (!checkedIds.has(e.id)) return;
      const jd = joiningOf(e);
      if (jd && (!latest || jd > joiningOf(latest))) latest = e;
    });
    return latest;
  }, [employees, checkedIds]);
  const joiningFloor = joiningOf(joiningFloorEmployee);

  // A date below the floor is reported and blocks the save; it is not silently corrected.
  // The calendar cannot offer one (see `min` on the input), so this is reached by typing, or
  // by ticking a later joiner after the date was already chosen. Moving the admin's date for
  // them would change what they entered without saying so — the message names the employee
  // and their joining date instead, and Assign stays shut until it is fixed.
  //
  // Guarded on the date being complete, because a date input reports a value mid-entry:
  // typing 15-Aug-2026 passes through year 0002 as the year is keyed in, which is below every
  // floor and would flash an error on the first keystroke. Anything before 1900 is therefore
  // treated as still being typed rather than as a real date.
  const dateComplete =
    /^\d{4}-\d{2}-\d{2}$/.test(assignmentStartDate) && Number(assignmentStartDate.slice(0, 4)) >= 1900;
  const dateBelowFloor = Boolean(dateComplete && joiningFloor && assignmentStartDate < joiningFloor);
  const dateFloorMessage = dateBelowFloor
    ? `Assignment date can't be before ${fullName(joiningFloorEmployee)}'s VisionAI join date (${formatDMY(joiningFloor)}).`
    : "";

  // Everything that survives assignableEmployees is selectable — disabled accounts are
  // filtered out of the list entirely now rather than shown greyed out.
  const selectable = filteredEmployees;
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
    if (!clientName.trim()) {
      toast.error("Please enter or select a client name");
      return;
    }
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
    // Checked after the employee selection: the floor is derived from who is ticked, so with
    // nobody ticked there is no floor to be below and "select an employee" is the real
    // problem. The server enforces this too (requireOnOrAfterJoiningDate) — that is the rule,
    // this is the convenience.
    if (dateBelowFloor) {
      toast.error(dateFloorMessage);
      return;
    }

    const startDate = assignmentStartDate;

    setSaving(true);
    try {
      const res = await api("/api/admin/assign-client-project", {
        method: "POST",
        body: JSON.stringify({
          clientName: clientName.trim(),
          projectName: projectName.trim(),
          projectId: projectId.trim() || null,
          assignmentStartDate: startDate,
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
              <label className={sectionHeader}>Client</label>
              <input
                type="text"
                list="modal-clients-datalist"
                placeholder="e.g. Acme Corp"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-4 py-3 bg-bg-slate/50 border border-brand-blue/10 rounded-lg text-sm font-bold text-brand-text outline-none focus:border-brand-blue-dark/30 transition-all placeholder:text-brand-text/20 placeholder:font-medium"
              />
              <datalist id="modal-clients-datalist">
                {clientOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <label className={sectionHeader}>Project</label>
              <input
                type="text"
                placeholder="e.g. Website Revamp"
                value={projectName}
                maxLength={FIELD_LIMITS.PROJECT_NAME}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-3 bg-bg-slate/50 border border-brand-blue/10 rounded-lg text-sm font-bold text-brand-text outline-none focus:border-brand-blue-dark/30 transition-all placeholder:text-brand-text/20 placeholder:font-medium"
              />
              <CharCounter value={projectName} max={FIELD_LIMITS.PROJECT_NAME} />
            </div>
            <div className="space-y-2">
              <label className={sectionHeader}>Project ID</label>
              <input
                type="text"
                placeholder="e.g. 1000488399"
                value={projectId}
                maxLength={FIELD_LIMITS.PROJECT_ID}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-4 py-3 bg-bg-slate/50 border border-brand-blue/10 rounded-lg text-sm font-bold text-brand-text outline-none focus:border-brand-blue-dark/30 transition-all placeholder:text-brand-text/20 placeholder:font-medium"
              />
              <CharCounter value={projectId} max={FIELD_LIMITS.PROJECT_ID} />
            </div>
            <div className="space-y-2">
              <label className={sectionHeader}>Assignment start date</label>
              {/* `min` greys out every day before the selected employees joined, so the
                  calendar cannot produce an invalid date at all. Typing goes around the
                  calendar, which is what the message below catches. */}
              <input
                type="date"
                value={assignmentStartDate}
                min={joiningFloor || undefined}
                onChange={(e) => setAssignmentStartDate(e.target.value)}
                aria-invalid={dateBelowFloor}
                aria-describedby="assignment-date-help"
                className={`w-full px-4 py-3 bg-bg-slate/50 border rounded-lg text-sm font-bold text-brand-text outline-none transition-all ${dateBelowFloor
                  ? "border-red-400 focus:border-red-500"
                  : "border-brand-blue/10 focus:border-brand-blue-dark/30"}`}
              />
            </div>
          </div>
          {/* States the floor up front, and replaces it with the error once the date is below
              it — one line rather than two competing ones. */}
          <p
            id="assignment-date-help"
            className={`text-[10px] font-medium -mt-2 ${dateBelowFloor ? "text-red-600 font-semibold" : "text-brand-text/40"}`}
            role={dateBelowFloor ? "alert" : undefined}
          >
            {dateBelowFloor ? dateFloorMessage : (
              <>
                Employees can only log client hours on or after this date.
                {joiningFloor && ` Earliest allowed: ${formatDMY(joiningFloor)} (${fullName(joiningFloorEmployee)}'s joining date).`}
              </>
            )}
          </p>

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
                  const checked = checkedIds.has(e.id);
                  return (
                    <label
                      key={e.id}
                      className={`flex items-center gap-3 border-[0.5px] rounded-lg p-3 transition-all cursor-pointer ${checked ? "bg-brand-blue/[0.03] border-brand-blue-dark/40" : "bg-white border-brand-blue/10 hover:border-brand-blue/20"}`}
                    >
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ${checked ? "bg-brand-blue-dark border-brand-blue-dark text-white" : "border-brand-blue/20 bg-white"}`}
                      >
                        {checked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                      </span>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={checked}
                        onChange={() => toggleCheck(e.id)}
                      />
                      <div className="flex-1 min-w-0">
                        {/* No project suffix here: by construction nobody in this list holds
                            an active assignment, and employees.client_project can lag behind
                            an ended one — so showing it would name a project they've left. */}
                        <p className="text-sm font-bold truncate text-brand-text">{fullName(e)}</p>
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
