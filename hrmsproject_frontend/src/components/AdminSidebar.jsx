import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from '../assets/visionai-logo.png';
import {
  LayoutDashboard,
  Users,
  UsersRound,
  ShieldCheck,
  CalendarDays,
  Settings2,
  LogOut,
  Clock,
  Briefcase,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import useSidebarCollapsed from '../hooks/useSidebarCollapsed';

export default function AdminSidebar({ activeTab, setActiveTab, onLogout }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  const user = JSON.parse(localStorage.getItem("user")) || {};
  const isManager = user.role === "REPORTING_MANAGER";

  const handleTabClick = (tab) => {
    if (setActiveTab) setActiveTab(tab);
    if (tab === "dashboard" || tab === "hr-team" || tab === "leave-requests") {
      navigate(isManager ? "/manager" : "/admin", { state: { tab } });
    }
    else if (tab === "candidates" || tab === "team") navigate(isManager ? "/reporting-team" : "/admin/candidates");
    else if (tab === "reporting-managers") navigate("/admin/reporting-managers");
    else if (tab === "timesheets") navigate("/admin/timesheets");
    else if (tab === "client-timesheets") navigate("/admin/client-timesheets");
    setMobileOpen(false);
  };

  const navLinks = isManager
    ? [
      { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
      { id: "team", label: "My Team", Icon: Users }
    ]
    : [
      { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
      { id: "candidates", label: "Employees", Icon: Users },
      { id: "reporting-managers", label: "Managers", Icon: UsersRound },
      { id: "hr-team", label: "HR Team", Icon: ShieldCheck },
      { id: "leave-requests", label: "Leaves", Icon: CalendarDays },
      { id: "timesheets", label: "Timesheets", Icon: Clock },
      { id: "client-timesheets", label: "Client timesheets", Icon: Briefcase }
    ];

  // Mobile hamburger (fixed) — hide when drawer open
  return (
    <>
      <button
        className={`md:hidden fixed top-4 left-4 z-50 bg-white text-[#2C2C2A] border border-[#E3E8EF] rounded-md p-2 ${mobileOpen ? 'hidden' : 'block shadow-md'} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-95`}
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        ☰
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-[277px] bg-white text-[#2C2C2A] border-r border-[#E3E8EF] h-full p-6 shadow-2xl animate-in slide-in-from-left duration-200">
            <button
              className="absolute top-4 right-4 bg-[#F1EFE8] hover:bg-[#E3E8EF] text-[#5F5E5A] rounded-full p-2 transition-colors"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              ✕
            </button>
            <div className="text-center mb-4 pt-4">
              <img src={Logo} alt="VisionAi Logo" className="h-16 mx-auto mb-2 object-contain" />
              <h1 className="text-xl font-bold text-[#2C2C2A]">
                {(JSON.parse(localStorage.getItem("user"))?.firstName)
                  ? `${JSON.parse(localStorage.getItem("user")).firstName} ${JSON.parse(localStorage.getItem("user")).lastName}`
                  : "Admin User"}
              </h1>
              <p className="text-sm uppercase tracking-widest mt-1 text-[#888780]">
                {JSON.parse(localStorage.getItem("user"))?.designation || JSON.parse(localStorage.getItem("user"))?.role || 'Administrator'}
              </p>
            </div>

            <nav className="flex flex-col gap-1">
              {navLinks.map(({ id, label, Icon }) => (
                <div
                  key={id}
                  onClick={() => handleTabClick(id)}
                  className={`btn-sidebar flex items-center gap-3 transition-all duration-200 ${activeTab === id
                    ? 'bg-[#F1EFE8] text-[#2C2C2A] border-l-[3px] border-brand-stone rounded-lg px-5 py-3'
                    : 'text-[#5F5E5A] hover:text-[#2C2C2A] hover:bg-[#F1EFE8] hover:-translate-y-0.5'
                    }`}
                >
                  <Icon size={18} className={activeTab === id ? 'text-[#2C2C2A]' : 'inherit'} />
                  <span className="font-semibold">{label}</span>
                </div>
              ))}
            </nav>

            <div className="mt-auto pt-6">
              <button
                onClick={() => { onLogout(); setMobileOpen(false); }}
                className="w-full bg-white border border-[#E3E8EF] text-[#5F5E5A] py-3 rounded-lg text-lg font-bold hover:bg-brand-yellow hover:border-brand-yellow hover:text-white transition-all duration-200 hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
              >
                <LogOut size={20} />
                Logout
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <aside className={`hidden md:flex ${collapsed ? 'md:w-20' : 'md:w-[277px]'} w-full bg-white text-[#2C2C2A] border-r border-[#E3E8EF] flex-col flex-shrink-0 z-20 h-screen sticky top-0 overflow-hidden transition-[width] duration-300 ease-in-out`}>
        <div className={`border-b border-[#E3E8EF] flex items-center gap-2 ${collapsed ? 'p-4 justify-center' : 'p-6 justify-between'}`}>
          {!collapsed && (
            <div className="flex flex-col items-center text-center min-w-0 flex-1">
              <img src={Logo} alt="VisionAi Logo" className="h-11 mb-2 object-contain" />
              <h1 className="text-lg font-bold text-[#2C2C2A] truncate w-full text-center">
                {(JSON.parse(localStorage.getItem("user"))?.firstName)
                  ? `${JSON.parse(localStorage.getItem("user")).firstName} ${JSON.parse(localStorage.getItem("user")).lastName}`
                  : "Admin User"}
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] mt-1 font-bold text-[#888780] truncate w-full text-center">
                {JSON.parse(localStorage.getItem("user"))?.designation || JSON.parse(localStorage.getItem("user"))?.role || 'Administrator'}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Show Sidebar' : 'Hide Sidebar'}
            aria-label={collapsed ? 'Show Sidebar' : 'Hide Sidebar'}
            aria-expanded={!collapsed}
            className="shrink-0 w-9 h-9 rounded-lg bg-[#F1EFE8] text-[#5F5E5A] flex items-center justify-center hover:bg-[#E3E8EF] hover:text-[#2C2C2A] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-stone"
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>

        <nav className={`flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2' : 'px-4'}`}>
          {navLinks.map(({ id, label, Icon }) => (
            <div
              key={id}
              onClick={() => handleTabClick(id)}
              title={collapsed ? label : undefined}
              aria-label={label}
              className={`btn-sidebar flex items-center transition-colors ${collapsed ? 'justify-center px-0!' : 'gap-3'} ${activeTab === id
                ? 'bg-[#F1EFE8] text-[#2C2C2A] border-l-[3px] border-brand-stone rounded-lg px-5 py-3'
                : 'text-[#5F5E5A] hover:text-[#2C2C2A] hover:bg-[#F1EFE8]'
                }`}
            >
              <Icon size={collapsed ? 24 : 18} className={activeTab === id ? 'text-[#2C2C2A]' : 'inherit'} />
              {!collapsed && <span className="font-semibold tracking-tight whitespace-nowrap">{label}</span>}
            </div>
          ))}
        </nav>

        <div className={`border-t border-[#E3E8EF] ${collapsed ? 'p-2' : 'p-4'}`}>
          <button
            onClick={onLogout}
            title={collapsed ? 'Logout' : undefined}
            aria-label="Logout"
            className={`w-full bg-white border border-[#E3E8EF] text-[#5F5E5A] py-3 rounded-lg text-sm font-bold hover:bg-brand-yellow hover:border-brand-yellow hover:text-white transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 ${collapsed ? 'px-0' : ''}`}
          >
            <LogOut size={collapsed ? 20 : 16} className="shrink-0" />
            {!collapsed && "LOGOUT"}
          </button>
        </div>
      </aside>
    </>
  );
}
