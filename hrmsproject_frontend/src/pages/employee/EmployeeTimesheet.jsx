import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import PersonalTimesheetContent from "./PersonalTimesheetContent";
import { toast } from "react-toastify";
import api from "../../utils/api";

const EmployeeTimesheet = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("timesheet");
  const [user, setUser] = useState({});
  const [employeeId, setEmployeeId] = useState(null);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user")) || {};
    setUser(userData);

    if (userData.employeeId) {
      setEmployeeId(userData.employeeId);
    } else {
      fetchEmployeeProfile();
    }
  }, []);

  const fetchEmployeeProfile = async () => {
    try {
      const response = await api("/me/employee");

      if (response.ok) {
        const result = await response.json();
        const empData = result.data || result;
        if (empData && empData.id) {
          setEmployeeId(empData.id);
          const userData = JSON.parse(localStorage.getItem("user")) || {};
          userData.employeeId = empData.id;
          localStorage.setItem("user", JSON.stringify(userData));
        }
      }
    } catch (err) {
      console.error("Error fetching employee profile:", err);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      navigate("/");
    }
  };

  const navItems = [
    {
      tab: "dashboard",
      label: "Dashboard",
      to: user.role === 'HR' ? "/hr" : "/employee",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      ),
    },
    {
      tab: "timesheet",
      label: "Timesheet",
      to: "/employee/timesheet",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      ),
    },
    {
      tab: "leave",
      label: "Leave Request",
      to: user.role === 'HR' ? "/hr" : "/employee",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      ),
    },
  ];

  if (user.role === 'HR') {
    navItems.push({
      tab: "actions",
      label: "Actions",
      to: "/hr/actions",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12" y2="16"></line>
        </svg>
      ),
    });
  }

  return (
    <div className="flex h-screen bg-bg-slate font-brand text-brand-text">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleLogout={handleLogout}
        navItems={navItems}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white text-[#2C2C2A] p-4 md:p-6 md:px-10 flex flex-wrap items-center justify-between shadow-lg z-10 border-b border-[#E3E8EF]">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-brand-yellow rounded-full flex items-center justify-center text-brand-blue shadow-inner border-2 border-[#E3E8EF]">
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                {user.fullName || "Employee Name"}
              </h1>
              <p className="text-xs text-[#888780] uppercase tracking-[0.2em] mt-1 font-bold">{user.role || "Designation"}</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/employee/profile")}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            VIEW PROFILE
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-10 space-y-8">
          <PersonalTimesheetContent employeeId={employeeId} user={user} />


        </div>
      </main>
    </div>
  );
};

export default EmployeeTimesheet;




