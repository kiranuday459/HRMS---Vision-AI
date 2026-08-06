/**
 * Live "120/256" character counter shown under a capped text field.
 *
 * Inputs hard-stop at the limit via maxLength, so `at` is the steady state once a user keeps
 * typing rather than an error condition — it is emphasised, not coloured like a validation
 * failure. The amber "near" state gives warning before the field stops accepting input,
 * which is otherwise silent.
 *
 * aria-live="polite" so a screen reader hears the count change without it interrupting
 * every keystroke.
 */
export default function CharCounter({ value, max, className = "" }) {
    const used = String(value ?? "").length;
    const at = used >= max;
    const near = !at && used >= max * 0.9;

    return (
        <p
            aria-live="polite"
            className={`mt-1 text-[10px] font-semibold tabular-nums leading-tight ${at
                ? "text-brand-text/70"
                : near
                    ? "text-amber-600"
                    : "text-brand-text/40"} ${className}`}
        >
            {used}/{max}
            {at && <span className="ml-1 font-bold">· limit reached</span>}
        </p>
    );
}
