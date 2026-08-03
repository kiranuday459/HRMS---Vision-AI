import { useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useClientAccess } from "../hooks/useClientAccess";
import { useWorkspace } from "../hooks/useWorkspace";
import { clientTimesheetDashboardPath } from "../utils/clientTimesheetNav";

function readRole() {
    try {
        return (JSON.parse(localStorage.getItem("user") || "{}").role || "").toUpperCase();
    } catch {
        return "";
    }
}

/**
 * Entry point into the Client Timesheet workspace from the HRMS dashboards. Switching
 * only flips the active workspace — session/token stays the same.
 *
 * Renders one of three states so the employee always sees their real position and never
 * a dead end:
 *   no assignment        → nothing
 *   assigned, unverified → "Verify your account" prompt, opening the activation OTP modal
 *   assigned + verified  → "Open Client Timesheet"
 * Admin skips the gate entirely (they manage client timesheets for everyone).
 *
 * `onVerifyClick` opens the caller's <ClientOtpVerifyModal>; it is required by any
 * dashboard an unverified employee can land on.
 */
export default function ClientTimesheetSwitch({ onVerifyClick }) {
    const navigate = useNavigate();
    const { switchToClientWorkspace } = useWorkspace();
    const { clientAssigned, clientVerified, loading } = useClientAccess();
    const isAdmin = readRole() === "ADMIN";

    const openWorkspace = () => switchToClientWorkspace(navigate, clientTimesheetDashboardPath());

    const openButton = (
        <button
            type="button"
            onClick={openWorkspace}
            className="self-start shrink-0 px-5 py-2.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-bold text-xs tracking-wide transition-all shadow-sm active:scale-95 flex items-center gap-2"
            style={{ borderRadius: "8px" }}
        >
            Open Client Timesheet
            <ArrowRight size={14} />
        </button>
    );

    if (isAdmin) return openButton;

    if (loading || !clientAssigned) return null;

    if (!clientVerified) {
        if (!onVerifyClick) {
            // Without a handler the prompt would be a dead end — the exact failure this
            // state exists to prevent. Surface it instead of rendering a no-op button.
            console.error(
                "ClientTimesheetSwitch: employee has an unverified client assignment but no onVerifyClick handler was passed — activation is unreachable from this dashboard."
            );
            return null;
        }
        return (
            <div className="self-start shrink-0 flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={onVerifyClick}
                    className="px-5 py-2.5 bg-[#185FA5] hover:bg-[#13507f] text-white font-bold text-xs tracking-wide transition-all shadow-sm active:scale-95 flex items-center gap-2"
                    style={{ borderRadius: "8px" }}
                >
                    <ShieldCheck size={14} />
                    Verify Your Account
                </button>
                <span className="text-xs text-[#5F5E5A]">
                    Enter the OTP emailed to you to unlock Client Timesheet.
                </span>
            </div>
        );
    }

    return openButton;
}
