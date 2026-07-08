import React, { useState } from 'react';

// Status pill colours — communicated via badge only (no coloured left border).
const statusBadgeClass = (status) => {
    if (status === 'APPROVED') return 'bg-emerald-50 text-emerald-700';
    if (status === 'REJECTED') return 'bg-red-50 text-red-700';
    if (status === 'NOT_FILLED') return 'bg-slate-100 text-slate-600';
    return 'bg-amber-50 text-amber-700'; // any pending state
};

const TimesheetSummary = ({ weeks, onSelectWeek }) => {
    const [statusFilter, setStatusFilter] = useState('All');

    const filteredWeeks = weeks.filter(week => {
        if (statusFilter === 'All') return true;
        const label = week.statusLabel || week.status || '';
        return label.toLowerCase() === statusFilter.toLowerCase();
    });

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Compact guidelines + status filter on a single row */}
            <div className="bg-white px-4 py-3 rounded-xl border-[0.5px] border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] shrink-0">Guidelines</span>
                    <span className="text-xs text-slate-500 truncate">Submit timesheets before the deadline. Approved timesheets cannot be edited.</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-slate-500">Status</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    >
                        <option value="All">All</option>
                        <option value="Not Filled">Not Filled</option>
                        <option value="Pending approval from Reporting Manager">Pending approval from Reporting Manager</option>
                        <option value="Pending approval from HR">Pending approval from HR</option>
                        <option value="Pending approval from Admin">Pending approval from Admin</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                    </select>
                </div>
            </div>

            {/* Week cards */}
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredWeeks.map((week, index) => {
                    const total = week.billableHrs + week.nonBillableHrs + week.timeOffHrs;
                    const cols = [
                        { label: 'Billable Project', value: week.billableHrs },
                        { label: 'Non-Billable', value: week.nonBillableHrs },
                        { label: 'Time Off/Holiday', value: week.timeOffHrs },
                        { label: 'Total Hours', value: total },
                    ];
                    return (
                        <div
                            key={index}
                            onClick={() => onSelectWeek(week)}
                            className="bg-white rounded-xl border-[0.5px] border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all duration-200 cursor-pointer p-4 md:p-5"
                        >
                            {/* Header row: week range + status badge */}
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-sm font-medium text-slate-800">{week.startDate} – {week.endDate}</h3>
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${statusBadgeClass(week.status)}`}>
                                    {week.statusLabel || week.status}
                                </span>
                            </div>

                            {/* Hours grid: 4 columns */}
                            <div className="grid grid-cols-4 divide-x divide-slate-100 border-t border-slate-100 mt-4 pt-4">
                                {cols.map((c, i) => (
                                    <div key={i} className="px-3 first:pl-0">
                                        <p className="text-[11px] uppercase tracking-wide text-slate-400">{c.label}</p>
                                        <p className="text-[18px] font-medium text-slate-800 mt-1">{c.value.toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Bottom row: action link */}
                            <div className="flex items-center justify-between mt-4">
                                <span className="text-[13px] font-medium text-[#185FA5] hover:underline">
                                    {week.status === 'NOT_FILLED' ? 'Fill Timesheet' : 'View Details'}
                                </span>
                            </div>
                        </div>
                    );
                })}

                {filteredWeeks.length === 0 && (
                    <div className="bg-white p-16 rounded-xl border-[0.5px] border-dashed border-slate-200 text-center">
                        <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h4 className="text-base font-semibold text-slate-500">No timesheets found</h4>
                        <p className="text-slate-400 text-sm mt-1">Start by filling your first weekly timesheet</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TimesheetSummary;
