import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import React from "react";
// import LoginPage from "./components/LoginPage";
import LoginPage from "./pages/login/LoginPage";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import EmployeeOwnProfile from "./pages/employee/EmployeeOwnProfile";
import EmployeeTimesheet from "./pages/employee/EmployeeTimesheet";
import ForgotPassword from "./pages/login/ForgotPassword";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CandidatesPage from "./pages/admin/CandidatesPage";
import EmployeeProfile from "./pages/admin/EmployeeProfile";
import SelectedEmployees from "./pages/admin/SelectedEmployees";
import ReportingManagers from "./pages/admin/ReportingManagers";
import AdminTimesheets from "./pages/admin/AdminTimesheets";
import ReportingManagerDashboard from "./pages/reporting/ReportingManagerDashboard";
import ReportingManagerTeam from "./pages/reporting/ReportingManagerTeam";
import HrDashboard from "./pages/hr/HrDashboard";
import HrActions from "./pages/hr/HrActions";
import HrCandidatesPage from "./pages/hr/HrCandidatesPage";
import HrReportingManagersPage from "./pages/hr/HrReportingManagersPage";
import HrManagerLeaves from "./pages/hr/HrManagerLeaves";
import HrManagerTimesheets from "./pages/hr/HrManagerTimesheets";
import SessionManager from "./components/SessionManager";
// import EmployeeForm from "./components/EmployeeForm";
// import ForgotPassword from "./components/ForgotPassword";
// import AdminDashboard from "./components/AdminDashboard";


import { useLocation } from "react-router-dom";

function App() {
  const [user, setUser] = React.useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = React.useState(false);

  React.useEffect(() => {
    // Sync if localStorage changes in other tabs
    const handleStorageChange = () => {
      try {
        const stored = localStorage.getItem("user");
        setUser(stored ? JSON.parse(stored) : null);
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <>
      <SessionManager />
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <Routes>
        {/* Login */}
        <Route path="/login" element={<LoginPage setUser={setUser} />} />

        {/* TEMP TEST ROUTES (work exactly like before) */}
        <Route
          path="/employee"
          element={authLoading ? null : (user ? <EmployeeDashboard /> : <Navigate to="/login" />)}
        />
        <Route
          path="/employee/profile"
          element={
            user?.role === "REPORTING_MANAGER"
              ? <Navigate to="/reporting-dashboard?tab=profile" />
              : user?.role === "HR"
                ? <Navigate to="/hr?tab=profile" />
                : <Navigate to="/employee?tab=profile" />
          }
        />
        <Route
          path="/employee/timesheet"
          element={
            user?.role === "REPORTING_MANAGER"
              ? <Navigate to="/reporting-dashboard?tab=timesheet" />
              : <Navigate to="/employee?tab=timesheet" />
          }
        />
        <Route
          path="/admin"
          element={authLoading ? null : (user && user.role === "ADMIN" ? <AdminDashboard /> : <Navigate to="/login" />)}
        />
        <Route
          path="/admin/candidates"
          element={authLoading ? null : (user && user.role === "ADMIN" ? <CandidatesPage /> : <Navigate to="/login" />)}
        />
        <Route
          path="/admin/selected-employees"
          element={authLoading ? null : (user && user.role === "ADMIN" ? <SelectedEmployees /> : <Navigate to="/login" />)}
        />
        <Route
          path="/admin/reporting-managers"
          element={authLoading ? null : (user && user.role === "ADMIN" ? <ReportingManagers /> : <Navigate to="/login" />)}
        />
        <Route
          path="/admin/timesheets"
          element={authLoading ? null : (user && user.role === "ADMIN" ? <AdminTimesheets /> : <Navigate to="/login" />)}
        />
        <Route
          path="/admin/employee/:id"
          element={authLoading ? null : (user && (user.role === "ADMIN" || user.role === "REPORTING_MANAGER" || user.role === "HR") ? <EmployeeProfile /> : <Navigate to="/login" />)}
        />

        {/* <Route path="/admin-dashboard" element={<AdminDashboard />} /> */}
        <Route
          path="/hr"
          element={authLoading ? null : (user && user.role === "HR" ? <HrDashboard /> : <Navigate to="/login" />)}
        />
        <Route
          path="/hr/actions"
          element={authLoading ? null : (user && user.role === "HR" ? <HrActions /> : <Navigate to="/login" />)}
        />
        <Route
          path="/hr/actions/candidates"
          element={authLoading ? null : (user && user.role === "HR" ? <HrCandidatesPage /> : <Navigate to="/login" />)}
        />
        <Route
          path="/hr/actions/reporting-managers"
          element={authLoading ? null : (user && user.role === "HR" ? <HrReportingManagersPage /> : <Navigate to="/login" />)}
        />
        <Route
          path="/hr/actions/leaves"
          element={authLoading ? null : (user && user.role === "HR" ? <HrManagerLeaves /> : <Navigate to="/login" />)}
        />
        <Route
          path="/hr/actions/timesheet"
          element={authLoading ? null : (user && user.role === "HR" ? <HrManagerTimesheets /> : <Navigate to="/login" />)}
        />

        {/* Reporting Manager Routes */}
        <Route
          path="/reporting-dashboard"
          element={authLoading ? null : (user && user.role === "REPORTING_MANAGER" ? <ReportingManagerDashboard /> : <Navigate to="/login" />)}
        />
        <Route
          path="/reporting-team"
          element={authLoading ? null : (user && user.role === "REPORTING_MANAGER" ? <ReportingManagerTeam /> : <Navigate to="/login" />)}
        />

        <Route path="/forgot-password" element={<ForgotPassword />} />


        {/* Default */}
        <Route path="/" element={user ? (
          <Navigate to={
            user.role === 'ADMIN' ? "/admin" :
            user.role === 'HR' ? "/hr" :
            user.role === 'REPORTING_MANAGER' ? "/reporting-dashboard" : "/employee"
          } />
        ) : <Navigate to="/login" />} />
        
        <Route path="*" element={user ? (
          <Navigate to={
            user.role === 'ADMIN' ? "/admin" :
            user.role === 'HR' ? "/hr" :
            user.role === 'REPORTING_MANAGER' ? "/reporting-dashboard" : "/employee"
          } />
        ) : <Navigate to="/login" />} />

      </Routes>
    </>
  );
}

export default App;

