import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, Clock, LogOut } from "lucide-react";
import "./clientTimesheets.css";

/**
 * Layout shell for the Client Timesheets module. Provides the module's OWN chrome — a
 * dedicated dark top bar with in-module navigation and a Home affordance back to the
 * HRMS dashboard — instead of the VisionAI left sidebar. The `.ct-scope` wrapper retints
 * the module to its own (teal/slate) visual language. Role gating stays with the routes;
 * auth/session is read from the existing localStorage user (no duplicated logic).
 */
export default function ClientTimesheetsLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem("user")) || {};
    const role = (user.role || "").toUpperCase();
    const isAdmin = role === "ADMIN";

    const logout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
    };

    const navItems = isAdmin
        ? []
        : role === "REPORTING_MANAGER"
            ? [{ label: "Timesheet Summary", to: "/reporting-dashboard/client-timesheet" }]
            : [{ label: "Timesheet Summary", to: "/employee/client-timesheet" }];

    return (
        <div className="ct-scope flex flex-col h-screen w-screen overflow-hidden">
            {/* Module top bar */}
            <header className="ct-topbar flex items-center justify-between px-4 md:px-6 h-14 shadow-md shrink-0">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(45,212,191,0.18)" }}>
                            <Clock size={18} style={{ color: "#5eead4" }} />
                        </span>
                        <span className="font-bold tracking-tight text-white text-[15px]">Client Timesheets</span>
                    </div>
                    <nav className="hidden sm:flex items-stretch h-14">
                        {navItems.map((n) => {
                            const active = location.pathname === n.to || location.pathname.startsWith(n.to);
                            return (
                                <button
                                    key={n.to}
                                    onClick={() => navigate(n.to)}
                                    className={`ct-navbtn px-3 h-14 text-[12px] font-bold uppercase tracking-widest ${active ? "is-active" : ""}`}
                                >
                                    {n.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => navigate("/")} title="Back to HRMS dashboard" aria-label="Home" className="ct-home w-9 h-9 rounded-lg flex items-center justify-center">
                        <Home size={18} />
                    </button>
                    <button onClick={logout} title="Logout" aria-label="Logout" className="ct-home w-9 h-9 rounded-lg flex items-center justify-center">
                        <LogOut size={17} />
                    </button>
                </div>
            </header>

            {/* Module content */}
            <main className="flex-1 min-h-0 overflow-hidden">
                <Outlet />
            </main>
        </div>
    );
}
