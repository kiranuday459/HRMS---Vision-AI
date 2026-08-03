import ExcelJS from "exceljs";

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
 */
export async function generateTimesheetExcel({
    dateSequence = [],
    selectedIds = [],
    employees = [],
    dateFilteredEntries = [],
    allLeaves = [],
    allHolidays = [],
    fromDate = "",
    toDate = ""
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
    const HEADER_TOTAL_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3360" } };
    const LABEL_BLUE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } }; // #4472C4 @ 60% tint
    const GOLD_TINT_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF2CC" } }; // #FFC000 @ 60% tint

    const FONT_TITLE = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    const FONT_HEADER_11 = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    const FONT_HEADER_10 = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    const FONT_LABEL_10_BOLD = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1A2744" } };
    const FONT_VALUE_10_REG = { name: "Calibri", size: 10, bold: false, color: { argb: "FF334155" } };
    const FONT_DATA_10_REG = { name: "Calibri", size: 10, bold: false, color: { argb: "FF000000" } };

    // Group dates by Month Key (YYYY-MM)
    const monthMap = {};
    dateSequence.forEach((ds) => {
        const parts = ds.split("-");
        const monthKey = `${parts[0]}-${parts[1]}`;
        if (!monthMap[monthKey]) monthMap[monthKey] = [];
        monthMap[monthKey].push(ds);
    });

    const monthKeys = Object.keys(monthMap).sort();

    // Iterate through selected employees & months to build sheets
    selectedIds.forEach((empId) => {
        const emp = employees.find((e) => e.id === empId || String(e.id) === String(empId)) || {};
        const empName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name || emp.fullName || "Employee";
        const empCode = emp.oryfolksId || `EMP${empId}`;
        const managerName = emp.reportingManagerName || emp.manager || emp.reportingManager || "PRAVEEN";

        monthKeys.forEach((mKey) => {
            const monthDates = monthMap[mKey];
            const sampleDate = parseLocalDate(monthDates[0]);
            const monthLong = sampleDate.toLocaleDateString("en-US", { month: "long" });
            const yearFull = sampleDate.getFullYear();
            const monthYearStr = `${monthLong} ${yearFull}`;

            // Sheet naming rule: if only 1 employee selected, sheet name is "<Month> <Year>" (e.g. July 2026).
            // If multiple employees selected, prefix with employee first name or short ID to ensure unique tabs.
            let rawSheetName = monthYearStr;
            if (selectedIds.length > 1) {
                const shortName = emp.firstName || empName.split(" ")[0];
                rawSheetName = `${shortName} - ${monthYearStr}`;
            }
            // Excel sheet name max length is 31 chars
            const sheetName = rawSheetName.substring(0, 31);

            const worksheet = workbook.addWorksheet(sheetName);

            // 1. Column Sizing
            worksheet.getColumn(1).width = 12.45; // A: Date
            worksheet.getColumn(2).width = 12.45; // B: Day
            worksheet.getColumn(3).width = 14.0;  // C: Day Type
            worksheet.getColumn(4).width = 22.0;  // D: Project Name
            worksheet.getColumn(5).width = 15.0;  // E: Project ID
            worksheet.getColumn(6).width = 12.0;  // F: ON/OFF
            worksheet.getColumn(7).width = 14.0;  // G: Bill Type
            worksheet.getColumn(8).width = 12.45; // H: TOTAL
            worksheet.getColumn(9).width = 3.82;  // I: Spacer
            worksheet.getColumn(10).width = 12.45; // J: Monthly Summary Label
            worksheet.getColumn(11).width = 12.45; // K: Spacer inside label
            worksheet.getColumn(12).width = 12.45; // L: Spacer inside label
            worksheet.getColumn(13).width = 12.45; // M: Monthly Summary Value

            // 2. Freeze Panes at A8 (Row 8 starts scrolling)
            worksheet.views = [
                { state: "frozen", xSplit: 0, ySplit: 7, topLeftCell: "A8", activeCell: "A8" }
            ];

            // Set default row height = 20px for all rows except Row 1
            for (let r = 1; r <= 100; r++) {
                worksheet.getRow(r).height = r === 1 ? 28 : 20;
            }

            // --- ROW 1: Title Row ---
            worksheet.mergeCells("A1:H1");
            const a1 = worksheet.getCell("A1");
            a1.value = `VISION AI HRMS TIMESHEET- ${monthYearStr}`;
            a1.fill = NAVY_FILL;
            a1.font = FONT_TITLE;
            a1.alignment = { horizontal: "center", vertical: "middle" };

            worksheet.mergeCells("J1:M1");
            const j1 = worksheet.getCell("J1");
            j1.value = "MONTHLY SUMMARY";
            j1.fill = NAVY_FILL;
            j1.font = FONT_TITLE;
            j1.alignment = { horizontal: "center", vertical: "middle" };

            // --- ROW 2: Left Side Empty / Right Side Summary Row 2 ---
            // Left side A2:H2 remains empty (height 20)

            // --- ROW 3 & 4: Employee Info Block (Left) & Summary Panel (Right) ---
            // A3: Employee Label
            const a3 = worksheet.getCell("A3");
            a3.value = "Employee:";
            a3.fill = LABEL_BLUE_FILL;
            a3.font = FONT_LABEL_10_BOLD;
            a3.alignment = { horizontal: "center", vertical: "middle" };

            worksheet.mergeCells("B3:D3");
            const b3 = worksheet.getCell("B3");
            b3.value = empName.toUpperCase();
            b3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
            b3.font = FONT_VALUE_10_REG;
            b3.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

            worksheet.mergeCells("E3:F3");
            const e3 = worksheet.getCell("E3");
            e3.value = monthYearStr;
            e3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
            e3.font = FONT_VALUE_10_REG;
            e3.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

            const g3 = worksheet.getCell("G3");
            g3.value = "Manager:";
            g3.fill = LABEL_BLUE_FILL;
            g3.font = FONT_LABEL_10_BOLD;
            g3.alignment = { horizontal: "right", vertical: "middle" };

            const h3 = worksheet.getCell("H3");
            h3.value = String(managerName).toUpperCase();
            h3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
            h3.font = FONT_VALUE_10_REG;
            h3.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

            // Row 4
            const a4 = worksheet.getCell("A4");
            a4.value = "Employee ID:";
            a4.fill = LABEL_BLUE_FILL;
            a4.font = FONT_LABEL_10_BOLD;
            a4.alignment = { horizontal: "center", vertical: "middle" };

            worksheet.mergeCells("B4:D4");
            const b4 = worksheet.getCell("B4");
            b4.value = empCode;
            b4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
            b4.font = FONT_VALUE_10_REG;
            b4.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

            const e4 = worksheet.getCell("E4");
            // Count of working days in month
            const monthWorkDaysCount = monthDates.filter((ds) => {
                const d = parseLocalDate(ds);
                return d.getDay() !== 0 && d.getDay() !== 6;
            }).length;
            e4.value = String(monthWorkDaysCount);
            e4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
            e4.font = FONT_VALUE_10_REG;
            e4.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

            const f4 = worksheet.getCell("F4");
            f4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

            const g4 = worksheet.getCell("G4");
            g4.value = "Reg Hrs/Day:";
            g4.fill = LABEL_BLUE_FILL;
            g4.font = FONT_LABEL_10_BOLD;
            g4.alignment = { horizontal: "right", vertical: "middle" };

            const h4 = worksheet.getCell("H4");
            h4.value = "8";
            h4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
            h4.font = FONT_VALUE_10_REG;
            h4.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

            // Apply thin borders to Employee Info Block (Rows 3 & 4, columns A..H)
            [3, 4].forEach((rIdx) => {
                const r = worksheet.getRow(rIdx);
                for (let c = 1; c <= 8; c++) {
                    r.getCell(c).border = thinBorder;
                }
            });

            // --- TABLE HEADERS: Rows 6 & 7 (Merged Vertically 6:7) ---
            const headers = [
                { col: 1, text: "Date", fill: NAVY_FILL, font: FONT_HEADER_11, colLetter: "A" },
                { col: 2, text: "Day", fill: NAVY_FILL, font: FONT_HEADER_11, colLetter: "B" },
                { col: 3, text: "Day Type", fill: NAVY_FILL, font: FONT_HEADER_11, colLetter: "C" },
                { col: 4, text: "Project Name", fill: GREEN_FILL, font: FONT_HEADER_10, colLetter: "D" },
                { col: 5, text: "Project ID", fill: BLUE_FILL, font: FONT_HEADER_10, colLetter: "E" },
                { col: 6, text: "ON/OFF", fill: GREEN_FILL, font: FONT_HEADER_10, colLetter: "F" },
                { col: 7, text: "Bill Type", fill: BLUE_FILL, font: FONT_HEADER_10, colLetter: "G" },
                { col: 8, text: "TOTAL", fill: HEADER_TOTAL_FILL, font: FONT_HEADER_10, colLetter: "H" }
            ];

            headers.forEach((h) => {
                worksheet.mergeCells(`${h.colLetter}6:${h.colLetter}7`);
                const cell = worksheet.getCell(`${h.colLetter}6`);
                cell.value = h.text;
                cell.fill = h.fill;
                cell.font = h.font;
                cell.alignment = { horizontal: "center", vertical: "middle" };

                // Apply border to merged cells in row 6 & 7
                worksheet.getCell(`${h.colLetter}6`).border = thinBorder;
                worksheet.getCell(`${h.colLetter}7`).border = thinBorder;
            });

            // --- DATA ROWS & ACCUMULATION ---
            let daysLoggedCount = 0;
            let totalRegHoursWorked = 0;
            let billableHoursTotal = 0;
            let nonBillableHoursTotal = 0;
            let weekendHolidayHoursTotal = 0;
            let overtimeHoursTotal = 0;
            let grandTotalHours = 0;

            monthDates.forEach((ds, idx) => {
                const rowIdx = 8 + idx;
                const r = worksheet.getRow(rowIdx);
                r.height = 20;

                const d = parseLocalDate(ds);
                const dayNumStr = String(d.getDate()).padStart(2, "0");
                const monthAbbr = d.toLocaleDateString("en-US", { month: "short" });
                const dateDisplay = `${dayNumStr}-${monthAbbr}`; // DD-Mon
                const dayAbbr = d.toLocaleDateString("en-US", { weekday: "short" }); // Mon, Tue, etc.
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                // Find entries for employee & date
                const dayEntries = dateFilteredEntries.filter(
                    (e) => (e.employeeId === empId || String(e.employeeId) === String(empId)) && e.date === ds
                );

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

                // Determine Day Type & Entry attributes
                let dayType = isWeekend ? "Week Off" : "Working Day";
                let projectName = "";
                let projectId = "";
                let onOff = "";
                let billType = "";
                let totalHours = 0;

                if (matchingHoliday) {
                    dayType = "Public Holiday";
                    projectName = matchingHoliday.holidayName || "Public Holiday";
                } else if (matchingLeave) {
                    dayType = matchingLeave.leaveType || "Leave";
                }

                if (dayEntries.length > 0) {
                    // Aggregate or pick primary entry
                    let primaryEntry = dayEntries[0];
                    dayEntries.forEach((entry) => {
                        const h = Number(entry.totalHours || 0);
                        totalHours += h;
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
                            billType = entry.billType;
                        }
                        if (entry.dayType) dayType = entry.dayType;
                    });
                } else {
                    if (isWeekend) {
                        dayType = "Week Off";
                    }
                }

                const isWeekOffRow = isWeekend || dayType === "Week Off" || dayType.toLowerCase().includes("week off");

                // Accumulate totals for Monthly Summary
                if (totalHours > 0 || dayEntries.length > 0) {
                    daysLoggedCount++;
                }

                grandTotalHours += totalHours;

                if (isWeekOffRow || dayType === "Public Holiday") {
                    weekendHolidayHoursTotal += totalHours;
                } else {
                    totalRegHoursWorked += totalHours;
                }

                if (billType.toLowerCase().includes("non-billable") || billType.toLowerCase().includes("non billable")) {
                    nonBillableHoursTotal += totalHours;
                } else if (billType.toLowerCase().includes("billable")) {
                    billableHoursTotal += totalHours;
                } else if (totalHours > 0) {
                    // Default to billable if hours present and unspecified
                    billableHoursTotal += totalHours;
                }

                // Check for overtime (hours > 8)
                if (totalHours > 8) {
                    overtimeHoursTotal += (totalHours - 8);
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

                // Cell Formatting
                for (let c = 1; c <= 8; c++) {
                    const cell = r.getCell(c);
                    cell.font = FONT_DATA_10_REG;
                    cell.border = thinBorder;
                    cell.alignment = {
                        horizontal: c === 8 ? "center" : "left",
                        vertical: "middle",
                        wrapText: true
                    };

                    // Row Highlighting Rule:
                    // Week Off rows (Saturdays/Sundays or Day Type = "Week Off"/Holiday): A-G filled #FFC000 @ 60% tint (#FFF2CC)
                    // H (TOTAL) stays unfilled!
                    if (isWeekOffRow || dayType === "Public Holiday") {
                        if (c < 8) {
                            cell.fill = GOLD_TINT_FILL;
                        } else {
                            // Column H stays unfilled
                            cell.fill = { type: "pattern", pattern: "none" };
                        }
                    } else {
                        cell.fill = { type: "pattern", pattern: "none" };
                    }
                }
            });

            // --- SUMMARY PANEL (J2:M8) POPULATION ---
            const summaryRows = [
                { row: 2, label: "Days logged", value: daysLoggedCount, fill: GREEN_FILL },
                { row: 3, label: "Total regular Hours worked", value: totalRegHoursWorked, fill: BLUE_FILL },
                { row: 4, label: "Billable Hours", value: billableHoursTotal, fill: BLUE_FILL },
                { row: 5, label: "Non-Billable Hours", value: nonBillableHoursTotal, fill: BLUE_FILL },
                { row: 6, label: "Total weekends & Holiday hours worked", value: weekendHolidayHoursTotal, fill: BLUE_FILL },
                { row: 7, label: "Total OverTime Hours Worked", value: overtimeHoursTotal, fill: BLUE_FILL },
                { row: 8, label: "Total Hours worked.", value: grandTotalHours, fill: GREEN_FILL }
            ];

            summaryRows.forEach((s) => {
                worksheet.mergeCells(`J${s.row}:L${s.row}`);
                const lblCell = worksheet.getCell(`J${s.row}`);
                lblCell.value = s.label;
                lblCell.fill = s.fill;
                lblCell.font = FONT_HEADER_10;
                lblCell.alignment = { horizontal: "center", vertical: "middle" };

                // Apply borders to J:L merged cells
                ["J", "K", "L"].forEach((colL) => {
                    worksheet.getCell(`${colL}${s.row}`).border = thinBorder;
                    worksheet.getCell(`${colL}${s.row}`).fill = s.fill;
                });

                const valCell = worksheet.getCell(`M${s.row}`);
                valCell.value = Number(s.value);
                valCell.fill = s.fill;
                valCell.font = FONT_HEADER_10;
                valCell.alignment = { horizontal: "center", vertical: "middle" };
                valCell.border = thinBorder;
                if (s.row > 2) {
                    valCell.numFmt = "0.00";
                }
            });

            // --- TOTAL FOOTER ROW (Last data row + 1) ---
            const totalRowIdx = 8 + monthDates.length;
            const totalRow = worksheet.getRow(totalRowIdx);
            totalRow.height = 20;

            worksheet.mergeCells(`A${totalRowIdx}:F${totalRowIdx}`);
            const totLabelCell = worksheet.getCell(`A${totalRowIdx}`);
            totLabelCell.value = `TOTAL - ${monthYearStr}`;
            totLabelCell.fill = NAVY_FILL;
            totLabelCell.font = FONT_HEADER_10;
            totLabelCell.alignment = { horizontal: "center", vertical: "middle" };

            // Apply fill and border to merged A..F cells
            ["A", "B", "C", "D", "E", "F"].forEach((colL) => {
                const c = worksheet.getCell(`${colL}${totalRowIdx}`);
                c.fill = NAVY_FILL;
                c.border = thinBorder;
            });

            const gTotCell = worksheet.getCell(`G${totalRowIdx}`);
            gTotCell.value = 0.00;
            gTotCell.numFmt = "0.00";
            gTotCell.fill = NAVY_FILL;
            gTotCell.font = FONT_HEADER_10;
            gTotCell.alignment = { horizontal: "center", vertical: "middle" };
            gTotCell.border = thinBorder;

            const hTotCell = worksheet.getCell(`H${totalRowIdx}`);
            hTotCell.value = Number(grandTotalHours);
            hTotCell.numFmt = "0.00";
            hTotCell.fill = NAVY_FILL;
            hTotCell.font = FONT_HEADER_10;
            hTotCell.alignment = { horizontal: "center", vertical: "middle" };
            hTotCell.border = thinBorder;
        });
    });

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
