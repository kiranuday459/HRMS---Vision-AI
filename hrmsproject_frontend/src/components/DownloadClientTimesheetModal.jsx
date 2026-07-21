import React, { useState, useMemo } from "react";
import { X, Download, Calendar } from "lucide-react";
import api from "../utils/api";
import { toast } from "react-toastify";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { projectSuffix } from "../utils/employeeName";

// ── Local date helpers (treat YYYY-MM-DD as local, avoid timezone shifts) ──
const toYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

// Monday of the week containing `d`.
const startOfWeek = (d) => {
    const c = new Date(d);
    const day = c.getDay(); // 0=Sun
    const diff = day === 0 ? 6 : day - 1;
    c.setDate(c.getDate() - diff);
    return c;
};

/**
 * Download panel for client timesheets. Matches the reference layout:
 * From/To date → quick-range presets → Employee → Client → Status → Download Excel.
 * Reads the filtered client_timesheets data from the API and generates a flat .xlsx
 * (one row per day per entry): Employee | Client | Project | Date | Hours | Billable | Status.
 */
export default function DownloadClientTimesheetModal({ isOpen, onClose, employees = [], clients = [] }) {
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [employeeId, setEmployeeId] = useState("");
    const [client, setClient] = useState("");
    const [status, setStatus] = useState("");
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState("");

    const employeeOptions = useMemo(
        () => (employees || []).filter((e) => (e.role || "").toUpperCase() !== "ADMIN"),
        [employees]
    );

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
            setFromDate(toYMD(from));
            setToDate(toYMD(to));
            setError("");
        }
    };

    const handleDownload = async () => {
        if (fromDate && toDate && toDate < fromDate) {
            setError("End date must be on or after the start date.");
            return;
        }
        setError("");
        try {
            setGenerating(true);

            const params = new URLSearchParams();
            if (employeeId) params.append("employeeId", employeeId);
            if (client) params.append("client", client);
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

            if (rows.length === 0) {
                toast.info("No client timesheets found for the selected filters.");
                return;
            }

            await generateExcel(rows);
            toast.success("Excel generated successfully.");
            onClose();
        } catch (err) {
            console.error(err);
            toast.error("An unexpected error occurred during generation.");
        } finally {
            setGenerating(false);
        }
    };

    // Reference-style export (English). One sheet per employee. Header block +
    // Date | Day | Category | Clock-in | Clock-out | Break | Working hours | Remarks,
    // one row per calendar date in the range, with a Total working-hours footer.
    const generateExcel = async (rows) => {
        const workbook = new ExcelJS.Workbook();

        const border = {
            top: { style: "thin" }, left: { style: "thin" },
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

        // ---- Date range shared across all sheets ----
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
        const dateSeq = [];
        for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
            dateSeq.push(new Date(d));
        }

        const titleMonth = rangeStart.toLocaleString("en-US", { month: "long" });
        const titleYear = rangeStart.getFullYear();

        // ---- Group rows by employee ----
        const groups = new Map();
        rows.forEach((r) => {
            const key = r.employeeId != null ? r.employeeId : r.employeeName;
            if (!groups.has(key)) groups.set(key, { name: r.employeeName || "Employee", rows: [] });
            groups.get(key).rows.push(r);
        });

        // Excel sheet names: max 31 chars, no []:*?/\, and must be unique.
        const usedSheetNames = new Set();
        const sheetNameFor = (name) => {
            let s = (name || "Employee").replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Employee";
            const base = s;
            let i = 2;
            while (usedSheetNames.has(s)) {
                const suffix = ` (${i++})`;
                s = base.slice(0, 31 - suffix.length) + suffix;
            }
            usedSheetNames.add(s);
            return s;
        };

        groups.forEach((group) => {
            const ws = workbook.addWorksheet(sheetNameFor(group.name));
            ws.getColumn(1).width = 10; // Date
            ws.getColumn(2).width = 8;  // Day
            ws.getColumn(3).width = 12; // Category
            ws.getColumn(4).width = 10; // Clock-in
            ws.getColumn(5).width = 10; // Clock-out
            ws.getColumn(6).width = 10; // Break
            ws.getColumn(7).width = 14; // Working hours
            ws.getColumn(8).width = 18; // Remarks

            // Employee meta (from the employees list already loaded — no extra API call).
            const emp = (employees || []).find(
                (e) => String(e.id) === String(group.rows[0].employeeId)
            );
            const dept = emp ? (emp.department || emp.departmentName || "") : "";
            const workLocation = "Office";
            const projectName = Array.from(
                new Set(
                    group.rows
                        .map((r) => [(r.clientName || "").trim(), (r.projectName || "").trim()].filter(Boolean).join(" / "))
                        .filter(Boolean)
                )
            ).join(", ");

            // ---- Header block ----
            ws.mergeCells(1, 1, 1, 8);
            const title = ws.getCell(1, 1);
            title.value = `Timesheet_${titleMonth} ${titleYear}`;
            title.font = { bold: true, size: 14 };
            title.alignment = { horizontal: "left", vertical: "middle" };
            ws.getRow(1).height = 22;

            const metaPair = (rowIdx, leftLabel, leftValue, rightLabel, rightValue) => {
                ws.getCell(rowIdx, 1).value = leftLabel;
                ws.getCell(rowIdx, 1).font = { bold: true };
                ws.mergeCells(rowIdx, 2, rowIdx, 4);
                ws.getCell(rowIdx, 2).value = leftValue;
                ws.getCell(rowIdx, 6).value = rightLabel;
                ws.getCell(rowIdx, 6).font = { bold: true };
                ws.mergeCells(rowIdx, 7, rowIdx, 8);
                ws.getCell(rowIdx, 7).value = rightValue;
            };
            metaPair(3, "Employee name:", group.name, "Project name:", projectName);
            metaPair(4, "Department:", dept, "Work location:", workLocation);

            // ---- Table header (row 6) ----
            const headerRowIdx = 6;
            const headers = ["Date", "Day", "Category", "Clock-in", "Clock-out", "Break", "Working hours", "Remarks"];
            const hr = ws.getRow(headerRowIdx);
            headers.forEach((h, i) => {
                const c = hr.getCell(i + 1);
                c.value = h;
                c.font = { bold: true };
                c.alignment = { horizontal: "center", vertical: "middle" };
                c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDDDDD" } };
                c.border = border;
            });

            // Sum stored working hours per date (multiple entries on one day are added).
            const hoursByDate = {};
            group.rows.forEach((r) => {
                const key = String(r.date).split("T")[0];
                const h = typeof r.hours === "number" ? r.hours : parseFloat(r.hours) || 0;
                hoursByDate[key] = (hoursByDate[key] || 0) + h;
            });

            // ---- Body: one row per calendar date ----
            let totalMinutes = 0;
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
                let working = "0:00";
                let remarks = "";

                if (isWeekend) {
                    category = "Weekend";
                    remarks = "Weekend";
                } else {
                    const hrs = hoursByDate[ymd] || 0;
                    if (hrs > 0) {
                        const workMin = Math.round(hrs * 60);
                        const startMin = 9 * 60 + 30; // 9:30
                        const breakMin = 60; // 1:00
                        clockIn = "9:30";
                        brk = "1:00";
                        working = minutesToHMM(workMin);
                        clockOut = minutesToHMM(startMin + workMin + breakMin);
                        totalMinutes += workMin;
                    }
                    // Weekday with no entry → all 0:00, blank Category/Remarks.
                }

                const values = [`${mo}/${da}`, dayAbbr[dow], category, clockIn, clockOut, brk, working, remarks];
                values.forEach((v, i) => {
                    const c = row.getCell(i + 1);
                    c.value = v;
                    c.alignment = { horizontal: i === 7 ? "left" : "center", vertical: "middle" };
                    c.border = border;
                });
            });

            // ---- Total footer ----
            const totalRowIdx = headerRowIdx + 1 + dateSeq.length;
            const totalRow = ws.getRow(totalRowIdx);
            ws.mergeCells(totalRowIdx, 1, totalRowIdx, 6);
            const label = totalRow.getCell(1);
            label.value = "Total";
            label.font = { bold: true };
            label.alignment = { horizontal: "center", vertical: "middle" };
            for (let cc = 1; cc <= 6; cc++) totalRow.getCell(cc).border = border;
            const totalCell = totalRow.getCell(7);
            totalCell.value = minutesToHMM(totalMinutes);
            totalCell.font = { bold: true };
            totalCell.alignment = { horizontal: "right", vertical: "middle" };
            totalCell.border = border;
            totalRow.getCell(8).border = border;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        saveAs(blob, `Client_Timesheets_${titleMonth}_${titleYear}.xlsx`);
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
                    {/* Date range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest ml-1">From date</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text/30 w-4 h-4" />
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => { setFromDate(e.target.value); setError(""); }}
                                    className="w-full bg-bg-slate/50 border-2 border-transparent focus:border-brand-yellow rounded-2xl p-3.5 pl-11 text-sm font-bold text-brand-text outline-none transition-all"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest ml-1">To date</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text/30 w-4 h-4" />
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => { setToDate(e.target.value); setError(""); }}
                                    className="w-full bg-bg-slate/50 border-2 border-transparent focus:border-brand-yellow rounded-2xl p-3.5 pl-11 text-sm font-bold text-brand-text outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Quick-range presets */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { key: "thisWeek", label: "This week" },
                            { key: "lastWeek", label: "Last week" },
                            { key: "thisMonth", label: "This month" },
                            { key: "lastMonth", label: "Last month" },
                        ].map((p) => (
                            <button
                                key={p.key}
                                onClick={() => applyPreset(p.key)}
                                className="px-4 py-2 rounded-xl border border-brand-blue/10 bg-white text-[11px] font-black uppercase tracking-widest text-brand-text/70 hover:bg-brand-blue hover:text-white hover:border-brand-blue transition-all"
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Employee + Client */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest ml-1">Employee</label>
                            <select
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                className="w-full bg-bg-slate/50 border-2 border-transparent focus:border-brand-yellow rounded-2xl p-3.5 text-sm font-bold text-brand-text outline-none transition-all"
                            >
                                <option value="">All employees</option>
                                {employeeOptions.map((e) => (
                                    <option key={e.id} value={e.id}>
                                        {e.firstName} {e.lastName}{projectSuffix(e.clientProject)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest ml-1">Client</label>
                            <select
                                value={client}
                                onChange={(e) => setClient(e.target.value)}
                                className="w-full bg-bg-slate/50 border-2 border-transparent focus:border-brand-yellow rounded-2xl p-3.5 text-sm font-bold text-brand-text outline-none transition-all"
                            >
                                <option value="">All clients</option>
                                {clients.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest ml-1">Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full bg-bg-slate/50 border-2 border-transparent focus:border-brand-yellow rounded-2xl p-3.5 text-sm font-bold text-brand-text outline-none transition-all"
                        >
                            <option value="">All statuses</option>
                            <option value="PENDING">Pending</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>

                    {error && <p className="text-red-500 text-[12px] ml-1">{error}</p>}
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
