import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import HrRerouteBanner from '../../../components/HrRerouteBanner';

const EMPTY_ARRAY = [];

const WeeklyTimesheetGrid = ({ weekData, onBack, onSave, employeeId, approvedLeaves = EMPTY_ARRAY, holidays = EMPTY_ARRAY, readOnly = false, onApprove, onReject, canApprove = false, canReject = false, onProbation = false, disabledAccount = false, hrDisabledReroute = false, hrRerouteEmployeeName = '' }) => {
    // Dates for the week (7 days)
    const [dates, setDates] = useState([]);

    // Project rows
    const [projectRows, setProjectRows] = useState([
        { id: Date.now(), projectId: '', projectName: '', taskId: '', taskDesc: '', onsite: 'Offshore', billable: 'Billable', location: 'India', hours: Array.from({ length: 7 }, () => ({ value: '', id: null })), comment: '' }
    ]);

    // TruTime rows (Swipe)
    const [truTimeRows, setTruTimeRows] = useState({
        swipe: Array(7).fill({ value: '', id: null }),
    });

    // Holiday / Time off / Leave
    // Note: Casual & Earned are merged into a single row (leaveC). Any historical
    // "E" entries are routed into leaveC on load for display purposes.
    const [leaveRows, setLeaveRows] = useState({
        holiday: Array(7).fill({ value: '', id: null }),
        leaveS: Array(7).fill({ value: '', id: null }),
        leaveC: Array(7).fill({ value: '', id: null }),
        leaveM: Array(7).fill({ value: '', id: null }),
        leaveP: Array(7).fill({ value: '', id: null }),
        leaveB: Array(7).fill({ value: '', id: null }),
        leaveL: Array(7).fill({ value: '', id: null })
    });

    useEffect(() => {
        if (weekData && weekData.start) {
            const dateList = [];
            let current = parseDateLocal(weekData.start);
            for (let i = 0; i < 7; i++) {
                dateList.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }
            setDates(dateList);

            // Initialize local data structures
            const projects = {};
            const swipes = Array(7).fill(null).map(() => ({ value: '', id: null }));
            const holidayData = Array(7).fill(null).map(() => ({ value: '', id: null }));
            const leavesS = Array(7).fill(null).map(() => ({ value: '', id: null }));
            const leavesC = Array(7).fill(null).map(() => ({ value: '', id: null }));
            const leavesM = Array(7).fill(null).map(() => ({ value: '', id: null }));
            const leavesP = Array(7).fill(null).map(() => ({ value: '', id: null }));
            const leavesB = Array(7).fill(null).map(() => ({ value: '', id: null }));
            const leavesL = Array(7).fill(null).map(() => ({ value: '', id: null }));

            const weekDates = [];
            let d = parseDateLocal(weekData.start);
            for (let i = 0; i < 7; i++) {
                weekDates.push(getLocalDateStr(d));
                d.setDate(d.getDate() + 1);
            }

            // Populate existing data if available
            if (weekData.entries && weekData.entries.length > 0) {
                weekData.entries.forEach(entry => {
                    const entryDateStr = getLocalDateStr(entry.date);
                    const dayIdx = weekDates.indexOf(entryDateStr);

                    if (dayIdx !== -1) {
                        if (entry.category === 'PROJECT') {
                            // Use ALL identifying fields as the composite key so that rows
                            // with different projectId (or any other field) are NOT merged together.
                            const key = [
                                entry.project || '',
                                entry.projectName || '',
                                entry.task || '',
                                entry.taskDescription || '',
                                entry.onsiteOffshore || '',
                                String(entry.billable),
                                entry.billingLocation || '',
                                entry.notes || ''
                            ].join('||');
                            if (!projects[key]) {
                                projects[key] = {
                                    id: Date.now() + Math.random(),
                                    projectId: entry.project || '',
                                    projectName: entry.projectName || '',
                                    taskId: entry.task || '',
                                    taskDesc: entry.taskDescription || '',
                                    onsite: entry.onsiteOffshore || 'Offshore',
                                    billable: entry.billable ? 'Billable' : 'Non-Billable',
                                    location: entry.billingLocation || 'India',
                                    hours: Array.from({ length: 7 }, () => ({ value: '', id: null })),
                                    comment: entry.notes || ''
                                };
                            }
                            projects[key].hours[dayIdx] = { value: entry.totalHours.toString(), id: entry.id };
                        } else if (entry.category === 'TRUTIME') {
                            swipes[dayIdx] = { value: entry.totalHours.toString(), id: entry.id };
                        } else if (entry.category === 'HOLIDAY') {
                            holidayData[dayIdx] = { value: entry.totalHours.toString(), id: entry.id };
                        } else if (entry.category === 'LEAVE') {
                            if (entry.leaveType === 'S') leavesS[dayIdx] = { value: entry.totalHours.toString(), id: entry.id };
                            // 'C' and historical 'E' both route to the merged Casual & Earned row.
                            else if (entry.leaveType === 'C' || entry.leaveType === 'E') leavesC[dayIdx] = { value: entry.totalHours.toString(), id: entry.id };
                            else if (entry.leaveType === 'M') leavesM[dayIdx] = { value: entry.totalHours.toString(), id: entry.id };
                            else if (entry.leaveType === 'P') leavesP[dayIdx] = { value: entry.totalHours.toString(), id: entry.id };
                            else if (entry.leaveType === 'B') leavesB[dayIdx] = { value: entry.totalHours.toString(), id: entry.id };
                            else if (entry.leaveType === 'L') leavesL[dayIdx] = { value: entry.totalHours.toString(), id: entry.id };
                        }
                    }
                });
            }

            // Auto-populate 4 or 8 hours for approved leaves
            weekDates.forEach((ds, dayIdx) => {
                const gridDate = parseDateLocal(ds);
                gridDate.setHours(0, 0, 0, 0);

                if (isWeekend(gridDate)) return; // Skip weekends

                approvedLeaves.forEach(leave => {
                    const start = parseDateLocal(leave.startDate);
                    const end = parseDateLocal(leave.endDate);
                    start.setHours(0, 0, 0, 0);
                    end.setHours(0, 0, 0, 0);

                    if (gridDate >= start && gridDate <= end) {
                        let hoursAuto = "8.00";
                        if (leave.sessionData && leave.sessionData[ds]) {
                            const session = leave.sessionData[ds];
                            if (session === 'MORNING' || session === 'AFTERNOON') {
                                hoursAuto = "4.00";
                            }
                        }

                        if (leave.leaveType === 'SICK' && !leavesS[dayIdx].value) {
                            leavesS[dayIdx] = { ...leavesS[dayIdx], value: hoursAuto };
                        } else if ((leave.leaveType === 'CASUAL' || leave.leaveType === 'EARNED') && !leavesC[dayIdx].value) {
                            // Casual & Earned auto-fill into the shared row.
                            leavesC[dayIdx] = { ...leavesC[dayIdx], value: hoursAuto };
                        } else if (leave.leaveType === 'MATERNITY' && !leavesM[dayIdx].value) {
                            leavesM[dayIdx] = { ...leavesM[dayIdx], value: hoursAuto };
                        } else if (leave.leaveType === 'PATERNITY' && !leavesP[dayIdx].value) {
                            leavesP[dayIdx] = { ...leavesP[dayIdx], value: hoursAuto };
                        } else if (leave.leaveType === 'BEREAVEMENT' && !leavesB[dayIdx].value) {
                            leavesB[dayIdx] = { ...leavesB[dayIdx], value: hoursAuto };
                        } else if (leave.leaveType === 'LOP' && !leavesL[dayIdx].value) {
                            leavesL[dayIdx] = { ...leavesL[dayIdx], value: hoursAuto };
                        }
                    }
                });
            });

            // Auto-populate 8 hours for holidays
            weekDates.forEach((ds, dayIdx) => {
                const gridDate = parseDateLocal(ds);
                if (isWeekend(gridDate)) return; // Skip weekends

                if (holidays.some(h => getLocalDateStr(h.holidayDate) === ds) && !holidayData[dayIdx].value) {
                    holidayData[dayIdx] = { ...holidayData[dayIdx], value: '8.00' };
                }
            });

            const projectRowsList = Object.values(projects);
            if (projectRowsList.length > 0) setProjectRows(projectRowsList);
            else setProjectRows([{ id: Date.now(), projectId: '', projectName: '', taskId: '', taskDesc: '', onsite: 'Offshore', billable: 'Billable', location: 'India', hours: Array.from({ length: 7 }, () => ({ value: '', id: null })), comment: '' }]);

            setTruTimeRows({ swipe: swipes });
            setLeaveRows({
                holiday: holidayData,
                leaveS: leavesS,
                leaveC: leavesC,
                leaveM: leavesM,
                leaveP: leavesP,
                leaveB: leavesB,
                leaveL: leavesL
            });
        }
    }, [weekData, approvedLeaves, holidays]);

    const handleAddRow = () => {
        setProjectRows([...projectRows, { id: Date.now(), projectId: '', projectName: '', taskId: '', taskDesc: '', onsite: 'Offshore', billable: 'Billable', location: 'India', hours: Array.from({ length: 7 }, () => ({ value: '', id: null })), comment: '' }]);
    };

    const handleRowChange = (rowIndex, field, value) => {
        const updated = projectRows.map((row, idx) =>
            idx === rowIndex ? { ...row, [field]: value } : row
        );
        setProjectRows(updated);
    };

    const getLocalDateStr = (date) => {
        if (!date) return "";
        const d = date instanceof Date ? date : new Date(date);
        // If it was a string YYYY-MM-DD, new Date(string) creates UTC.
        // But getFullYear/getMonth/getDate are local.
        // If user is in UTC+5:30, UTC 00:00 is 05:30 same day. Correct.
        // If user is in UTC-5:00, UTC 00:00 is 19:00 previous day. Incorrect!
        // So we strictly use string splitting for YYYY-MM-DD strings.
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
            return date.split('T')[0];
        }
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const parseDateLocal = (d) => {
        if (!d) return new Date();
        if (d instanceof Date) return new Date(d);
        const s = d.toString().split('T')[0];
        const parts = s.split('-');
        if (parts.length === 3) {
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        return new Date(d);
    };

    const isWeekend = (date) => {
        if (!date) return false;
        const day = date instanceof Date ? date.getDay() : new Date(date).getDay();
        return day === 0 || day === 6; // Sunday = 0, Saturday = 6
    };

    const isHolidayDay = (dayIdx) => {
        if (!dates[dayIdx]) return false;
        const ds = getLocalDateStr(dates[dayIdx]);
        return holidays.some(h => h.holidayDate === ds);
    };

    // A day is "future" when its calendar date is strictly after today (local time).
    // Future days cannot receive timesheet hours — only today and past days are editable.
    const isFutureDay = (date) => {
        if (!date) return false;
        const d = date instanceof Date ? new Date(date) : new Date(date);
        d.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return d > today;
    };



    // Numeric-only sanitizer for timesheet hour fields:
    // keeps digits and a single decimal point (hours are fractional, e.g. 4.5);
    // strips letters, symbols, spaces, etc. Blocks invalid input while typing AND on paste.
    const sanitizeHours = (value) => {
        let v = String(value ?? '').replace(/[^0-9.]/g, '');
        const firstDot = v.indexOf('.');
        if (firstDot !== -1) {
            v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
        }
        return v;
    };

    // Block invalid keystrokes (letters/symbols/space) before they register.
    const handleHoursKeyDown = (e) => {
        const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'];
        if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) return;
        if (e.key === '.') {
            if (e.currentTarget.value.includes('.')) e.preventDefault();
            return;
        }
        if (!/^[0-9]$/.test(e.key)) e.preventDefault();
    };

    const handleHourChange = (rowIndex, dayIndex, value) => {
        // Validation removed to allow "two entries in single column" (e.g. 4h Leave + 4h Work)
        const clean = sanitizeHours(value);
        const updated = projectRows.map((row, rIdx) => {
            if (rIdx !== rowIndex) return row;
            const newHours = row.hours.map((h, dIdx) =>
                dIdx === dayIndex ? { ...h, value: clean } : h
            );
            return { ...row, hours: newHours };
        });
        setProjectRows(updated);
    };

    const handleLeaveHourChange = (typeKey, dayIndex, value) => {
        const clean = sanitizeHours(value);
        const updated = { ...leaveRows, [typeKey]: [...leaveRows[typeKey]] };
        updated[typeKey][dayIndex] = { ...updated[typeKey][dayIndex], value: clean };
        setLeaveRows(updated);
    };

    const calculateRowTotal = (hours) => {
        return hours.reduce((sum, h) => sum + (parseFloat(h.value) || 0), 0);
    };

    const getGrandTotal = () => {
        let total = 0;
        projectRows.forEach(row => total += calculateRowTotal(row.hours));
        leaveRows.holiday.forEach(h => total += (parseFloat(h.value) || 0));
        leaveRows.leaveS.forEach(h => total += (parseFloat(h.value) || 0));
        leaveRows.leaveC.forEach(h => total += (parseFloat(h.value) || 0));
        leaveRows.leaveM.forEach(h => total += (parseFloat(h.value) || 0));
        leaveRows.leaveP.forEach(h => total += (parseFloat(h.value) || 0));
        leaveRows.leaveB.forEach(h => total += (parseFloat(h.value) || 0));
        leaveRows.leaveL.forEach(h => total += (parseFloat(h.value) || 0));
        return total;
    };

    const getTruTimeTotal = () => {
        let total = 0;
        truTimeRows.swipe.forEach(h => total += (parseFloat(h.value) || 0));
        return total;
    };

    const handleSave = () => {
        // Probation guard: only LOP leave hours are valid; reject if other paid-leave hours were entered.
        if (onProbation) {
            const paidLeaveKeys = ['leaveS', 'leaveC', 'leaveM', 'leaveP', 'leaveB'];
            const hasPaidLeave = paidLeaveKeys.some(k =>
                (leaveRows[k] || []).some(h => (parseFloat(h.value) || 0) > 0)
            );
            if (hasPaidLeave) {
                toast.error("You are on probation. Only LOP leave can be entered until probation ends.");
                return;
            }
        }

        // Validate project rows: a row carrying hours must have Project ID and Name.
        for (let idx = 0; idx < projectRows.length; idx++) {
            const row = projectRows[idx];
            const rowTotal = calculateRowTotal(row.hours);
            if (rowTotal > 0) {
                if (!row.projectId || !row.projectId.trim()) {
                    toast.error(`Project ID is required for project row ${idx + 1}.`);
                    return;
                }
                if (!row.projectName || !row.projectName.trim()) {
                    toast.error(`Project Name is required for project row ${idx + 1}.`);
                    return;
                }
            }
        }

        // Validate daily hours
        for (let i = 0; i < 7; i++) {
            // Skip weekends and future days — future days are locked and cannot carry hours,
            // so a week with future weekdays can still be submitted for the available days.
            if (isWeekend(dates[i]) || isFutureDay(dates[i])) continue;
            let dailyTotal = 0;
            projectRows.forEach(row => dailyTotal += (parseFloat(row.hours[i].value) || 0));
            dailyTotal += (parseFloat(leaveRows.holiday[i].value) || 0);
            dailyTotal += (parseFloat(leaveRows.leaveS[i].value) || 0);
            dailyTotal += (parseFloat(leaveRows.leaveC[i].value) || 0);
            dailyTotal += (parseFloat(leaveRows.leaveM[i].value) || 0);
            dailyTotal += (parseFloat(leaveRows.leaveP[i].value) || 0);
            dailyTotal += (parseFloat(leaveRows.leaveB[i].value) || 0);
            dailyTotal += (parseFloat(leaveRows.leaveL[i].value) || 0);

            if (dailyTotal <= 0) {
                toast.error(`Please fill hours for ${dates[i].toDateString()}`);
                return;
            }
            if (dailyTotal >= 24) {
                toast.error(`Total hours for ${dates[i].toDateString()} must be less than 24.`);
                return;
            }
        }

        const payload = {
            employeeId,
            weekStart: getLocalDateStr(weekData.start),
            entries: []
        };

        projectRows.forEach(row => {
            row.hours.forEach((h, i) => {
                const val = parseFloat(h.value);
                if (val > 0) {
                    payload.entries.push({
                        id: h.id,
                        date: getLocalDateStr(dates[i]),
                        project: row.projectId,
                        projectName: row.projectName,
                        task: row.taskId,
                        taskDescription: row.taskDesc,
                        onsiteOffshore: row.onsite,
                        billingLocation: row.location,
                        billable: row.billable === 'Billable',
                        totalHours: val,
                        category: 'PROJECT',
                        notes: row.comment
                    });
                }
            });
        });

        truTimeRows.swipe.forEach((h, i) => {
            const val = parseFloat(h.value);
            if (val > 0) {
                payload.entries.push({
                    id: h.id,
                    date: getLocalDateStr(dates[i]),
                    totalHours: val,
                    category: 'TRUTIME',
                    projectName: 'TruTime Swipe'
                });
            }
        });

        leaveRows.holiday.forEach((h, i) => {
            const val = parseFloat(h.value);
            if (val > 0) {
                payload.entries.push({
                    id: h.id,
                    date: getLocalDateStr(dates[i]),
                    totalHours: val,
                    category: 'HOLIDAY',
                    projectName: 'Holiday'
                });
            }
        });

        const leaveTypes = ['S', 'C', 'M', 'P', 'B', 'L'];
        const fullNames = ['Sick', 'Casual & Earned', 'Maternity', 'Paternity', 'Bereavement', 'LOP'];
        ['leaveS', 'leaveC', 'leaveM', 'leaveP', 'leaveB', 'leaveL'].forEach((key, typeIdx) => {
            leaveRows[key].forEach((h, i) => {
                const val = parseFloat(h.value);
                if (val > 0) {
                    payload.entries.push({
                        id: h.id,
                        date: getLocalDateStr(dates[i]),
                        totalHours: val,
                        category: 'LEAVE',
                        leaveType: leaveTypes[typeIdx],
                        projectName: `Leave (${fullNames[typeIdx]})`
                    });
                }
            });
        });

        // Safety: never submit hours for a future date (e.g. an auto-filled future holiday).
        payload.entries = payload.entries.filter(e => !isFutureDay(parseDateLocal(e.date)));

        onSave(payload);
    };

    const formatDateHeader = (date) => {
        if (!date || !(date instanceof Date)) return { day: '', name: '' };
        const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        return {
            day: date.getDate(),
            name: days[date.getDay()] || ''
        };
    };

    // A fully-future week (every day after today) locks all columns and disables Submit.
    const allFutureWeek = dates.length === 7 && dates.every(isFutureDay);

    return (
        <div className="flex flex-col max-w-6xl mx-auto w-full flex-1 min-h-0">
            {/* Back navigation — standalone, ABOVE/OUTSIDE the timesheet card */}
            <button
                onClick={onBack}
                aria-label="Back"
                className="self-start mb-3 inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold text-sm transition-colors group"
            >
                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back</span>
            </button>

            {/* Disabled-account banner — shown to Admin/HR/RM viewing a disabled employee's timesheet.
                Records are read-only; no approve/reject actions are available. */}
            {disabledAccount && (
                <div className="mb-3 flex items-start gap-2 bg-[#F1EFE8] text-[#5F5E5A] text-[13px] rounded-lg px-4 py-3 border border-[#D3D1C7]">
                    <span className="mt-px">⚠</span>
                    <span>This employee's account has been disabled. Records are visible for reference only. No actions can be taken.</span>
                </div>
            )}

            {/* HR-disabled reroute note (Part 3): shown to the RM handling the HR stage. */}
            {hrDisabledReroute && (
                <div className="mb-3">
                    <HrRerouteBanner variant="detail" employeeName={hrRerouteEmployeeName} className="w-full" />
                </div>
            )}

            {/* Rejection reason banner if week/entries are rejected */}
            {(() => {
                const rejectedEntry = (weekData?.entries || []).find(e => e.status === 'REJECTED' && (e.rejectionReason || e.managerComments));
                const reason = rejectedEntry?.rejectionReason || rejectedEntry?.managerComments || weekData?.rejectionReason;
                if (weekData?.status === 'REJECTED' || (weekData?.entries || []).some(e => e.status === 'REJECTED')) {
                    return (
                        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-start gap-3">
                            <span className="text-red-500 font-bold text-base mt-0.5">⚠</span>
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider text-red-800">Rejection Reason</p>
                                <p className="text-xs font-bold text-red-700 mt-1 italic">
                                    "{reason || 'No reason provided.'}"
                                </p>
                            </div>
                        </div>
                    );
                }
                return null;
            })()}

            <div className="bg-white rounded-xl shadow-xl border border-[#D3D1C7] overflow-hidden flex flex-col flex-1 min-h-0 w-full animate-in fade-in zoom-in duration-300">
                {/* Header — white background, blue accents only */}
                <div className="bg-white border-b border-[#D3D1C7] px-4 md:px-8 py-3 shrink-0">
                    {/* Employee identity row — only rendered when viewing another employee's timesheet
                        (Admin / HR / RM team views pass weekData.employeeName). My Timesheet passes no
                        employeeName, so a user never sees their own name on their own timesheet. */}
                    {weekData?.employeeName && (
                        <div className="flex items-center gap-3 pb-3 mb-3 border-b border-[#F1EFE8]">
                            <div className="w-8 h-8 rounded-full bg-[#F1EFE8] flex items-center justify-center text-xs font-bold text-[#2C2C2A] uppercase shrink-0">
                                {weekData.employeeName?.[0] || 'U'}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-[#2C2C2A] uppercase tracking-tight">{weekData.employeeName}</span>
                                <span className="text-[12px] text-[#5F5E5A]">· ID: {weekData.employeeOfficeId || weekData.employeeId}</span>
                                {disabledAccount && (
                                    <span className="inline-flex px-2 py-0.5 bg-[#D3D1C7] text-[#5F5E5A] text-[10px] font-medium rounded-[4px]">DISABLED</span>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center gap-3">
                            <h2 className="text-base font-medium text-[#185FA5]">Weekly Timesheet</h2>
                            <span className="inline-block bg-[#185FA5] text-white px-3 py-1 rounded-[20px] text-[10px] font-bold">
                                {weekData.startDate} - {weekData.endDate}
                            </span>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            {!readOnly ? (
                                <button onClick={handleSave} disabled={allFutureWeek} className={`flex-1 sm:flex-none px-4 md:px-5 py-2 rounded-lg text-[9px] md:text-[10px] font-bold transition-all shadow-sm tracking-widest uppercase ${allFutureWeek ? 'bg-[#D3D1C7] text-[#8A8880] cursor-not-allowed' : 'bg-[#185FA5] text-white hover:bg-[#0C447C] active:scale-95'}`}>
                                    SUBMIT SHEET
                                </button>
                            ) : (canApprove && canReject && onApprove && onReject && !disabledAccount && String(employeeId) !== String(JSON.parse(localStorage.getItem("user"))?.employeeId)) && (
                                <>
                                    <button onClick={() => onApprove(weekData)} className="flex-1 sm:flex-none px-4 md:px-5 py-2 bg-emerald-600 text-white rounded-lg text-[9px] md:text-[10px] font-bold hover:bg-emerald-500 transition-all shadow-sm active:scale-95 tracking-widest uppercase">
                                        APPROVE
                                    </button>
                                    <button onClick={() => onReject(weekData)} className="flex-1 sm:flex-none px-4 md:px-5 py-2 bg-red-600 text-white rounded-lg text-[9px] md:text-[10px] font-bold hover:bg-red-500 transition-all shadow-sm active:scale-95 tracking-widest uppercase">
                                        REJECT
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

            {/* Content */}
            <div className="flex-1 overflow-auto min-h-0 bg-white">
                {/* Desktop View (Table) */}
                <div className="hidden lg:block">
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-white text-[#0C447C] text-[11px] font-bold uppercase tracking-wider">
                                <th className="p-1 border-r border-b border-[#F1EFE8] text-left min-w-[70px]">Project ID <span className="text-red-500">*</span></th>
                                <th className="p-1 border-r border-b border-[#F1EFE8] text-left min-w-[100px]">Project Name <span className="text-red-500">*</span></th>
                                <th className="p-1 border-r border-b border-[#F1EFE8] text-left min-w-[70px]">Task ID</th>
                                <th className="p-1 border-r border-b border-[#F1EFE8] text-center min-w-[70px]">On/Off</th>
                                <th className="p-1 border-r border-b border-[#F1EFE8] text-center min-w-[80px]">Billable</th>
                                <th className="p-1 border-r border-b border-[#F1EFE8] text-center min-w-[110px]">Location</th>
                                {dates.map((d, i) => {
                                    const header = formatDateHeader(d);
                                    const future = isFutureDay(d);
                                    return (
                                        <th key={i} className="p-2 border-r border-b border-[#F1EFE8] text-center min-w-[45px]">
                                            <div className={`text-[13px] font-medium ${future ? 'text-[#B4B2A9]' : 'text-[#185FA5]'}`}>{header.day}</div>
                                            <div className={`text-[11px] font-normal ${future ? 'text-[#D3D1C7]' : 'text-[#0C447C]'}`}>{header.name}</div>
                                        </th>
                                    );
                                })}
                                <th className="p-1 border-r border-b border-[#F1EFE8] text-center min-w-[50px]">Total</th>
                                <th className="p-1 border-r border-b border-[#F1EFE8] text-center min-w-[90px]">Comment</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1EFE8]">
                            {/* Project Rows */}
                            {projectRows.map((row, index) => (
                                <tr key={row.id} className="hover:bg-white transition-colors group">
                                    <td className="p-0.5 border-r border-[#F1EFE8]">
                                        <input type="text" value={row.projectId} maxLength={32} onChange={(e) => handleRowChange(index, 'projectId', e.target.value)} className="w-full p-2 text-[11px] border border-transparent hover:border-[#F1EFE8] focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20 rounded bg-transparent focus:bg-white outline-none" />
                                    </td>
                                    <td className="p-0.5 border-r border-[#F1EFE8]">
                                        <input type="text" value={row.projectName} maxLength={32} onChange={(e) => handleRowChange(index, 'projectName', e.target.value)} className="w-full p-2 text-[11px] border border-transparent hover:border-[#F1EFE8] focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20 rounded bg-transparent focus:bg-white outline-none" />
                                    </td>
                                    <td className="p-0.5 border-r border-[#F1EFE8]">
                                        <input type="text" value={row.taskId} maxLength={32} onChange={(e) => handleRowChange(index, 'taskId', e.target.value)} className="w-full p-2 text-[11px] border border-transparent hover:border-[#F1EFE8] focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20 rounded bg-transparent focus:bg-white outline-none" />
                                    </td>
                                    <td className="p-0.5 border-r border-[#F1EFE8]">
                                        <select value={row.onsite} onChange={(e) => handleRowChange(index, 'onsite', e.target.value)} className="w-full p-2 text-[11px] bg-transparent outline-none">
                                            <option>Onsite</option>
                                            <option>Offshore</option>
                                        </select>
                                    </td>
                                    <td className="p-0.5 border-r border-[#F1EFE8]">
                                        <select value={row.billable} onChange={(e) => handleRowChange(index, 'billable', e.target.value)} className="w-full p-2 text-[11px] bg-transparent outline-none">
                                            <option>Billable</option>
                                            <option>Non-Billable</option>
                                        </select>
                                    </td>
                                    <td className="p-0.5 border-r border-[#F1EFE8]">
                                        <select
                                            value={row.location}
                                            disabled={readOnly}
                                            onChange={(e) => handleRowChange(index, 'location', e.target.value)}
                                            className="w-full p-2 text-[11px] bg-transparent outline-none"
                                        >
                                            <option value="India">India</option>
                                            <option value="Japan">Japan</option>
                                            <option value="Singapore">Singapore</option>
                                        </select>
                                    </td>
                                    {row.hours.map((h, i) => {
                                        const weekend = isWeekend(dates[i]);
                                        const future = isFutureDay(dates[i]);
                                        return (
                                            <td key={i} className={`p-0.5 border-r border-[#F1EFE8] ${future ? 'bg-[#F1EFE8]' : ''}`}>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    maxLength={2}
                                                    value={h.value}
                                                    disabled={weekend || readOnly || isHolidayDay(i) || future}
                                                    onKeyDown={handleHoursKeyDown}
                                                    onChange={(e) => handleHourChange(index, i, e.target.value)}
                                                    className={`w-full p-2 text-[11px] text-center rounded outline-none font-bold ${future ? 'bg-[#F1EFE8] text-[#B4B2A9] border-none cursor-not-allowed' : `border border-transparent hover:border-[#F1EFE8] focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20 bg-transparent focus:bg-white ${weekend || isHolidayDay(i) ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700'}`}`}
                                                />
                                            </td>
                                        );
                                    })}
                                    <td className="p-0.5 border-r border-[#F1EFE8] text-center font-black text-slate-700 text-[11px]">
                                        {calculateRowTotal(row.hours).toFixed(2)}
                                    </td>
                                    <td className="p-0.5 border-r border-[#F1EFE8]">
                                        <input type="text" value={row.comment} maxLength={32} onChange={(e) => handleRowChange(index, 'comment', e.target.value)} className="w-full p-2 text-[11px] bg-transparent outline-none" />
                                    </td>
                                </tr>
                            ))}

                            {/* Special Rows Button */}
                            {!readOnly && (
                                <tr className="bg-white">
                                    <td colSpan="16" className="p-1.5 pl-4">
                                        <button onClick={handleAddRow} className="flex items-center gap-2 text-[#185FA5] font-medium text-[13px] hover:text-[#0C447C]">
                                            <div className="w-4 h-4 bg-transparent rounded-full flex items-center justify-center">
                                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 5v14M5 12h14" />
                                                </svg>
                                            </div>
                                            <span>ADD PROJECT ROW</span>
                                        </button>
                                    </td>
                                </tr>
                            )}

                            {/* TruTime / Leave section */}
                            <tr className="bg-white text-[11px] font-bold uppercase tracking-wider text-[#0C447C]">
                                <td colSpan="6" className="p-2 pl-6 border-r border-[#F1EFE8]">TruTime / Holiday / Leave</td>
                                <td colSpan="7" className="p-2 border-r border-[#F1EFE8]"></td>
                                <td colSpan="3"></td>
                            </tr>

                            {/* Swipe Hours */}
                            <tr className="text-[11px]">
                                <td colSpan="6" className="p-2 pl-10 text-[#888780] border-r border-[#F1EFE8] italic font-medium">Swipe in hours</td>
                                {truTimeRows.swipe.map((h, i) => {
                                    const weekend = isWeekend(dates[i]);
                                    const future = isFutureDay(dates[i]);
                                    return (
                                        <td key={i} className={`p-0 border-r border-[#F1EFE8] h-8 ${future ? 'bg-[#F1EFE8]' : 'bg-white'}`}>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                maxLength={2}
                                                value={h.value}
                                                disabled={weekend || readOnly || isHolidayDay(i) || future}
                                                onKeyDown={handleHoursKeyDown}
                                                onChange={(e) => {
                                                    const val = sanitizeHours(e.target.value);
                                                    const updated = { ...truTimeRows, swipe: [...truTimeRows.swipe] };
                                                    updated.swipe[i] = { ...updated.swipe[i], value: val };
                                                    setTruTimeRows(updated);
                                                }}
                                                className={`w-full h-full text-center outline-none font-bold ${future ? 'bg-[#F1EFE8] text-[#B4B2A9] cursor-not-allowed' : `bg-transparent ${weekend || isHolidayDay(i) ? 'text-slate-400 cursor-not-allowed' : 'text-slate-400'}`}`}
                                            />
                                        </td>
                                    );
                                })}
                                <td className="text-center font-bold text-slate-400">{calculateRowTotal(truTimeRows.swipe).toFixed(2)}</td>
                                <td colSpan="2"></td>
                            </tr>

                            {/* Holiday Row */}
                            <tr className="text-[11px]">
                                <td colSpan="6" className="p-2 pl-10 text-[#888780] border-r border-[#F1EFE8] italic font-medium">Holiday (Public/National)</td>
                                {leaveRows.holiday.map((h, i) => {
                                    const isHoliday = isHolidayDay(i);
                                    return (
                                        <td key={i} className={`p-0 border-r border-[#F1EFE8] ${isHoliday ? 'bg-amber-100/50' : 'bg-amber-50/10'}`}>
                                            <input
                                                type="text"
                                                value={h.value}
                                                disabled={true}
                                                className={`w-full text-center h-full outline-none bg-transparent font-bold ${isHoliday ? 'text-amber-700' : 'text-amber-600/50'} cursor-not-allowed`}
                                            />
                                        </td>
                                    );
                                })}
                                <td className="text-center font-bold text-amber-600">{calculateRowTotal(leaveRows.holiday).toFixed(2)}</td>
                                <td colSpan="2"></td>
                            </tr>

                            {/* Leave Rows S, C, M, P, B, L (Casual & Earned merged) */}
                            {['S', 'C', 'M', 'P', 'B', 'L'].map((type) => {
                                const key = `leave${type}`;
                                // Only show a leave row when there is an actual approved/recorded
                                // leave for this type in the week. Rows are auto-filled from
                                // approvedLeaves (and saved entries), so an all-zero row means the
                                // employee has no approved leave of this type — hide it.
                                const hasLeave = leaveRows[key].some(h => (parseFloat(h.value) || 0) > 0);
                                if (!hasLeave) return null;
                                const labelMap = {
                                    'S': 'Leave (Sick)',
                                    'C': 'Leave (Casual & Earned)',
                                    'M': 'Leave (Maternity)',
                                    'P': 'Leave (Paternity)',
                                    'B': 'Leave (Bereavement)',
                                    'L': 'Leave (LOP)'
                                };
                                const isPaidLeave = type !== 'L';
                                const lockedByProbation = onProbation && isPaidLeave;
                                const cellTone = '';
                                return (
                                    <tr key={type} className={`text-[11px] ${lockedByProbation ? 'opacity-40' : ''}`}>
                                        <td colSpan="6" className="p-2 pl-10 text-slate-500 border-r border-[#F1EFE8] italic font-medium">
                                            {labelMap[type]}
                                            {lockedByProbation && <span className="ml-2 text-[9px] text-red-500 font-bold not-italic uppercase tracking-widest">Locked (Probation)</span>}
                                        </td>
                                        {leaveRows[key].map((h, i) => {
                                            const future = isFutureDay(dates[i]);
                                            return (
                                                <td key={i} className={`p-0 border-r border-[#F1EFE8] ${future ? 'bg-[#F1EFE8]' : cellTone}`}>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        maxLength={2}
                                                        value={h.value}
                                                        disabled={readOnly || lockedByProbation || future}
                                                        onKeyDown={handleHoursKeyDown}
                                                        onChange={(e) => handleLeaveHourChange(key, i, e.target.value)}
                                                        className={`w-full text-center h-full outline-none font-bold transition-colors disabled:cursor-not-allowed ${future ? 'bg-[#F1EFE8] text-[#B4B2A9]' : 'bg-transparent text-slate-500 hover:bg-white focus:bg-white'}`}
                                                    />
                                                </td>
                                            );
                                        })}
                                        <td className="text-center font-bold text-slate-500">{calculateRowTotal(leaveRows[key]).toFixed(2)}</td>
                                        <td colSpan="2"></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile/Tablet View (Cards) */}
                <div className="lg:hidden p-4 space-y-6">
                    {/* Project Entries */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Project Entries</h3>
                            {!readOnly && (
                                <button onClick={handleAddRow} className="text-[#185FA5] text-[10px] font-bold">+ ADD ROW</button>
                            )}
                        </div>
                        {projectRows.map((row, index) => (
                            <div key={row.id} className="bg-white rounded-xl shadow-sm border border-[#F1EFE8] p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Proj ID</label>
                                        <input type="text" value={row.projectId} maxLength={32} onChange={(e) => handleRowChange(index, 'projectId', e.target.value)} className="w-full p-2 text-xs bg-white rounded border-[#F1EFE8] border focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20 outline-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Proj Name</label>
                                        <input type="text" value={row.projectName} maxLength={32} onChange={(e) => handleRowChange(index, 'projectName', e.target.value)} className="w-full p-2 text-xs bg-white rounded border-[#F1EFE8] border focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20 outline-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Task ID</label>
                                        <input type="text" value={row.taskId} maxLength={32} onChange={(e) => handleRowChange(index, 'taskId', e.target.value)} className="w-full p-2 text-xs bg-white rounded border-[#F1EFE8] border focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20 outline-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Location</label>
                                        <select value={row.location} onChange={(e) => handleRowChange(index, 'location', e.target.value)} className="w-full p-2 text-xs bg-white rounded outline-none border-[#F1EFE8] border focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20">
                                            <option value="India">India</option>
                                            <option value="Japan">Japan</option>
                                            <option value="Singapore">Singapore</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Daily Hours</label>
                                    <div className="grid grid-cols-7 gap-1">
                                        {row.hours.map((h, i) => {
                                            const future = isFutureDay(dates[i]);
                                            return (
                                            <div key={i} className="flex flex-col items-center">
                                                <span className={`text-[7px] font-bold mb-1 ${future ? 'text-[#D3D1C7]' : 'text-slate-400'}`}>
                                                    {formatDateHeader(dates[i])?.name?.charAt(0) || ''}
                                                </span>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    maxLength={2}
                                                    value={h.value}
                                                    disabled={isWeekend(dates[i]) || readOnly || isHolidayDay(i) || future}
                                                    onKeyDown={handleHoursKeyDown}
                                                    onChange={(e) => handleHourChange(index, i, e.target.value)}
                                                    className={`w-full h-8 p-0 text-center text-[10px] font-bold rounded outline-none ${future ? 'bg-[#F1EFE8] text-[#B4B2A9] border-none cursor-not-allowed' : isWeekend(dates[i]) || isHolidayDay(i) ? 'bg-white text-slate-300' : 'bg-white text-slate-700 border-[#F1EFE8] border focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20'}`}
                                                />
                                            </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Total: <span className="text-slate-700">{calculateRowTotal(row.hours).toFixed(2)}</span></span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* TruTime & Leaves Mobile */}
                    <div className="bg-white rounded-xl shadow-sm border border-[#F1EFE8] overflow-hidden divide-y divide-slate-50">
                        <div className="p-4">
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Leave & TruTime</h3>
                            <div className="space-y-4">
                                {['swipe', 'holiday', 'leaveS', 'leaveC', 'leaveM', 'leaveP', 'leaveB', 'leaveL'].map((key) => {
                                    // Hide leave rows with no approved/recorded leave (all-zero).
                                    // Swipe and Holiday are not employee leaves, so they always render.
                                    if (key.startsWith('leave')) {
                                        const hasLeave = leaveRows[key].some(h => (parseFloat(h.value) || 0) > 0);
                                        if (!hasLeave) return null;
                                    }
                                    const labelMap = {
                                        'leaveS': 'Leave (Sick)',
                                        'leaveC': 'Leave (Casual & Earned)',
                                        'leaveM': 'Leave (Maternity)',
                                        'leaveP': 'Leave (Paternity)',
                                        'leaveB': 'Leave (Bereavement)',
                                        'leaveL': 'Leave (LOP)'
                                    };
                                    const label = key === 'swipe' ? 'TruTime Index' : key === 'holiday' ? 'Holidays' : labelMap[key];
                                    const data = key === 'swipe' ? truTimeRows.swipe : leaveRows[key];
                                    const isPaidLeave = key.startsWith('leave') && key !== 'leaveL';
                                    const lockedByProbation = onProbation && isPaidLeave;
                                    return (
                                        <div key={key} className={`space-y-1.5 ${lockedByProbation ? 'opacity-40' : ''}`}>
                                            <div className="flex justify-between items-center">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    {label}
                                                    {lockedByProbation && <span className="ml-1 text-red-500">(Locked)</span>}
                                                </label>
                                                <span className="text-[9px] font-bold text-slate-700">{calculateRowTotal(data).toFixed(2)}h</span>
                                            </div>
                                            <div className="grid grid-cols-7 gap-1">
                                                {data.map((h, i) => {
                                                    const future = isFutureDay(dates[i]);
                                                    return (
                                                    <input
                                                        key={i}
                                                        type="text"
                                                        inputMode="decimal"
                                                        maxLength={2}
                                                        value={h.value}
                                                        disabled={key === 'holiday' || readOnly || isWeekend(dates[i]) || lockedByProbation || future}
                                                        onKeyDown={handleHoursKeyDown}
                                                        onChange={(e) => key === 'swipe' ? setTruTimeRows({ ...truTimeRows, swipe: truTimeRows.swipe.map((sh, idx) => idx === i ? { ...sh, value: sanitizeHours(e.target.value) } : sh) }) : handleLeaveHourChange(key, i, e.target.value)}
                                                        className={`w-full h-8 p-0 text-center text-[10px] font-bold rounded border-transparent border outline-none disabled:cursor-not-allowed ${future ? 'bg-[#F1EFE8] text-[#B4B2A9]' : key === 'holiday' ? 'bg-amber-100/50 text-amber-700' : key.startsWith('leave') ? 'bg-white text-slate-500' : 'bg-white text-slate-400'}`}
                                                    />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info banner — shown when the whole week is in the future (all columns locked). */}
            {!readOnly && allFutureWeek && (
                <div className="mx-4 md:mx-8 mb-2 flex items-start gap-2 bg-[#E6F1FB] text-[#0C447C] text-[13px] rounded-lg px-4 py-2.5 shrink-0">
                    <span className="mt-px">ℹ</span>
                    <span>Timesheet entries can only be filled for today and past days. Future dates are locked.</span>
                </div>
            )}

            {/* Footer Summary */}
            <div className="bg-white p-3 md:p-2 border-t border-[#D3D1C7] shrink-0">
                <div className="flex justify-between sm:justify-end items-center max-w-6xl mx-auto px-4 md:px-8">
                    <div className="sm:hidden flex flex-col">
                        <span className="text-[7px] uppercase font-black text-slate-400">Submitting as</span>
                        <span className="text-[10px] font-bold text-slate-500">Employee</span>
                    </div>
                    <div className="text-right">
                        <p className="text-[11px] uppercase font-bold text-[#0C447C] tracking-wider">Total Weekly Hours</p>
                        <p className="text-[20px] font-medium text-[#185FA5]">
                            {getGrandTotal().toFixed(2)}
                        </p>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};

export default WeeklyTimesheetGrid;


