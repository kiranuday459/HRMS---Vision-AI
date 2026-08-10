import { useEffect } from "react";
import { X } from "lucide-react";
import CharCounter from "../../components/CharCounter";

/**
 * The one place a client-timesheet row's long text is ever shown in full.
 *
 * Grew out of the row-comment dialog. Comments used to be rendered in two places at once —
 * truncated beside the row's icon, and again in full in a panel under the table — which put the
 * same text on screen twice and pushed the page long. The fix was a truncated cell plus this
 * dialog behind it, and Task/Activity Description has exactly the same problem: 256 characters
 * in a 190px column. So the dialog is parameterised by `label` rather than copied, and the two
 * fields stay in step by construction.
 *
 * Because the text is detached from its row once it is in a dialog, the header names the row it
 * belongs to (Project ID · Project Name · Task ID) — without it, a reviewer reading two rows'
 * descriptions has no way to tell which is which.
 *
 * Shared by the employee's Time Entry page and the admin review drawer so both sides read
 * identically. `editable` is what separates them: the employee gets a textarea, a live counter
 * and Save while the week is still open; the admin (and the employee after submission) gets the
 * same text read-only.
 */
export const rowContextLabel = (row) =>
    [row?.projectId, row?.projectName, row?.taskId].filter(Boolean).join(" · ") || "Project row";

export default function RowTextDialog({
    row,
    value,
    max,
    /** Field name, used for the heading and the empty/placeholder copy. */
    label = "Comment",
    placeholder,
    editable = false,
    onChange,
    onClose,
    onSave,
}) {
    // Escape closes it. This is the only route to the full text, so it is reached far more
    // often than the old edit-only comment modal was.
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const text = String(value ?? "");
    const heading = editable ? label : `${label} (read-only)`;

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div role="dialog" aria-modal="true" aria-label={heading} className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold text-brand-text">{heading}</h3>
                        {/* Which row this belongs to — without it the text in a dialog is
                            unattributed, since the row it sits on is no longer visible. */}
                        <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-brand-text/40 break-words">
                            {rowContextLabel(row)}
                        </p>
                    </div>
                    <button onClick={onClose} className="shrink-0 text-brand-text/40 hover:text-brand-text" aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                {editable ? (
                    <>
                        <textarea
                            value={text}
                            onChange={(e) => onChange(e.target.value)}
                            maxLength={max}
                            placeholder={placeholder || `${label} for this project row`}
                            className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-yellow outline-none text-sm"
                            rows="4"
                            autoFocus
                        />
                        <div className="mb-4"><CharCounter value={text} max={max} /></div>
                    </>
                ) : (
                    // whitespace-pre-wrap keeps the employee's line breaks; break-words stops a
                    // long unbroken string from widening the dialog. max-h + scroll so a
                    // full-length value cannot push the buttons off a short screen.
                    <div className="mb-4 max-h-64 overflow-y-auto rounded-lg bg-bg-slate/40 p-3">
                        <p className="text-sm text-brand-text/80 leading-relaxed whitespace-pre-wrap break-words">
                            {text.trim() || <span className="text-brand-text/40">No {label.toLowerCase()} on this row.</span>}
                        </p>
                    </div>
                )}

                {/* Once the week is submitted the text is history, not an input — a lone Close
                    beats a Cancel next to a permanently disabled Save. */}
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold uppercase text-[10px] tracking-widest hover:bg-slate-200 transition">
                        {editable ? "Cancel" : "Close"}
                    </button>
                    {editable && (
                        <button onClick={onSave} className="flex-1 bg-brand-blue-dark text-white px-4 py-2 rounded-lg font-bold uppercase text-[10px] tracking-widest hover:brightness-110 transition">
                            Save
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
