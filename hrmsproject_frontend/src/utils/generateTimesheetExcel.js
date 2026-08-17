import ExcelJS from "exceljs";
import { fitRowHeight, wrap } from "./excelWrap";

/**
 * Converts a full name or string into Capitalized words with space (Camel Case with space, e.g. "john doe" -> "John Doe", "priya sharma" -> "Priya Sharma").
 *
 * @param {string} str
 * @returns {string}
 */
export function toCamelCaseWithSpace(str) {
    if (!str) return "Employee";
    const cleaned = String(str).replace(/[^a-zA-Z0-9\s]/g, " ").trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length === 0) return "Employee";
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

export const toCamelCase = toCamelCaseWithSpace;

/**
 * Standardized Timesheet Excel Generator
 * Matches the reference Vision AI HRMS Timesheet layout exactly.
 *
 * @param {Object} options
 * @param {Array<string>} options.dateSequence - Array of YYYY-MM-DD strings for the export period
 * @param {Array<number|string>} options.selectedIds - List of selected employee IDs
 * @param {Array<Object>} options.employees - List of employee objects
 * @param {Array<Object>} options.dateFilteredEntries - Timesheet entries filtered for the date range
 * @param {Array<Object>} options.allLeaves - Leave records
 * @param {Array<Object>} options.allHolidays - Holiday records
 * @param {string} options.fromDate - YYYY-MM-DD start date
 * @param {string} options.toDate - YYYY-MM-DD end date
 * @param {boolean} [options.isAllEmployees=false] - Whether "All Employees" export is requested (1 sheet per employee in CamelCase)
 */
export async function generateTimesheetExcel({
    dateSequence = [],
    selectedIds = [],
    employees = [],
    dateFilteredEntries = [],
    allLeaves = [],
    allHolidays = [],
    fromDate = "",
    toDate = "",
    isAllEmployees = false
}) {
    const workbook = new ExcelJS.Workbook();

    const parseLocalDate = (dateStr) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
        return new Date(year, month - 1, day);
    };

    const thinBorder = {
        top: { style: "thin", color: { argb: "FFD3D3D3" } },
        left: { style: "thin", color: { argb: "FFD3D3D3" } },
        bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
        right: { style: "thin", color: { argb: "FFD3D3D3" } }
    };

    // Style Constants
    const NAVY_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A2744" } };
    const GREEN_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D5C4A" } };
    const BLUE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3A4F8A" } };
    const LABEL_BLUE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } }; // #4472C4 @ 60% tint
    const GOLD_TINT_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF2CC" } }; // #FFC000 @ 60% tint
    const GREY_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };

    const FONT_TITLE = { name: "Calibri", size: 14, bold: false, color: { argb: "FFFFFFFF" } };
    const FONT_HEADER_11 = { name: "Calibri", size: 11, bold: false, color: { argb: "FFFFFFFF" } };
    const FONT_HEADER_10 = { name: "Calibri", size: 10, bold: false, color: { argb: "FFFFFFFF" } };
    const FONT_HEADER_10_BOLD = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    const FONT_VALUE_10_BOLD = { name: "Calibri", size: 10, bold: true, color: { argb: "FF334155" } };
    const FONT_DATA_10_REG = { name: "Calibri", size: 10, bold: false, color: { argb: "FF000000" } };

    // Format helper: DD Mon
    const formatShortDate = (ds) => {
        if (!ds) return "";
        const d = parseLocalDate(ds);
        if (!d) return "";
        const day = String(d.getDate()).padStart(2, "0");
        const mon = d.toLocaleDateString("en-US", { month: "short" });
        return `${day} ${mon}`;
    };

    // Track used sheet names (case-insensitive) to prevent ExcelJS duplicate worksheet exceptions
    const usedSheetNames = new Set();
    const getSafeUniqueSheetName = (desiredName, collisionSuffix = "") => {
        // Excel worksheet name rules:
        // 1. Max length: 31 characters
        // 2. Cannot contain: \ / ? * : [ ]
        // 3. Cannot start or end with single quote (')
        // 4. Cannot be empty
        // 5. Must be unique within workbook
        let clean = (desiredName || "Sheet")
            .replace(/[\\/?*[\]:]/g, "")
            .trim()
            .replace(/^'+|'+$/g, "");
        if (!clean) clean = "Sheet";

        let candidate = clean.substring(0, 31);
        let counter = 1;

        while (usedSheetNames.has(candidate.toLowerCase()) || workbook.getWorksheet(candidate)) {
            counter++;
            const suffix = collisionSuffix && counter === 2 ? `_${collisionSuffix}` : `${counter}`;
            const maxBaseLen = Math.max(1, 31 - suffix.length);
            const base = clean.substring(0, maxBaseLen).trim();
            candidate = `${base}${suffix}`;
        }

        usedSheetNames.add(candidate.toLowerCase());
        return candidate;
    };

    /**
     * Renders a single complete timesheet worksheet for one employee over a specific array of dates.
     */
    const renderEmployeeSheet = ({
        emp,
        empId,
        sheetDates,
        sheetName,
        titleDateRangeStr,
        titleYearStr,
        summaryTitle = "SUMMARY",
        totalFooterLabel
    }) => {
        const empName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name || emp.fullName || "Employee";
        const empCode = emp.oryfolksId || `EMP${empId}`;
        const managerName = emp.reportingManagerName || emp.manager || emp.reportingManager || "PRAVEEN";
        const designationVal = emp.designation || emp.jobTitle || emp.role || "Software Engineer";

        const worksheet = workbook.addWorksheet(sheetName);

        // Group this employee's entries by date up front. A date with several project
        // rows must emit several Excel rows.
        const entriesByDate = {};
        dateFilteredEntries.forEach((e) => {
            if (e.employeeId !== empId && String(e.employeeId) !== String(empId)) return;
            // Strict status check: only APPROVED entries are treated as finalized timesheet data
            const statusUpper = (e.status || "").toUpperCase();
            if (statusUpper !== "APPROVED") return;
            const key = e.date ? String(e.date).split("T")[0] : "";
            if (!key) return;
            if (!entriesByDate[key]) entriesByDate[key] = [];
            entriesByDate[key].push(e);
        });

        // Dates with no entries still occupy one row (Week Off / Holiday / blank day).
        const plannedDataRows = sheetDates.reduce(
            (n, ds) => n + Math.max(1, (entriesByDate[ds] || []).length), 0);

        // 1. Column Sizing
        worksheet.getColumn(1).width = 12.45; // A: Date
        worksheet.getColumn(2).width = 10.0;  // B: Day
        worksheet.getColumn(3).width = 14.0;  // C: Day Type
        worksheet.getColumn(4).width = 22.0;  // D: Project Name
        worksheet.getColumn(5).width = 15.0;  // E: Project ID
        worksheet.getColumn(6).width = 16.0;  // F: ONShore/OFFShore
        worksheet.getColumn(7).width = 14.0;  // G: Bill Type
        worksheet.getColumn(8).width = 12.45; // H: TOTAL
        worksheet.getColumn(9).width = 20.0;  // I: Comments
        worksheet.getColumn(10).width = 3.82; // J: Spacer
        worksheet.getColumn(11).width = 14.0; // K: Summary Label Part 1
        worksheet.getColumn(12).width = 14.0; // L: Summary Label Part 2
        worksheet.getColumn(13).width = 14.0; // M: Summary Label Part 3
        worksheet.getColumn(14).width = 12.45; // N: Summary Value

        // 2. Freeze Panes at A9 (Row 9 starts scrolling; Rows 1..8 stay locked at top)
        // Omitting xSplit avoids creating a 4-way split quadrant in OpenXML, preventing visual
        // header ghosting/duplication during high-frequency touchpad scrolling.
        worksheet.views = [
            { state: "frozen", ySplit: 8, topLeftCell: "A9", activePane: "bottomLeft" }
        ];

        // Set default row height = 20px for all rows except Row 1 & 2.
        const lastStyledRow = Math.max(100, 9 + plannedDataRows + 5);
        for (let r = 1; r <= lastStyledRow; r++) {
            worksheet.getRow(r).height = (r === 1 || r === 2) ? 22 : 20;
        }

        // --- ROW 1 & 2: Title Row (A1:I2 merged) ---
        worksheet.mergeCells("A1:I2");
        const a1 = worksheet.getCell("A1");
        a1.value = `VISION AI HRMS TIMESHEET - ${titleDateRangeStr} - ${titleYearStr}`;
        a1.fill = NAVY_FILL;
        a1.font = FONT_TITLE;
        a1.alignment = wrap({ horizontal: "center" });

        worksheet.mergeCells("K1:N1");
        const k1 = worksheet.getCell("K1");
        k1.value = summaryTitle;
        k1.fill = NAVY_FILL;
        k1.font = FONT_TITLE;
        k1.alignment = wrap({ horizontal: "center" });

        // --- ROW 4 & 5: Employee Info Block (Left) ---
        // Row 4
        const a4 = worksheet.getCell("A4");
        a4.value = "Employee:";
        a4.fill = BLUE_FILL;
        a4.font = FONT_HEADER_10;
        a4.alignment = wrap({ horizontal: "center" });

        worksheet.mergeCells("B4:C4");
        const b4 = worksheet.getCell("B4");
        b4.value = empName.toUpperCase();
        b4.fill = LABEL_BLUE_FILL;
        b4.font = FONT_VALUE_10_BOLD;
        b4.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

        worksheet.mergeCells("D4:D5");
        const d4 = worksheet.getCell("D4");
        d4.value = "Designation";
        d4.fill = BLUE_FILL;
        d4.font = FONT_HEADER_10;
        d4.alignment = wrap({ horizontal: "center" });

        worksheet.mergeCells("E4:F5");
        const e4 = worksheet.getCell("E4");
        e4.value = designationVal;
        e4.fill = LABEL_BLUE_FILL;
        e4.font = FONT_VALUE_10_BOLD;
        e4.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

        const g4 = worksheet.getCell("G4");
        g4.value = "Manager:";
        g4.fill = BLUE_FILL;
        g4.font = FONT_HEADER_10;
        g4.alignment = wrap({ horizontal: "right" });

        worksheet.mergeCells("H4:I4");
        const h4 = worksheet.getCell("H4");
        h4.value = String(managerName).toUpperCase();
        h4.fill = LABEL_BLUE_FILL;
        h4.font = FONT_VALUE_10_BOLD;
        h4.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

        // Row 5
        const a5 = worksheet.getCell("A5");
        a5.value = "Employee ID:";
        a5.fill = BLUE_FILL;
        a5.font = FONT_HEADER_10;
        a5.alignment = wrap({ horizontal: "center" });

        worksheet.mergeCells("B5:C5");
        const b5 = worksheet.getCell("B5");
        b5.value = empCode;
        b5.fill = LABEL_BLUE_FILL;
        b5.font = FONT_VALUE_10_BOLD;
        b5.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

        const g5 = worksheet.getCell("G5");
        g5.value = "Reg Hrs/Day:";
        g5.fill = BLUE_FILL;
        g5.font = FONT_HEADER_10;
        g5.alignment = wrap({ horizontal: "right" });

        worksheet.mergeCells("H5:I5");
        const h5 = worksheet.getCell("H5");
        h5.value = String(emp.regHrsPerDay || 8);
        h5.fill = LABEL_BLUE_FILL;
        h5.font = FONT_VALUE_10_BOLD;
        h5.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

        // Apply thin borders to Employee Info Block (Rows 4 & 5, columns A..I)
        [4, 5].forEach((rIdx) => {
            const r = worksheet.getRow(rIdx);
            for (let c = 1; c <= 9; c++) {
                r.getCell(c).border = thinBorder;
            }
        });

        fitRowHeight(worksheet.getRow(4), [
            { value: b4.value, width: 24 },
            { value: h4.value, width: 32.45 },
            { value: designationVal, width: 31 * 2 },
        ]);
        fitRowHeight(worksheet.getRow(5), [
            { value: b5.value, width: 24 },
            { value: h5.value, width: 32.45 },
        ]);

        // --- TABLE HEADERS: Rows 7 & 8 (Merged Vertically 7:8) ---
        const headers = [
            { col: 1, text: "Date", fill: GREEN_FILL, font: FONT_HEADER_11, colLetter: "A" },
            { col: 2, text: "Day", fill: GREEN_FILL, font: FONT_HEADER_11, colLetter: "B" },
            { col: 3, text: "Day Type", fill: GREEN_FILL, font: FONT_HEADER_11, colLetter: "C" },
            { col: 4, text: "Project Name", fill: GREEN_FILL, font: FONT_HEADER_10, colLetter: "D" },
            { col: 5, text: "Project ID", fill: GREEN_FILL, font: FONT_HEADER_10, colLetter: "E" },
            { col: 6, text: "ONShore/OFFShore", fill: GREEN_FILL, font: FONT_HEADER_10, colLetter: "F" },
            { col: 7, text: "Bill Type", fill: GREEN_FILL, font: FONT_HEADER_10, colLetter: "G" },
            { col: 8, text: "TOTAL", fill: BLUE_FILL, font: FONT_HEADER_10, colLetter: "H" },
            { col: 9, text: "Comments", fill: BLUE_FILL, font: FONT_HEADER_10, colLetter: "I" }
        ];

        headers.forEach((h) => {
            worksheet.mergeCells(`${h.colLetter}7:${h.colLetter}8`);
            const cell = worksheet.getCell(`${h.colLetter}7`);
            cell.value = h.text;
            cell.fill = h.fill;
            cell.font = h.font;
            cell.alignment = wrap({ horizontal: "center" });

            worksheet.getCell(`${h.colLetter}7`).border = thinBorder;
            worksheet.getCell(`${h.colLetter}8`).border = thinBorder;
        });

        // --- DATA ROWS & ACCUMULATION ---
        let daysLoggedCount = 0;
        let totalRegHoursWorked = 0;
        let billableHoursTotal = 0;
        let nonBillableHoursTotal = 0;
        let weekendHolidayHoursTotal = 0;
        let grandTotalHours = 0;

        let rowIdx = 8; // last header row — the first data row is 9

        sheetDates.forEach((ds) => {
            const d = parseLocalDate(ds);
            const dayNumStr = String(d.getDate()).padStart(2, "0");
            const monthAbbr = d.toLocaleDateString("en-US", { month: "short" });
            const dateDisplay = `${dayNumStr}-${monthAbbr}`; // DD-Mon
            const dayAbbr = d.toLocaleDateString("en-US", { weekday: "short" }); // Mon, Tue, etc.
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;

            const dayEntries = entriesByDate[ds] || [];

            // Find matching Holiday or Leave
            const matchingHoliday = allHolidays.find((h) => {
                const hDate = h.holidayDate ? h.holidayDate.split("T")[0] : "";
                return hDate === ds;
            });

            const matchingLeave = allLeaves.find((l) => {
                if (l.employeeId !== empId && String(l.employeeId) !== String(empId)) return false;
                if (l.status !== "APPROVED") return false;
                const lStart = l.startDate ? l.startDate.split("T")[0] : "";
                const lEnd = l.endDate ? l.endDate.split("T")[0] : "";
                return ds >= lStart && ds <= lEnd;
            });

            let baseDayType = isWeekend ? "Week Off" : "Working Day";
            let holidayLabel = "";

            if (matchingHoliday) {
                baseDayType = "Public Holiday";
                holidayLabel = matchingHoliday.holidayName || "Public Holiday";
            } else if (matchingLeave) {
                baseDayType = matchingLeave.leaveType || "Leave";
            }

            if (dayEntries.length > 0) {
                daysLoggedCount++;
            }

            const rowSources = dayEntries.length > 0 ? dayEntries : [null];

            rowSources.forEach((entry) => {
                rowIdx++;
                const r = worksheet.getRow(rowIdx);

                let dayType = baseDayType;
                let projectName = holidayLabel;
                let projectId = "";
                let onOff = "";
                let billType = "";
                let totalHours = 0;

                if (entry) {
                    const parsedHrs = parseFloat(entry.totalHours);
                    totalHours = isNaN(parsedHrs) ? 0 : parsedHrs;

                    if (entry.projectName && entry.projectName !== "-") projectName = entry.projectName;
                    if (entry.projectCode || entry.projectId || entry.project) {
                        projectId = entry.projectCode || entry.projectId || entry.project;
                    }
                    if (entry.onsiteOffshore || entry.location) {
                        onOff = entry.onsiteOffshore || entry.location;
                    }
                    if (entry.billable !== undefined && entry.billable !== null) {
                        billType = entry.billable ? "Billable" : "Non-Billable";
                    } else if (entry.billType) {
                        billType = String(entry.billType);
                    }
                    if (entry.dayType) dayType = entry.dayType;
                }

                const isWeekOffRow = isWeekend || dayType === "Week Off" || dayType.toLowerCase().includes("week off");

                grandTotalHours += totalHours;

                if (isWeekOffRow || dayType === "Public Holiday") {
                    weekendHolidayHoursTotal += totalHours;
                } else {
                    totalRegHoursWorked += totalHours;
                }

                const lowerBill = (billType || "").toLowerCase();
                if (lowerBill.includes("non-billable") || lowerBill.includes("non billable")) {
                    nonBillableHoursTotal += totalHours;
                } else if (lowerBill.includes("billable")) {
                    billableHoursTotal += totalHours;
                } else if (totalHours > 0) {
                    billableHoursTotal += totalHours;
                }

                // Write Cell Values
                r.getCell(1).value = dateDisplay;
                r.getCell(2).value = dayAbbr;
                r.getCell(3).value = dayType;
                r.getCell(4).value = projectName;
                r.getCell(5).value = projectId;
                r.getCell(6).value = onOff;
                r.getCell(7).value = billType;

                const hCell = r.getCell(8);
                hCell.value = Number(totalHours);
                hCell.numFmt = "0.00";

                r.getCell(9).value = entry?.notes || entry?.taskDescription || "";

                // Cell Formatting (Cols A..I / 1..9)
                for (let c = 1; c <= 9; c++) {
                    const cell = r.getCell(c);
                    cell.font = FONT_DATA_10_REG;
                    cell.border = thinBorder;
                    cell.alignment = {
                        horizontal: c === 8 ? "center" : "left",
                        vertical: "middle",
                        wrapText: true
                    };

                    if (isWeekOffRow || dayType === "Public Holiday") {
                        if (c === 3) {
                            cell.fill = GOLD_TINT_FILL;
                        } else {
                            cell.fill = GREY_FILL;
                        }
                    } else {
                        cell.fill = { type: "pattern", pattern: "none" };
                    }
                }

                fitRowHeight(r, [
                    { value: dateDisplay, width: 12.45 },
                    { value: dayAbbr, width: 10 },
                    { value: dayType, width: 14 },
                    { value: projectName, width: 22 },
                    { value: projectId, width: 15 },
                    { value: onOff, width: 16 },
                    { value: billType, width: 14 },
                    { value: r.getCell(9).value, width: 20 },
                ]);
            });
        });

        // --- SUMMARY PANEL (K2:N8) POPULATION ---
        const totalHolidaysCount = sheetDates.filter((ds) => {
            return allHolidays.some((h) => {
                const hDate = h.holidayDate ? h.holidayDate.split("T")[0] : "";
                return hDate === ds;
            });
        }).length;

        const summaryRows = [
            { row: 2, label: "Days logged", value: daysLoggedCount, fill: BLUE_FILL, isCount: true },
            { row: 3, label: "Total regular Hours worked", value: totalRegHoursWorked, fill: BLUE_FILL },
            { row: 4, label: "Billable Hours", value: billableHoursTotal, fill: BLUE_FILL },
            { row: 5, label: "Non - Billable Hours", value: nonBillableHoursTotal, fill: BLUE_FILL },
            { row: 6, label: "Total weekends & Holiday hours worked", value: weekendHolidayHoursTotal, fill: BLUE_FILL },
            { row: 7, label: "Total Holidays", value: totalHolidaysCount, fill: BLUE_FILL, isCount: true },
            { row: 8, label: "Total Hours worked.", value: grandTotalHours, fill: GREEN_FILL }
        ];

        summaryRows.forEach((s) => {
            worksheet.mergeCells(`K${s.row}:M${s.row}`);
            const lblCell = worksheet.getCell(`K${s.row}`);
            lblCell.value = s.label;
            lblCell.fill = s.fill;
            lblCell.font = s.row === 8 ? FONT_HEADER_10_BOLD : FONT_HEADER_10;
            lblCell.alignment = wrap({ horizontal: "center" });

            ["K", "L", "M"].forEach((colL) => {
                worksheet.getCell(`${colL}${s.row}`).border = thinBorder;
                worksheet.getCell(`${colL}${s.row}`).fill = s.fill;
            });

            const valCell = worksheet.getCell(`N${s.row}`);
            const parsedVal = parseFloat(s.value);
            valCell.value = isNaN(parsedVal) ? 0 : parsedVal;
            valCell.fill = s.fill;
            valCell.font = s.row === 8 ? FONT_HEADER_10_BOLD : FONT_HEADER_10;
            valCell.alignment = wrap({ horizontal: "center" });
            valCell.border = thinBorder;
            valCell.numFmt = s.isCount ? "0" : "0.00";

            fitRowHeight(worksheet.getRow(s.row), [{ value: s.label, width: 42 }]);
        });

        // --- TOTAL FOOTER ROW (Last data row + 1) ---
        const totalRowIdx = rowIdx + 1;
        const totalRow = worksheet.getRow(totalRowIdx);

        worksheet.mergeCells(`A${totalRowIdx}:F${totalRowIdx}`);
        const totLabelCell = worksheet.getCell(`A${totalRowIdx}`);
        totLabelCell.value = totalFooterLabel;
        totLabelCell.fill = BLUE_FILL;
        totLabelCell.font = FONT_HEADER_10;
        totLabelCell.alignment = wrap({ horizontal: "center" });

        ["A", "B", "C", "D", "E", "F"].forEach((colL) => {
            const c = worksheet.getCell(`${colL}${totalRowIdx}`);
            c.fill = BLUE_FILL;
            c.border = thinBorder;
        });

        const gTotCell = worksheet.getCell(`G${totalRowIdx}`);
        gTotCell.value = 0;
        gTotCell.numFmt = "0";
        gTotCell.fill = BLUE_FILL;
        gTotCell.font = FONT_HEADER_10;
        gTotCell.alignment = wrap({ horizontal: "center" });
        gTotCell.border = thinBorder;

        const hTotCell = worksheet.getCell(`H${totalRowIdx}`);
        hTotCell.value = grandTotalHours === 0 ? 0 : Number(grandTotalHours);
        hTotCell.numFmt = grandTotalHours === 0 ? "0" : "0.00";
        hTotCell.fill = BLUE_FILL;
        hTotCell.font = FONT_HEADER_10;
        hTotCell.alignment = wrap({ horizontal: "center" });
        hTotCell.border = thinBorder;

        const iTotCell = worksheet.getCell(`I${totalRowIdx}`);
        iTotCell.value = "";
        iTotCell.fill = BLUE_FILL;
        iTotCell.alignment = wrap({ horizontal: "left" });
        iTotCell.border = thinBorder;

        fitRowHeight(totalRow, [{ value: totLabelCell.value, width: 89.45 }]);
    };

    if (isAllEmployees) {
        // =========================================================================
        // MODE 1: "All Employees" Selection
        // Single Excel workbook containing ONE sheet per employee for the FULL date range.
        // Sheet names in Camel Case (e.g. JohnDoe, PriyaSharma).
        // =========================================================================
        const firstDs = dateSequence[0] || fromDate;
        const lastDs = dateSequence[dateSequence.length - 1] || toDate;
        const titleDateRangeStr = `[${formatShortDate(firstDs)} - ${formatShortDate(lastDs)}]`;

        const startYear = parseLocalDate(firstDs)?.getFullYear() || new Date().getFullYear();
        const endYear = parseLocalDate(lastDs)?.getFullYear() || startYear;
        const titleYearStr = startYear === endYear ? String(startYear) : `${startYear}-${endYear}`;
        const totalFooterLabel = `TOTAL - ${titleDateRangeStr} - ${titleYearStr}`;

        selectedIds.forEach((empId) => {
            const emp = employees.find((e) => e.id === empId || String(e.id) === String(empId)) || {};
            const empFullName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name || emp.fullName || `Employee${empId}`;
            const camelCaseName = toCamelCase(empFullName);
            const empCode = emp.oryfolksId || `EMP${empId}`;

            // Sheet name in Camel Case, collision-handled and <= 31 chars
            const sheetName = getSafeUniqueSheetName(camelCaseName, empCode);

            renderEmployeeSheet({
                emp,
                empId,
                sheetDates: dateSequence,
                sheetName,
                titleDateRangeStr,
                titleYearStr,
                summaryTitle: "PERIOD SUMMARY",
                totalFooterLabel
            });
        });
    } else {
        // =========================================================================
        // MODE 2: Single-Employee or Subset Selection (Existing Behavior Preserved)
        // Groups dates by Month Key (YYYY-MM) and creates per-month sheets.
        // =========================================================================
        const monthMap = {};
        dateSequence.forEach((ds) => {
            const parts = ds.split("-");
            const monthKey = `${parts[0]}-${parts[1]}`;
            if (!monthMap[monthKey]) monthMap[monthKey] = [];
            monthMap[monthKey].push(ds);
        });

        const monthKeys = Object.keys(monthMap).sort();

        selectedIds.forEach((empId) => {
            const emp = employees.find((e) => e.id === empId || String(e.id) === String(empId)) || {};
            const empName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name || emp.fullName || "Employee";

            monthKeys.forEach((mKey) => {
                const monthDates = monthMap[mKey];
                const sampleDate = parseLocalDate(monthDates[0]);
                const monthLong = sampleDate ? sampleDate.toLocaleDateString("en-US", { month: "long" }) : "Month";
                const yearFull = sampleDate ? sampleDate.getFullYear() : new Date().getFullYear();
                const monthYearStr = `${monthLong} ${yearFull}`;

                let rawSheetName = monthYearStr;
                if (selectedIds.length > 1) {
                    const shortName = (emp.firstName || "").trim() || (empName || "").split(" ")[0] || "EMP";
                    const codeSuffix = emp.oryfolksId ? `_${emp.oryfolksId}` : "";
                    rawSheetName = `${shortName}${codeSuffix} - ${monthYearStr}`;
                }
                const sheetName = getSafeUniqueSheetName(rawSheetName);

                const firstMonthDs = monthDates[0];
                const lastMonthDs = monthDates[monthDates.length - 1];
                const titleDateRangeStr = `[${formatShortDate(firstMonthDs)} - ${formatShortDate(lastMonthDs)}]`;
                const totalFooterLabel = `TOTAL - ${monthYearStr}`;

                renderEmployeeSheet({
                    emp,
                    empId,
                    sheetDates: monthDates,
                    sheetName,
                    titleDateRangeStr,
                    titleYearStr: String(yearFull),
                    summaryTitle: "MONTHLY SUMMARY",
                    totalFooterLabel
                });
            });
        });
    }

    // Generate Excel Buffer and Trigger Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Timesheet_${fromDate}_to_${toDate}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
