import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import api from "../utils/api";

/**
 * Client Timesheet access state (assignment + OTP verification) for the logged-in employee.
 * Read once on login and refreshed after a successful OTP verification, so the sidebar
 * button and the dashboard activation banner update WITHOUT a page reload.
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
    }, [refresh]);

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
