/**
 * Text-wrap helpers shared by the .xlsx exports.
 *
 * Wrapping a cell is only half the job. Excel auto-fits a row's height to wrapped content
 * ONLY when that row has no explicit height set — and it never auto-fits a *merged* cell at
 * all, whatever the height. Both timesheet exports set explicit row heights and both use
 * merged cells in their header blocks, so leaving it to Excel would still clip long text.
 *
 * So the height is computed from the content instead. That is deterministic, and unlike
 * auto-fit it also survives LibreOffice and Google Sheets, which open these files too.
 */

/** Points of row height one line of ~10-11pt Calibri needs. */
export const LINE_HEIGHT = 15;

// Excel column widths are measured in characters of the default font. Real wrapping breaks
// a little earlier than the nominal width (padding, proportional glyphs), so leave a margin
// — over-estimating lines costs a few points of blank row, under-estimating clips text.
const usableChars = (widthChars) => Math.max(1, Math.floor((widthChars || 10) * 0.95));

/**
 * Lines one paragraph occupies, breaking at spaces the way Excel does.
 *
 * Counting characters and dividing by the width under-counts: it assumes text can break
 * anywhere, but a word that does not fit is pushed to the next line whole, leaving the rest of
 * the previous one empty. "Half Day — Paid Sick Leave" in a 20-char column is 26 characters —
 * two lines either way — but "Total Holiday/Time off Hours" is 28 characters and breaks after
 * "Time" rather than mid-word, so the naive count can be a line short. A line short is a line
 * clipped, which is the failure this whole module exists to prevent.
 *
 * A single word longer than the column is the one case Excel does break mid-word, so it is
 * charged the lines it actually needs.
 */
function linesForParagraph(text, per) {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return 1;
    let lines = 1;
    let used = 0;
    for (const word of words) {
        if (word.length > per) {
            if (used > 0) { lines += 1; used = 0; }
            lines += Math.ceil(word.length / per) - 1;
            used = word.length % per || per;
            continue;
        }
        const need = used === 0 ? word.length : used + 1 + word.length;
        if (need <= per) {
            used = need;
        } else {
            lines += 1;
            used = word.length;
        }
    }
    return lines;
}

/**
 * How many lines a value occupies at a given column width, honouring explicit newlines.
 * Always at least 1, so an empty cell never produces a zero-height row.
 */
export function wrappedLineCount(value, widthChars) {
    const text = value == null ? "" : String(value);
    if (!text) return 1;
    const per = usableChars(widthChars);
    return text
        .split("\n")
        .reduce((sum, line) => sum + linesForParagraph(line, per), 0);
}

/**
 * Row height in points for a line count, never below `minHeight`.
 *
 * Wrapped rows get more slack than a single-line one. Excel leaves internal padding above and
 * below the text block, so a row sized to exactly n × LINE_HEIGHT clips the last line — which
 * is what "Half Day — Paid Sick Leave" did at two lines and 33pt. Single-line rows are
 * unaffected: they were never close to clipping and their height is still the 20pt floor.
 */
export function heightForLines(lines, minHeight = 20) {
    const n = Math.ceil(lines);
    const padding = n > 1 ? 8 : 3;
    return Math.max(minHeight, n * LINE_HEIGHT + padding);
}

/**
 * Grows a row so the tallest of its wrapped cells fits.
 *
 * `cells` is [{ value, width }] where width is in Excel character units — for a merged
 * cell pass the sum of the widths it spans, since that is the space the text actually has.
 * Call this AFTER the values are written, or it measures empty cells.
 *
 * Grow-only: a sheet can have side-by-side blocks writing to the same rows (the employee
 * info block and the monthly summary panel share rows 4-5), so a later call must never
 * shrink a row an earlier one already grew. That also makes the calls order-independent.
 */
export function fitRowHeight(row, cells, minHeight = 20) {
    const lines = (cells || []).reduce(
        (max, c) => Math.max(max, wrappedLineCount(c.value, c.width)),
        1
    );
    row.height = Math.max(row.height || 0, heightForLines(lines, minHeight));
}

/**
 * Alignment object with wrapping switched on. Spread-friendly:
 *   cell.alignment = wrap({ horizontal: "center" })
 */
export function wrap(alignment = {}) {
    return { vertical: "middle", wrapText: true, ...alignment };
}
