import { X } from "lucide-react";

/**
 * Confirmation dialog for the Client Timesheet module's admin decisions.
 *
 * Deliberately module-local and NOT the shared components/ConfirmActionModal: the two
 * systems are kept separate, so this one carries the workspace's own teal/slate chrome
 * rather than the HRMS brand palette. Nothing outside client-timesheets/ should import it.
 *
 * Used by both decisions. Approve confirms straight from the queue; reject confirms after the
 * reason has been typed, as the last step before the call goes out.
 *
 * `destructive` turns the confirm button red — rejecting sends a week back to the employee,
 * and the button shouldn't look like the approve one it sits a few pixels away from.
 */
export default function ClientTimesheetConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    submitting = false,
    title = "Confirm",
    message = "Are you sure?",
    confirmLabel = "Confirm",
    destructive = false,
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[320] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
                onClick={() => !submitting && onClose()}
                aria-hidden="true"
            />
            <div
                role="dialog"
                aria-modal="true"
                className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#E3E8EF] overflow-hidden"
            >
                <div className="px-5 py-4 border-b border-[#E3E8EF] bg-bg-slate/30 flex items-center justify-between">
                    <h3 className="text-base font-black text-brand-text tracking-tight">{title}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="p-2 hover:bg-[#0d9488]/5 rounded-lg transition-all text-brand-text/40 hover:text-brand-text disabled:opacity-50"
                        aria-label="Close dialog"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    <p className="text-sm text-[#5F5E5A] leading-relaxed">{message}</p>
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-brand-text/50 hover:bg-bg-slate transition disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={submitting}
                            className={`px-6 py-2.5 rounded-lg text-white text-[10px] font-black uppercase tracking-widest transition shadow-sm active:scale-95 disabled:opacity-40 ${destructive
                                ? "bg-red-500 hover:bg-red-600"
                                : "bg-[#0d9488] hover:bg-[#0f766e]"}`}
                        >
                            {submitting ? "Please wait..." : confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
