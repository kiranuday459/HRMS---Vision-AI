import React, { useState, useEffect } from "react";

/**
 * Reusable rejection modal for Leave and Timesheet requests.
 * Enforces mandatory rejection reason validation:
 * - Title: "Reject Request"
 * - Label: "Rejection Reason"
 * - Multiline textarea for reason input
 * - Validation: Mandatory (blocks empty, null, or whitespace-only)
 * - Validation error message: "Rejection reason is required."
 * - OK and Cancel buttons
 */
export default function RejectRequestModal({
  isOpen,
  onClose,
  onConfirm,
  submitting = false,
  title = "Reject Request",
  label = "Rejection Reason",
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!reason || !reason.trim()) {
      setError("Rejection reason is required.");
      return;
    }
    setError("");
    onConfirm(reason.trim());
  };

  const handleReasonChange = (e) => {
    setReason(e.target.value);
    if (error && e.target.value.trim()) {
      setError("");
    }
  };

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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-brand-text/70 mb-2">
              {label} <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={handleReasonChange}
              placeholder="Enter rejection reason..."
              disabled={submitting}
              className={`w-full p-3 bg-bg-slate border-2 rounded-xl text-sm font-medium text-brand-text outline-none transition-all resize-none ${
                error
                  ? "border-red-500 focus:border-red-500 bg-red-50/50"
                  : "border-transparent focus:border-brand-yellow"
              }`}
            />
            {error && (
              <p className="mt-1.5 text-xs font-bold text-red-500 flex items-center gap-1">
                <span>⚠</span> {error}
              </p>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 bg-bg-slate border border-brand-blue/10 text-brand-text/60 font-bold rounded-xl hover:bg-slate-200 transition-all text-xs uppercase tracking-wider disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all text-xs uppercase tracking-wider shadow-md disabled:opacity-50 active:scale-95"
            >
              {submitting ? "Rejecting..." : "OK"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
