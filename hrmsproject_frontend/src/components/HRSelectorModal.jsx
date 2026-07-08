import React, { useEffect, useState } from "react";
import useEmployees from "../hooks/useEmployees";
import api from "../utils/api";

export default function HRSelectorModal({ open, onClose, onSave }) {
  const [employees, setEmployees] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hrUsers, setHrUsers] = useState(new Set());

  const { employees: fetchedEmployees } = useEmployees();

  useEffect(() => {
    if (!open) return;

    if (fetchedEmployees && fetchedEmployees.length) {
      const list = fetchedEmployees
        .filter(e => {
          const isSystemAdmin = (e.role === 'ADMIN') || (e.firstName === 'System' && e.lastName === 'Admin');
          const isHR = e.role === 'HR';
          return !isSystemAdmin && !isHR;
        })
        .map((e) => ({
          id: e.id,
          name: `${e.firstName || ""}${e.lastName ? ` ${e.lastName}` : ""}`.trim(),
          email: e.email || "",
          corporateEmail: e.corporateEmail,
          userId: e.userId,
        }));
      setEmployees(list);
    } else {
      setEmployees([]);
    }

    // Fetch existing HR users to exclude them
    api("/api/users")
      .then(res => res.json())
      .then(data => {
        const set = new Set();
        if (Array.isArray(data)) {
          data.forEach(u => {
            if (u.role === 'HR') {
              set.add(u.id);
            }
          });
        }
        setHrUsers(set);
      })
      .catch(err => console.error("Failed to fetch HR users", err));

  }, [open, fetchedEmployees]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedEmployeeId(null);
    }
  }, [open]);

  const filtered = employees.filter((e) =>
    (e.name.toLowerCase().includes(query.toLowerCase()) ||
      (e.email || "").toLowerCase().includes(query.toLowerCase())) &&
    !hrUsers.has(e.userId)
  );

  const handleSave = async () => {
    const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

    if (!selectedEmployee) {
      alert('Please select an employee');
      return;
    }

    if (!selectedEmployee.userId) {
      alert('Selected employee does not have a user account');
      return;
    }

    setSaving(true);

    try {
      const res = await api(`/api/reporting-managers/promote-hr/${selectedEmployee.id}`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        alert('Failed to update user role: ' + (data.message || 'Unknown error'));
        setSaving(false);
        return;
      }

      alert('Employee promoted to HR successfully!');
      setSelectedEmployeeId(null);

      if (onSave) onSave(selectedEmployee);
      onClose();
    } catch (e) {
      console.error('Error updating user role:', e);
      alert('Error updating user role');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const isSaveDisabled = saving || !selectedEmployeeId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="bg-white rounded-xl shadow-2xl w-11/12 max-w-2xl p-6 relative z-10 transition-all duration-200 transform modal-scale">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Promote Employee to HR</h3>
          <button className="text-gray-600 hover:text-gray-800 text-2xl" onClick={onClose}>✕</button>
        </div>

        <div className="mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employees by name or email"
            className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="max-h-96 overflow-y-auto mb-4 border border-gray-200 rounded-md">
          {filtered.length === 0 && (
            <p className="text-sm text-gray-500 p-4 text-center">No available employees found</p>
          )}
          {filtered.map((emp) => (
            <label
              key={emp.id}
              className={`flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${selectedEmployeeId === emp.id ? 'bg-green-50' : ''
                }`}
            >
              <input
                type="radio"
                name="hrEmployee"
                checked={selectedEmployeeId === emp.id}
                onChange={() => setSelectedEmployeeId(emp.id)}
                className="w-5 h-5 text-green-600 focus:ring-green-500"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{emp.name}</div>
                <div className="text-sm text-gray-500">
                  {emp.corporateEmail || emp.email || "No email available"}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {saving ? 'Promoting...' : 'Promote to HR'}
          </button>
        </div>
      </div>
    </div>
  );
}


