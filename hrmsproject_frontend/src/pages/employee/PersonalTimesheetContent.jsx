import React, { useState, useEffect } from "react";
import api from "../../utils/api";

import { toast } from "react-toastify";
import TimesheetSummary from "./timesheet/TimesheetSummary";
import WeeklyTimesheetGrid from "./timesheet/WeeklyTimesheetGrid";
import { getWeekStatus, REPORTING_MANAGER_SELF, HR_SELF } from "../../utils/timesheetStatus";

const PersonalTimesheetContent = ({ employeeId, user, profileResolved = true }) => {
    const [view, setView] = useState("summary"); // 'summary' or 'grid'
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [timesheetData, setTimesheetData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [weeks, setWeeks] = useState([]);
    const [joiningDate, setJoiningDate] = useState(null);

    const [approvedLeaves, setApprovedLeaves] = useState([]);
    const [holidays, setHolidays] = useState([]);
    const [leaveBalance, setLeaveBalance] = useState(null);

    useEffect(() => {
        if (employeeId) {
            fetchTimesheets(employeeId);
            fetchEmployeeDetails(employeeId);
            fetchApprovedLeaves(employeeId);
            fetchHolidays();
            fetchLeaveBalance(employeeId);
        }
    }, [employeeId]);

    const fetchLeaveBalance = async (id) => {
        try {
            const res = await api(`/api/leaves/balance/${id}`);
            if (res.ok) {
                const json = await res.json();
                setLeaveBalance(json.data);
            }
        } catch (err) {
            console.error("Error fetching leave balance for probation status", err);
        }
    };

    useEffect(() => {
        if (timesheetData.length >= 0) {
            const grouped = groupIntoWeeks(timesheetData, joiningDate);
            setWeeks(grouped);
        }
    }, [timesheetData, joiningDate]);

    const fetchApprovedLeaves = async (id) => {
        try {
            const response = await api(`/api/leaves/employee/${id}`);
            const result = await response.json();
            if (response.ok && result.data) {
                // Filter only approved leaves
                const approved = result.data.filter(l => l.status === 'APPROVED');
                setApprovedLeaves(approved);
            }
        } catch (err) {
            console.error("Error fetching approved leaves", err);
        }
    };

    const fetchHolidays = async () => {
        try {
            const year = new Date().getFullYear();
            const response = await api(`/api/holidays/year/${year}`);
            const data = await response.json();
            if (data && data.status === "success") {
                setHolidays(data.data || []);
            }
        } catch (err) {
            console.error("Error fetching holidays:", err);
        }
    };

    const fetchTimesheets = async (id) => {
        if (!id) return;
        try {
            setLoading(true);
            const response = await api(`/api/timesheets?employeeId=${id}`);
            const result = await response.json();
            if (response.ok) {
                setTimesheetData(result.data || []);
            } else {
                toast.error(result.message || "Failed to fetch timesheets");
            }
        } catch (err) {
            toast.error("Error connecting to server");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployeeDetails = async (id) => {
        try {
            const response = await api(`/api/employees/${id}`);
            const result = await response.json();
            if (response.ok && result.data) {
                setJoiningDate(result.data.joiningDate || result.data.hireDate);
            }
        } catch (err) {
            console.error("Error fetching employee details", err);
        }
    };

    const formatDate = (date) => {
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        return `${date.getDate().toString().padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
    };

    const groupIntoWeeks = (data, joiningDate) => {
        const weeksMap = {};

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

        const getSaturday = (d) => {
            const date = parseDateLocal(d);
            const day = date.getDay();
            const diff = (day + 1) % 7;
            date.setDate(date.getDate() - diff);
            date.setHours(0, 0, 0, 0);
            return date;
        };

        const now = new Date();
        const startPoint = joiningDate ? parseDateLocal(joiningDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

        let currentSat = getSaturday(now);
        const limitSat = getSaturday(startPoint);

        const getLocalDateStr = (date) => {
            if (!date) return "";
            if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
                return date.split('T')[0];
            }
            const d = date instanceof Date ? date : new Date(date);
            const year = d.getFullYear();
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        while (currentSat >= limitSat) {
            const key = getLocalDateStr(currentSat);
            const fri = new Date(currentSat);
            fri.setDate(currentSat.getDate() + 6);

            weeksMap[key] = {
                start: new Date(currentSat),
                end: fri,
                startDate: formatDate(currentSat),
                endDate: formatDate(fri),
                status: 'NOT_FILLED',
                statusLabel: 'Not Filled',
                billableHrs: 0,
                nonBillableHrs: 0,
                timeOffHrs: 0,
                truTimeHrs: 0,
                entries: []
            };

            currentSat.setDate(currentSat.getDate() - 7);
        }

        data.forEach(entry => {
            const sat = getSaturday(entry.date);
            const key = getLocalDateStr(sat);

            if (!weeksMap[key]) {
                const fri = new Date(sat);
                fri.setDate(sat.getDate() + 6);
                weeksMap[key] = {
                    start: sat,
                    end: fri,
                    startDate: formatDate(sat),
                    endDate: formatDate(fri),
                    status: 'APPROVED',
                    statusLabel: 'Approved',
                    billableHrs: 0,
                    nonBillableHrs: 0,
                    timeOffHrs: 0,
                    truTimeHrs: 0,
                    entries: []
                };
            }

            const week = weeksMap[key];
            week.entries.push(entry);

            if (entry.category === 'TRUTIME') {
                week.truTimeHrs += entry.totalHours;
            } else if (entry.category === 'HOLIDAY' || entry.category === 'TIMEOFF' || entry.category === 'LEAVE') {
                week.timeOffHrs += entry.totalHours;
            } else if (entry.billable) {
                week.billableHrs += entry.totalHours;
            } else {
                week.nonBillableHrs += entry.totalHours;
            }

            // This component always renders the logged-in user's OWN timesheet. A
            // Reporting Manager's own sheet skips the RM stage (any pending → "Pending
            // approval from HR"); an HR's own sheet goes straight to Admin (any pending →
            // "Pending Admin Approval"). Employees/others are unchanged.
            const ownViewerRole = (user?.role === 'REPORTING_MANAGER')
                ? REPORTING_MANAGER_SELF
                : (user?.role === 'HR')
                    ? HR_SELF
                    : 'EMPLOYEE';
            const weekStatus = getWeekStatus(week.entries, ownViewerRole);
            week.status = weekStatus.status;
            week.statusLabel = weekStatus.statusLabel;
        });

        return Object.values(weeksMap).sort((a, b) => b.start - a.start);
    };

    const handleSelectWeek = (week) => {
        setSelectedWeek(week);
        setView("grid");
    };

    const handleSaveWeekly = async (payload) => {
        try {
            setLoading(true);
            const formattedEntries = payload.entries.map(entry => {
                const startTime = "09:00:00";
                const totalHrs = entry.totalHours || 0;
                const endHour = Math.floor(totalHrs + 9);
                const endMin = Math.round((totalHrs % 1) * 60);
                const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}:00`;
                return { ...entry, employeeId, startTime, endTime };
            });

            const weeklyPayload = { weekStart: payload.weekStart, entries: formattedEntries };
            console.log('[Timesheet] Saving payload:', JSON.stringify(weeklyPayload, null, 2));

            const response = await api("/api/timesheets/save-weekly", {
                method: 'POST',
                body: JSON.stringify(weeklyPayload)
            });

            const result = await response.json().catch(() => null);
            console.log('[Timesheet] Save response:', response.status, result);

            if (!response.ok) {
                const errMsg = result?.message || `Server error ${response.status}`;
                toast.error(`Failed to save: ${errMsg}`);
                return;
            }

            toast.success("Weekly timesheet saved successfully");
            setView("summary");
            fetchTimesheets(employeeId);
        } catch (err) {
            toast.error("Error saving timesheet");
            console.error('[Timesheet] Save error:', err);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="h-[600px] max-w-5xl mx-auto flex flex-col overflow-hidden px-4">
            {view === 'summary' && (
                <div className="flex justify-end mb-4 shrink-0">
                    <div />
                </div>
            )}

            {loading && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Processing Request...</p>
                    </div>
                </div>
            )}

            {!loading && view === 'summary' && (
                <TimesheetSummary
                    weeks={weeks}
                    onSelectWeek={handleSelectWeek}
                />
            )}

            {!loading && view === 'grid' && (
                <WeeklyTimesheetGrid
                    weekData={selectedWeek}
                    employeeId={employeeId}
                    approvedLeaves={approvedLeaves}
                    holidays={holidays}
                    readOnly={selectedWeek.status === 'Approved'}
                    onProbation={!!(leaveBalance && leaveBalance.onProbation)}
                    probationEndDate={leaveBalance ? leaveBalance.probationEndDate : null}
                    onBack={() => setView('summary')}
                    onSave={handleSaveWeekly}
                />
            )}
        </div>
    );
};

export default PersonalTimesheetContent;


