import { MessageSquare } from "lucide-react";

/**
 * Read-only per-row comments for a client timesheet week.
 *
 * Shared by the employee's Time Entry page and the admin review drawer so a comment reads
 * identically on both sides — the comment belongs to a specific project row, not to the week,
 * and several rows can each carry a distinct one.
 *
 * The comment text is persisted on every day-line of its row (client_timesheets.comment) and
 * read back from the row group, so it survives submission and every later status change
 * (pending → approved/rejected).
 *
 * Renders nothing when no row carries a comment, so neither view shows an empty box.
 */
export default function RowCommentsPanel({ rows, className = "" }) {
    const commented = (rows || []).filter((r) => r.comment && String(r.comment).trim());
    if (commented.length === 0) return null;

    return (
        <div className={`bg-white border border-[#E3E8EF] rounded-xl overflow-hidden ${className}`}>
            <div className="px-4 py-2.5 border-b border-[#E3E8EF] flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-xs font-black text-brand-text uppercase tracking-wide">Row Comments</h3>
                <span className="text-[10px] text-brand-text/40">
                    Entered by the employee against a specific project row
                </span>
            </div>
            <ul className="divide-y divide-[#E3E8EF]">
                {commented.map((r, idx) => (
                    <li key={r.rowId || idx} className="px-4 py-3 flex gap-3">
                        <MessageSquare size={14} className="mt-1 shrink-0 text-emerald-600" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-text/40">
                                {[r.projectId, r.projectName, r.taskId].filter(Boolean).join(" · ") || "Project row"}
                            </p>
                            {/* whitespace-pre-wrap keeps the employee's line breaks; break-words
                                stops a long unbroken string from widening the panel. */}
                            <p className="mt-1 text-sm text-brand-text/80 leading-relaxed whitespace-pre-wrap break-words">
                                {r.comment}
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
