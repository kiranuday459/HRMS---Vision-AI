import React from "react";

/**
 * Reusable confirmation dialog for non-destructive admin decisions (Approve).
 *
 * Mirrors RejectRequestModal's layout/wording so approve and reject read as one
 * interaction pattern across Leaves, Timesheets and Client Timesheets. Rejections
 * keep using RejectRequestModal — it additionally enforces a mandatory reason.
 */
export default function ConfirmActionModal({
  isOpen,
  onClose,
  onConfirm,
  submitting = false,
  title = "Confirm",
  message = "Are you sure?",
  confirmLabel = "Confirm",
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="absolute inset-0 bg-brand-blue/40 backdrop-blur-sm"
        onClick={() => !submitting && onClose()}
      />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-brand-blue/10 overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-brand-blue-dark px-6 py-4 flex justify-between items-center text-white">
          <h3 className="text-base font-black tracking-tight uppercase">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white disabled:opacity-50"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <p className="text-sm font-medium text-brand-text leading-relaxed">{message}</p>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 bg-bg-slate border border-brand-blue/10 text-brand-text/60 font-bold rounded-xl hover:bg-slate-200 transition-all text-xs uppercase tracking-wider disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all text-xs uppercase tracking-wider shadow-md disabled:opacity-50 active:scale-95"
            >
              {submitting ? "Please wait..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
