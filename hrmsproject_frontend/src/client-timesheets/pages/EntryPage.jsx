import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessageSquare, Plus, Minus, ArrowLeft, X } from "lucide-react";
import api from "../../utils/api";
import { toast } from "react-toastify";
import { clientTimesheetStatusMeta } from "../../utils/clientTimesheetStatus";
import { clientTimesheetBase, roleDashboardPath } from "../../utils/clientTimesheetNav";
import RowCommentsPanel from "../components/RowCommentsPanel";
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
// Not part of the agreed limits table; unchanged, and still matches its VARCHAR(64) column.
const MAX_BILLING_LOCATION = 64;

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
    const [commentModal, setCommentModal] = useState({ open: false, rowId: null, text: "" });
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
            return { type, days: found ? mapDays(found.days) : days.map((d) => ({ date: d.ymd, hours: "" })) };
        }));
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

    // Cell keys for capNotices — project cells are identified by row, leave cells by type.
    const projectCellKey = (rowId, date) => `p:${rowId}:${date}`;
    const leaveCellKey = (type, date) => `t:${type}:${date}`;
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

    const setProjectDay = (rowId, dayIdx, value) => {
        const { hours, clamped } = clampHours(value, MAX_HOURS_PER_DAY);
        const date = projectRows.find((r) => r.rowId === rowId)?.days?.[dayIdx]?.date;
        setProjectRows((prev) => prev.map((r) => r.rowId !== rowId ? r : {
            ...r, days: r.days.map((d, j) => j !== dayIdx ? d : { ...d, hours }),
        }));
        noteCap(projectCellKey(rowId, date), clamped ? `Max ${MAX_HOURS_PER_DAY} hrs/day` : null);
    };
    const setTimeOffDay = (rowIdx, dayIdx, value) => {
        const { hours, clamped } = clampHours(value, MAX_LEAVE_HOURS_PER_DAY);
        noteCap(
            leaveCellKey(timeOffRows[rowIdx]?.type, timeOffRows[rowIdx]?.days?.[dayIdx]?.date),
            clamped ? `Max ${MAX_LEAVE_HOURS_PER_DAY} hrs/day for leave` : null
        );
        const nextRows = timeOffRows.map((r, i) => i !== rowIdx ? r : {
            ...r, days: r.days.map((d, j) => j !== dayIdx ? d : { ...d, hours }),
        });
        setTimeOffRows(nextRows);

        // Once leave fills the day, any project hours already typed for that date are
        // cleared — the cells are about to lock, so leaving a stale value behind would
        // keep counting toward the totals with no way to edit it out.
        const ymd = timeOffRows[rowIdx]?.days?.[dayIdx]?.date;
        if (!ymd) return;
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
    const grandTotal = totalProject + totalTimeOff;

    // ── Daily Regular / OT split ────────────────────────────────────────────────
    // Every weekday carries 8 hours of Regular capacity, shared between leave taken and
    // project hours worked:
    //   full-day leave (>= 8h) → Regular 8, OT 0 for that day, whatever else is entered
    //   otherwise              → Regular = leave + min(worked, 8 - leave)
    //                            OT      = worked beyond that remaining capacity
    // Weekends are locked for entry and are never Regular or OT.
    // Mirrored server-side in ClientTimesheetWeekService.applyTotals — the saved figures
    // are the server's, so the two must stay in step.
    const dayBreakdown = days.map((d) => {
        if (isWeekendYMD(d.ymd)) return { ymd: d.ymd, wd: d.wd, dom: d.dom, regular: 0, ot: 0, locked: false };
        const worked = dayHoursFor(projectRows, d.ymd);
        const leave = dayHoursFor(timeOffRows, d.ymd);
        if (leave >= FULL_DAY_LEAVE_HOURS) {
            // Full-day leave fills the day's quota outright; no overtime is earned, and
            // both this cell and the day's project cells are locked.
            return { ymd: d.ymd, wd: d.wd, dom: d.dom, regular: FULL_DAY_LEAVE_HOURS, ot: 0, locked: true };
        }
        const capacity = FULL_DAY_LEAVE_HOURS - leave;
        return {
            ymd: d.ymd,
            wd: d.wd,
            dom: d.dom,
            regular: leave + Math.min(worked, capacity),
            ot: Math.max(0, worked - capacity),
            locked: false,
        };
    });
    const totalOT = dayBreakdown.reduce((s, d) => s + d.ot, 0);
    const totalRegular = dayBreakdown.reduce((s, d) => s + d.regular, 0);

    // A part-day leave has to be topped up to a full 8-hour day before the week can be
    // submitted: 4h of sick leave and nothing else leaves the day at 4, not 8.
    // Regular already includes the leave hours, so Regular + OT is the day's whole total —
    // adding leave again would double-count it.
    // Only dates carrying leave are checked; a day with no leave at all (not worked, or
    // partially worked) is a different case and is deliberately left alone. Full-day leave
    // (>= 8h) is complete by definition and never flagged.
    const incompleteLeaveDays = dayBreakdown
        .filter((d) => {
            const leave = dayHoursFor(timeOffRows, d.ymd);
            return leave > 0
                && leave < FULL_DAY_LEAVE_HOURS
                && (d.regular + d.ot) < FULL_DAY_LEAVE_HOURS;
        })
        .map((d) => {
            const logged = d.regular + d.ot;
            return {
                label: `${parseLocal(d.ymd).toLocaleDateString("en-US", { weekday: "long" })} ${d.dom}`,
                logged,
                missing: FULL_DAY_LEAVE_HOURS - logged,
            };
        });

    const incompleteLeaveMessage = () => {
        if (incompleteLeaveDays.length === 1) {
            const d = incompleteLeaveDays[0];
            return `${d.label} only has ${d.logged} hours logged — please fill the remaining ${d.missing} hours (regular or OT) before submitting.`;
        }
        // Every offending date is listed, not just the first one found.
        const list = incompleteLeaveDays.map((d) => `${d.label} (${d.logged} of ${FULL_DAY_LEAVE_HOURS})`).join(", ");
        return `These dates are incomplete — please fill the remaining hours (regular or OT) before submitting: ${list}.`;
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
            type: r.type, days: r.days.map((d) => ({ date: d.date, hours: numOr0(d.hours) })),
        })),
    });

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
        if (incompleteLeaveDays.length > 0) {
            toast.error(incompleteLeaveMessage());
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

    const openComment = (rowId) => {
        const row = projectRows.find((r) => r.rowId === rowId);
        setCommentModal({ open: true, rowId, text: row?.comment || "" });
    };
    const saveComment = () => {
        if (commentModal.rowId) {
            setRowField(commentModal.rowId, "comment", commentModal.text);
        }
        setCommentModal({ open: false, rowId: null, text: "" });
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
    const dayCell = (ymd, value, editable, onChange, lockedByFullLeave = false, invalid = false, max = MAX_HOURS_PER_DAY, capNotice = null) => (
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
            onChange={(e) => onChange(e.target.value)}
            onPaste={(e) => {
                e.preventDefault();
                onChange(e.clipboardData.getData("text"));
            }}
            title={editable
                ? undefined
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
                                    {/* Project table */}
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
                                                <tr className="bg-brand-blue-dark text-white text-[11px] uppercase tracking-wide">
                                                    {/* Every project column is mandatory — marked so the employee
                                                        knows before Submit rather than after it is blocked. */}
                                                    <th className="px-3 py-3 font-bold">Project ID <span className="text-red-300">*</span></th>
                                                    <th className="px-3 py-3 font-bold">Project Name <span className="text-red-300">*</span></th>
                                                    <th className="px-3 py-3 font-bold">Task/Activity ID <span className="text-red-300">*</span></th>
                                                    <th className="px-3 py-3 font-bold">Task/Activity Description <span className="text-red-300">*</span></th>
                                                    <th className="px-3 py-3 font-bold">Onsite/Offshore <span className="text-red-300">*</span></th>
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
                                                            <td className="px-2 py-2">
                                                                <input disabled={!weekEditable} maxLength={MAX_TASK_DESCRIPTION} value={r.taskDescription} onChange={(e) => setRowField(r.rowId, "taskDescription", e.target.value)} placeholder="Enter description" title={r.taskDescription || undefined} className={fieldClass(issueFor(r.rowId, "taskDescription"), "w-40")} />
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
                                                                <input disabled={!weekEditable} maxLength={MAX_BILLING_LOCATION} value={r.billingLocation} onChange={(e) => setRowField(r.rowId, "billingLocation", e.target.value)} className={fieldClass(issueFor(r.rowId, "billingLocation"), "w-16")} />
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
                                                            {/* The comment text is shown next to the button, not hidden
                                                                behind it — the same text the admin sees on their review
                                                                screen. Full text is in the Row Comments panel below. */}
                                                            <td className="px-2 py-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <button onClick={() => openComment(r.rowId)} className={`shrink-0 p-1.5 rounded transition-all ${r.comment ? "text-emerald-600 bg-emerald-50" : "text-brand-text/40 hover:bg-bg-slate"}`} title={weekEditable ? "Add or edit comment" : "View comment"} aria-label="Comment">
                                                                        <MessageSquare size={16} />
                                                                    </button>
                                                                    {r.comment
                                                                        ? <span className="block max-w-[120px] truncate text-[11px] text-brand-text/70" title={r.comment}>{r.comment}</span>
                                                                        : <span className="text-[11px] text-brand-text/30">—</span>}
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

                                    {/* Per-row comments in full, read-only. Same component and position
                                        as the admin review drawer, so what the employee wrote reads
                                        identically on both sides after submission. */}
                                    <RowCommentsPanel rows={projectRows} className="mt-8" />

                                    {/* OT hours — derived, never typed. Sits between the project
                                        hours (Regular) and the Holiday/Time off block it reads from. */}
                                    <div className="mt-8 bg-white rounded-xl border border-[#E3E8EF] shadow-sm overflow-x-auto">
                                        <div className="px-4 py-3 border-b border-[#E3E8EF] flex items-baseline gap-3">
                                            <h3 className="text-sm font-black text-brand-text uppercase tracking-wide">OT Hours</h3>
                                            <span className="text-[11px] text-brand-text/40">
                                                Calculated — hours beyond the 8h daily regular capacity (leave included)
                                            </span>
                                        </div>
                                        <table className="w-full border-collapse table-fixed" style={{ minWidth: GRID_MIN_W }}>
                                            {/* The label column is exactly as wide as the project grid's seven
                                                descriptive columns, so day 1 starts at the same x in both. */}
                                            <colgroup>
                                                <col style={{ width: GRID_LEAD_W }} />
                                                {days.map((d) => <col key={d.ymd} style={{ width: GRID_DAY_W }} />)}
                                                <col style={{ width: GRID_TOTAL_W }} />
                                                <col style={{ width: GRID_COMMENT_W + GRID_ACTIONS_W }} />
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
                                                    <th></th>
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
                                                    <td></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Holiday / Time off */}
                                    <div className="mt-8 bg-white rounded-xl border border-[#E3E8EF] shadow-sm overflow-x-auto">
                                        <div className="px-4 py-3 border-b border-[#E3E8EF]">
                                            <h3 className="text-sm font-black text-brand-text uppercase tracking-wide">Holiday/Time off</h3>
                                        </div>
                                        <table className="w-full border-collapse table-fixed" style={{ minWidth: GRID_MIN_W }}>
                                            {/* Same geometry as the Regular and OT grids above. */}
                                            <colgroup>
                                                <col style={{ width: GRID_LEAD_W }} />
                                                {days.map((d) => <col key={d.ymd} style={{ width: GRID_DAY_W }} />)}
                                                <col style={{ width: GRID_TOTAL_W }} />
                                                <col style={{ width: GRID_COMMENT_W + GRID_ACTIONS_W }} />
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
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {timeOffRows.map((r, rowIdx) => {
                                                    const gate = meta.earliestAssignmentDate;
                                                    return (
                                                        <tr key={r.type} className="border-b border-[#E3E8EF]">
                                                            <td className="px-4 py-2 text-right text-sm font-semibold text-brand-text/70">{TIMEOFF_LABELS[r.type]}</td>
                                                            {r.days.map((d, dayIdx) => (
                                                                <td key={d.date} className="px-1 py-2 text-center">
                                                                    {dayCell(d.date, d.hours, isDayEditable(d.date, gate), (v) => setTimeOffDay(rowIdx, dayIdx, v), false, false, MAX_LEAVE_HOURS_PER_DAY, capNotices[leaveCellKey(r.type, d.date)])}
                                                                </td>
                                                            ))}
                                                            <td className="px-2 py-2 text-center text-xs font-bold text-brand-text">{rowTotal(r).toFixed(2)}</td>
                                                            <td></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Totals + actions */}
                                    <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div className="flex flex-col gap-1 text-sm">
                                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Total Holiday/Time off Hours:</span><span className="font-black text-brand-text">{totalTimeOff.toFixed(2)}</span></div>
                                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Total Regular Hours:</span><span className="font-black text-brand-text">{totalRegular.toFixed(2)}</span></div>
                                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Total OT Hours:</span><span className="font-black text-amber-600">{totalOT.toFixed(2)}</span></div>
                                            <div className="flex gap-4"><span className="text-brand-text/50 font-semibold">Grand Total:</span><span className="font-black text-brand-text">{grandTotal.toFixed(2)}</span></div>
                                            {/* The per-day breakdown that used to live here is now the OT Hours
                                                block above; both read the same dayBreakdown, so they cannot drift. */}
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            {/* <button onClick={handleUpdateTotals} disabled={saving || !weekEditable} className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40">Update Totals</button> */}
                                            <button onClick={handleSave} disabled={saving || !weekEditable} className="px-5 py-2.5 rounded-lg bg-[#2C2C2A] hover:bg-black text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40">Save</button>
                                            <button onClick={handleSubmit} disabled={saving || !weekEditable} className="px-6 py-2.5 rounded-lg bg-brand-blue-dark hover:brightness-110 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-brand-blue/20 transition-all active:scale-95 disabled:opacity-40">
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
                                    {showErrors && incompleteRowCount > 0 && (
                                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                                            <p className="text-xs font-black uppercase tracking-widest text-red-600">Incomplete rows</p>
                                            <p className="mt-1 text-sm text-red-700 leading-relaxed">
                                                {incompleteRowCount === 1
                                                    ? "One project row still has required fields to fill in — see the highlighted fields above."
                                                    : `${incompleteRowCount} project rows still have required fields to fill in — see the highlighted fields above.`}
                                                {" "}Remove any row you are not logging against, or complete it.
                                            </p>
                                        </div>
                                    )}
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

            {/* Comment modal */}
            {commentModal.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-brand-text">{weekEditable ? "Row Comment" : "Row Comment (read-only)"}</h3>
                            <button onClick={() => setCommentModal({ open: false, rowId: null, text: "" })} className="text-brand-text/40 hover:text-brand-text"><X size={18} /></button>
                        </div>
                        <textarea
                            value={commentModal.text}
                            onChange={(e) => setCommentModal((p) => ({ ...p, text: e.target.value }))}
                            maxLength={MAX_COMMENT}
                            disabled={!weekEditable}
                            placeholder="Add a comment for this project row"
                            className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-yellow outline-none text-sm disabled:bg-gray-100"
                            rows="4"
                        />
                        <div className="mb-4">
                            {weekEditable && <CharCounter value={commentModal.text} max={MAX_COMMENT} />}
                        </div>
                        {/* Once the week is approved the comment is history, not an input — a lone
                            Close beats a Cancel next to a permanently disabled Save. */}
                        <div className="flex gap-3">
                            <button onClick={() => setCommentModal({ open: false, rowId: null, text: "" })} className="flex-1 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold uppercase text-[10px] tracking-widest hover:bg-slate-200 transition">{weekEditable ? "Cancel" : "Close"}</button>
                            {weekEditable && (
                                <button onClick={saveComment} className="flex-1 bg-brand-blue-dark text-white px-4 py-2 rounded-lg font-bold uppercase text-[10px] tracking-widest hover:brightness-110 transition">Save</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
