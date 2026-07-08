import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DisabledBadge from "../../components/DisabledBadge";
import { isDisabled } from "../../utils/employeeStatus";

export default function SelectedEmployees() {
  const { state } = useLocation();
  const navigate = useNavigate();

  let payload = null;

  if (state && state.selectedEmployees) {
    payload = { manager: null, team: state.selectedEmployees };
  } else if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("selectedReportingManagers");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          payload = { manager: null, team: parsed };
        } else if (parsed && (parsed.manager || parsed.team)) {
          payload = parsed;
        }
      }
    } catch (e) {
      console.error("Failed to read selected reporting managers from storage", e);
    }
  }

  const manager = (payload && payload.manager) || null;
  const team = (payload && payload.team) || [];

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Reporting Manager Assignment</h2>
          <button onClick={() => navigate('/admin')} className="text-brand-yellow">Back to Dashboard</button>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold">Manager</h3>
          {manager ? (
            <div className="p-3 border rounded flex items-center gap-4 mt-2">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-sm font-semibold">{(manager.name || 'U').slice(0, 1)}</div>
              <div>
                <div className="font-medium">{manager.name}</div>
                <div className="text-sm text-gray-500">{manager.corporateEmail || "Not Available"}</div>
              </div>
            </div>
          ) : (
            <p className="text-gray-600 mt-2">No manager selected.</p>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold">Team Members</h3>
          {team.length === 0 ? (
            <p className="text-gray-600 mt-2">No team members assigned.</p>
          ) : (
            <div className="space-y-3 mt-2">
              {team.map((e) => {
                const empDisabled = isDisabled(e);
                return (
                <div key={e.id} className={`p-3 border rounded flex items-center gap-4 ${empDisabled ? 'bg-[#F1EFE8]' : ''}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${empDisabled ? 'bg-[#D3D1C7] text-[#5F5E5A]' : 'bg-gray-200'}`}>{(e.name || 'U').slice(0, 1)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={`font-medium ${empDisabled ? 'text-[#5F5E5A]' : ''}`}>{e.name}</div>
                      {empDisabled && <DisabledBadge />}
                    </div>
                    <div className="text-sm text-gray-500">{e.corporateEmail || "Not Available"}</div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



