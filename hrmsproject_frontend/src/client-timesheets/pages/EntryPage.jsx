import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessageSquare, MessageSquareText, Plus, Minus, ArrowLeft, Maximize2 } from "lucide-react";
import api from "../../utils/api";
import { toast } from "react-toastify";
import { clientTimesheetStatusMeta } from "../../utils/clientTimesheetStatus";
import { clientTimesheetBase, roleDashboardPath } from "../../utils/clientTimesheetNav";
import RowTextDialog from "../components/RowTextDialog";
import CharCounter from "../../components/CharCounter";
import { FIELD_LIMITS } from "../../utils/fieldLimits";

const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const TIMEOFF_LABELS = {
    SICK: "Paid Sick Leave",
    HOLIDAY: "Holiday (Public/National)",
    PTO: "Paid Time Off",
    LOP: "Unpaid Leave (LOP)",
    EARNED: "Leave (Earned)",
};
const TIMEOFF_ORDER = ["SICK", "HOLIDAY", "PTO", "LOP", "EARNED"];

// Field caps. Mirrored by the server-side check in ClientTimesheetWeekService.validateEntries
// — without these a long paste reached MySQL and came back as a raw "Data too long for
// column" 500 on Save. The shared limits live in utils/fieldLimits so every screen that
// writes these fields caps them identically.
const MAX_TASK_ID = FIELD_LIMITS.TASK_ID;
const MAX_TASK_DESCRIPTION = FIELD_LIMITS.TASK_DESCRIPTION;
const MAX_COMMENT = FIELD_LIMITS.COMMENT;
const MAX_BILLING_LOCATION = FIELD_LIMITS.BILLING_LOCATION;
const MAX_LEAVE_REASON = FIELD_LIMITS.LEAVE_REASON;

/**
 * How long a leave cell waits after the last keystroke before asking for a reason.
 *
 * Short enough to read as "right after typing", long enough not to land mid-number. These
 * cells take digits only and at most two of them (sanitizeHourDigits), and leave is clamped
 * to 8, so the only real two-keystroke entry is something like "10" — which passes through a
 * perfectly valid "1" on the way. Prompting on that first digit would throw a dialog over
 * the grid and take the focus still needed to finish typing, which is why this is debounced
 * rather than fired on the keystroke itself.
 */
const LEAVE_REASON_PROMPT_DELAY_MS = 400;

// Billing Location holds a place name, so it takes letters and spaces only — "New York" is
// allowed, "Bldg 4" and "St. Louis" are not. Everything else is stripped as it arrives rather
// than flagged on Submit, which is how the app's other restricted fields behave (sanitizeName
// in utils/formValidation, the designation field in CompanyDetailsModal): one handler covers
// typing and pasting alike, since a paste fires onChange with the whole clipboard string.
const BILLING_LOCATION_DISALLOWED = /[^A-Za-z ]/g;

// Leave booked on a date that fills the day's whole regular capacity.
const FULL_DAY_LEAVE_HOURS = 8;

// Hour caps. A calendar day cannot hold more than 24 hours however the rows are split, and
// a leave entry cannot exceed a standard working day. Enforced three ways: the cell clamps
// as you type, the daily totals are checked before submit, and the server re-checks both in
// ClientTimesheetWeekService.validateEntries — the input cap is a convenience, not the rule.
const MAX_HOURS_PER_DAY = 24;
const MAX_LEAVE_HOURS_PER_DAY = FULL_DAY_LEAVE_HOURS;

// Every project row must carry all of these before the week can be submitted. Kept in one
// place so the validator, the red highlighting and the error text can't drift apart.
// Project ID / Project Name are not typed — they come from the employee's client project
// assignment (picked from the dropdown on a newly added row), but they are required all the
// same: a row with no project can't be grouped or approved.
const REQUIRED_ROW_FIELDS = [
    { key: "projectId", label: "Project ID" },
    { key: "projectName", label: "Project Name" },
    { key: "taskId", label: "Task/Activity ID" },
    { key: "taskDescription", label: "Task/Activity Description" },
    { key: "onsiteOffshore", label: "Onsite/Offshore" },
    { key: "clientBillable", label: "Client Billable" },
    { key: "billingLocation", label: "Billing Location" },
];

// Shared column geometry for the three hour grids (Regular / OT / Leave).
//
// They are separate tables with different headers and row shapes, and nothing made their day
// columns line up: the project grid was min-w-1100 over seven content-sized description
// columns, while OT and Leave were min-w-900 over a single 280px label. The same weekday
// therefore landed at a different x in each block and the page read as three staggered grids.
// Driving all three from one colgroup puts a given day in the same place in every block, so
// the sheet reads straight down a day as well as left-to-right along a row.
const GRID_IDENTITY_COLS = [84, 128, 116, 190, 108, 106, 100]; // the project grid's 7 descriptive columns
const GRID_LEAD_W = GRID_IDENTITY_COLS.reduce((a, b) => a + b, 0);
const GRID_DAY_W = 78;
const GRID_TOTAL_W = 88;
const GRID_COMMENT_W = 92;
const GRID_ACTIONS_W = 64;
// Every grid declares the same minimum, so they scroll as one shape rather than drifting apart.
const GRID_MIN_W = GRID_LEAD_W + GRID_DAY_W * 7 + GRID_TOTAL_W + GRID_COMMENT_W + GRID_ACTIONS_W;

// The OT and Leave blocks carry one label column instead of the project grid's seven
// descriptive ones, so they cannot use GRID_LEAD_W without becoming as wide as the project
// table and scrolling like it. They take the day and total widths verbatim and let the label
// column absorb whatever is left, which keeps a day cell the same size in all three blocks —
// the point of the exercise — without forcing a scrollbar onto blocks that fit today.
//
// They previously sized every column as a percentage, which made a day column ~126px against
// the project grid's 78px and left each w-14 box floating in ~70px of gap. Fixed day columns
// are what stop that: a percentage day column grows with the page, a 78px one does not.
// Only reached on a viewport too narrow for the label to keep absorbing slack; above it the
// label column is auto and far wider. 200px is the longest label, "Holiday (Public/National)"
// at text-sm (~168px), plus the cell's px-4.
const GRID_LABEL_MIN_W = 200;
const LOWER_GRID_MIN_W = GRID_LABEL_MIN_W + GRID_DAY_W * 7 + GRID_TOTAL_W;

const parseLocal = (ymd) => {
    const [y, m, d] = String(ymd).split("T")[0].split("-").map(Number);
    return new Date(y, m - 1, d);
};
const toYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const numOr0 = (v) => { const n = parseInt(String(v), 10); return isNaN(n) ? 0 : n; };
// Saturday (6) and Sunday (0) are locked for entry and excluded from hour totals.
const isWeekendYMD = (ymd) => { const g = parseLocal(ymd).getDay(); return g === 0 || g === 6; };

const newRowId = () => (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

// A newly added row starts with every field blank/unselected and is immediately mandatory —
// nothing is carried over from the row it was added beneath.
const makeBlankRow = (dayList) => ({
    rowId: newRowId(),
    // Marks a row the employee added here rather than one that came back from the server, so
    // its project stays re-pickable for as long as it is being edited. Local only — never
    // part of the save payload.
    isNew: true,
    projectId: "",
    projectName: "",
    taskId: "",
    taskDescription: "",
    onsiteOffshore: "",
    clientBillable: "",
    billingLocation: "",
    comment: "",
    assignmentStartDate: null,
    days: dayList.map((d) => ({ date: d.ymd, hours: "" })),
});

// Shared input styling, with the red invalid state applied in one place.
const fieldClass = (invalid, extra = "") =>
    `text-xs border rounded px-1 py-1 outline-none disabled:bg-gray-100 disabled:text-gray-400 ${extra} ${invalid
        ? "border-red-500 bg-red-50 focus:border-red-500"
        : "border-[#E3E8EF] focus:border-brand-yellow"}`;

const formatHourDisplay = (h) => {
    if (h == null || h === "") return "";
    const n = Number(h);
    if (!Number.isFinite(n) || n <= 0) return "";
    return String(Math.round(n));
};

const sanitizeHourDigits = (raw) => String(raw ?? "").replace(/\D/g, "").slice(0, 2);

// Digits only, then clamped to the cell's cap. Returns `clamped` so the caller can tell
// "typed 8" apart from "typed 80 and had it cut to 24" — only the latter earns an error.
const clampHours = (raw, max) => {
    const digits = sanitizeHourDigits(raw);
    if (digits === "") return { hours: "", clamped: false };
    const n = parseInt(digits, 10);
    return n > max ? { hours: String(max), clamped: true } : { hours: digits, clamped: false };
};

const hourInputAllowedKeys = new Set(["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"]);

const handleHourKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (hourInputAllowedKeys.has(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
};

function useNavItems() {
    const clock = (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>);
    return [
        { tab: "dashboard", label: "Dashboard", to: roleDashboardPath(), icon: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>) },
        { tab: "timesheet", label: "Timesheet", to: `${roleDashboardPath()}?tab=timesheet`, icon: clock },
        { tab: "client-timesheet", label: "Client Timesheet", to: clientTimesheetBase(), icon: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline><path d="M8 3h8"></path></svg>) },
        { tab: "leave", label: "Leave Request", to: `${roleDashboardPath()}?tab=leave`, icon: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>) },
    ];
}

export default function ClientTimesheetEntry() {
    const { weekStart } = useParams();
    const navigate = useNavigate();
    const navItems = useNavItems();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [meta, setMeta] = useState({ employeeName: "", weekStartDate: weekStart, weekEndDate: "", status: "DRAFT", earliestAssignmentDate: null, rejectionReason: null, hasProjectContext: false });
    const [projectRows, setProjectRows] = useState([]);
    const [timeOffRows, setTimeOffRows] = useState([]);
    // Whether the sheet differs from what the server last gave us. Gates Resubmit on a
    // rejected week — see the payloadSnapshot effect below.
    const [dirty, setDirty] = useState(false);
    const [baselineToken, setBaselineToken] = useState(0);
    const baselineTokenRef = useRef(-1);
    const baselineRef = useRef(null);
    // The row-text dialog, shared by Comment and Task/Activity Description. `field` is which of
    // the two is open, so one dialog and one save path serve both.
    const [textModal, setTextModal] = useState({ open: false, rowId: null, field: null, text: "" });
    // The leave-reason dialog. Separate state from textModal because it is keyed by leave type
    // rather than by project rowId, and because it opens by itself on blur — mixing the two
    // would make "which dialog is open, and why" ambiguous.
    const [leaveModal, setLeaveModal] = useState({ open: false, type: null, text: "" });
    // The pending prompt, and a handle on the newest maybePromptLeaveReason for it to call.
    const leaveReasonTimerRef = useRef(null);
    const latestLeavePromptRef = useRef(null);
    // Projects the employee may log against — the options for the Project ID cell on a newly
    // added row. Project ID/Name are owned by the assignment, never typed.
    const [assignmentOptions, setAssignmentOptions] = useState([]);
    // Field-level errors stay hidden until the first Submit attempt, so a half-filled row
    // isn't screaming red while it is still being typed. Drafts are never gated.
    const [showErrors, setShowErrors] = useState(false);
    // Per-cell "you hit the cap" messages, keyed by cell. Shown as soon as a value is
    // clamped (not gated on Submit) — the number visibly changed under the user, so the
    // reason has to appear immediately. Cleared as soon as that cell takes a valid value.
    const [capNotices, setCapNotices] = useState({});

    const todayYMD = toYMD(new Date());

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
    };

    // 7 day columns from the week start (Saturday → Friday).
    const days = useMemo(() => {
        const start = parseLocal(meta.weekStartDate || weekStart);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start); d.setDate(start.getDate() + i);
            return { ymd: toYMD(d), dom: d.getDate(), wd: WD[d.getDay()] };
        });
    }, [meta.weekStartDate, weekStart]);

    const applyDetail = (dto) => {
        const mapDays = (arr) => (arr || []).map((d) => ({
            date: String(d.date).split("T")[0],
            hours: formatHourDisplay(d.hours),
        }));
        const serverRows = (dto.projectRows || []).map((r) => ({
            rowId: r.rowId || newRowId(),
            projectId: r.projectId || "",
            projectName: r.projectName || "",
            taskId: r.taskId || "",
            taskDescription: r.taskDescription || "",
            // Left blank rather than defaulted when the assignment carries nothing, so a
            // missing value is something the employee has to choose, not a silent guess.
            onsiteOffshore: r.onsiteOffshore || "",
            clientBillable: r.clientBillable || "",
            billingLocation: r.billingLocation && r.billingLocation !== "DFLT" ? r.billingLocation : "",
            comment: r.comment || "",
            assignmentStartDate: r.assignmentStartDate ? String(r.assignmentStartDate).split("T")[0] : null,
            days: mapDays(r.days),
        }));
        // Whether this employee has anything to log against at all — an active assignment, or
        // rows already saved under an assignment that has since ended.
        const hasProjectContext = Boolean(dto.earliestAssignmentDate) || serverRows.length > 0;
        setMeta({
            employeeName: dto.employeeName || "",
            weekStartDate: String(dto.weekStartDate).split("T")[0],
            weekEndDate: String(dto.weekEndDate).split("T")[0],
            status: dto.status || "DRAFT",
            earliestAssignmentDate: dto.earliestAssignmentDate ? String(dto.earliestAssignmentDate).split("T")[0] : null,
            rejectionReason: dto.rejectionReason || null,
            // Drives the "no client project" empty state, which can no longer be inferred from
            // the row count now that an empty sheet is seeded with a blank row.
            hasProjectContext,
        });
        // The sheet always holds at least one project row (never zero) — but only for an
        // employee who actually has a project to log against.
        setProjectRows(serverRows.length === 0 && hasProjectContext ? [makeBlankRow(days)] : serverRows);
        setTimeOffRows(TIMEOFF_ORDER.map((type) => {
            const found = (dto.timeOffRows || []).find((t) => (t.type || "").toUpperCase() === type);
            return {
                type,
                days: found ? mapDays(found.days) : days.map((d) => ({ date: d.ymd, hours: "" })),
                // Blank for a week saved before leave reasons existed, and for a type with no
                // leave. Only rows carrying hours are ever asked for one.
                reason: found?.reason || "",
            };
        }));
        // Everything above is now the sheet's saved state. Bumping the token tells the effect
        // below to re-baseline against it, so "changed" means changed since this load — not
        // since the page first opened. Saving a draft re-applies the server's echo and
        // therefore re-baselines too, which is correct: those edits are no longer unsaved.
        setBaselineToken((t) => t + 1);
    };

    const fetchDetail = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api(`/api/client-timesheets/weeks/${weekStart}`);
            if (res.ok) {
                const json = await res.json().catch(() => ({}));
                if (json.data) applyDetail(json.data);
            } else {
                toast.error("Could not load the week.");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [weekStart]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);

    // Active client project assignments — the pick list for a newly added row.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await api("/api/client-project-assignments/my");
                if (!res.ok || cancelled) return;
                const json = await res.json().catch(() => ({}));
                if (cancelled) return;
                // An employee can hold more than one assignment to the same project; the
                // dropdown lists each project once.
                const byProject = new Map();
                (Array.isArray(json.data) ? json.data : []).forEach((a) => {
                    if (a.projectId && !byProject.has(a.projectId)) byProject.set(a.projectId, a);
                });
                setAssignmentOptions([...byProject.values()]);
            } catch (err) {
                console.error(err);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // A week stays editable until the admin takes a final decision. DRAFT, PENDING (submitted,
    // awaiting review) and REJECTED all remain open, so the employee can revise and resubmit as
    // many times as they need. Only APPROVED locks the week — matching the backend guard in
    // ClientTimesheetWeekService.persist().
    const weekEditable = meta.status !== "APPROVED";

    // Total leave booked on a date, summed across every Holiday/Time off row — so a split
    // like 4h Paid Sick + 4h PTO on one date counts as the same full day as a single 8h row.
    const dayHoursFor = (rows, ymd) =>
        rows.reduce((s, r) => s + numOr0(r.days.find((x) => x.date === ymd)?.hours), 0);

    // Dates whose leave fills the whole 8h day. Project hours and OT are locked for these.
    const isFullLeaveDay = (ymd) => dayHoursFor(timeOffRows, ymd) >= FULL_DAY_LEAVE_HOURS;

    // Gate for the Holiday/Time off cells. Deliberately does NOT consider full-day leave:
    // these are the inputs the employee uses to drop the leave back below 8, so locking
    // them at 8 would be a one-way trap.
    const isDayEditable = (ymd, rowGate) => {
        if (!weekEditable) return false;
        if (!rowGate) return false;
        if (isWeekendYMD(ymd)) return false; // Saturday/Sunday are locked
        return ymd >= rowGate && ymd <= todayYMD;
    };

    // Gate for the project (Regular Hours) cells — additionally locked once the date's
    // leave fills the whole 8h day. Unlocks again the moment leave drops below 8.
    const isProjectDayEditable = (ymd, rowGate) =>
        isDayEditable(ymd, rowGate) && !isFullLeaveDay(ymd);

    // Cell keys for capNotices — project cells are identified by row, leave cells by type,
    // and the row's Billing Location box by row.
    const projectCellKey = (rowId, date) => `p:${rowId}:${date}`;
    const leaveCellKey = (type, date) => `t:${type}:${date}`;
    const billingLocationKey = (rowId) => `bl:${rowId}`;
    // Passing null clears the notice, so every keystroke either raises or retires it.
    const noteCap = (key, message) => setCapNotices((prev) => {
        if (!message) {
            if (!(key in prev)) return prev; // no state churn on the common path
            const next = { ...prev };
            delete next[key];
            return next;
        }
        return { ...prev, [key]: message };
    });

    /**
     * The leave type already holding hours on this date, ignoring one row — or null when the
     * date is still free. Drives both the guard in setTimeOffDay and the disabled state of the
     * other four cells in that column, so the block and the reason for it come from one place.
     */
    const otherLeaveTypeOn = (date, exceptRowIdx) => {
        const claimed = timeOffRows.find((r, i) => {
            if (i === exceptRowIdx) return false;
            return numOr0(r.days.find((d) => d.date === date)?.hours) > 0;
        });
        return claimed ? claimed.type : null;
    };

    const setProjectDay = (rowId, dayIdx, value) => {
        const { hours, clamped } = clampHours(value, MAX_HOURS_PER_DAY);
        const date = projectRows.find((r) => r.rowId === rowId)?.days?.[dayIdx]?.date;
        setProjectRows((prev) => prev.map((r) => r.rowId !== rowId ? r : {
            ...r, days: r.days.map((d, j) => j !== dayIdx ? d : { ...d, hours }),
        }));
        noteCap(projectCellKey(rowId, date), clamped ? `Max ${MAX_HOURS_PER_DAY} hrs/day` : null);
    };
    const setTimeOffDay = (rowIdx, dayIdx, value) => {
        const date = timeOffRows[rowIdx]?.days?.[dayIdx]?.date;

        // One leave type per date. A day is taken as sick OR holiday OR PTO — not carved up
        // between them — so the moment one type carries hours for a date, the other four cells
        // in that column are disabled. The rule is enforced by the cell being unreachable, not
        // by complaining after the fact: there is nothing to explain about a box that cannot be
        // clicked, and an error under a greyed-out field reads as a fault rather than a rule.
        // This is the guard behind that, for a value arriving any other way. Silent by design.
        if (otherLeaveTypeOn(date, rowIdx)) {
            return;
        }

        // Within the one permitted type, a day still cannot hold more than 8 hours of leave.
        const { hours, clamped } = clampHours(value, MAX_LEAVE_HOURS_PER_DAY);
        noteCap(
            leaveCellKey(timeOffRows[rowIdx]?.type, date),
            clamped ? `Max ${MAX_LEAVE_HOURS_PER_DAY} hrs/day for leave` : null
        );
        const nextRows = timeOffRows.map((r, i) => i !== rowIdx ? r : {
            ...r, days: r.days.map((d, j) => j !== dayIdx ? d : { ...d, hours }),
        });
        setTimeOffRows(nextRows);

        // Ask why once the typing settles, rather than waiting for the cell to lose focus.
        // Armed on every change including a clear: the guard re-reads the row when the timer
        // fires, so a cell emptied again simply asks nothing.
        scheduleLeaveReasonPrompt(rowIdx);

        // This date's other four cells just changed state — disabled if this row now holds
        // hours, released if it was cleared. Either way any notice still sitting under them is
        // stale: a disabled cell must carry no message at all, and a re-enabled one starts
        // clean. Their own "Max 8 hrs/day" text, raised before this row claimed the date, is
        // exactly what would otherwise be stranded there.
        timeOffRows.forEach((r) => {
            if (r.type !== timeOffRows[rowIdx]?.type) noteCap(leaveCellKey(r.type, date), null);
        });

        // Once leave fills the day, any project hours already typed for that date are
        // cleared — the cells are about to lock, so leaving a stale value behind would
        // keep counting toward the totals with no way to edit it out.
        if (!date) return;
        const ymd = date;
        if (dayHoursFor(nextRows, ymd) >= FULL_DAY_LEAVE_HOURS) {
            setProjectRows((rows) => rows.map((r) => ({
                ...r,
                days: r.days.map((d) => (d.date === ymd ? { ...d, hours: "" } : d)),
            })));
        }
    };
    const setRowField = (rowId, field, value) => {
        setProjectRows((prev) => prev.map((r) => r.rowId !== rowId ? r : { ...r, [field]: value }));
    };

    // Billing Location filters what it accepts instead of taking the keystroke and complaining
    // later. Dropped characters are called out immediately — the input visibly refused what was
    // typed or pasted, so leaving that silent reads as a broken field. Hitting the length cap
    // needs no notice here: CharCounter already says "limit reached".
    const setBillingLocation = (rowId, value) => {
        const raw = String(value ?? "");
        const letters = raw.replace(BILLING_LOCATION_DISALLOWED, "");
        setRowField(rowId, "billingLocation", letters.slice(0, MAX_BILLING_LOCATION));
        noteCap(billingLocationKey(rowId), letters !== raw ? "Letters and spaces only" : null);
    };

    // Picking the project also stamps the row's own day gate. Without it the row would fall
    // back to the employee's earliest assignment date and open day cells this project can't
    // be logged against — which the server then rejects on save.
    const selectProject = (rowId, projectId) => {
        const a = assignmentOptions.find((o) => o.projectId === projectId);
        setProjectRows((prev) => prev.map((r) => r.rowId !== rowId ? r : {
            ...r,
            projectId: a ? a.projectId : "",
            projectName: a ? (a.projectName || "") : "",
            assignmentStartDate: a && a.assignmentStartDate ? String(a.assignmentStartDate).split("T")[0] : null,
        }));
    };

    // A new row is blank and unselected throughout — never a copy of the row above it — and
    // is mandatory from the moment it appears.
    const addRow = (rowIdx) => {
        setProjectRows((prev) => {
            const next = [...prev];
            next.splice(rowIdx + 1, 0, makeBlankRow(days));
            return next;
        });
    };
    // The sheet must always keep at least one project row; the last one cannot be deleted.
    // Guarded here as well as on the disabled button so no other caller can empty the sheet.
    const removeRow = (rowId) =>
        setProjectRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.rowId !== rowId)));

    // Weekend (Sat/Sun) hours are locked and excluded from every hour total.
    const rowTotal = (row) => row.days.reduce((s, d) => s + (isWeekendYMD(d.date) ? 0 : numOr0(d.hours)), 0);
    const totalBillable = projectRows.filter((r) => r.clientBillable !== "NON_BILLABLE").reduce((s, r) => s + rowTotal(r), 0);
    const totalNonBillable = projectRows.filter((r) => r.clientBillable === "NON_BILLABLE").reduce((s, r) => s + rowTotal(r), 0);
    const totalProject = totalBillable + totalNonBillable;
    const totalTimeOff = timeOffRows.reduce((s, r) => s + rowTotal(r), 0);

    // ── Daily Regular / OT split ────────────────────────────────────────────────
    // Every weekday carries 8 hours of Regular capacity, shared between leave taken and
    // project hours worked. Leave consumes the capacity but is NOT itself Regular:
    //   full-day leave (>= 8h) → Regular 0, OT 0 — the day is spent, nothing can be worked
    //   otherwise              → Regular = min(worked, 8 - leave)
    //                            OT      = worked beyond that remaining capacity
    // Weekends are locked for entry and are never Regular or OT.
    //
    // Regular used to be `leave + min(worked, capacity)`, which put the leave hours inside
    // Regular while the summary also reported them as Holiday/Time off. The three category
    // totals therefore could not be added up — the same leave sat in two of them — which is
    // why Grand Total never matched the lines above it. Regular is now worked hours only, so
    // Regular + OT + Time off is a straight sum with nothing counted twice.
    //
    // Mirrored server-side in ClientTimesheetWeekService.applyRegularAndOvertime — the saved
    // figures are the server's, so the two must stay in step.
    const dayBreakdown = days.map((d) => {
        if (isWeekendYMD(d.ymd)) return { ymd: d.ymd, wd: d.wd, dom: d.dom, regular: 0, ot: 0, locked: false };
        const worked = dayHoursFor(projectRows, d.ymd);
        const leave = dayHoursFor(timeOffRows, d.ymd);
        if (leave >= FULL_DAY_LEAVE_HOURS) {
            // Full-day leave fills the day's quota outright; no overtime is earned, and
            // both this cell and the day's project cells are locked.
            return { ymd: d.ymd, wd: d.wd, dom: d.dom, regular: 0, ot: 0, locked: true };
        }
        const capacity = FULL_DAY_LEAVE_HOURS - leave;
        return {
            ymd: d.ymd,
            wd: d.wd,
            dom: d.dom,
            regular: Math.min(worked, capacity),
            ot: Math.max(0, worked - capacity),
            locked: false,
        };
    });
    const totalOT = dayBreakdown.reduce((s, d) => s + d.ot, 0);
    const totalRegular = dayBreakdown.reduce((s, d) => s + d.regular, 0);
    // Hours actually worked, leave excluded — the figure a client is billed against.
    const totalWorking = totalRegular + totalOT;
    // Every hour the week accounts for. A straight sum of the three categories shown above
    // it, which is only sound because Regular no longer carries the leave hours.
    const grandTotal = totalWorking + totalTimeOff;

    // Any date the employee has touched has to account for a full 8-hour day before the week
    // can be submitted. The day's total is Regular + OT + leave — Regular carries worked hours
    // only now, so the leave has to be added back here; it used to be inside Regular already.
    // One rule covers every way a day can fall short, in either direction:
    //   4h of sick leave and nothing else → 4, short by 4
    //   6h on a project and nothing else  → 6, short by 2
    //   3h leave + 3h worked              → 6, short by 2
    // "Touched" means at least one non-zero entry: a date left completely blank (not worked,
    // no leave claimed) is untouched and deliberately left alone, as before. Full-day leave
    // (>= 8h) is complete by definition. Days past 8 are overtime, not errors, so the test is
    // "short of 8" rather than "not exactly 8" — the daily cap is what limits the top end.
    // Weekends are locked for entry and never counted.
    const dayLogged = (d) => d.regular + d.ot + dayHoursFor(timeOffRows, d.ymd);
    const incompleteDays = dayBreakdown
        .filter((d) => !isWeekendYMD(d.ymd) && dayLogged(d) > 0 && dayLogged(d) < FULL_DAY_LEAVE_HOURS)
        .map((d) => {
            const logged = dayLogged(d);
            return {
                label: `${parseLocal(d.ymd).toLocaleDateString("en-US", { weekday: "long" })} ${d.dom}`,
                logged,
                missing: FULL_DAY_LEAVE_HOURS - logged,
            };
        });

    const incompleteDayMessage = () => {
        if (incompleteDays.length === 1) {
            const d = incompleteDays[0];
            return `${d.label} only totals ${d.logged} hours — please add ${d.missing} more hours (regular, OT, or leave) before submitting.`;
        }
        // Every offending date is listed, not just the first one found.
        const list = incompleteDays.map((d) => `${d.label} (${d.logged} of ${FULL_DAY_LEAVE_HOURS})`).join(", ");
        return `These dates don't total ${FULL_DAY_LEAVE_HOURS} hours — please add the missing hours (regular, OT, or leave) before submitting: ${list}.`;
    };

    // ── Daily hour caps ─────────────────────────────────────────────────────────
    // The per-cell clamp can't catch these: eight project rows of 8h each are individually
    // legal but add up to 64 hours in one day. Checked as a total per date, so however the
    // rows are split the day still has to fit in 24 hours (leave included — leave and worked
    // hours occupy the same day). Mirrored server-side in validateEntries.
    const dayCapIssues = days
        .filter((d) => !isWeekendYMD(d.ymd))
        .map((d) => {
            const worked = dayHoursFor(projectRows, d.ymd);
            const leave = dayHoursFor(timeOffRows, d.ymd);
            return { ...d, worked, leave, total: worked + leave };
        })
        .filter((d) => d.total > MAX_HOURS_PER_DAY || d.leave > MAX_LEAVE_HOURS_PER_DAY);

    const dayLabel = (d) => `${parseLocal(d.ymd).toLocaleDateString("en-US", { weekday: "long" })} ${d.dom}`;

    const dayCapMessage = () => {
        const parts = dayCapIssues.map((d) => d.leave > MAX_LEAVE_HOURS_PER_DAY
            ? `${dayLabel(d)} has ${d.leave} leave hours (max ${MAX_LEAVE_HOURS_PER_DAY})`
            : `${dayLabel(d)} totals ${d.total} hours (max ${MAX_HOURS_PER_DAY})`);
        return `A day cannot exceed its hour limit — ${parts.join(", ")}.`;
    };

    // ── Row-level required-field validation ─────────────────────────────────────
    // Every field of every project row is mandatory, plus hours on at least one day.
    // Recomputed on each render (not memoised) so the red highlighting clears the moment a
    // field is filled in. Blocks Submit/Resubmit only — a draft is allowed to be incomplete.
    const rowIssues = {};
    projectRows.forEach((row) => {
        const missing = {};
        REQUIRED_ROW_FIELDS.forEach(({ key }) => {
            if (!String(row[key] ?? "").trim()) missing[key] = true;
        });
        // "at least the hours for the days being logged" — a row with an identity but no
        // hours anywhere is incomplete. Skipped when the row has no enterable day at all
        // (every weekday gated out or filled by full-day leave): the grid forbids the input,
        // so requiring it would leave the employee with no way to submit.
        const gate = row.assignmentStartDate || meta.earliestAssignmentDate;
        const anyDayOpen = row.days.some((d) => isProjectDayEditable(d.date, gate));
        const anyHours = row.days.some((d) => !isWeekendYMD(d.date) && numOr0(d.hours) > 0);
        if (anyDayOpen && !anyHours) missing.hours = true;
        if (Object.keys(missing).length > 0) rowIssues[row.rowId] = missing;
    });
    const incompleteRowCount = Object.keys(rowIssues).length;

    // ── Leave reason: required on any leave row that carries hours ──────────────
    // Same rule and same timing as the project-row fields above — Submit only, never Save, so
    // a draft can be parked half-filled. Mirrored server-side by
    // ClientTimesheetWeekService.requireLeaveReasons, which is the actual contract.
    const rowHasLeaveHours = (r) => r.days.some((d) => numOr0(d.hours) > 0);
    const leaveRowsMissingReason = timeOffRows.filter(
        (r) => rowHasLeaveHours(r) && !String(r.reason ?? "").trim()
    );
    const leaveReasonIssue = (type) =>
        showErrors && leaveRowsMissingReason.some((r) => r.type === type);
    // Errors are only painted after a Submit attempt.
    const issueFor = (rowId, key) => showErrors && Boolean(rowIssues[rowId]?.[key]);

    // A project row is "empty" when it has no identity and no hours — never persist these
    // (keeps blank/duplicate rows out of the saved draft).
    const isEmptyProjectRow = (r) =>
        !r.projectId && !r.projectName && !r.taskId && !r.taskDescription &&
        !r.billingLocation && !r.comment && r.days.every((d) => numOr0(d.hours) === 0);

    // Regular/OT are sent for reference only — the server recomputes them from the same
    // rules in applyTotals() and persists its own figures, so a tampered payload can't
    // change what the admin sees.
    // ── "Has anything actually changed?" ────────────────────────────────────────
    // A rejected week may only be resubmitted once the employee has edited something —
    // resubmitting it untouched sends the admin back exactly what they rejected.
    //
    // The comparison is against buildPayload(), which is precisely what a submit would send:
    // if two states serialise the same, submitting either is the same request, so there is
    // nothing to resubmit. Deriving it from the payload rather than tracking a flag on every
    // setter means no edit path can forget to mark the sheet dirty, and — because it compares
    // values rather than counting keystrokes — typing a 7 over a 7, or typing a character and
    // deleting it again, correctly leaves the sheet clean.
    const buildPayload = () => ({
        weekStartDate: meta.weekStartDate,
        weekEndDate: meta.weekEndDate,
        totalRegularHours: totalRegular,
        totalOtHours: totalOT,
        projectRows: projectRows.filter((r) => !isEmptyProjectRow(r)).map((r) => ({
            rowId: r.rowId,
            projectId: r.projectId, projectName: r.projectName, taskId: r.taskId,
            taskDescription: r.taskDescription, onsiteOffshore: r.onsiteOffshore,
            clientBillable: r.clientBillable, billingLocation: r.billingLocation, comment: r.comment,
            assignmentStartDate: r.assignmentStartDate,
            days: r.days.map((d) => ({ date: d.date, hours: numOr0(d.hours) })),
        })),
        timeOffRows: timeOffRows.map((r) => ({
            type: r.type, reason: r.reason || "",
            days: r.days.map((d) => ({ date: d.date, hours: numOr0(d.hours) })),
        })),
    });

    const payloadSnapshot = JSON.stringify(buildPayload());
    // Re-baseline when applyDetail bumped the token, otherwise compare. Keyed on the token as
    // well as the snapshot because a save can echo back a byte-identical sheet: the snapshot
    // alone would not change, the effect would not run, and the pending re-baseline would land
    // on the NEXT edit instead — quietly adopting that edit as the saved state.
    useEffect(() => {
        if (baselineTokenRef.current !== baselineToken) {
            baselineTokenRef.current = baselineToken;
            baselineRef.current = payloadSnapshot;
            setDirty(false);
            return;
        }
        setDirty(baselineRef.current !== null && payloadSnapshot !== baselineRef.current);
    }, [payloadSnapshot, baselineToken]);

    // Only the rejected sheet is gated. A draft is submitted for the first time, so there is
    // nothing to compare it against, and Save stays available throughout either way.
    const resubmitBlockedUnchanged = meta.status === "REJECTED" && !dirty;

    // Upsert the whole week (all project rows + time-off rows) as a DRAFT. Save and Update
    // Totals both go through here, so the timesheet stays a single draft record (overwrite,
    // never a new submission) until the user clicks Submit.
    const persistDraft = async (successMsg) => {
        setSaving(true);
        try {
            const res = await api("/api/client-timesheets/save-draft", { method: "POST", body: JSON.stringify(buildPayload()) });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
                toast.success(successMsg);
                if (json.data) applyDetail(json.data);
            } else {
                const detail = json.error || json.message || "";
                console.error(`Client timesheet save failed (${res.status}):`, detail);
                toast.error(`Couldn't save, please try again.${detail ? ` (${detail})` : ""}`);
            }
        } catch (err) { console.error(err); toast.error("Couldn't save, please try again."); } finally { setSaving(false); }
    };

    const handleSave = () => persistDraft("Draft saved.");
    // Update Totals recalculates live (below) AND syncs the latest entered values to the draft.
    const handleUpdateTotals = () => persistDraft("Totals updated and saved.");

    // Submit re-persists the whole week and then flips its status, so a validation failure
    // anywhere in the payload leaves it a draft. Success is reported only after the server
    // echoes back a submitted status — never optimistically off the click alone, which is
    // how a failed submit previously looked like nothing had happened.
    const handleSubmit = async () => {
        // Blocks Submit/Resubmit only — drafts stay work-in-progress and are never gated.
        // Checked before the request so the week is never written with a submitted status.

        // Mirrors the disabled state on the button, for the case where a click lands before
        // React has re-rendered it. Checked before setShowErrors so an untouched rejected week
        // does not light up in red for fields the employee has not been asked to change.
        if (resubmitBlockedUnchanged) {
            toast.error("Nothing has changed since this week was rejected — update it before resubmitting.");
            return;
        }

        // Reveal the field-level errors from here on, whatever the outcome below.
        setShowErrors(true);
        // Checked before the required-field pass: an over-24h day is a hard data error, and
        // saying so is more useful than "fill in the blanks".
        if (dayCapIssues.length > 0) {
            toast.error(dayCapMessage());
            return;
        }
        if (incompleteRowCount > 0) {
            toast.error(incompleteRowCount === 1
                ? "A project row is incomplete — fill the highlighted fields before submitting."
                : `${incompleteRowCount} project rows are incomplete — fill the highlighted fields before submitting.`);
            return;
        }
        if (incompleteDays.length > 0) {
            toast.error(incompleteDayMessage());
            return;
        }
        // Named rather than counted: a week can use several leave types and "a reason is
        // missing" would not say which row to open.
        if (leaveRowsMissingReason.length > 0) {
            const names = leaveRowsMissingReason.map((r) => TIMEOFF_LABELS[r.type]).join(", ");
            toast.error(`Please give a reason for your leave — ${names} ${
                leaveRowsMissingReason.length === 1 ? "has" : "have"} hours but no reason.`);
            return;
        }
        setSaving(true);
        try {
            const res = await api(`/api/client-timesheets/weeks/${weekStart}/submit`, { method: "PATCH", body: JSON.stringify(buildPayload()) });
            const json = await res.json().catch(() => ({}));
            const detail = json.error || json.message || "";
            if (!res.ok) {
                console.error(`Client timesheet submit failed (${res.status}):`, detail);
                toast.error(`Couldn't submit, please try again.${detail ? ` (${detail})` : ""}`);
                return;
            }
            if (json.data) applyDetail(json.data);
            const savedStatus = String(json.data?.status || "").toUpperCase();
            const submitted = savedStatus && savedStatus !== "DRAFT" && savedStatus !== "NOT_STARTED";
            if (submitted) {
                setShowErrors(false);
                toast.success("Submitted for approval.");
            } else {
                // The request succeeded but the week did not actually leave draft — never
                // tell the employee it is with the admin when the admin queue won't show it.
                console.error("Client timesheet submit returned a non-submitted status:", savedStatus, json);
                toast.error("Couldn't submit — this week is still a draft. Please try again.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Couldn't submit, please try again.");
        } finally { setSaving(false); }
    };

    /**
     * Opens the row-text dialog on one of the two long-text fields. Both outgrow their column
     * — a 256-character description in a 190px cell reads no better than a comment did — so
     * they share one dialog, one piece of state and one save path rather than each growing
     * their own.
     */
    const openRowText = (rowId, field) => {
        const row = projectRows.find((r) => r.rowId === rowId);
        setTextModal({ open: true, rowId, field, text: row?.[field] || "" });
    };
    const closeRowText = () => setTextModal({ open: false, rowId: null, field: null, text: "" });

    /** Drops a pending prompt, so it cannot reopen a dialog the employee has just dealt with. */
    const cancelLeaveReasonPrompt = () => {
        if (leaveReasonTimerRef.current) {
            clearTimeout(leaveReasonTimerRef.current);
            leaveReasonTimerRef.current = null;
        }
    };

    // A pending timer outliving the page would fire into an unmounted component.
    useEffect(() => cancelLeaveReasonPrompt, []);

    /**
     * Asks for the reason once the typing settles, without waiting for the cell to lose
     * focus — an employee who enters their hours and stops is asked there and then.
     *
     * Each keystroke replaces the pending timer, so a burst of typing asks once at the end
     * rather than once per key. It defers to maybePromptLeaveReason for whether to ask at
     * all, reached through a ref because the timer lands several hundred milliseconds after
     * the keystroke that armed it: the guard captured back then would be looking at a sheet
     * the employee may since have typed into, cleared, or answered from the row icon.
     */
    const scheduleLeaveReasonPrompt = (rowIdx) => {
        cancelLeaveReasonPrompt();
        leaveReasonTimerRef.current = setTimeout(() => {
            leaveReasonTimerRef.current = null;
            latestLeavePromptRef.current?.(rowIdx);
        }, LEAVE_REASON_PROMPT_DELAY_MS);
    };

    /**
     * The leave-reason dialog, opened by the row's icon, by leaving a leave cell that has
     * just taken hours, or by the settle-timer above.
     */
    const openLeaveReason = (type) => {
        cancelLeaveReasonPrompt();
        const row = timeOffRows.find((r) => r.type === type);
        setLeaveModal({ open: true, type, text: row?.reason || "" });
    };
    const closeLeaveReason = () => setLeaveModal({ open: false, type: null, text: "" });
    const saveLeaveReason = () => {
        if (leaveModal.type) {
            const text = leaveModal.text;
            setTimeOffRows((rows) => rows.map((r) => r.type !== leaveModal.type ? r : { ...r, reason: text }));
        }
        closeLeaveReason();
    };

    /**
     * Asks for the reason once the employee has finished typing hours and moved on.
     *
     * On blur rather than on change: prompting mid-keystroke would throw a dialog over the grid
     * while they are still entering the number, and stealing focus would make the field
     * impossible to finish typing in. It fires only when the row has just become a leave row
     * with no reason yet — an employee who already answered is not asked again, and clearing a
     * row back to zero asks nothing.
     */
    const maybePromptLeaveReason = (rowIdx) => {
        if (!weekEditable) return;
        const row = timeOffRows[rowIdx];
        if (!row || leaveModal.open) return;
        if (!rowHasLeaveHours(row)) return;
        if (String(row.reason ?? "").trim()) return;
        openLeaveReason(row.type);
    };

    // Republished every render so a pending prompt runs the guard against the sheet as it is
    // when the timer fires, not as it was when the key went down.
    useEffect(() => {
        latestLeavePromptRef.current = maybePromptLeaveReason;
    });
    const saveRowText = () => {
        if (textModal.rowId && textModal.field) {
            setRowField(textModal.rowId, textModal.field, textModal.text);
        }
        closeRowText();
    };

    const statusMeta = clientTimesheetStatusMeta(meta.status);
    const noAssignment = !meta.hasProjectContext;

    // One day's hour box. Used by both the project (regular hours) and the Holiday/Time off
    // (leave hours) grids, so the unit reads identically on every entry cell.
    // "hrs" sits in the placeholder: it names the unit on an empty box without eating any of
    // the two digits the field accepts, and the typed number replaces it. aria-label carries
    // the unit for screen readers, which don't reliably announce a placeholder.
    // `max` is the cell's hour cap (24 for worked hours, 8 for leave). The clamp lives in the
    // onChange handlers so it applies to typing and pasting alike — the max attribute alone
    // does nothing on a text input, it is here for assistive tech and for the record.
    // `lockReason` names a third way a cell can be closed — currently "another leave type
    // already holds this date" — and wins over the two generic reasons below when given.
    // `onBlur` is how the leave grid asks for a reason once the employee has finished typing
    // and moved on; the project grid passes nothing and behaves exactly as before.
    const dayCell = (ymd, value, editable, onChange, lockedByFullLeave = false, invalid = false, max = MAX_HOURS_PER_DAY, capNotice = null, lockReason = null, onBlur = null) => (
        <>
            <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={2}
                max={max}
                value={value}
                disabled={!editable}
                placeholder="hrs"
                aria-label={`Hours for ${ymd} (maximum ${max})`}
                onKeyDown={handleHourKeyDown}
                onBlur={onBlur || undefined}
                onChange={(e) => onChange(e.target.value)}
                onPaste={(e) => {
                    e.preventDefault();
                    onChange(e.clipboardData.getData("text"));
                }}
                title={editable
                    ? undefined
                    : lockReason
                        ? lockReason
                        : lockedByFullLeave
                            ? "Not available — full-day leave is booked for this date"
                            : "Not available — you were not assigned before this date"}
                className={`w-14 text-center text-xs font-semibold rounded border px-1 py-1.5 outline-none transition-all placeholder:font-medium placeholder:text-brand-text/35 ${!editable
                    ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                    : invalid
                        ? "bg-red-50 border-red-500 focus:border-red-500 text-brand-text"
                        : "bg-white border-[#E3E8EF] focus:border-brand-yellow text-brand-text"}`}
            />
            {/* Raised the moment a value is clamped, so the user sees why the number they typed
            changed. role="alert" because it appears in response to their keystroke. Allowed
            to wrap: the day columns are a fixed width now, and "Max 8 hrs/day for leave" is
            wider than one. */}
            {capNotice && (
                <p role="alert" className="mt-1 text-[9px] font-bold text-red-600 leading-tight">
                    {capNotice}
                </p>
            )}
        </>
    );

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="bg-white py-4 px-4 md:px-8 border-b border-[#E3E8EF] shadow-sm flex items-center gap-3">
                    <button onClick={() => navigate(clientTimesheetBase())} className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#F1EFE8] text-[#5F5E5A] hover:bg-[#E3E8EF] transition-all" title="Back" aria-label="Back">
                        <ArrowLeft size={18} />
                    </button>
                    <h1 className="text-xl font-black text-brand-text tracking-tight">Time Entry Page</h1>
                    <span className={`ml-2 text-xs font-bold ${statusMeta.text}`}>{statusMeta.label}</span>
                </header>

                <div className="flex-1 overflow-auto p-4 md:p-8">
                    {loading ? (
                        <div className="py-20 text-center text-brand-text/30 font-bold uppercase tracking-widest text-xs animate-pulse">Loading...</div>
                    ) : (
                        <>
                            {/* Top meta */}
                            <div className="mb-6">
                                <h2 className="text-lg font-bold text-brand-text">{meta.employeeName}</h2>
                                <div className="flex flex-wrap gap-x-10 gap-y-1 mt-2 text-sm text-brand-text/70">
                                    <span><span className="font-semibold text-brand-text/50">Period End Date:</span> {meta.weekEndDate}</span>
                                </div>
                            </div>

                            {/* Why the week came back, shown above the grid the employee is
                                about to correct and resubmit. */}
                            {meta.rejectionReason && (
                                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                                    <p className="text-xs font-black uppercase tracking-widest text-red-600">Rejection reason</p>
                                    <p className="mt-1 text-sm text-red-700 leading-relaxed">{meta.rejectionReason}</p>
                                </div>
                            )}

                            {noAssignment ? (
                                <div className="bg-white rounded-xl border border-dashed border-[#E3E8EF] p-16 text-center">
                                    <p className="text-base font-bold text-brand-text">No client project to log against</p>
                                    <p className="text-sm text-brand-text/40 mt-2">You don't have an active client project assignment. Contact your admin to be assigned before entering hours.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Project table — the only block that scrolls. It carries the
                                        seven descriptive columns (Project ID through Billing
                                        Location) on top of the week, so it cannot fit; the OT and
                                        Holiday blocks below hold nothing but days and therefore
                                        should never make the employee drag to reach Friday. */}
                                    <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm overflow-x-auto">
                                        <table className="w-full text-left border-collapse table-fixed" style={{ minWidth: GRID_MIN_W }}>
                                            {/* Same widths as the OT and Leave grids below — see GRID_* */}
                                            <colgroup>
                                                {GRID_IDENTITY_COLS.map((w, i) => <col key={`ident-${i}`} style={{ width: w }} />)}
                                                {days.map((d) => <col key={d.ymd} style={{ width: GRID_DAY_W }} />)}
                                                <col style={{ width: GRID_TOTAL_W }} />
                                                <col style={{ width: GRID_COMMENT_W }} />
                                                <col style={{ width: GRID_ACTIONS_W }} />
                                            </colgroup>
                                            <thead>
                                                {/* break-words is the safety net for this row: the table is table-fixed
                                                    with hard column widths, so a header too wide for its column has
                                                    nowhere to go and paints over its neighbour instead of being clipped.
                                                    overflow-wrap inherits, so declaring it once here covers every th. */}
                                                <tr className="bg-brand-blue-dark text-white text-[11px] uppercase tracking-wide break-words">
                                                    {/* Every project column is mandatory — marked so the employee
                                                        knows before Submit rather than after it is blocked. */}
                                                    <th className="px-3 py-3 font-bold">Project ID <span className="text-red-300">*</span></th>
                                                    <th className="px-3 py-3 font-bold">Project Name <span className="text-red-300">*</span></th>
                                                    <th className="px-3 py-3 font-bold">Task/Activity ID <span className="text-red-300">*</span></th>
                                                    <th className="px-3 py-3 font-bold">Task/Activity Description <span className="text-red-300">*</span></th>
                                                    {/* The slash is not a line-break opportunity, so "Onsite/Offshore"
                                                        is one 15-character token that overran this column and ran
                                                        straight into "Client Billable". <wbr> lets it break after the
                                                        slash — "ONSITE/" over "OFFSHORE" — which fits the column as it
                                                        stands, so the widths (and the day-column alignment the OT and
                                                        Leave grids share through GRID_LEAD_W) stay untouched. */}
                                                    <th className="px-3 py-3 font-bold">Onsite/<wbr />Offshore <span className="text-red-300">*</span></th>
                                                    <th className="px-3 py-3 font-bold">Client Billable <span className="text-red-300">*</span></th>
                                                    <th className="px-3 py-3 font-bold">Billing Location <span className="text-red-300">*</span></th>
                                                    {days.map((d) => (
                                                        <th key={d.ymd} className="px-1 py-3 font-bold text-center">
                                                            <div>{d.dom}</div><div className="text-[9px] opacity-80">{d.wd}</div>
                                                        </th>
                                                    ))}
                                                    <th className="px-2 py-3 font-bold text-center">Total Hours</th>
                                                    <th className="px-2 py-3 font-bold text-center">Comment</th>
                                                    <th className="px-2 py-3"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {projectRows.map((r, rowIdx) => {
                                                    const gate = r.assignmentStartDate || meta.earliestAssignmentDate;
                                                    return (
                                                        <tr key={r.rowId} className="border-b border-[#E3E8EF] align-top">
                                                            <td className="px-3 py-2">
                                                                {/* Project ID/Name belong to the client project assignment, so they are
                                                                    chosen rather than typed. A row that already carries a project (saved
                                                                    or templated from an assignment) shows it read-only, as before. */}
                                                                {!r.isNew || !weekEditable ? (
                                                                    <span className="text-xs font-semibold text-brand-text">{r.projectId || "—"}</span>
                                                                ) : (
                                                                    <select
                                                                        value={r.projectId}
                                                                        onChange={(e) => selectProject(r.rowId, e.target.value)}
                                                                        disabled={assignmentOptions.length === 0}
                                                                        className={fieldClass(issueFor(r.rowId, "projectId"), "w-28")}
                                                                    >
                                                                        <option value="">
                                                                            {assignmentOptions.length === 0 ? "No projects assigned" : "Select project"}
                                                                        </option>
                                                                        {assignmentOptions.map((a) => (
                                                                            <option key={a.projectId} value={a.projectId}>{a.projectId}</option>
                                                                        ))}
                                                                    </select>
                                                                )}
                                                                {issueFor(r.rowId, "projectId") && (
                                                                    <p className="mt-1 text-[10px] font-semibold text-red-600 leading-tight">
                                                                        {assignmentOptions.length === 0 ? "No active project assignment — remove this row" : "Project ID is required"}
                                                                    </p>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 max-w-[150px]">
                                                                <span className="text-xs text-brand-text/80">{r.projectName || "—"}</span>
                                                                {issueFor(r.rowId, "projectName") && !issueFor(r.rowId, "projectId") && (
                                                                    <p className="mt-1 text-[10px] font-semibold text-red-600 leading-tight">Project Name is required</p>
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-2">
                                                                <input disabled={!weekEditable} maxLength={MAX_TASK_ID} value={r.taskId} onChange={(e) => setRowField(r.rowId, "taskId", e.target.value)} placeholder="Enter task ID" className={fieldClass(issueFor(r.rowId, "taskId"), "w-24")} />
                                                                {weekEditable && <CharCounter value={r.taskId} max={MAX_TASK_ID} />}
                                                                {issueFor(r.rowId, "taskId") && (
                                                                    <p className="mt-1 text-[10px] font-semibold text-red-600 leading-tight">Task/Activity ID is required</p>
                                                                )}
                                                            </td>
                                                            {/* The input stays: a description is typed on every row, and
                                                                routing that through a dialog would put a click in front
                                                                of the most-used field on the sheet. What the cell cannot
                                                                do is show 256 characters — a single-line input clips at
                                                                w-40 with no way to read past it — so the expand button
                                                                opens the full text in the same dialog Comment uses,
                                                                editable while the week is open. */}
                                                            <td className="px-2 py-2">
                                                                <div className="flex items-center gap-1">
                                                                    <input disabled={!weekEditable} maxLength={MAX_TASK_DESCRIPTION} value={r.taskDescription} onChange={(e) => setRowField(r.rowId, "taskDescription", e.target.value)} placeholder="Enter description" title={r.taskDescription || undefined} className={fieldClass(issueFor(r.rowId, "taskDescription"), "w-36")} />
                                                                    <button
                                                                        id={`ct-desc-${r.rowId}`}
                                                                        onClick={() => openRowText(r.rowId, "taskDescription")}
                                                                        className={`shrink-0 p-1 rounded transition-all ${r.taskDescription ? "text-brand-blue-dark bg-brand-blue/5" : "text-brand-text/40"} hover:bg-brand-blue-dark hover:text-white`}
                                                                        title={weekEditable ? "Open full description" : "View full description"}
                                                                        aria-label="Open full task description"
                                                                    >
                                                                        <Maximize2 size={13} />
                                                                    </button>
                                                                </div>
                                                                {weekEditable && <CharCounter value={r.taskDescription} max={MAX_TASK_DESCRIPTION} />}
                                                                {issueFor(r.rowId, "taskDescription") && (
                                                                    <p className="mt-1 text-[10px] font-semibold text-red-600 leading-tight">Description is required</p>
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-2">
                                                                <select disabled={!weekEditable} value={r.onsiteOffshore} onChange={(e) => setRowField(r.rowId, "onsiteOffshore", e.target.value)} className={fieldClass(issueFor(r.rowId, "onsiteOffshore"))}>
                                                                    <option value="">Select</option>
                                                                    <option value="ONSITE">Onsite</option>
                                                                    <option value="OFFSHORE">Offshore</option>
                                                                </select>
                                                                {issueFor(r.rowId, "onsiteOffshore") && (
                                                                    <p className="mt-1 text-[10px] font-semibold text-red-600 leading-tight">Select Onsite or Offshore</p>
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-2">
                                                                <select disabled={!weekEditable} value={r.clientBillable} onChange={(e) => setRowField(r.rowId, "clientBillable", e.target.value)} className={fieldClass(issueFor(r.rowId, "clientBillable"))}>
                                                                    <option value="">Select</option>
                                                                    <option value="BILLABLE">Billable</option>
                                                                    <option value="NON_BILLABLE">Non-Billable</option>
                                                                </select>
                                                                {issueFor(r.rowId, "clientBillable") && (
                                                                    <p className="mt-1 text-[10px] font-semibold text-red-600 leading-tight">Select a billable type</p>
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-2">
                                                                <input disabled={!weekEditable} maxLength={MAX_BILLING_LOCATION} value={r.billingLocation} onChange={(e) => setBillingLocation(r.rowId, e.target.value)} aria-label={`Billing Location (letters and spaces, maximum ${MAX_BILLING_LOCATION} characters)`} className={fieldClass(issueFor(r.rowId, "billingLocation"), "w-16")} />
                                                                {weekEditable && <CharCounter value={r.billingLocation} max={MAX_BILLING_LOCATION} />}
                                                                {weekEditable && capNotices[billingLocationKey(r.rowId)] && (
                                                                    <p className="mt-1 text-[10px] font-semibold text-amber-600 leading-tight">{capNotices[billingLocationKey(r.rowId)]}</p>
                                                                )}
                                                                {issueFor(r.rowId, "billingLocation") && (
                                                                    <p className="mt-1 text-[10px] font-semibold text-red-600 leading-tight">Billing Location is required</p>
                                                                )}
                                                            </td>
                                                            {r.days.map((d, dayIdx) => (
                                                                <td key={d.date} className="px-1 py-2 text-center">
                                                                    {dayCell(d.date, d.hours, isProjectDayEditable(d.date, gate), (v) => setProjectDay(r.rowId, dayIdx, v), isFullLeaveDay(d.date), issueFor(r.rowId, "hours"), MAX_HOURS_PER_DAY, capNotices[projectCellKey(r.rowId, d.date)])}
                                                                </td>
                                                            ))}
                                                            <td className="px-2 py-2 text-center text-xs font-bold text-brand-text">
                                                                {rowTotal(r).toFixed(2)}
                                                                {issueFor(r.rowId, "hours") && (
                                                                    <p className="mt-1 text-[10px] font-semibold text-red-600 leading-tight">Enter hours for at least one day</p>
                                                                )}
                                                            </td>
                                                            {/* Icon only. The comment text lives in the dialog this opens
                                                                and nowhere else — it used to be previewed here and
                                                                repeated in full below the table.
                                                                A row that carries a comment gets the filled emerald
                                                                treatment plus a dot, so "has a comment" is legible
                                                                without putting any of the text on the row. */}
                                                            <td className="px-2 py-2">
                                                                <div className="flex items-center justify-center">
                                                                    <button
                                                                        onClick={() => openRowText(r.rowId, "comment")}
                                                                        className={`relative p-1.5 rounded transition-all ${r.comment ? "text-emerald-600 bg-emerald-50" : "text-brand-text/40 hover:bg-bg-slate"}`}
                                                                        title={weekEditable ? "Add or edit comment" : "View comment"}
                                                                        aria-label={r.comment ? "View comment" : "Add comment"}
                                                                    >
                                                                        <MessageSquare size={16} />
                                                                        {r.comment && (
                                                                            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-2 whitespace-nowrap">
                                                                <div className="flex items-center gap-1">
                                                                    <button onClick={() => addRow(rowIdx)} disabled={!weekEditable} className="w-6 h-6 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-40" title="Add row"><Plus size={14} /></button>
                                                                    {/* The last remaining row cannot be removed — the sheet always keeps at least one. */}
                                                                    <button
                                                                        onClick={() => removeRow(r.rowId)}
                                                                        disabled={!weekEditable || projectRows.length <= 1}
                                                                        className="w-6 h-6 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all disabled:opacity-40 disabled:hover:bg-red-50 disabled:hover:text-red-500 disabled:cursor-not-allowed"
                                                                        title={projectRows.length <= 1 ? "At least one project row is required" : "Remove row"}
                                                                    ><Minus size={14} /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {/* Safety net only — the sheet is seeded with a blank row on load and
                                                    the last row can't be deleted, so this should not be reachable.
                                                    The old copy pointed at a “+” that isn't rendered when there are
                                                    no rows, leaving no way back. */}
                                                {projectRows.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7 + days.length + 3} className="px-4 py-8 text-center text-sm text-brand-text/40">
                                                            No project rows.
                                                            <button onClick={() => addRow(-1)} disabled={!weekEditable} className="ml-2 font-bold text-brand-blue-dark underline disabled:opacity-40">Add a row</button>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-bg-slate/40">
                                                    <td colSpan={7 + days.length} className="px-3 py-2 text-right text-xs font-bold text-brand-text/60 uppercase tracking-wide">Total Project Related Hours</td>
                                                    <td className="px-2 py-2 text-center text-sm font-black text-brand-text">{totalProject.toFixed(2)}</td>
                                                    <td colSpan={2}></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* OT hours — derived, never typed. Sits between the project
                                        hours (Regular) and the Holiday/Time off block it reads from.
                                        mt-2 rather than mt-8: the three blocks are one timesheet
                                        read top to bottom, not three floating cards. */}
                                    <div className="mt-2 bg-white rounded-xl border border-[#E3E8EF] shadow-sm overflow-x-auto">
                                        <div className="px-4 py-3 border-b border-[#E3E8EF] flex items-baseline gap-3">
                                            <h3 className="text-sm font-black text-brand-text uppercase tracking-wide">OT Hours</h3>
                                            {/* <span className="text-[11px] text-brand-text/40">
                                                Calculated — hours worked beyond the 8h daily capacity, which leave uses up first
                                            </span> */}
                                        </div>
                                        <table className="w-full border-collapse table-fixed" style={{ minWidth: LOWER_GRID_MIN_W }}>
                                            {/* Day and Total take the project grid's pixel widths verbatim, so a
                                                day cell is the same size in all three blocks. The label column is
                                                the only auto one — with table-fixed it absorbs the leftover width,
                                                which is what keeps this block fitting the page instead of
                                                inheriting the project grid's scroll. Exactly one column may be
                                                auto: if the fixed widths did not account for the rest, table-fixed
                                                would rescale them proportionally and stretch the day cells again. */}
                                            <colgroup>
                                                <col />
                                                {days.map((d) => <col key={d.ymd} style={{ width: GRID_DAY_W }} />)}
                                                <col style={{ width: GRID_TOTAL_W }} />
                                            </colgroup>
                                            <thead>
                                                <tr className="text-[11px] text-brand-text/40 uppercase">
                                                    <th className="px-4 py-2 text-right font-bold"></th>
                                                    {days.map((d) => (
                                                        <th key={d.ymd} className="px-1 py-2 font-bold text-center">
                                                            <div className="text-brand-text/70">{d.dom}</div><div className="text-[9px]">{d.wd}</div>
                                                        </th>
                                                    ))}
                                                    <th className="px-2 py-2 font-bold text-center">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="border-b border-[#E3E8EF]">
                                                    <td className="px-4 py-2 text-right text-sm font-semibold text-brand-text/70">Overtime (&gt;8h/day)</td>
                                                    {dayBreakdown.map((d) => (
                                                        <td key={d.ymd} className="px-1 py-2 text-center">
                                                            <div
                                                                className={`w-14 mx-auto text-center text-xs font-semibold rounded border px-1 py-1.5 ${d.locked
                                                                    ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                                                    : d.ot > 0
                                                                        ? "bg-amber-50 border-amber-200 text-amber-700"
                                                                        : "bg-gray-100 border-gray-200 text-gray-400"}`}
                                                                title={d.locked
                                                                    ? "Not available — full-day leave is booked for this date"
                                                                    : "Calculated from the hours entered above"}
                                                            >
                                                                {/* Derived, so there is no real placeholder to use — an empty
                                                                    cell shows the unit in the same muted style the entry
                                                                    boxes use, in place of the old bare em dash. */}
                                                                {d.ot > 0
                                                                    ? d.ot.toFixed(2)
                                                                    : <span className="font-medium text-brand-text/35">hrs</span>}
                                                            </div>
                                                        </td>
                                                    ))}
                                                    <td className="px-2 py-2 text-center text-xs font-bold text-amber-600">{totalOT.toFixed(2)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Holiday / Time off */}
                                    <div className="mt-2 bg-white rounded-xl border border-[#E3E8EF] shadow-sm overflow-x-auto">
                                        <div className="px-4 py-3 border-b border-[#E3E8EF]">
                                            <h3 className="text-sm font-black text-brand-text uppercase tracking-wide">Holiday/Time off</h3>
                                        </div>
                                        <table className="w-full border-collapse table-fixed" style={{ minWidth: LOWER_GRID_MIN_W }}>
                                            {/* Same geometry as the OT block above — see the note there, plus a
                                                Reason column matching the project grid's Comment column. */}
                                            <colgroup>
                                                <col />
                                                {days.map((d) => <col key={d.ymd} style={{ width: GRID_DAY_W }} />)}
                                                <col style={{ width: GRID_TOTAL_W }} />
                                                <col style={{ width: 64 }} />
                                            </colgroup>
                                            <thead>
                                                <tr className="text-[11px] text-brand-text/40 uppercase">
                                                    <th className="px-4 py-2 text-right font-bold"></th>
                                                    {days.map((d) => (
                                                        <th key={d.ymd} className="px-1 py-2 font-bold text-center">
                                                            <div className="text-brand-text/70">{d.dom}</div><div className="text-[9px]">{d.wd}</div>
                                                        </th>
                                                    ))}
                                                    <th className="px-2 py-2 font-bold text-center">Total</th>
                                                    <th className="px-2 py-2 font-bold text-center">Reason</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {timeOffRows.map((r, rowIdx) => {
                                                    const gate = meta.earliestAssignmentDate;
                                                    return (
                                                        <tr key={r.type} className="border-b border-[#E3E8EF]">
                                                            <td className="px-4 py-2 text-right text-sm font-semibold text-brand-text/70">{TIMEOFF_LABELS[r.type]}</td>
                                                            {r.days.map((d, dayIdx) => {
                                                                // A date belongs to one leave type. Once another row holds
                                                                // hours for it, this cell is simply closed — a greyed,
                                                                // non-interactive box in the same disabled treatment the
                                                                // module uses for pre-assignment dates and full-leave-day
                                                                // Regular/OT cells. There is deliberately no message: the
                                                                // employee cannot reach the field, and an error under a
                                                                // field they cannot touch reads as a fault rather than a
                                                                // rule. The hover text follows the module's existing
                                                                // "Not available — …" wording for anyone who looks.
                                                                const claimedBy = otherLeaveTypeOn(d.date, rowIdx);
                                                                return (
                                                                    <td key={d.date} className="px-1 py-2 text-center">
                                                                        {dayCell(
                                                                            d.date, d.hours,
                                                                            isDayEditable(d.date, gate) && !claimedBy,
                                                                            (v) => setTimeOffDay(rowIdx, dayIdx, v),
                                                                            false, false, MAX_LEAVE_HOURS_PER_DAY,
                                                                            capNotices[leaveCellKey(r.type, d.date)],
                                                                            claimedBy
                                                                                ? `Not available — ${TIMEOFF_LABELS[claimedBy]} is already logged for this date`
                                                                                : null,
                                                                            () => maybePromptLeaveReason(rowIdx)
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="px-2 py-2 text-center text-xs font-bold text-brand-text">{rowTotal(r).toFixed(2)}</td>
                                                            {/* Icon only, exactly like the project grid's Comment cell: the
                                                                text lives in the dialog this opens, never inline in the
                                                                table. A row that carries a reason gets the filled emerald
                                                                treatment plus a dot; a row that owes one is outlined red
                                                                after a Submit attempt, matching how the project rows'
                                                                missing fields are flagged. */}
                                                            <td className="px-2 py-2 text-center">
                                                                {rowHasLeaveHours(r) ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openLeaveReason(r.type)}
                                                                        className={`relative p-1.5 rounded transition-all ${r.reason
                                                                            ? "text-emerald-600 bg-emerald-50"
                                                                            : leaveReasonIssue(r.type)
                                                                                ? "text-red-600 bg-red-50 ring-1 ring-red-500"
                                                                                : "text-brand-text/40 hover:bg-bg-slate"}`}
                                                                        title={weekEditable
                                                                            ? (r.reason ? "View or edit leave reason" : "Add a reason for this leave")
                                                                            : "View leave reason"}
                                                                        aria-label={r.reason
                                                                            ? `View reason for ${TIMEOFF_LABELS[r.type]}`
                                                                            : `Add reason for ${TIMEOFF_LABELS[r.type]}`}
                                                                    >
                                                                        <MessageSquareText size={16} />
                                                                        {r.reason && (
                                                                            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                        )}
                                                                    </button>
                                                                ) : (
                                                                    // No leave on this row, so there is nothing to explain.
                                                                    <span className="text-brand-text/20 text-xs">—</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Totals + actions */}
                                    <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div className="flex flex-col gap-1 text-sm">
                                            {/* Ordered so the arithmetic reads down the column:
                                                Regular + OT = Working, Working + Time off = Grand.
                                                Every line is a distinct bucket — no hour appears
                                                in two of them. */}
                                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Total Regular Hours:</span><span className="font-black text-brand-text">{totalRegular.toFixed(2)}</span></div>
                                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Total OT Hours:</span><span className="font-black text-amber-600">{totalOT.toFixed(2)}</span></div>
                                            {/* Hours actually worked — Regular + OT, leave excluded. */}
                                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Total Working Hours:</span><span className="font-black text-brand-text">{totalWorking.toFixed(2)}</span></div>
                                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Total Holiday/Time off Hours:</span><span className="font-black text-brand-text">{totalTimeOff.toFixed(2)}</span></div>
                                            <div className="flex gap-4 pt-1 border-t border-[#E3E8EF]"><span className="text-brand-text/50 font-semibold">Grand Total:</span><span className="font-black text-brand-text">{grandTotal.toFixed(2)}</span></div>
                                            {/* The per-day breakdown that used to live here is now the OT Hours
                                                block above; both read the same dayBreakdown, so they cannot drift. */}
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            {/* <button onClick={handleUpdateTotals} disabled={saving || !weekEditable} className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40">Update Totals</button> */}
                                            <button onClick={handleSave} disabled={saving || !weekEditable} className="px-5 py-2.5 rounded-lg bg-[#2C2C2A] hover:bg-black text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40">Save</button>
                                            <button
                                                onClick={handleSubmit}
                                                disabled={saving || !weekEditable || resubmitBlockedUnchanged}
                                                title={resubmitBlockedUnchanged
                                                    ? "Make a change before resubmitting — this week is unchanged since it was rejected."
                                                    : undefined}
                                                className="px-6 py-2.5 rounded-lg bg-brand-blue-dark hover:brightness-110 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-brand-blue/20 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {meta.status === "PENDING" || meta.status === "REJECTED" ? "Resubmit" : "Submit"}
                                            </button>
                                        </div>
                                    </div>
                                    {/* Not gated on showErrors — an impossible day is worth flagging
                                        as soon as it exists, without waiting for a Submit attempt. */}
                                    {dayCapIssues.length > 0 && (
                                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                                            <p className="text-xs font-black uppercase tracking-widest text-red-600">Daily hour limit exceeded</p>
                                            <p className="mt-1 text-sm text-red-700 leading-relaxed">{dayCapMessage()}</p>
                                        </div>
                                    )}
                                    {/* {showErrors && incompleteRowCount > 0 && (
                                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                                            <p className="text-xs font-black uppercase tracking-widest text-red-600">Incomplete rows</p>
                                            <p className="mt-1 text-sm text-red-700 leading-relaxed">
                                                {incompleteRowCount === 1
                                                    ? "One project row still has required fields to fill in — see the highlighted fields above."
                                                    : `${incompleteRowCount} project rows still have required fields to fill in — see the highlighted fields above.`}
                                                {" "}Remove any row you are not logging against, or complete it.
                                            </p>
                                        </div>
                                    )} */}
                                    {!weekEditable ? (
                                        <p className="mt-3 text-xs text-brand-text/40">This week is {statusMeta.label.toLowerCase()} and can no longer be edited.</p>
                                    ) : meta.status === "PENDING" ? (
                                        <p className="mt-3 text-xs text-brand-text/40">Submitted and awaiting approval — you can still edit and resubmit until it is approved or rejected.</p>
                                    ) : null}
                                </>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* The only place either long-text field is shown in full. Same component the admin
                drawer uses, so both sides read identically. */}
            {textModal.open && (
                <RowTextDialog
                    row={projectRows.find((r) => r.rowId === textModal.rowId)}
                    value={textModal.text}
                    max={textModal.field === "comment" ? MAX_COMMENT : MAX_TASK_DESCRIPTION}
                    label={textModal.field === "comment" ? "Row Comment" : "Task/Activity Description"}
                    placeholder={textModal.field === "comment"
                        ? "Add a comment for this project row"
                        : "Describe the work on this project row"}
                    editable={weekEditable}
                    onChange={(text) => setTextModal((p) => ({ ...p, text }))}
                    onClose={closeRowText}
                    onSave={saveRowText}
                />
            )}

            {/* Leave reason — the same dialog, so it looks and behaves exactly like Comment and
                Task/Activity Description. Named by leave type rather than by project row, since
                a Holiday/Time off row carries no project identity. */}
            {leaveModal.open && (
                <RowTextDialog
                    value={leaveModal.text}
                    max={MAX_LEAVE_REASON}
                    label="Leave Reason"
                    contextLabel={TIMEOFF_LABELS[leaveModal.type] || "Leave"}
                    placeholder="Why are you taking this leave?"
                    editable={weekEditable}
                    onChange={(text) => setLeaveModal((p) => ({ ...p, text }))}
                    onClose={closeLeaveReason}
                    onSave={saveLeaveReason}
                />
            )}
        </div>
    );
}
