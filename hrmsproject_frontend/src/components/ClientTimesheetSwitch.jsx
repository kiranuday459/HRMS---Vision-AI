import { useNavigate } from "react-router-dom";
import { Clock, ArrowRight, ShieldCheck } from "lucide-react";
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

function formatAssignmentDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(String(dateStr).split("T")[0]);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Workspace switch tile for the HRMS dashboard. Switches into the Client Timesheet
 * workspace without a new login — session/token stays the same.
 */
export default function ClientTimesheetSwitch({ onVerifyClick, variant = "card" }) {
    const navigate = useNavigate();
    const { switchToClientWorkspace } = useWorkspace();
    const { clientAssigned, clientVerified, clientProject, clientAssignmentDate, loading } = useClientAccess();
    const role = readRole();
    const isAdmin = role === "ADMIN";

    const handleSwitch = () => {
        switchToClientWorkspace(navigate, clientTimesheetDashboardPath());
    };

    if (isAdmin) {
        if (variant === "compact") {
            return (
                <button
                    type="button"
                    onClick={handleSwitch}
                    className="group bg-white/90 hover:bg-[#0d9488] p-3 rounded-2xl flex items-center gap-3 transition-all duration-300 shadow-sm hover:shadow-xl border border-[#0d9488]/20 w-full"
                >
                    <div className="w-12 h-12 rounded-xl bg-[#0d9488]/10 flex items-center justify-center text-[#0d9488] group-hover:bg-white/10 group-hover:text-white transition-colors">
                        <Clock size={22} />
                    </div>
                    <div className="text-left flex-1">
                        <p className="text-xs font-black text-brand-text uppercase tracking-widest group-hover:text-white leading-none">
                            Client Timesheet
                        </p>
                        <p className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest mt-1.5 group-hover:text-white/40">
                            Admin workspace
                        </p>
                    </div>
                    <ArrowRight size={16} className="text-[#0d9488] group-hover:text-white shrink-0" />
                </button>
            );
        }

        return (
            <div
                className="bg-white border border-[#99f6e4] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                style={{ borderRadius: "12px", padding: "20px 24px" }}
            >
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#0d9488]/10 flex items-center justify-center shrink-0">
                        <Clock size={20} className="text-[#0d9488]" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-[#2C2C2A]">Client Timesheet Admin</h3>
                        <p className="mt-1 text-sm text-[#5F5E5A]">
                            Manage assignments, verification status, and submitted timesheets.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleSwitch}
                    className="self-end sm:self-center shrink-0 px-5 py-2.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-bold text-xs tracking-wide transition-all shadow-sm active:scale-95 flex items-center gap-2"
                    style={{ borderRadius: "8px" }}
                >
                    Open Client Timesheet
                    <ArrowRight size={14} />
                </button>
            </div>
        );
    }

    if (loading || !clientAssigned) return null;

    const verified = clientVerified;

    return (
        <div
            className={`bg-white border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${verified ? "border-[#99f6e4]" : "border-[#E5E7EB] opacity-95"}`}
            style={{ borderRadius: "12px", padding: "20px 24px" }}
        >
            <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${verified ? "bg-[#0d9488]/10" : "bg-[#185FA5]/10"}`}>
                    {verified ? (
                        <Clock size={20} className="text-[#0d9488]" />
                    ) : (
                        <ShieldCheck size={20} className="text-[#185FA5]" />
                    )}
                </div>
                <div>
                    <h3 className="text-base font-bold text-[#2C2C2A] flex items-center gap-2">
                        Client Timesheet
                        {!verified && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#888780] bg-[#F1EFE8] px-2 py-0.5 rounded">
                                Verification required
                            </span>
                        )}
                    </h3>
                    {!verified ? (
                        <div className="mt-1 text-sm text-[#5F5E5A] space-y-0.5">
                            <p className="font-semibold text-[#185FA5]">
                                You have been assigned to project: {clientProject || "—"}
                            </p>
                            <p className="text-xs">Verify your account to access Client Timesheet</p>
                        </div>
                    ) : (
                        <div className="mt-1 text-sm text-[#5F5E5A] space-y-0.5">
                            <p className="font-semibold text-[#2C2C2A]">
                                Project: {clientProject || "—"}
                            </p>
                            <p className="text-xs text-[#888780]">
                                Assigned: {formatAssignmentDate(clientAssignmentDate)}
                            </p>
                        </div>
                    )}
                </div>
            </div>
            <div className="self-end sm:self-center shrink-0">
                {!verified ? (
                    <button
                        type="button"
                        onClick={onVerifyClick}
                        disabled={!onVerifyClick}
                        className="px-5 py-2.5 bg-[#185FA5] hover:bg-[#13507f] text-white font-bold text-xs tracking-wide transition-all shadow-sm active:scale-95 uppercase disabled:opacity-50"
                        style={{ borderRadius: "8px" }}
                    >
                        Verify Access
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleSwitch}
                        className="px-5 py-2.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-bold text-xs tracking-wide transition-all shadow-sm active:scale-95 flex items-center gap-2"
                        style={{ borderRadius: "8px" }}
                    >
                        Open Client Timesheet
                        <ArrowRight size={14} />
                    </button>
                )}
            </div>
        </div>
    );
}
