import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import api from "../utils/api";

/**
 * Client Timesheet access state (assignment + OTP verification) for the logged-in employee.
 * Read on login, on every navigation, and after a successful OTP verification, so the sidebar
 * button and the dashboard activation banner update WITHOUT a page reload.
 *
 * Re-reading on navigation is what makes an admin removing someone from a project land on
 * that employee's screen without a re-login: their next move anywhere in the app picks up the
 * revocation, the sidebar button goes, and ClientTimesheetGuard bounces them out of the
 * module. It is a cheap call and only fires for non-admin sessions. The guarantee itself is
 * server-side — ClientTimesheetWeekService refuses to save for an unassigned employee — this
 * only keeps the UI honest.
 *
 * Shape: { clientAssigned, clientVerified, clientProject, clientProjectId,
 *          clientAssignmentDate, loading, refresh }
 */
const DEFAULT = {
    clientAssigned: false,
    clientVerified: false,
    clientProject: null,
    clientProjectId: null,
    clientAssignmentDate: null,
};

const ClientAccessContext = createContext({ ...DEFAULT, loading: true, refresh: () => {} });

function readUser() {
    try {
        return JSON.parse(localStorage.getItem("user") || "{}") || {};
    } catch {
        return {};
    }
}

export function ClientAccessProvider({ children }) {
    const [status, setStatus] = useState(DEFAULT);
    const [loading, setLoading] = useState(true);
    // Pathname only — a query-string change is the same screen and needs no re-check.
    const { pathname } = useLocation();

    const refresh = useCallback(async () => {
        const token = localStorage.getItem("token");
        const role = (readUser().role || "").toUpperCase();
        // Only employees have client-timesheet access; skip the call for other roles so we
        // don't emit needless 404s (they have no employee profile behind the endpoint).
        if (!token || role === "ADMIN") {
            setStatus(DEFAULT);
            setLoading(false);
            return;
        }
        try {
            const res = await api("/api/client-timesheet/access-status");
            if (res && res.ok) {
                const d = await res.json().catch(() => ({}));
                setStatus({
                    clientAssigned: !!d.clientAssigned,
                    clientVerified: !!d.clientVerified,
                    clientProject: d.clientProject ?? null,
                    clientProjectId: d.clientProjectId ?? null,
                    clientAssignmentDate: d.clientAssignmentDate ?? null,
                });
            } else {
                // 404 (no employee profile) / other non-OK → treat as no access. 401/403 are
                // handled by the global api interceptor (session expiry).
                setStatus(DEFAULT);
            }
        } catch {
            setStatus(DEFAULT);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh, pathname]);

    return (
        <ClientAccessContext.Provider value={{ ...status, loading, refresh }}>
            {children}
        </ClientAccessContext.Provider>
    );
}

export function useClientAccess() {
    return useContext(ClientAccessContext);
}

export default useClientAccess;
