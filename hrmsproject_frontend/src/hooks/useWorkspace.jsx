import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { clientTimesheetDashboardPath, roleDashboardPath } from "../utils/clientTimesheetNav";

export const WORKSPACES = {
    HRMS: "hrms",
    CLIENT: "client",
};

const STORAGE_KEY = "activeWorkspace";

const WorkspaceContext = createContext({
    activeWorkspace: WORKSPACES.HRMS,
    enterClientWorkspace: () => {},
    switchToClientWorkspace: () => {},
    exitClientWorkspace: () => {},
});

function readStoredWorkspace() {
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        return stored === WORKSPACES.CLIENT ? WORKSPACES.CLIENT : WORKSPACES.HRMS;
    } catch {
        return WORKSPACES.HRMS;
    }
}

function persistWorkspace(workspace) {
    try {
        sessionStorage.setItem(STORAGE_KEY, workspace);
    } catch {
        /* ignore */
    }
}

export function WorkspaceProvider({ children }) {
    const location = useLocation();
    const [activeWorkspace, setActiveWorkspace] = useState(readStoredWorkspace);

    const enterClientWorkspace = useCallback(() => {
        setActiveWorkspace(WORKSPACES.CLIENT);
        persistWorkspace(WORKSPACES.CLIENT);
    }, []);

    const exitClientWorkspace = useCallback((navigate) => {
        setActiveWorkspace(WORKSPACES.HRMS);
        persistWorkspace(WORKSPACES.HRMS);
        if (typeof navigate === "function") {
            navigate(roleDashboardPath());
        }
    }, []);

    const switchToClientWorkspace = useCallback((navigate, path) => {
        enterClientWorkspace();
        if (typeof navigate === "function") {
            navigate(path || clientTimesheetDashboardPath());
        }
    }, [enterClientWorkspace]);

    // Keep workspace aligned with the current route.
    useEffect(() => {
        if (location.pathname.startsWith("/client-timesheet")) {
            enterClientWorkspace();
        } else {
            setActiveWorkspace(WORKSPACES.HRMS);
            persistWorkspace(WORKSPACES.HRMS);
        }
    }, [location.pathname, enterClientWorkspace]);

    return (
        <WorkspaceContext.Provider value={{
            activeWorkspace,
            enterClientWorkspace,
            switchToClientWorkspace,
            exitClientWorkspace,
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    return useContext(WorkspaceContext);
}

export default useWorkspace;
