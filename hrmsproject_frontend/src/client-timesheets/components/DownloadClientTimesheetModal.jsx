import React, { useState, useMemo, useEffect, useRef } from "react";
import { X, Download, Calendar } from "lucide-react";
import api from "../../utils/api";
import { toast } from "react-toastify";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { projectSuffix } from "../../utils/employeeName";
import { fitRowHeight, wrap } from "../../utils/excelWrap";

// ── Local date helpers (treat YYYY-MM-DD as local, avoid timezone shifts) ──
const toYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

// A day's regular capacity. Leave fills it first; worked hours beyond what is left are OT.
// Mirrors FULL_DAY_LEAVE_HOURS on the Time Entry page and the server's own split.
const FULL_DAY_HOURS = 8;

// The five Holiday/Time off categories, and how the app spells them. Every other category
// (PROJECT, and legacy rows that carry none) is worked time — defaulting the unknown case to
// "worked" is what keeps old rows exporting as they always did.
const LEAVE_LABELS = {
    SICK: "Paid Sick Leave",
    HOLIDAY: "Holiday (Public/National)",
    PTO: "Paid Time Off",
    LOP: "Unpaid Leave (LOP)",
    EARNED: "Leave (Earned)",
};
const isLeaveRow = (r) => Object.prototype.hasOwnProperty.call(LEAVE_LABELS, String(r?.category || "").toUpperCase());
const leaveLabel = (category) => LEAVE_LABELS[String(category || "").toUpperCase()] || "Leave";

// Monday of the week containing `d`.
const startOfWeek = (d) => {
    const c = new Date(d);
    const day = c.getDay(); // 0=Sun
    const diff = day === 0 ? 6 : day - 1;
    c.setDate(c.getDate() - diff);
    return c;
};

/**
 * One line of a checkbox list. The whole row is the label, so the click target is the full
 * width rather than the 16px box — these lists are scanned and ticked in bulk.
 *
 * `indeterminate` draws the dash used by a select-all row when only part of the list is
 * ticked. It has no HTML attribute — it only exists as a DOM property — so it is set
 * through a ref rather than in JSX.
 */
function CheckRow({ checked, onChange, label, emphasis = false, indeterminate = false }) {
    const boxRef = useRef(null);
    useEffect(() => {
        if (boxRef.current) boxRef.current.indeterminate = indeterminate && !checked;
    }, [indeterminate, checked]);

    return (
        <label className="flex items-center gap-3 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-white/70 transition-colors">
            <input
                ref={boxRef}
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="w-4 h-4 shrink-0 accent-[#0d9488] cursor-pointer"
            />
            <span className={`text-sm truncate ${emphasis ? "font-black text-brand-text" : "font-bold text-brand-text/80"}`}>
                {label}
            </span>
        </label>
    );
}

/**
 * Download panel for client timesheets. Matches the reference layout:
 * From/To date → quick-range presets → Employee → Client → Status → Download Excel.
 * Reads the filtered client_timesheets data from the API and generates a flat .xlsx
 * (one row per day per entry): Employee | Client | Project | Date | Hours | Billable | Status.
 */
export default function DownloadClientTimesheetModal({ isOpen, onClose, employees = [] }) {
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    // Multi-select, holding exactly the ticked rows — no sentinel meanings. "All employees"
    // is a view of this set (every row present), not a separate mode, which is what keeps the
    // header checkbox and the rows under it from ever disagreeing.
    const [employeeIds, setEmployeeIds] = useState(new Set());
    const [status, setStatus] = useState("");
    const [generating, setGenerating] = useState(false);
    // Keyed by field ("start" / "end") and rendered under that input, matching the
    // employee-timesheet download panel — the button stays enabled and the reason
    // appears against the field that caused it.
    const [errors, setErrors] = useState({});

    /**
     * Today, as the admin's own local calendar date.
     *
     * Deliberately the browser clock rather than the server's: `<input type="date">` holds a
     * plain calendar date with no timezone attached, and every other date in this panel — the
     * quick-range presets included — is already computed off the same local clock. Judging
     * those against a server UTC instant is what would introduce a timezone bug rather than
     * avoid one. An admin in UTC+5:30 at 01:00 would be told their own today is in the future
     * (server still on yesterday), and one in UTC-8 at 20:00 could pick a local tomorrow
     * (server already on the next day). One clock, no conversion, no edge case.
     */
    const today = toYMD(new Date());
    const FUTURE_MSG = "Date can't be in the future";

    /**
     * Both date rules in one place, derived from the pair rather than from whichever field was
     * last touched — editing either date re-judges both, so fixing From clears an ordering
     * complaint parked on To.
     */
    const dateIssues = (from, to) => {
        const issues = {};
        if (from && from > today) issues.start = FUTURE_MSG;
        if (to && to > today) issues.end = FUTURE_MSG;
        // Only when To is otherwise fine: "in the future" is the more specific complaint.
        if (!issues.end && from && to && to < from) {
            issues.end = "End date must be on or after the start date.";
        }
        return issues;
    };

    // The single way either date changes, so the picker, typing and the chips are all judged
    // by the same rule the moment they write.
    const applyDates = (nextFrom, nextTo) => {
        setFromDate(nextFrom);
        setToDate(nextTo);
        setErrors((prev) => ({ ...prev, start: undefined, end: undefined, ...dateIssues(nextFrom, nextTo) }));
    };

    // Client-assigned employees (clientAssigned = true). The Employee and Project
    // dropdowns are both driven off this list — employees with no client project are
    // excluded, and the distinct project names come from these assignments.
    const [assignedEmployees, setAssignedEmployees] = useState([]);

    // Load assigned employees each time the modal opens.
    useEffect(() => {
        if (!isOpen) return;
        (async () => {
            try {
                const res = await api("/api/admin/client-timesheet/assigned-employees");
                if (res.ok) {
                    const json = await res.json().catch(() => []);
                    const list = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
                    setAssignedEmployees(list);
                }
            } catch (err) {
                console.error("Error fetching assigned employees:", err);
            }
        })();
    }, [isOpen]);

    // Employees disabled in HRMS are dropped: this is a selection list, and no picker in
    // Client Timesheet Admin should offer an inactive account. Their already-submitted
    // timesheets are untouched — an "All employees" export still includes them, and the
    // admin queue still shows them (flagged), so nothing is lost from the record.
    const employeeOptions = useMemo(
        () => (assignedEmployees || []).filter((e) => e.employeeActive !== false),
        [assignedEmployees]
    );

    const employeeKeys = useMemo(
        () => employeeOptions.map((e) => String(e.employeeId)),
        [employeeOptions]
    );

    // The panel opens with nothing ticked: who to export is a deliberate choice, not something
    // that defaults to everyone. Clearing on each new list also resets the selection between
    // openings, since reopening refetches.
    useEffect(() => {
        setEmployeeIds(new Set());
    }, [employeeKeys]);

    // Ticking anybody answers the "select at least one" complaint, so it clears as soon as the
    // admin acts rather than waiting for them to press Download again.
    const clearEmployeeError = () =>
        setErrors((prev) => (prev.employee ? { ...prev, employee: undefined } : prev));

    // ── Checkbox helpers ────────────────────────────────────────────────────
    // A Set is copied rather than mutated so React sees a new value and re-renders.
    const toggleEmployee = (key) => {
        clearEmployeeError();
        setEmployeeIds((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    // Derived from the rows rather than tracked alongside them — so unticking one row drops
    // "All employees" on its own, and ticking the last one restores it, with no separate state
    // to keep in step. Guarded on a non-empty list: with no employees to offer, "none ticked"
    // and "all ticked" are the same set, and the header must read as the unticked default.
    const allEmployeesChecked = employeeOptions.length > 0 && employeeIds.size === employeeOptions.length;
    const someEmployeesChecked = employeeIds.size > 0 && !allEmployeesChecked;
    const toggleAllEmployees = () => {
        clearEmployeeError();
        setEmployeeIds(allEmployeesChecked ? new Set() : new Set(employeeKeys));
    };

    // Does this row survive the current selection? Only ticked rows do.
    const employeeSelected = (id) => employeeIds.has(String(id));

    /**
     * Puts every filter back to how the panel looks the first time it is opened: no dates, no
     * employees ticked, status All.
     *
     * Needed because the panel is never unmounted — AdminPage renders it permanently and only
     * toggles `isOpen`, so closing it keeps all of this state alive and the next export would
     * otherwise open on the last one's filters. Called on a completed download only; Cancel
     * and the failure paths leave the filters where the admin left them.
     */
    const resetFilters = () => {
        setFromDate("");
        setToDate("");
        setStatus("");
        setEmployeeIds(new Set());
        setErrors({});
    };

    if (!isOpen) return null;

    const applyPreset = (preset) => {
        const today = new Date();
        let from;
        let to;
        if (preset === "thisWeek") {
            from = startOfWeek(today);
            to = new Date(from);
            to.setDate(from.getDate() + 6);
        } else if (preset === "lastWeek") {
            const thisWeekStart = startOfWeek(today);
            from = new Date(thisWeekStart);
            from.setDate(thisWeekStart.getDate() - 7);
            to = new Date(from);
            to.setDate(from.getDate() + 6);
        } else if (preset === "thisMonth") {
            from = new Date(today.getFullYear(), today.getMonth(), 1);
            to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        } else if (preset === "lastMonth") {
            from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            to = new Date(today.getFullYear(), today.getMonth(), 0);
        }
        if (from && to) {
            // "Last week" and "Last month" both land wholly in the past by construction —
            // verified across mid-week and month/year boundaries — so this clamp is a no-op
            // for the two chips on the panel. It is here for the thisWeek/thisMonth branches
            // above, which do run past today and would reintroduce a future range the moment
            // anyone puts a button back on them.
            const toStr = toYMD(to);
            applyDates(toYMD(from), toStr > today ? today : toStr);
        }
    };

    const handleDownload = async () => {
        // ---- Date range is required ----
        // Either both dates typed in, or a quick range clicked — the presets write into these
        // same two fields, so the fields are the single source of truth for "is a range set".
        const nextErrors = {};
        if (!fromDate) nextErrors.start = "Please select a date range before downloading";
        if (!toDate) nextErrors.end = "Please select a date range before downloading";
        // Re-run at submit rather than trusting the pickers: `max` greys out future days in the
        // calendar but does not stop a typed value, and nothing stops the panel being left open
        // across midnight, which turns a then-valid "today" into tomorrow.
        Object.assign(nextErrors, dateIssues(fromDate, toDate));
        // ---- At least one employee is required ----
        // Nothing is ticked when the panel opens, so an export with an empty selection is the
        // default state rather than a deliberate "everyone" — it would fetch the range and
        // filter every row away. Named here for the same reason the dates are: the button
        // stays enabled and the reason appears against the field that caused it.
        if (employeeIds.size === 0) {
            nextErrors.employee = "Please select at least one employee";
        }
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        try {
            setGenerating(true);

            const params = new URLSearchParams();
            // The endpoint filters by a single employeeId, so it can only narrow the fetch when
            // exactly one is ticked. Every other case fetches the range and narrows below —
            // same rows either way, since the client-side pass applies regardless. "All
            // employees" is excluded even when the list happens to hold one name: that is a
            // whole-list export, and narrowing it to an id would drop the rows below.
            if (!allEmployeesChecked && employeeIds.size === 1) {
                params.append("employeeId", [...employeeIds][0]);
            }
            if (status) params.append("status", status);
            if (fromDate) params.append("fromDate", fromDate);
            if (toDate) params.append("toDate", toDate);

            const res = await api(`/api/client-timesheets?${params.toString()}`);
            let rows = [];
            if (res.ok) {
                const json = await res.json().catch(() => ({}));
                rows = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
            } else {
                toast.error(`Could not load client timesheets (${res.status}).`);
                return;
            }

            // Scope to the ticked employees. Client-side because the endpoint only filters by a
            // single employeeId. "All employees" skips the pass rather than matching every id
            // against it: the list offers active employees only, so filtering by it would drop
            // a disabled employee's already-submitted timesheets, which a whole-list export is
            // meant to keep. Project is no longer a filter — each row's own projectName still
            // reaches the workbook header, it just no longer narrows what is exported.
            if (!allEmployeesChecked) {
                rows = rows.filter((r) => employeeSelected(r.employeeId));
            }

            if (rows.length === 0) {
                toast.info("No client timesheets found for the selected filters.");
                return;
            }

            await generateExcel(rows);
            toast.success("Excel generated successfully.");

            // Notify download (optional background notification)
            try {
                // Names the ticked selections rather than a single one. Falls back to the same
                // "All" wording when nothing is ticked, so an unfiltered export's confirmation
                // reads exactly as it did before.
                const empName = allEmployeesChecked
                    ? "All Employees"
                    : employeeOptions
                        .filter((e) => employeeIds.has(String(e.employeeId)))
                        .map((e) => e.employeeName)
                        .join(", ");
                // Project is gone from the confirmation too — listing it would report a filter
                // that no longer exists.
                const filterStr = `Date Range: ${fromDate || "Any"} to ${toDate || "Any"} | Employee: ${empName} | Status: ${status || "All"}`;

                api("/api/timesheets/download-notification", {
                    method: "POST",
                    body: JSON.stringify({
                        recordCount: rows.length,
                        filters: filterStr,
                        timesheetType: "Client Timesheet"
                    })
                }).catch((err) => {
                    console.warn("Download notification skipped:", err);
                });
            } catch (err) {
                console.warn("Failed to send download confirmation email:", err);
            }

            // The file is on disk by now, so this export is done with its filters. Reset before
            // closing rather than on close, so the "no rows found" and failure paths above —
            // which return early without ever producing a file — keep theirs.
            resetFilters();
            onClose();
        } catch (err) {
            console.error(err);
            toast.error("An unexpected error occurred during generation.");
        } finally {
            setGenerating(false);
        }
    };

    // Reference-style export (English). One workbook per employee; within each workbook
    // one tab per calendar month spanned by the range (newest month first / leftmost).
    // Each tab: header block + Date | Day | Category | Clock-in | Clock-out | Break |
    // Working hours | Remarks, one row per calendar date in that month, with a Total
    // working-hours footer. A single employee downloads one .xlsx; multiple employees
    // download a .zip of one .xlsx per employee.
    const generateExcel = async (rows) => {
        const border = {
            top: { style: "thin" }, left: { style: "thin" },
            bottom: { style: "thin" }, right: { style: "thin" },
        };
        // Total row: medium top border, thin elsewhere.
        const totalBorder = {
            top: { style: "medium" }, left: { style: "thin" },
            bottom: { style: "thin" }, right: { style: "thin" },
        };
        const dayAbbr = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const parseYMD = (s) => {
            const [y, m, d] = String(s).split("T")[0].split("-").map(Number);
            return new Date(y, m - 1, d);
        };
        // Minutes-from-midnight (or a duration in minutes) → "H:MM". Hours may exceed 24
        // for the period total (e.g. 176:00).
        const minutesToHMM = (mins) => {
            const h = Math.floor(mins / 60);
            const m = Math.round(mins % 60);
            return `${h}:${String(m).padStart(2, "0")}`;
        };

        // ---- Date range shared across all workbooks ----
        // Explicit From/To when provided; otherwise the calendar month of the earliest entry.
        let rangeStart;
        let rangeEnd;
        if (fromDate && toDate) {
            rangeStart = parseYMD(fromDate);
            rangeEnd = parseYMD(toDate);
        } else {
            const times = rows.map((r) => parseYMD(r.date).getTime()).filter((t) => !isNaN(t));
            const base = times.length ? new Date(Math.min(...times)) : new Date();
            rangeStart = new Date(base.getFullYear(), base.getMonth(), 1);
            rangeEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0);
        }

        // ---- Calendar months the range spans, newest first (leftmost tab) ----
        const months = [];
        {
            let cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
            const lastMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
            while (cur <= lastMonth) {
                months.push(new Date(cur));
                cur.setMonth(cur.getMonth() + 1);
            }
        }
        months.reverse(); // newest month → leftmost tab, oldest → rightmost

        // ---- Group rows by employee ----
        const groups = new Map();
        rows.forEach((r) => {
            const key = r.employeeId != null ? r.employeeId : r.employeeName;
            if (!groups.has(key)) groups.set(key, { name: r.employeeName || "Employee", rows: [] });
            groups.get(key).rows.push(r);
        });

        // Excel sheet names: max 31 chars, no []:*?/\. "Timesheet_July 2026" = 19 chars.
        const sheetNameFor = (name) =>
            (name || "Timesheet").replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Timesheet";

        // Populate a single worksheet with one calendar month of one employee's data.
        const populateSheet = (ws, group, monthDate) => {
            // Named so the header block below can add up the columns it merges across without
            // restating the numbers — the two used to be maintained separately and drifted.
            // Each is sized to its own content: the hour columns hold "10:00" and their own
            // header word, Category and Remarks hold leave names ("Unpaid Leave (LOP)" fits on
            // one line; "Holiday (Public/National)" takes two, which the row grows for).
            // `regular` is 10 rather than 9 on purpose: ExcelJS treats 9 as its own default
            // column width and omits the <col> entry entirely, so the column shipped with no
            // width at all and Excel fell back to its 8.43 — narrower than every neighbour it
            // was meant to match. Any value but 9 is written out.
            const COL = {
                date: 8, day: 8, category: 22, clockIn: 10, clockOut: 10, break: 8,
                regular: 10, ot: 8, leave: 8, dayTotal: 10, remarks: 20,
            };
            const colWidths = Object.values(COL);
            colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
            const LAST_COL = colWidths.length;

            const titleMonth = monthDate.toLocaleString("en-US", { month: "long" });
            const titleYear = monthDate.getFullYear();

            // Employee meta (from the employees list already loaded — no extra API call).
            const emp = (employees || []).find(
                (e) => String(e.id) === String(group.rows[0].employeeId)
            );
            const dept = emp ? (emp.department || emp.departmentName || "") : "";
            const workLocation = "Office";
            // Project lines only. A leave line carries a client but no project, so including
            // them added a bare "Acme" alongside the real "Acme / p2".
            const projectName = Array.from(
                new Set(
                    group.rows
                        .filter((r) => !isLeaveRow(r))
                        .map((r) => [(r.clientName || "").trim(), (r.projectName || "").trim()].filter(Boolean).join(" / "))
                        .filter(Boolean)
                )
            ).join(", ");

            // ---- Header block ----
            ws.mergeCells(1, 1, 1, LAST_COL);
            const title = ws.getCell(1, 1);
            title.value = `Timesheet_${titleMonth} ${titleYear}`;
            title.font = { name: "Calibri", bold: true, size: 14 };
            title.alignment = wrap({ horizontal: "left" });
            // Merged across all 8 columns; 22pt fits the single line this always produces.
            fitRowHeight(ws.getRow(1), [
                { value: title.value, width: colWidths.reduce((a, b) => a + b, 0) },
            ], 22);

            // Every cell here is a merged span, and Excel never auto-fits a merged cell — so
            // the row height is computed from the content instead.
            //
            // The labels get two columns each rather than one. In a single 8-wide column
            // "Employee name:" wraps to two lines, and because only the *values* were measured
            // the row stayed one line tall and the second line was cut off — the header read
            // "Employe" / "Depart" / "Project" / "Work". Widening column A instead is not an
            // option: it is the Date column of the table below. So the label spans A-B (16
            // chars) and G-H (17), which fits the longest of them ("Work location:", 14) on one
            // line, and all four cells are now measured so nothing can be clipped again.
            const LABEL_L = COL.date + COL.day;                       // A-B
            const VALUE_L = COL.category + COL.clockIn + COL.clockOut; // C-E
            const LABEL_R = COL.regular + COL.ot;                      // G-H
            const VALUE_R = COL.leave + COL.dayTotal + COL.remarks;    // I-K
            const metaPair = (rowIdx, leftLabel, leftValue, rightLabel, rightValue) => {
                ws.mergeCells(rowIdx, 1, rowIdx, 2);
                ws.getCell(rowIdx, 1).value = leftLabel;
                ws.getCell(rowIdx, 1).font = { name: "Calibri", bold: true };
                ws.getCell(rowIdx, 1).alignment = wrap({ horizontal: "left" });
                ws.mergeCells(rowIdx, 3, rowIdx, 5);
                ws.getCell(rowIdx, 3).value = leftValue;
                ws.getCell(rowIdx, 3).alignment = wrap({ horizontal: "left" });
                ws.mergeCells(rowIdx, 7, rowIdx, 8);
                ws.getCell(rowIdx, 7).value = rightLabel;
                ws.getCell(rowIdx, 7).font = { name: "Calibri", bold: true };
                ws.getCell(rowIdx, 7).alignment = wrap({ horizontal: "left" });
                ws.mergeCells(rowIdx, 9, rowIdx, LAST_COL);
                ws.getCell(rowIdx, 9).value = rightValue;
                ws.getCell(rowIdx, 9).alignment = wrap({ horizontal: "left" });
                fitRowHeight(ws.getRow(rowIdx), [
                    { value: leftLabel, width: LABEL_L },
                    { value: leftValue, width: VALUE_L },
                    { value: rightLabel, width: LABEL_R },
                    { value: rightValue, width: VALUE_R },
                ]);
            };
            metaPair(3, "Employee name:", group.name, "Project name:", projectName);
            metaPair(4, "Department:", dept, "Work location:", workLocation);

            // ---- Table header (row 6) ----
            const headerRowIdx = 6;
            const headers = ["Date", "Day", "Category", "Clock-in", "Clock-out", "Break", "Regular", "OT", "Leave", "Day Total", "Remarks"];
            const hr = ws.getRow(headerRowIdx);
            headers.forEach((h, i) => {
                const c = hr.getCell(i + 1);
                c.value = h;
                c.font = { name: "Calibri", bold: true };
                c.alignment = wrap({ horizontal: "center" });
                c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
                c.border = border;
            });
            // "Day Total" is longer than its column and wraps to two lines.
            fitRowHeight(hr, headers.map((h, i) => ({ value: h, width: colWidths[i] })));

            // Project hours and leave hours are bucketed separately. They used to share one
            // bucket, which is what put a sick day's 8 hours into "Working hours" and made the
            // sheet's only total read 46 where the screen says 38 worked.
            const workedByDate = {};
            const leaveByDate = {};
            const leaveLabelByDate = {};
            group.rows.forEach((r) => {
                const key = String(r.date).split("T")[0];
                const h = typeof r.hours === "number" ? r.hours : parseFloat(r.hours) || 0;
                if (isLeaveRow(r)) {
                    leaveByDate[key] = (leaveByDate[key] || 0) + h;
                    // A day can hold more than one leave type; name them all.
                    const label = leaveLabel(r.category);
                    const seen = leaveLabelByDate[key];
                    if (!seen) leaveLabelByDate[key] = label;
                    else if (!seen.split(", ").includes(label)) leaveLabelByDate[key] = `${seen}, ${label}`;
                } else {
                    workedByDate[key] = (workedByDate[key] || 0) + h;
                }
            });

            // ---- Day sequence: this calendar month, clamped to the selected range ----
            const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
            const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
            const seqStart = monthStart < rangeStart ? rangeStart : monthStart;
            const seqEnd = monthEnd > rangeEnd ? rangeEnd : monthEnd;
            const dateSeq = [];
            for (let d = new Date(seqStart); d <= seqEnd; d.setDate(d.getDate() + 1)) {
                dateSeq.push(new Date(d));
            }

            // ---- Body: one row per calendar date (no days skipped) ----
            let regularMinutes = 0;
            let otMinutes = 0;
            let leaveMinutes = 0;
            dateSeq.forEach((d, idx) => {
                const row = ws.getRow(headerRowIdx + 1 + idx);
                const mo = d.getMonth() + 1;
                const da = d.getDate();
                const ymd = `${d.getFullYear()}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
                const dow = d.getDay();
                const isWeekend = dow === 0 || dow === 6;

                let category = "";
                let clockIn = "0:00";
                let clockOut = "0:00";
                let brk = "0:00";
                let regular = "0:00";
                let ot = "0:00";
                let leave = "0:00";
                let dayTotal = "0:00";
                let remarks = "";

                if (isWeekend) {
                    category = "Weekend";
                    remarks = "Weekend";
                } else {
                    const workedHrs = workedByDate[ymd] || 0;
                    const leaveHrs = leaveByDate[ymd] || 0;

                    // Same split the Time Entry page and the server apply (EntryPage.dayBreakdown
                    // / ClientTimesheetWeekService.applyRegularAndOvertime): leave consumes the
                    // day's regular capacity first, worked hours fill what is left, and anything
                    // beyond that is overtime. A day already full of leave earns no OT.
                    let regularHrs = 0;
                    let otHrs = 0;
                    if (leaveHrs < FULL_DAY_HOURS) {
                        const capacity = FULL_DAY_HOURS - leaveHrs;
                        regularHrs = Math.min(workedHrs, capacity);
                        otHrs = Math.max(0, workedHrs - capacity);
                    }

                    const workMin = Math.round(workedHrs * 60);
                    const regMin = Math.round(regularHrs * 60);
                    const otMin = Math.round(otHrs * 60);
                    const lvMin = Math.round(leaveHrs * 60);

                    // Clock times describe worked hours only — a day spent on leave was not
                    // clocked in, so it no longer reports a 9:30–18:30 shift it never had.
                    if (workMin > 0) {
                        const startMin = 9 * 60 + 30; // 9:30
                        const breakMin = 60; // 1:00
                        clockIn = "9:30";
                        brk = "1:00";
                        clockOut = minutesToHMM(startMin + workMin + breakMin);
                    }
                    if (lvMin > 0) {
                        category = leaveLabelByDate[ymd] || "Leave";
                        remarks = category;
                    }
                    regular = minutesToHMM(regMin);
                    ot = minutesToHMM(otMin);
                    leave = minutesToHMM(lvMin);
                    dayTotal = minutesToHMM(regMin + otMin + lvMin);

                    regularMinutes += regMin;
                    otMinutes += otMin;
                    leaveMinutes += lvMin;
                    // Weekday with no entry → all 0:00, blank Category/Remarks.
                }

                const values = [`${mo}/${da}`, dayAbbr[dow], category, clockIn, clockOut, brk, regular, ot, leave, dayTotal, remarks];
                values.forEach((v, i) => {
                    const c = row.getCell(i + 1);
                    c.value = v;
                    c.alignment = wrap({ horizontal: i === LAST_COL - 1 ? "left" : "center" });
                    c.border = border;
                    // Weekend rows: light-yellow highlight to distinguish visually.
                    if (isWeekend) {
                        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9C4" } };
                    }
                });
                // Remarks is free text and the only cell here that realistically wraps.
                fitRowHeight(row, values.map((v, i) => ({ value: v, width: colWidths[i] })));
            });

            // ---- Total footer (this month only) ----
            // Column totals sit under the columns they add up, so each one can be checked
            // against the days above it.
            const totalRowIdx = headerRowIdx + 1 + dateSeq.length;
            const totalRow = ws.getRow(totalRowIdx);
            ws.mergeCells(totalRowIdx, 1, totalRowIdx, 6);
            const label = totalRow.getCell(1);
            label.value = "Total";
            label.font = { name: "Calibri", bold: true };
            label.alignment = wrap({ horizontal: "center" });
            for (let cc = 1; cc <= 6; cc++) totalRow.getCell(cc).border = totalBorder;
            const workingMinutes = regularMinutes + otMinutes;
            [regularMinutes, otMinutes, leaveMinutes, workingMinutes + leaveMinutes]
                .forEach((mins, i) => {
                    const c = totalRow.getCell(7 + i);
                    c.value = minutesToHMM(mins);
                    c.font = { name: "Calibri", bold: true };
                    c.alignment = wrap({ horizontal: "right" });
                    c.border = totalBorder;
                });
            totalRow.getCell(LAST_COL).border = totalBorder;
            totalRow.getCell(LAST_COL).alignment = wrap({ horizontal: "left" });
            fitRowHeight(totalRow, [{ value: "Total", width: colWidths.slice(0, 6).reduce((a, b) => a + b, 0) }]);

            // ---- Named summary, in the order the Time Entry page lists it ----
            // The column totals above are the same figures; these name them, so the workbook
            // states Regular, OT, Working, Leave and Grand Total outright instead of leaving
            // the reader to add columns up.
            const summary = [
                ["Total Regular Hours:", regularMinutes],
                ["Total OT Hours:", otMinutes],
                ["Total Working Hours:", workingMinutes],
                ["Total Holiday/Time off Hours:", leaveMinutes],
                ["Grand Total:", workingMinutes + leaveMinutes],
            ];
            summary.forEach(([text, mins], i) => {
                const rowIdx = totalRowIdx + 2 + i;
                const r = ws.getRow(rowIdx);
                ws.mergeCells(rowIdx, 1, rowIdx, 6);
                const lc = r.getCell(1);
                lc.value = text;
                lc.font = { name: "Calibri", bold: true };
                lc.alignment = wrap({ horizontal: "right" });
                const vc = r.getCell(7);
                vc.value = minutesToHMM(mins);
                vc.font = { name: "Calibri", bold: true };
                vc.alignment = wrap({ horizontal: "right" });
                // Merged, so Excel will not auto-fit it either — "Total Holiday/Time off
                // Hours:" is the longest label on the sheet and has to be measured too.
                fitRowHeight(r, [
                    { value: text, width: colWidths.slice(0, 6).reduce((a, b) => a + b, 0) },
                    { value: vc.value, width: COL.regular },
                ]);
            });
        };

        // Employee name → title-case, no spaces. "ganesh y" → "GaneshY".
        // "employee one" → "Employee One". Words stay separated: squashing them together was
        // what produced the run-on "employeeone" in the old file names.
        const formatEmployeeName = (fullName) => {
            if (!fullName || !fullName.trim()) return "Employee";
            return fullName.trim().split(/\s+/)
                .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
                .join(" ");
        };
        const monthShort = (d) => d.toLocaleString("en-US", { month: "short" }); // e.g. Jul
        const yy = (d) => String(d.getFullYear()).slice(-2);
        // "Jul 26" — each sheet always covers a whole calendar month, so the day range the
        // tab name used to spell out ("01.08.26-31.08.26") added length without information.
        const monthLabelOf = (d) => `${monthShort(d)} ${yy(d)}`;

        // Build one workbook for an employee group: a tab per month, newest first.
        // Tab names are just the month ("Jul 26"); the employee is already the file name,
        // and every workbook holds exactly one employee.
        const buildWorkbook = (group) => {
            const wb = new ExcelJS.Workbook();
            months.forEach((monthDate) => {
                const ws = wb.addWorksheet(sheetNameFor(monthLabelOf(monthDate)));
                populateSheet(ws, group, monthDate);
            });
            return wb;
        };

        // ---- File-name helpers ----
        // "Jul 26" for one month, "Jul-Aug 26" within a year, "Dec 25-Jan 26" across years.
        const rangeLabel = (() => {
            if (months.length === 1) return monthLabelOf(rangeStart);
            if (rangeStart.getFullYear() === rangeEnd.getFullYear()) {
                return `${monthShort(rangeStart)}-${monthShort(rangeEnd)} ${yy(rangeEnd)}`;
            }
            return `${monthLabelOf(rangeStart)}-${monthLabelOf(rangeEnd)}`;
        })();
        // Strip only what a filesystem rejects, so spaces and the name stay intact.
        const fileNameSafe = (name) =>
            ((name || "Employee").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim() || "Employee");
        const workbookFileName = (group) => `${fileNameSafe(formatEmployeeName(group.name))} - ${rangeLabel}.xlsx`;

        const groupList = Array.from(groups.values());

        if (groupList.length <= 1) {
            // Single employee → one .xlsx, e.g. "Employee One - Jul-Aug 26.xlsx".
            const group = groupList[0];
            const wb = buildWorkbook(group);
            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            saveAs(blob, workbookFileName(group));
        } else {
            // Multiple employees → one .xlsx per employee, delivered as a .zip. Each file
            // keeps the same "Name - Range.xlsx" pattern so the archive stays readable.
            const zip = new JSZip();
            for (const group of groupList) {
                const wb = buildWorkbook(group);
                const buffer = await wb.xlsx.writeBuffer();
                zip.file(workbookFileName(group), buffer);
            }
            const zipBlob = await zip.generateAsync({ type: "blob" });
            saveAs(zipBlob, `Timesheets - ${rangeLabel}.zip`);
        }
    };

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-brand-blue/40 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-4xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                <div className="p-6 border-b border-brand-blue/5 flex items-center justify-between bg-bg-slate/30">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-brand-blue-dark rounded-2xl flex items-center justify-center text-white shadow-lg">
                            <Download size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-brand-text tracking-tight">Download client timesheets</h2>
                            <p className="text-[10px] font-black text-brand-text/30 uppercase tracking-widest mt-0.5">Filtered Export</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-brand-blue/5 rounded-xl transition-all"><X size={20} /></button>
                </div>

                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Date range + the two quick ranges, one row. The chips set the very fields
                        beside them, so they belong on the same line rather than in a strip
                        underneath; they wrap under on a narrow panel. Aligned to the top, not
                        the bottom: a validation message under one date grows that column, and
                        bottom-alignment would shunt its input out of line with its neighbour.
                        The chips carry a spacer standing in for the labels so they still land
                        on the inputs' line. */}
                    <div className="flex flex-wrap items-start gap-3">
                        <div className="space-y-2 flex-1 min-w-[150px]">
                            <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest ml-1">From date</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text/30 w-4 h-4" />
                                <input
                                    type="date"
                                    value={fromDate}
                                    max={today}
                                    onChange={(e) => applyDates(e.target.value, toDate)}
                                    onBlur={(e) => applyDates(e.target.value, toDate)}
                                    className="w-full bg-bg-slate/50 border-2 border-transparent focus:border-brand-yellow rounded-2xl p-3.5 pl-11 text-sm font-bold text-brand-text outline-none transition-all"
                                />
                            </div>
                            {errors.start && <p className="text-red-500 text-[12px] mt-1 ml-1">{errors.start}</p>}
                        </div>
                        <div className="space-y-2 flex-1 min-w-[150px]">
                            <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest ml-1">To date</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text/30 w-4 h-4" />
                                <input
                                    type="date"
                                    value={toDate}
                                    max={today}
                                    onChange={(e) => applyDates(fromDate, e.target.value)}
                                    onBlur={(e) => applyDates(fromDate, e.target.value)}
                                    className="w-full bg-bg-slate/50 border-2 border-transparent focus:border-brand-yellow rounded-2xl p-3.5 pl-11 text-sm font-bold text-brand-text outline-none transition-all"
                                />
                            </div>
                            {errors.end && <p className="text-red-500 text-[12px] mt-1 ml-1">{errors.end}</p>}
                        </div>
                        <div className="space-y-2 shrink-0">
                            {/* Empty stand-in for the "From date"/"To date" labels, so the chips
                                start on the same line as the inputs rather than the labels. */}
                            <span aria-hidden="true" className="block text-[10px] font-black uppercase tracking-widest invisible">.</span>
                            <div className="flex gap-2">
                                {[
                                    { key: "lastWeek", label: "Last week" },
                                    { key: "lastMonth", label: "Last month" },
                                ].map((p) => (
                                    <button
                                        key={p.key}
                                        onClick={() => applyPreset(p.key)}
                                        className="px-3 py-3.5 rounded-2xl border border-brand-blue/10 bg-white text-[11px] font-black uppercase tracking-widest text-brand-text/70 hover:bg-brand-blue hover:text-white hover:border-brand-blue transition-all whitespace-nowrap"
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Employee + Project — checkbox lists, side by side in the columns the
                        dropdowns held. Each scrolls inside a fixed max height so the panel's
                        own height barely moves as the assignment list grows. */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest ml-1">Employee</label>
                            {/* The list border turns red on the same terms the date fields do,
                                so an empty selection reads as the unanswered field it is. */}
                            <div className={`bg-bg-slate/50 border-2 rounded-2xl p-2 max-h-[184px] overflow-y-auto custom-scrollbar ${errors.employee ? "border-red-400" : "border-transparent"}`}>
                                <CheckRow
                                    checked={allEmployeesChecked}
                                    indeterminate={someEmployeesChecked}
                                    onChange={toggleAllEmployees}
                                    label="All employees"
                                    emphasis
                                />
                                <div className="my-1 border-t border-brand-blue/10" />
                                {employeeOptions.length === 0 ? (
                                    <p className="px-3 py-2 text-xs font-bold text-brand-text/30">No assigned employees.</p>
                                ) : employeeOptions.map((e) => (
                                    <CheckRow
                                        key={e.employeeId}
                                        checked={employeeIds.has(String(e.employeeId))}
                                        onChange={() => toggleEmployee(String(e.employeeId))}
                                        label={`${e.employeeName}${projectSuffix(e.projectName)}`}
                                    />
                                ))}
                            </div>
                            {errors.employee && <p className="text-red-500 text-[12px] mt-1 ml-1">{errors.employee}</p>}
                        </div>
                        {/* Status takes the column Project has vacated. Sized to a date field
                            rather than the panel width — it holds one word — and top-aligned so
                            it sits level with the employee list beside it rather than stretching
                            to its height. */}
                        <div className="space-y-2 self-start">
                            <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest ml-1">Status</label>
                            {/* block, not the select's default inline-block: once it stopped
                                being full-width it fitted beside its own label and the two
                                shared a line, unlike every other field on the panel. */}
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="block w-full max-w-[200px] bg-bg-slate/50 border-2 border-transparent focus:border-brand-yellow rounded-2xl p-3.5 text-sm font-bold text-brand-text outline-none transition-all"
                            >
                                <option value="">All</option>
                                <option value="PENDING">Pending</option>
                                <option value="APPROVED">Approved</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-bg-slate/30 border-t border-brand-blue/5 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-brand-text/40 hover:text-brand-text transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={generating}
                        className="px-10 py-4 bg-brand-blue-dark text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-brand-blue/20 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                        {generating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Download size={16} />
                                Download Excel
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
