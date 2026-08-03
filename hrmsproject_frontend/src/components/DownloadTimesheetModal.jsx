import React, { useState, useEffect } from "react";
import { X, Search, Download, Calendar, CheckSquare, Square } from "lucide-react";
import api from "../utils/api";
import { toast } from "react-toastify";
import ExcelJS from "exceljs";
import { ProjectSuffix } from "../utils/employeeName";
import { generateTimesheetExcel } from "../utils/generateTimesheetExcel";

export default function DownloadTimesheetModal({ isOpen, onClose, employees: rawEmployees }) {
    const employees = (rawEmployees || []).filter(emp => emp.role?.toUpperCase() !== "ADMIN");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [generating, setGenerating] = useState(false);
    const [memberType, setMemberType] = useState("ALL");
    const [errors, setErrors] = useState({});
    const [info, setInfo] = useState("");
    const [joiningDates, setJoiningDates] = useState({});

    const MEMBER_TYPES = [
        { value: "ALL", label: "All Members" },
        { value: "EMPLOYEE", label: "Employees Only" },
        { value: "REPORTING_MANAGER", label: "Reporting Managers Only" },
        { value: "HR", label: "HR Only" },
    ];
    // Role-eligible members for the chosen "Download For" type (Admins already excluded above).
    const roleEligible = (employees || []).filter(
        (e) => memberType === "ALL" || (e.role || "").toUpperCase() === memberType
    );

    const MIN_DATE = "2001-01-01";
    const MAX_DATE = "2099-12-31";
    // Returns an error message for a single date value, or null if valid.
    const getDateError = (value) => {
        if (!value) return null;
        if (value < MIN_DATE) return "Date cannot be earlier than 2001-01-01.";
        if (value > MAX_DATE) return "Date cannot be later than 2099-12-31.";
        return null;
    };
    const clearError = (key) => setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

    // Fetch joining dates for selected employees so the From Date can't precede them.
    useEffect(() => {
        const missing = selectedIds.filter((id) => !(id in joiningDates));
        if (missing.length === 0) return;
        let cancelled = false;
        (async () => {
            const updates = {};
            await Promise.all(missing.map(async (id) => {
                try {
                    const res = await api(`/api/employees/${id}`);
                    if (res.ok) {
                        const json = await res.json().catch(() => ({}));
                        const data = json.data || json || {};
                        const jd = data.joiningDate || data.hireDate || null;
                        updates[id] = jd ? String(jd).split("T")[0] : null;
                    } else {
                        updates[id] = null;
                    }
                } catch {
                    updates[id] = null;
                }
            }));
            if (!cancelled) setJoiningDates((prev) => ({ ...prev, ...updates }));
        })();
        return () => { cancelled = true; };
    }, [selectedIds]);

    // Earliest joining date among selected members → the minimum allowed From Date.
    const selectedJoining = selectedIds.map((id) => joiningDates[id]).filter(Boolean);
    const minFromDate = selectedJoining.length ? selectedJoining.reduce((m, d) => (d < m ? d : m)) : MIN_DATE;
    const formatDMY = (ymd) => { if (!ymd) return ""; const [y, m, d] = ymd.split("-"); return `${d}-${m}-${y}`; };

    // Switching the "Download For" type prunes any selections no longer in the filtered list.
    const handleMemberTypeChange = (value) => {
        setMemberType(value);
        const allowed = (employees || [])
            .filter((e) => value === "ALL" || (e.role || "").toUpperCase() === value)
            .map((e) => e.id);
        setSelectedIds((prev) => prev.filter((id) => allowed.includes(id)));
        clearError("member");
    };

    if (!isOpen) return null;

    const filteredEmployees = roleEligible.filter(emp => {
        const empName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name || emp.fullName || "";
        const empCode = emp.oryfolksId || `EMP${emp.id}` || "";
        return empName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            empCode.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const handleToggleSelectAll = () => {
        const list = roleEligible || [];
        const allSelected = list.length > 0 && list.every((e) => selectedIds.includes(e.id));
        if (allSelected) {
            setSelectedIds((prev) => prev.filter((id) => !list.some((e) => e.id === id)));
        } else {
            setSelectedIds((prev) => Array.from(new Set([...prev, ...list.map((e) => e.id)])));
        }
        clearError("member");
    };

    const handleToggleEmployee = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
        clearError("member");
    };

    const handleDownload = async () => {
        // ---- Inline validations (shown in red below each field) ----
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const newErrors = {};

        if (!fromDate) {
            newErrors.start = "Please select a start date";
        } else {
            const bounds = getDateError(fromDate);
            if (bounds) newErrors.start = bounds;
            else if (fromDate > todayStr) newErrors.start = "Cannot download timesheet for future dates";
        }

        if (!toDate) {
            newErrors.end = "Please select an end date";
        } else {
            const bounds = getDateError(toDate);
            if (bounds) newErrors.end = bounds;
            else if (toDate > todayStr) newErrors.end = "Cannot download timesheet for future dates";
        }

        if (fromDate && toDate && !newErrors.start && !newErrors.end && toDate <= fromDate) {
            newErrors.end = "End date must be after start date";
        }

        if (fromDate && !newErrors.start && minFromDate !== MIN_DATE && fromDate < minFromDate) {
            newErrors.start = `Start date cannot be before the employee's joining date (${formatDMY(minFromDate)})`;
        }

        if (selectedIds.length === 0) {
            newErrors.member = "Please select at least one member to download";
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        try {
            setGenerating(true);

            // Fetch a broad set of data using the working dashboard pattern to avoid 500 errors
            const year = new Date(fromDate).getFullYear();
            const [res, leavesRes, holidaysRes] = await Promise.all([
                api(`/api/timesheets?size=10000`),
                api(`/api/leaves`),
                api(`/api/holidays/year/${year}`)
            ]);

            let allRecords = [];
            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                allRecords = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
            } else {
                toast.error(`Communication breakdown (${res.status}). generating placeholder report.`);
            }

            let allLeaves = [];
            if (leavesRes.ok) {
                const data = await leavesRes.json().catch(() => ({}));
                allLeaves = Array.isArray(data.data) ? data.data : [];
            }
            
            let allHolidays = [];
            if (holidaysRes.ok) {
                const data = await holidaysRes.json().catch(() => ({}));
                allHolidays = Array.isArray(data.data) ? data.data : [];
            }

            // Perform date filtering on the client side for maximum reliability
            // PERFORM LOCAL DATE PARSING TO AVOID TIMEZONE SHIFTS (treat YYYY-MM-DD as local midnight)
            const parseLocalDate = (dateStr) => {
                if (!dateStr) return null;
                const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
                return new Date(year, month - 1, day);
            };

            const startLimit = parseLocalDate(fromDate);
            const endLimit = parseLocalDate(toDate);

            const dateFilteredEntries = allRecords.filter(entry => {
                if (!entry.date) return false;
                const d = parseLocalDate(entry.date);
                if (startLimit && d < startLimit) return false;
                if (endLimit && d > endLimit) return false;
                return true;
            });

            // Empty range is allowed — an empty/template timesheet is still generated.
            const hasData = dateFilteredEntries.some((e) => selectedIds.includes(e.employeeId));
            setInfo(hasData ? "" : "No timesheet submissions found for this period. An empty timesheet will be downloaded.");

            // Generate a continuous list of dates between fromDate and toDate in LOCAL time
            const dateSequence = [];
            let curr = new Date(startLimit);
            while (curr <= endLimit) {
                const y = curr.getFullYear();
                const m = String(curr.getMonth() + 1).padStart(2, '0');
                const d = String(curr.getDate()).padStart(2, '0');
                dateSequence.push(`${y}-${m}-${d}`);
                curr.setDate(curr.getDate() + 1);
            }

            const finalExportList = [];

            // Ensure every selected employee has a record for EVERY date in the sequence
            selectedIds.forEach(id => {
                const emp = employees.find(e => e.id === id);
                const empName = emp ? `${emp.firstName} ${emp.lastName}` : "Unknown";
                const oryId = emp?.oryfolksId || "-";

                dateSequence.forEach(dateStr => {
                    const dayEntries = dateFilteredEntries.filter(e => e.employeeId === id && e.date === dateStr);

                    if (dayEntries.length > 0) {
                        finalExportList.push(...dayEntries.map(e => ({ ...e, oryfolksId: oryId })));
                    } else {
                        // Create an exhaustive placeholder for the missing date to keep the sequence intact
                        finalExportList.push({
                            id: "-",
                            employeeId: oryId, // Use Oryfolks ID as the identifier
                            employeeName: empName,
                            oryfolksId: oryId,
                            date: dateStr,
                            totalHours: 0,
                            project: "-",
                            projectName: "-",
                            task: "-",
                            taskDescription: "-",
                            category: "EMPTY",
                            status: "EMPTY",
                            billable: null,
                            onsiteOffshore: "-",
                            billingLocation: "-",
                            leaveType: "-"
                        });
                    }
                });
            });

            // Replace finalExportList CSV approach with standardized generateTimesheetExcel
            await generateTimesheetExcel({
                dateSequence,
                selectedIds,
                employees,
                dateFilteredEntries,
                allLeaves,
                allHolidays,
                fromDate,
                toDate
            });
            toast.success("Excel Generated successfully.");

            // Notify download (optional background notification)
            try {
                const filterStr = `Date Range: ${fromDate} to ${toDate} | Role Filter: ${memberType} | Selected Employees Count: ${selectedIds.length}`;
                api("/api/timesheets/download-notification", {
                    method: "POST",
                    body: JSON.stringify({
                        recordCount: selectedIds.length,
                        filters: filterStr,
                        timesheetType: "Internal Timesheet"
                    })
                }).catch((err) => {
                    console.warn("Download notification skipped:", err);
                });
            } catch (err) {
                console.warn("Failed to send download confirmation email:", err);
            }

            if (hasData) onClose();
        } catch (error) {
            console.error(error);
            toast.error("An unexpected error occurred during generation.");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-brand-blue/40 backdrop-blur-md px-4 animate-in fade-in scale-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-4xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                <div className="p-6 border-b border-brand-blue/5 flex items-center justify-between bg-bg-slate/30">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-brand-blue-dark rounded-2xl flex items-center justify-center text-white shadow-lg">
                            <Download size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-brand-text tracking-tight">Download Timesheets</h2>
                            <p className="text-[10px] font-black text-brand-text/30 uppercase tracking-widest mt-0.5">Custom Export Protocol</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-brand-blue/5 rounded-xl transition-all"><X size={20} /></button>
                </div>

                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Date Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest ml-1">From Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text/30 w-4 h-4" />
                                <input
                                    type="date"
                                    min={minFromDate}
                                    max={MAX_DATE}
                                    value={fromDate}
                                    onChange={(e) => { setFromDate(e.target.value); setErrors((p) => ({ ...p, start: undefined, end: undefined, general: undefined })); setInfo(""); }}
                                    className="w-full bg-bg-slate/50 border-2 border-transparent focus:border-brand-yellow rounded-2xl p-3.5 pl-11 text-sm font-bold text-brand-text outline-none transition-all"
                                />
                            </div>
                            {errors.start && <p className="text-red-500 text-[12px] mt-1 ml-1">{errors.start}</p>}
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest ml-1">To Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text/30 w-4 h-4" />
                                <input
                                    type="date"
                                    min={MIN_DATE}
                                    max={MAX_DATE}
                                    value={toDate}
                                    onChange={(e) => { setToDate(e.target.value); setErrors((p) => ({ ...p, start: undefined, end: undefined, general: undefined })); setInfo(""); }}
                                    className="w-full bg-bg-slate/50 border-2 border-transparent focus:border-brand-yellow rounded-2xl p-3.5 pl-11 text-sm font-bold text-brand-text outline-none transition-all"
                                />
                            </div>
                            {errors.end && <p className="text-red-500 text-[12px] mt-1 ml-1">{errors.end}</p>}
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest ml-1">Download For</label>
                            <select
                                value={memberType}
                                onChange={(e) => handleMemberTypeChange(e.target.value)}
                                className="w-full bg-bg-slate/50 border-2 border-transparent focus:border-brand-yellow rounded-2xl p-3.5 text-sm font-bold text-brand-text outline-none transition-all"
                            >
                                {MEMBER_TYPES.map((m) => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Employee Selection */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest ml-1">Select Employees</label>
                            <button
                                onClick={handleToggleSelectAll}
                                className="text-[10px] font-black text-brand-text hover:text-brand-yellow uppercase tracking-widest transition-all"
                            >
                                {roleEligible.length > 0 && roleEligible.every((e) => selectedIds.includes(e.id)) ? "Deselect All" : "Select All"}
                            </button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text/30 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search by name or ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-bg-slate/50 border-2 border-transparent focus:border-brand-yellow rounded-2xl p-3.5 pl-11 text-sm font-bold text-brand-text outline-none transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {filteredEmployees.map(emp => (
                                <div
                                    key={emp.id}
                                    onClick={() => handleToggleEmployee(emp.id)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedIds.includes(emp.id)
                                        ? "bg-brand-blue/5 border-brand-blue/20"
                                        : "bg-bg-slate/20 border-transparent hover:border-brand-blue/5"
                                        }`}
                                >
                                    {selectedIds.includes(emp.id) ? (
                                        <CheckSquare className="w-4 h-4 text-brand-text" />
                                    ) : (
                                        <Square className="w-4 h-4 text-brand-text/20" />
                                    )}
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-brand-text tracking-tight">{`${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name || emp.fullName || "Unknown"}<ProjectSuffix project={emp.clientProject} /></span>
                                        <span className="text-[9px] font-bold text-brand-text/30 uppercase tracking-widest">{emp.oryfolksId || `EMP${emp.id}`}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {errors.member && <p className="text-red-500 text-[12px] ml-1">{errors.member}</p>}
                    </div>
                    {info && <p className="text-amber-600 text-[12px] ml-1">{info}</p>}
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
                                Generate Excel
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}




