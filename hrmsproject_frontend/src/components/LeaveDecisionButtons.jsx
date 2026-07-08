import React from "react";
import { Check, X } from "lucide-react";

/**
 * Shared leave approve/reject decision controls.
 *
 * Renders a green tick (Approve) and a red cross (Reject) icon button with
 * consistent sizing, tooltips, accessible labels, and hover/active states that
 * match the existing design system. While `processing` is true both controls
 * are disabled to prevent duplicate submissions / changing the decision.
 */
export default function LeaveDecisionButtons({ onApprove, onReject, processing = false, size = 16 }) {
  return (
    <>
      <button
        type="button"
        onClick={onApprove}
        disabled={processing}
        title="Approve Leave"
        aria-label="Approve Leave"
        className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-50 disabled:hover:text-emerald-600 disabled:active:scale-100"
      >
        <Check size={size} strokeWidth={3} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onReject}
        disabled={processing}
        title="Reject Leave"
        aria-label="Reject Leave"
        className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-50 disabled:hover:text-red-500 disabled:active:scale-100"
      >
        <X size={size} strokeWidth={3} aria-hidden="true" />
      </button>
    </>
  );
}
