import { Outlet, useNavigate } from "react-router-dom";
import { Clock, LogOut } from "lucide-react";
import { useEffect } from "react";
import "./clientTimesheets.css";
import { useWorkspace } from "../hooks/useWorkspace";
import ClientTimesheetNotifications from "./components/ClientTimesheetNotifications";

/**
 * Layout shell for the Client Timesheets workspace. Provides distinct teal/slate chrome
 * while reusing the same auth session — no second login. "Exit Client Timesheet" returns
 * to the main HRMS dashboard without clearing token/session.
 */
export default function ClientTimesheetsLayout() {
    const navigate = useNavigate();
    const { enterClientWorkspace, exitClientWorkspace } = useWorkspace();
    const user = JSON.parse(localStorage.getItem("user")) || {};
    const role = (user.role || "").toUpperCase();
    const isAdmin = role === "ADMIN";

    useEffect(() => {
        enterClientWorkspace();
    }, [enterClientWorkspace]);

    const handleExit = () => {
        exitClientWorkspace(navigate);
    };

    // No tabs in the top bar. The admin's "Admin Dashboard" link lives in the filter row on
    // the admin page, and the employee's "Timesheet Summary" tab only restated the page
    // heading directly beneath it — the bar carries the branding alone.
    return (
        <div className="ct-scope flex flex-col h-screen w-screen overflow-hidden">
            <header className="ct-topbar flex items-center justify-between px-4 md:px-6 h-14 shadow-md shrink-0">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(45,212,191,0.18)" }}>
                            <Clock size={18} style={{ color: "#5eead4" }} />
                        </span>
                        <span className="font-bold tracking-tight text-white text-[15px]">
                            {isAdmin ? "Client Timesheet Admin" : "Client Timesheets"}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* One bell for both sides — this shell is shared by the admin and
                        employee views, and the API scopes rows to the caller. */}
                    <ClientTimesheetNotifications />
                    <button
                        type="button"
                        onClick={handleExit}
                        title="Return to HRMS dashboard"
                        className="hidden sm:inline-flex items-center gap-2 px-3 h-9 rounded-lg text-[12px] font-bold text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <LogOut size={15} />
                        Exit Client Timesheet
                    </button>
                    <button
                        type="button"
                        onClick={handleExit}
                        title="Exit Client Timesheet"
                        aria-label="Exit Client Timesheet"
                        className="sm:hidden ct-home w-9 h-9 rounded-lg flex items-center justify-center"
                    >
                        <LogOut size={17} />
                    </button>
                </div>
            </header>

            <main className="flex-1 min-h-0 overflow-hidden">
                <Outlet />
            </main>
        </div>
    );
}
