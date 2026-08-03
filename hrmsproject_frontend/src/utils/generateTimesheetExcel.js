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

    const FONT_TITLE = { name: "Calibri", size: 14, bold: false, color: { argb: "FFFFFFFF" } };
    const FONT_HEADER_11 = { name: "Calibri", size: 11, bold: false, color: { argb: "FFFFFFFF" } };
    const FONT_HEADER_10 = { name: "Calibri", size: 10, bold: false, color: { argb: "FFFFFFFF" } };
    const FONT_HEADER_10_BOLD = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    const FONT_LABEL_10_REG = { name: "Calibri", size: 10, bold: false, color: { argb: "FFFFFFFF" } };
    const FONT_VALUE_10_BOLD = { name: "Calibri", size: 10, bold: true, color: { argb: "FF334155" } };
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

            // Group this employee's entries by date up front. A date with several project
            // rows must emit several Excel rows — the row index can no longer be derived
            // from the date index alone, or the extra projects have nowhere to go.
            const entriesByDate = {};
            dateFilteredEntries.forEach((e) => {
                if (e.employeeId !== empId && String(e.employeeId) !== String(empId)) return;
                const key = e.date ? String(e.date).split("T")[0] : "";
                if (!key) return;
                if (!entriesByDate[key]) entriesByDate[key] = [];
                entriesByDate[key].push(e);
            });
            // Dates with no entries still occupy one row (Week Off / Holiday / blank day).
            const plannedDataRows = monthDates.reduce(
                (n, ds) => n + Math.max(1, (entriesByDate[ds] || []).length), 0);

            // Title date range calculation
            const firstMonthDs = monthDates[0];
            const lastMonthDs = monthDates[monthDates.length - 1];
            const formatShortDate = (ds) => {
                if (!ds) return "";
                const d = parseLocalDate(ds);
                const day = String(d.getDate()).padStart(2, "0");
                const mon = d.toLocaleDateString("en-US", { month: "short" });
                return `${day} ${mon}`;
            };
            const dateRangeStr = `[${formatShortDate(firstMonthDs)} - ${formatShortDate(lastMonthDs)}]`;

            // 1. Column Sizing
            worksheet.getColumn(1).width = 12.45; // A: Date
            worksheet.getColumn(2).width = 10.0;  // B: Day
            worksheet.getColumn(3).width = 14.0;  // C: Day Type
            worksheet.getColumn(4).width = 22.0;  // D: Project Name
            worksheet.getColumn(5).width = 15.0;  // E: Project ID
            worksheet.getColumn(6).width = 16.0;  // F: NShore/OFFShore
            worksheet.getColumn(7).width = 14.0;  // G: Bill Type
            worksheet.getColumn(8).width = 12.45; // H: TOTAL
            worksheet.getColumn(9).width = 20.0;  // I: Comments
            worksheet.getColumn(10).width = 3.82; // J: Spacer
            worksheet.getColumn(11).width = 14.0; // K: Monthly Summary Label Part 1
            worksheet.getColumn(12).width = 14.0; // L: Monthly Summary Label Part 2
            worksheet.getColumn(13).width = 14.0; // M: Monthly Summary Label Part 3
            worksheet.getColumn(14).width = 12.45; // N: Monthly Summary Value

            // 2. Freeze Panes at A9 (Row 9 starts scrolling; Rows 1..8 stay locked at top)
            worksheet.views = [
                { state: "frozen", xSplit: 0, ySplit: 8, topLeftCell: "A9", activeCell: "A9" }
            ];

            // Set default row height = 20px for all rows except Row 1 & 2. Bound follows the
            // real row count, which now exceeds one-per-date when projects overlap.
            const lastStyledRow = Math.max(100, 9 + plannedDataRows + 5);
            for (let r = 1; r <= lastStyledRow; r++) {
                worksheet.getRow(r).height = (r === 1 || r === 2) ? 22 : 20;
            }

            // --- ROW 1 & 2: Title Row (A1:I2 merged) ---
            worksheet.mergeCells("A1:I2");
            const a1 = worksheet.getCell("A1");
            a1.value = `VISION AI HRMS TIMESHEET - ${dateRangeStr} - ${yearFull}`;
            a1.fill = NAVY_FILL;
            a1.font = FONT_TITLE;
            a1.alignment = { horizontal: "center", vertical: "middle" };

            worksheet.mergeCells("K1:N1");
            const k1 = worksheet.getCell("K1");
            k1.value = "MONTHLY SUMMARY";
            k1.fill = NAVY_FILL;
            k1.font = FONT_TITLE;
            k1.alignment = { horizontal: "center", vertical: "middle" };

            // --- ROW 3: Blank Separator Row (Left side A3:I3 empty) ---

            // --- ROW 4 & 5: Employee Info Block (Left) ---
            const designationVal = emp.designation || emp.jobTitle || emp.role || "Software Engineer";

            // Row 4
            const a4 = worksheet.getCell("A4");
            a4.value = "Employee:";
            a4.fill = BLUE_FILL;
            a4.font = FONT_HEADER_10;
            a4.alignment = { horizontal: "center", vertical: "middle" };

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
            d4.alignment = { horizontal: "center", vertical: "middle" };

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
            g4.alignment = { horizontal: "right", vertical: "middle" };

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
            a5.alignment = { horizontal: "center", vertical: "middle" };

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
            g5.alignment = { horizontal: "right", vertical: "middle" };

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

            // --- ROW 6: Blank Separator Row (Left side A6:I6 empty) ---

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
                cell.alignment = { horizontal: "center", vertical: "middle" };

                // Apply border to merged cells in row 7 & 8
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

            const GREY_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };

            // Running cursor instead of "9 + dateIndex": one row per (date × project entry).
            let rowIdx = 8; // last header row — the first data row is 9

            monthDates.forEach((ds) => {
                const d = parseLocalDate(ds);
                const dayNumStr = String(d.getDate()).padStart(2, "0");
                const monthAbbr = d.toLocaleDateString("en-US", { month: "short" });
                const dateDisplay = `${dayNumStr}-${monthAbbr}`; // DD-Mon
                const dayAbbr = d.toLocaleDateString("en-US", { weekday: "short" }); // Mon, Tue, etc.
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                // Every entry logged by this employee on this date — all of them, not just one.
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

                // Day Type applies to the whole date, whatever it holds.
                let baseDayType = isWeekend ? "Week Off" : "Working Day";
                let holidayLabel = "";

                if (matchingHoliday) {
                    baseDayType = "Public Holiday";
                    holidayLabel = matchingHoliday.holidayName || "Public Holiday";
                } else if (matchingLeave) {
                    baseDayType = matchingLeave.leaveType || "Leave";
                }

                // "Days logged" counts DATES, not rows — two projects on one day is one day.
                if (dayEntries.length > 0) {
                    daysLoggedCount++;
                }

                // One row per entry; a date with no entries still gets a single placeholder
                // row so Week Off / Holiday / empty working days remain visible.
                const rowSources = dayEntries.length > 0 ? dayEntries : [null];

                rowSources.forEach((entry) => {
                    rowIdx++;
                    const r = worksheet.getRow(rowIdx);
                    r.height = 20;

                    let dayType = baseDayType;
                    let projectName = holidayLabel;
                    let projectId = "";
                    let onOff = "";
                    let billType = "";
                    let totalHours = 0;

                    if (entry) {
                        totalHours = Number(entry.totalHours || 0);
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
                    }

                    const isWeekOffRow = isWeekend || dayType === "Week Off" || dayType.toLowerCase().includes("week off");

                    // Summary totals accumulate PER ENTRY, so each project's hours are
                    // classified by its own bill type instead of the last one on the day.
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
                        billableHoursTotal += totalHours;
                    }

                    // Write Cell Values — Date/Day repeat on each of a date's project rows.
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

                    r.getCell(9).value = ""; // Comments column

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

                        // Row Highlighting Rule:
                        // Week Off rows (Saturdays/Sundays or Day Type = "Week Off"/Holiday):
                        // Day Type cell (c === 3) highlighted yellow (#FFF2CC)
                        // All other cells (A, B, D, E, F, G, H, I) filled with light grey (#D9D9D9)
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
                });
            });

            // --- SUMMARY PANEL (K2:N8) POPULATION ---
            const totalHolidaysCount = monthDates.filter((ds) => {
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
                lblCell.alignment = { horizontal: "center", vertical: "middle" };

                // Apply borders to K:M merged cells
                ["K", "L", "M"].forEach((colL) => {
                    worksheet.getCell(`${colL}${s.row}`).border = thinBorder;
                    worksheet.getCell(`${colL}${s.row}`).fill = s.fill;
                });

                const valCell = worksheet.getCell(`N${s.row}`);
                valCell.value = Number(s.value);
                valCell.fill = s.fill;
                valCell.font = s.row === 8 ? FONT_HEADER_10_BOLD : FONT_HEADER_10;
                valCell.alignment = { horizontal: "center", vertical: "middle" };
                valCell.border = thinBorder;
                valCell.numFmt = s.isCount ? "0" : "0.00";
            });

            // --- TOTAL FOOTER ROW (Last data row + 1) ---
            // Follows the cursor, not the date count: a date can now span several rows.
            const totalRowIdx = rowIdx + 1;
            const totalRow = worksheet.getRow(totalRowIdx);
            totalRow.height = 20;

            worksheet.mergeCells(`A${totalRowIdx}:F${totalRowIdx}`);
            const totLabelCell = worksheet.getCell(`A${totalRowIdx}`);
            totLabelCell.value = `TOTAL - ${monthYearStr}`;
            totLabelCell.fill = BLUE_FILL;
            totLabelCell.font = FONT_HEADER_10;
            totLabelCell.alignment = { horizontal: "center", vertical: "middle" };

            // Apply fill and border to merged A..F cells
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
            gTotCell.alignment = { horizontal: "center", vertical: "middle" };
            gTotCell.border = thinBorder;

            const hTotCell = worksheet.getCell(`H${totalRowIdx}`);
            hTotCell.value = grandTotalHours === 0 ? 0 : Number(grandTotalHours);
            hTotCell.numFmt = grandTotalHours === 0 ? "0" : "0.00";
            hTotCell.fill = BLUE_FILL;
            hTotCell.font = FONT_HEADER_10;
            hTotCell.alignment = { horizontal: "center", vertical: "middle" };
            hTotCell.border = thinBorder;

            const iTotCell = worksheet.getCell(`I${totalRowIdx}`);
            iTotCell.value = "";
            iTotCell.fill = BLUE_FILL;
            iTotCell.border = thinBorder;
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
