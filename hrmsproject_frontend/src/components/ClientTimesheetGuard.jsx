import { Navigate } from "react-router-dom";
import { useClientAccess } from "../hooks/useClientAccess";
import { roleDashboardPath } from "../utils/clientTimesheetNav";

/**
 * Route guard for the shared Client Timesheet module (employees and reporting managers).
 * Blocks direct-URL access unless the member is both assigned to a client project AND has
 * verified their activation OTP; otherwise redirects to their own role's dashboard.
 */
export default function ClientTimesheetGuard({ children }) {
    const { clientAssigned, clientVerified, loading } = useClientAccess();

    // Wait for the access status before deciding, so we never flash a redirect on first load.
    if (loading) return null;

    if (!clientAssigned || !clientVerified) {
        return <Navigate to={roleDashboardPath()} replace />;
    }
    return children;
}
