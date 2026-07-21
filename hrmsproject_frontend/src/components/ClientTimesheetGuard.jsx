import { Navigate } from "react-router-dom";
import { useClientAccess } from "../hooks/useClientAccess";

/**
 * Route guard for the employee Client Timesheet module. Blocks direct-URL access unless the
 * employee is both assigned to a client project AND has verified their activation OTP;
 * otherwise redirects to the employee dashboard.
 */
export default function ClientTimesheetGuard({ children }) {
    const { clientAssigned, clientVerified, loading } = useClientAccess();

    // Wait for the access status before deciding, so we never flash a redirect on first load.
    if (loading) return null;

    if (!clientAssigned || !clientVerified) {
        return <Navigate to="/employee" replace />;
    }
    return children;
}
