import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import React from "react";
import { CLIENT_TIMESHEET_DASHBOARD, CLIENT_TIMESHEET_ADMIN } from "./utils/clientTimesheetNav";
// import LoginPage from "./components/LoginPage";
import LoginPage from "./pages/login/LoginPage";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import EmployeeOwnProfile from "./pages/employee/EmployeeOwnProfile";
import EmployeeTimesheet from "./pages/employee/EmployeeTimesheet";
import ClientTimesheetsLayout from "./client-timesheets/ClientTimesheetsLayout";
import ClientTimesheetSummary from "./client-timesheets/pages/SummaryPage";
import ClientTimesheetEntry from "./client-timesheets/pages/EntryPage";
import ForgotPassword from "./pages/login/ForgotPassword";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CandidatesPage from "./pages/admin/CandidatesPage";
import EmployeeProfile from "./pages/admin/EmployeeProfile";
import SelectedEmployees from "./pages/admin/SelectedEmployees";
import ReportingManagers from "./pages/admin/ReportingManagers";
import AdminTimesheets from "./pages/admin/AdminTimesheets";
import ClientTimesheets from "./client-timesheets/pages/AdminPage";
import ReportingManagerDashboard from "./pages/reporting/ReportingManagerDashboard";
import ReportingManagerTeam from "./pages/reporting/ReportingManagerTeam";
import HrDashboard from "./pages/hr/HrDashboard";
import HrActions from "./pages/hr/HrActions";
import HrCandidatesPage from "./pages/hr/HrCandidatesPage";
import HrReportingManagersPage from "./pages/hr/HrReportingManagersPage";
import HrManagerLeaves from "./pages/hr/HrManagerLeaves";
import HrManagerTimesheets from "./pages/hr/HrManagerTimesheets";
import SessionManager from "./components/SessionManager";
import { ClientAccessProvider } from "./hooks/useClientAccess";
import { WorkspaceProvider } from "./hooks/useWorkspace";
import ClientTimesheetGuard from "./components/ClientTimesheetGuard";
// import EmployeeForm from "./components/EmployeeForm";
// import ForgotPassword from "./components/ForgotPassword";
// import AdminDashboard from "./components/AdminDashboard";


import { useParams } from "react-router-dom";

function LegacyClientWeekRedirect() {
  const { weekStart } = useParams();
  return <Navigate to={`${CLIENT_TIMESHEET_DASHBOARD}/${weekStart}`} replace />;
}

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
      <ClientAccessProvider>
      <WorkspaceProvider>
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
              ? <Navigate to="/manager?tab=profile" />
              : user?.role === "HR"
                ? <Navigate to="/hr?tab=profile" />
                : <Navigate to="/employee?tab=profile" />
          }
        />
        <Route
          path="/employee/timesheet"
          element={
            user?.role === "REPORTING_MANAGER"
              ? <Navigate to="/manager?tab=timesheet" />
              : <Navigate to="/employee?tab=timesheet" />
          }
        />
        {/* Client Timesheet workspace — unified routes, distinct layout, same auth session. */}
        <Route element={<ClientTimesheetsLayout />}>
          <Route
            path={CLIENT_TIMESHEET_DASHBOARD}
            element={authLoading ? null : (user ? <ClientTimesheetGuard><ClientTimesheetSummary /></ClientTimesheetGuard> : <Navigate to="/login" />)}
          />
          <Route
            path={`${CLIENT_TIMESHEET_DASHBOARD}/:weekStart`}
            element={authLoading ? null : (user ? <ClientTimesheetGuard><ClientTimesheetEntry /></ClientTimesheetGuard> : <Navigate to="/login" />)}
          />
          <Route
            path={CLIENT_TIMESHEET_ADMIN}
            element={authLoading ? null : (user && user.role === "ADMIN" ? <ClientTimesheets /> : <Navigate to="/login" />)}
          />
        </Route>
        {/* Legacy client-timesheet paths → unified workspace routes */}
        <Route path="/employee/client-timesheet" element={<Navigate to={CLIENT_TIMESHEET_DASHBOARD} replace />} />
        <Route path="/employee/client-timesheet/:weekStart" element={<LegacyClientWeekRedirect />} />
        <Route path="/reporting-dashboard/client-timesheet" element={<Navigate to={CLIENT_TIMESHEET_DASHBOARD} replace />} />
        <Route path="/reporting-dashboard/client-timesheet/:weekStart" element={<LegacyClientWeekRedirect />} />
        <Route path="/admin/client-timesheets" element={<Navigate to={CLIENT_TIMESHEET_ADMIN} replace />} />
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
          path="/manager"
          element={authLoading ? null : (user && user.role === "REPORTING_MANAGER" ? <ReportingManagerDashboard /> : <Navigate to="/login" />)}
        />
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
            user.role === 'REPORTING_MANAGER' ? "/manager" : "/employee"
          } />
        ) : <Navigate to="/login" />} />
        
        <Route path="*" element={user ? (
          <Navigate to={
            user.role === 'ADMIN' ? "/admin" :
            user.role === 'HR' ? "/hr" :
            user.role === 'REPORTING_MANAGER' ? "/manager" : "/employee"
          } />
        ) : <Navigate to="/login" />} />

      </Routes>
      </WorkspaceProvider>
      </ClientAccessProvider>
    </>
  );
}

export default App;

