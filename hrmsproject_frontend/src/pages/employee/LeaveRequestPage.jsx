import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

import { toast } from 'react-toastify';
import { Eye } from 'lucide-react';
import LeaveDetailsModal from '../../components/LeaveDetailsModal';
import { FormFieldError, CharacterCounter } from '../../components/FormValidation';
import { validateRequired, isFormValid } from '../../utils/formValidation';
import { getLeaveStatusLabel } from '../../utils/leaveStatus';
import '../../styles/formValidation.css';

const REASON_MAX_LENGTH = 255;

const LeaveRequestPage = ({ employeeId, leaveBalance, onLeaveRequestSuccess }) => {
  const [formData, setFormData] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
    daysCount: 0,
    sessionData: {}, // { "2024-02-24": "FULL", "2024-02-25": "MORNING" }
  });
  const [blockedDates, setBlockedDates] = useState([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Client-side validation for a single field (mirrors submit-time rules)
  const validateField = (name, value) => {
    switch (name) {
      case 'leaveType': {
        const r = validateRequired(value, 'Leave type');
        return r.isValid ? '' : r.error;
      }
      case 'startDate': {
        const r = validateRequired(value, 'Start date');
        return r.isValid ? '' : r.error;
      }
      case 'endDate': {
        const r = validateRequired(value, 'End date');
        if (!r.isValid) return r.error;
        if (formData.startDate && new Date(formData.startDate) > new Date(value)) {
          return 'Start date cannot be after end date';
        }
        return '';
      }
      case 'reason': {
        const r = validateRequired(value, 'Reason for leave');
        if (!r.isValid) return r.error;
        if (value && value.length > REASON_MAX_LENGTH) {
          return `Reason for leave cannot exceed ${REASON_MAX_LENGTH} characters`;
        }
        return '';
      }
      default:
        return '';
    }
  };

  // Validate the whole form; returns the errors object
  const validateAll = () => {
    const newErrors = {
      leaveType: validateField('leaveType', formData.leaveType),
      startDate: validateField('startDate', formData.startDate),
      endDate: validateField('endDate', formData.endDate),
      reason: validateField('reason', formData.reason),
    };
    setErrors(newErrors);
    setTouched({ leaveType: true, startDate: true, endDate: true, reason: true });
    return newErrors;
  };

  const handleFieldBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  // Fetch all leaves for this employee
  const fetchLeaveHistory = async () => {
    if (!employeeId) return;
    setHistoryLoading(true);
    try {
      const response = await api(`/api/leaves/employee/${employeeId}`);
      const data = await response.json();
      const leaves = (data && data.data) ? data.data : [];
      setLeaveHistory(leaves);

      // Block all dates in approved or pending leaves
      let blocked = [];
      leaves.forEach(lv => {
        if (["APPROVED", "PENDING"].includes(lv.status)) {
          let d = new Date(lv.startDate);
          let end = new Date(lv.endDate);
          while (d <= end) {
            blocked.push(d.toISOString().slice(0, 10));
            d.setDate(d.getDate() + 1);
          }
        }
      });
      setBlockedDates(blocked);
    } catch (err) {
      console.error("Error fetching leave history:", err);
    } finally {
      setHistoryLoading(false);
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

  useEffect(() => {
    fetchLeaveHistory();
    fetchHolidays();
  }, [employeeId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Live re-validate the field once it has been touched
    setErrors((prev) => (touched[name] ? { ...prev, [name]: validateField(name, value) } : prev));

    setFormData((prev) => {
      const newState = { ...prev, [name]: value };

      // If dates changed, sync the breakdown
      if (name === 'startDate' || name === 'endDate') {
        if (newState.startDate && newState.endDate) {
          const sessions = { ...prev.sessionData };
          const range = getDatesInRange(newState.startDate, newState.endDate);

          const newSessionData = {};
          range.forEach(date => {
            newSessionData[date] = sessions[date] || "FULL";
          });
          newState.sessionData = newSessionData;
          newState.daysCount = calculateTotalFromSessions(newSessionData);
        }
      }
      return newState;
    });
  };

  const handleSessionChange = (date, session) => {
    setFormData(prev => {
      const newSessionData = { ...prev.sessionData, [date]: session };
      return {
        ...prev,
        sessionData: newSessionData,
        daysCount: calculateTotalFromSessions(newSessionData)
      };
    });
  };

  const getDatesInRange = (start, end) => {
    const dates = [];
    let d = new Date(start);
    const endDate = new Date(end);
    const holidayDates = holidays.map(h => h.holidayDate);

    while (d <= endDate) {
      const day = d.getDay();
      const iso = d.toISOString().slice(0, 10);
      const isWeekend = day === 0 || day === 6;
      const isHoliday = holidayDates.includes(iso);

      if (!isWeekend && !isHoliday) {
        dates.push(iso);
      }
      d.setDate(d.getDate() + 1);
    }
    return dates;
  };

  const calculateTotalFromSessions = (sessions) => {
    return Object.values(sessions).reduce((acc, val) => {
      return acc + (val === "FULL" ? 1.0 : 0.5);
    }, 0);
  };

  // Calculate leave days, skipping weekends and blocked days
  const calculateLeaveDays = (start, end, ignoreBlockedDates = false) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;

    let total = 0;
    let d = new Date(startDate);
    const holidayDates = holidays.map(h => h.holidayDate);

    while (d <= endDate) {
      const day = d.getDay();
      const iso = d.toISOString().slice(0, 10);
      const isWeekend = day === 0 || day === 6;
      const isHoliday = holidayDates.includes(iso);
      const isBlocked = !ignoreBlockedDates && blockedDates.includes(iso);

      if (!isWeekend && !isHoliday && !isBlocked) {
        total += 1.0;
      }
      d.setDate(d.getDate() + 1);
    }
    return total;
  };

  const getDateBreakdown = () => {
    if (!formData.startDate || !formData.endDate) return [];

    const results = [];
    let d = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const holidayDates = holidays.map(h => h.holidayDate);

    while (d <= end) {
      const iso = d.toISOString().slice(0, 10);
      const dayOfWeek = d.getDay();
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase();

      const holiday = holidays.find(h => h.holidayDate === iso);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      let label = "";
      let type = "work";

      if (holiday) {
        label = `${holiday.holidayName} holiday`;
        type = "holiday";
      } else if (isWeekend) {
        label = `${dayName}(weekend)`;
        type = "weekend";
      } else {
        const session = formData.sessionData[iso] || "FULL";
        const suffix = session !== "FULL" ? ` (${session.toLowerCase()})` : '';
        label = `${formData.leaveType.toLowerCase()} leave${suffix}`;
        type = "leave";
      }

      results.push({ date: monthDay, label, type });
      d = new Date(d.setDate(d.getDate() + 1));
    }
    return results;
  };

  const handleRequest = async (e) => {
    if (e) e.preventDefault();

    // Client-side validation: block invalid submit
    const validationErrors = validateAll();
    if (!isFormValid(validationErrors)) {
      toast.error('Please fill in all fields');
      return;
    }

    if (formData.reason && formData.reason.length > REASON_MAX_LENGTH) {
      toast.error('Reason for leave cannot exceed 255 characters');
      return;
    }

    if (!employeeId) {
      toast.error('Employee ID not found. Please login again.');
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      toast.error('Start date cannot be after end date');
      return;
    }

    // Calculate days requested
    const daysRequested = calculateLeaveDays(formData.startDate, formData.endDate);

    // Check balance
    if (!leaveBalance) {
      toast.error('Unable to check leave balance');
      return;
    }

    const leaveTypeKey = formData.leaveType.toLowerCase();

    // Skip balance check for LOP
    if (formData.leaveType !== 'LOP') {
      const availableKey = `${leaveTypeKey}LeavesRemaining`;
      const availableLeaves = leaveBalance[availableKey] || 0;

      if (availableLeaves < formData.daysCount) {
        toast.error(`Insufficient ${formData.leaveType} leaves. Available: ${availableLeaves.toFixed(2)}, Requested: ${formData.daysCount}. If more leaves required please take approval from HR and apply for LOP`);
        return;
      }
    }

    // Probation lock: only LOP is permitted in the first 6 months from joining.
    if (leaveBalance && leaveBalance.onProbation && formData.leaveType !== 'LOP') {
      toast.error('You are on probation. Only Loss of Pay (LOP) can be applied for during the first 6 months from your joining date.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        employeeId: parseInt(employeeId),
        leaveType: formData.leaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason,
        daysCount: formData.daysCount,
        sessionData: formData.sessionData
      };

      const response = await api('/api/leaves', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Leave request submitted successfully!');
        setFormData({
          leaveType: '',
          startDate: '',
          endDate: '',
          reason: '',
          daysCount: 0,
          sessionData: {},
        });
        setErrors({});
        setTouched({});
        setIsPopupOpen(false);
        fetchLeaveHistory(); // Refresh history
        if (onLeaveRequestSuccess) {
          onLeaveRequestSuccess();
        }
      } else {
        toast.error(data.message || 'Failed to submit leave request');
      }
    } catch (err) {
      toast.error('Error submitting leave request: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'PENDING':
        return 'bg-brand-yellow/10 text-brand-yellow border-brand-yellow/20';
      case 'REJECTED':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-gray-400/10 text-gray-500 border-gray-400/20';
    }
  };

  const filteredHistory = leaveHistory.filter(
    (l) => statusFilter === 'All' || (l.status || '').toUpperCase() === statusFilter.toUpperCase()
  );

  return (
    <div className="space-y-8 font-brand">
      {/* Header with Title and New Request Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-black text-brand-text uppercase tracking-widest">Leave History</h2>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <label htmlFor="employee-leave-status-filter" className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text/50">Status</label>
            <select
              id="employee-leave-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-2xl border border-brand-blue/10 bg-white px-3 text-[11px] font-bold text-brand-text outline-none focus:ring-2 focus:ring-brand-blue/10"
            >
              <option>All</option>
              <option>Pending</option>
              <option>Approved</option>
              <option>Rejected</option>
            </select>
          </div>

          <button
            onClick={() => setIsPopupOpen(true)}
            className="w-full sm:w-auto px-6 py-2.5 bg-brand-blue-dark text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-blue-hover transition-all shadow-md active:scale-95 text-xs"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* Leave History Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-brand-blue/5 card-hover">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0 text-sm">
            <thead className="bg-brand-blue">
              <tr className="text-white/40 font-bold uppercase tracking-widest text-[10px]">
                <th className="p-4 px-6 border-b border-white/5">Request Date</th>
                <th className="p-4 px-6 border-b border-white/5">Leave Type</th>
                <th className="p-4 px-6 border-b border-white/5">Start Date</th>
                <th className="p-4 px-6 border-b border-white/5">End Date</th>
                <th className="p-4 px-6 border-b border-white/5 text-center">Days</th>
                <th className="p-4 px-6 border-b border-white/5 text-center">Status</th>
                <th className="p-4 px-6 border-b border-white/5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-blue/5">
              {historyLoading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-brand-text/30 font-bold uppercase tracking-widest text-xs animate-pulse">
                    Loading leave history...
                  </td>
                </tr>
              ) : filteredHistory.length > 0 ? (
                filteredHistory.map((leave) => {
                  const daysNum = leave.daysCount || 0;
                  return (
                    <tr key={leave.id} className="hover:bg-bg-slate transition-colors">
                      <td className="p-4 px-6 font-bold text-brand-text">{formatDate(leave.submittedAt || leave.createdAt || leave.startDate)}</td>
                      <td className="p-4 px-6 font-bold text-brand-text uppercase text-xs">{leave.leaveType}</td>
                      <td className="p-4 px-6 text-brand-text/70">{formatDate(leave.startDate)}</td>
                      <td className="p-4 px-6 text-brand-text/70">{formatDate(leave.endDate)}</td>
                      <td className="p-4 px-6 text-center font-black text-brand-text">{daysNum}</td>
                      <td className="p-4 px-6 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${getStatusColor(leave.status)}`}>
                          {getLeaveStatusLabel(leave, 'EMPLOYEE')}
                        </span>
                      </td>
                      <td className="p-4 px-6 text-right">
                        <button
                          onClick={() => {
                            setSelectedLeave(leave);
                            setIsDetailsModalOpen(true);
                          }}
                          className="p-2 bg-brand-blue/5 text-brand-text rounded-lg hover:bg-brand-blue-dark hover:text-white transition-all shadow-sm"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-brand-text/20">
                    <p className="font-bold uppercase tracking-widest text-[10px] italic">No leave history found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Request Modal */}
      {isPopupOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <div className="absolute inset-0 bg-brand-blue/80 backdrop-blur-md" onClick={() => setIsPopupOpen(false)}></div>

          <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] border border-brand-blue/10 animate-in fade-in zoom-in duration-300">
            {/* Modal Header */}
            <div className="bg-brand-blue px-6 py-6 flex justify-between items-center rounded-t-[2rem]">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-wider">New Leave Request</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">Submit your leave application</p>
              </div>
              <button
                onClick={() => setIsPopupOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-brand-yellow hover:text-brand-text transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 min-h-0">
              <form id="leaveForm" onSubmit={handleRequest} className="space-y-6">
                {/* Probation Banner */}
                {leaveBalance.onProbation && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12" y2="16"></line>
                      </svg>
                      <div>
                        <p className="text-[11px] font-black text-red-600 uppercase tracking-widest">You are on probation</p>
                        <p className="text-[10px] font-bold text-red-600/80 mt-1 leading-relaxed">
                          No paid leaves are allocated during the first 6 months from your joining date.
                          {leaveBalance.probationEndDate && (
                            <> Probation ends on <span className="font-black">{new Date(leaveBalance.probationEndDate).toLocaleDateString('en-GB')}</span>.</>
                          )}
                          {' '}Any leave taken now will be treated as <span className="font-black">Loss of Pay (LOP)</span>.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Balance Info */}
                <div className="mb-8">
                  <div className="p-4 bg-brand-yellow/10 border border-brand-yellow/20 rounded-2xl">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[10px] font-black uppercase tracking-widest text-brand-text text-center">
                      <div>
                        <span className="opacity-40 block mb-1">Casual & Earned</span>
                        <span className="text-lg">{(leaveBalance.casualLeavesRemaining ?? 0).toFixed(2)}</span>
                        {(leaveBalance.casualLeavesCarriedForward ?? 0) > 0 && (
                          <span className="block text-[8px] font-bold text-brand-text/40 normal-case tracking-normal mt-0.5">
                            incl. {(leaveBalance.casualLeavesCarriedForward).toFixed(1)} carried fwd
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="opacity-40 block mb-1 text-red-500/50">Sick</span>
                        <span className="text-lg text-red-500">{(leaveBalance.sickLeavesRemaining ?? 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="opacity-40 block mb-1 text-pink-500/50">Maternity</span>
                        <span className="text-lg text-pink-500">{(leaveBalance.maternityLeavesRemaining ?? 0).toFixed(0)}</span>
                      </div>
                      <div>
                        <span className="opacity-40 block mb-1 text-indigo-500/50">Paternity</span>
                        <span className="text-lg text-indigo-500">{(leaveBalance.paternityLeavesRemaining ?? 0).toFixed(0)}</span>
                      </div>
                      <div>
                        <span className="opacity-40 block mb-1 text-slate-500/50">Bereavement</span>
                        <span className="text-lg text-slate-500">{(leaveBalance.bereavementLeavesRemaining ?? 0).toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                  {!leaveBalance.onProbation && ((leaveBalance.casualLeavesRemaining ?? 0) + (leaveBalance.sickLeavesRemaining ?? 0) + (leaveBalance.maternityLeavesRemaining ?? 0) + (leaveBalance.paternityLeavesRemaining ?? 0) + (leaveBalance.bereavementLeavesRemaining ?? 0)) === 0 && (
                    <p className="mt-3 text-[10px] font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 italic">
                      Note: you don't have any available paid leaves, please take approval from HR and apply for LOP
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  {/* Leave Type */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest block ml-1">Leave Type</label>
                    <select
                      name="leaveType"
                      value={formData.leaveType}
                      onChange={handleInputChange}
                      onBlur={handleFieldBlur}
                      className={`w-full px-5 py-4 bg-bg-slate border-2 border-transparent focus:border-brand-yellow rounded-2xl text-sm font-bold text-brand-text outline-none transition-all shadow-sm appearance-none disabled:opacity-60 ${touched.leaveType && errors.leaveType ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                    >
                      <option value="">Select Type</option>
                      {leaveBalance?.onProbation ? (
                        <option value="LOP">Loss of Pay (LOP)</option>
                      ) : (
                        <>
                          <option value="SICK">Sick Leave</option>
                          <option value="CASUAL">Casual & Earned Leave</option>
                          <option value="MATERNITY">Maternity Leave</option>
                          <option value="PATERNITY">Paternity Leave</option>
                          <option value="BEREAVEMENT">Bereavement Leave</option>
                          <option value="LOP">Loss of Pay (LOP)</option>
                        </>
                      )}
                    </select>
                    {leaveBalance?.onProbation && (
                      <p className="text-[10px] text-red-500 font-bold mt-2">
                        Only LOP is available during your probation period.
                      </p>
                    )}
                    {formData.leaveType === 'LOP' && (
                      <p className="text-[10px] text-red-500 font-bold mt-2 animate-pulse">
                        ⚠ your salary will be deducted for this leave request
                      </p>
                    )}
                    {touched.leaveType && <FormFieldError error={errors.leaveType} />}
                  </div>

                  {/* Days Display (read-only placeholder) */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest block ml-1">Total Duration</label>
                    <div className="w-full px-5 py-4 bg-bg-slate border-2 border-transparent rounded-2xl text-sm font-bold text-brand-text shadow-sm">
                      {formData.daysCount} Days
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  {/* Start Date */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest block ml-1">Start Date</label>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      min={new Date().toISOString().slice(0, 10)}
                      onBlur={e => {
                        const d = new Date(e.target.value);
                        const iso = e.target.value;
                        const isHoliday = holidays.some(h => h.holidayDate === iso);
                        if (iso && (d.getDay() === 0 || d.getDay() === 6 || blockedDates.includes(iso) || isHoliday)) {
                          toast.error(isHoliday ? 'Start date cannot be a holiday.' : 'Start date cannot be a weekend or already requested/approved leave.');
                          setFormData(f => ({ ...f, startDate: '' }));
                          setTouched(t => ({ ...t, startDate: true }));
                          setErrors(er => ({ ...er, startDate: validateField('startDate', '') }));
                          return;
                        }
                        handleFieldBlur(e);
                      }}
                      className={`w-full px-5 py-4 bg-bg-slate border-2 border-transparent focus:border-brand-yellow rounded-2xl text-sm font-bold text-brand-text outline-none transition-all shadow-sm ${touched.startDate && errors.startDate ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                    />
                    {touched.startDate && <FormFieldError error={errors.startDate} />}
                  </div>

                  {/* End Date */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest block ml-1">End Date</label>
                    <input
                      type="date"
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      min={formData.startDate || new Date().toISOString().slice(0, 10)}
                      onBlur={e => {
                        const d = new Date(e.target.value);
                        const iso = e.target.value;
                        const isHoliday = holidays.some(h => h.holidayDate === iso);
                        if (iso && (d.getDay() === 0 || d.getDay() === 6 || blockedDates.includes(iso) || isHoliday)) {
                          toast.error(isHoliday ? 'End date cannot be a holiday.' : 'End date cannot be a weekend or already requested/approved leave.');
                          setFormData(f => ({ ...f, endDate: '' }));
                          setTouched(t => ({ ...t, endDate: true }));
                          setErrors(er => ({ ...er, endDate: validateField('endDate', '') }));
                          return;
                        }
                        handleFieldBlur(e);
                      }}
                      className={`w-full px-5 py-4 bg-bg-slate border-2 border-transparent focus:border-brand-yellow rounded-2xl text-sm font-bold text-brand-text outline-none transition-all shadow-sm ${touched.endDate && errors.endDate ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                    />
                    {touched.endDate && <FormFieldError error={errors.endDate} />}
                  </div>
                </div>

                {/* Daily Breakdown Section */}
                {formData.startDate && formData.endDate && Object.keys(formData.sessionData).length > 0 && (
                  <div className="bg-bg-slate/30 border border-brand-blue/5 rounded-2xl overflow-hidden shadow-inner">
                    <div className="bg-white/50 px-4 py-2 border-b border-brand-blue/5">
                      <h4 className="text-[10px] font-black text-brand-text/60 uppercase tracking-widest">Daily Breakdown</h4>
                    </div>
                    <div className="divide-y divide-brand-blue/5 max-h-[250px] overflow-y-auto custom-scrollbar">
                      {Object.keys(formData.sessionData).map((date) => {
                        const dateObj = new Date(date);
                        const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                        const currentSession = formData.sessionData[date];

                        return (
                          <div key={date} className="p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between group hover:bg-white/40 transition-colors gap-3">
                            <span className="text-[11px] font-bold text-brand-text/70">{formattedDate}:</span>
                            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-end overflow-x-auto pb-1 sm:pb-0">
                              {/* Full Day */}
                              <label className={`flex items-center gap-1 cursor-pointer px-2 py-1 rounded-md transition-all ${currentSession === 'FULL' ? 'bg-brand-blue-dark text-white' : 'hover:bg-brand-blue/5 text-brand-text/40'}`}>
                                <input
                                  type="radio"
                                  name={`session-${date}`}
                                  value="FULL"
                                  checked={currentSession === 'FULL'}
                                  onChange={() => handleSessionChange(date, 'FULL')}
                                  className="sr-only"
                                />
                                <span className="text-[9px] font-black uppercase">Full Day</span>
                              </label>

                              {/* Morning */}
                              <label className={`flex items-center gap-1 cursor-pointer px-2 py-1 rounded-md transition-all ${currentSession === 'MORNING' ? 'bg-amber-500 text-white' : 'hover:bg-amber-500/5 text-brand-text/40'}`}>
                                <input
                                  type="radio"
                                  name={`session-${date}`}
                                  value="MORNING"
                                  checked={currentSession === 'MORNING'}
                                  onChange={() => handleSessionChange(date, 'MORNING')}
                                  className="sr-only"
                                />
                                <span className="text-[9px] font-black uppercase">Morning</span>
                              </label>

                              {/* Afternoon */}
                              <label className={`flex items-center gap-1 cursor-pointer px-2 py-1 rounded-md transition-all ${currentSession === 'AFTERNOON' ? 'bg-indigo-500 text-white' : 'hover:bg-indigo-500/5 text-brand-text/40'}`}>
                                <input
                                  type="radio"
                                  name={`session-${date}`}
                                  value="AFTERNOON"
                                  checked={currentSession === 'AFTERNOON'}
                                  onChange={() => handleSessionChange(date, 'AFTERNOON')}
                                  className="sr-only"
                                />
                                <span className="text-[9px] font-black uppercase">Afternoon</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="bg-brand-blue/5 p-3 flex justify-between items-center border-t border-brand-blue/5">
                      <span className="text-[10px] font-black text-brand-text uppercase tracking-wider">Total Duration</span>
                      <span className="text-xs font-black text-brand-text">{formData.daysCount} Days</span>
                    </div>
                  </div>
                )}



                {/* Reason */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest block ml-1">Reason for Leave</label>
                  <textarea
                    name="reason"
                    value={formData.reason}
                    onChange={handleInputChange}
                    onBlur={handleFieldBlur}
                    maxLength={REASON_MAX_LENGTH}
                    rows={4}
                    className={`w-full px-5 py-4 bg-bg-slate border-2 border-transparent focus:border-brand-yellow rounded-2xl text-sm font-bold text-brand-text placeholder:text-brand-text/20 outline-none transition-all shadow-sm resize-none ${touched.reason && errors.reason ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                    placeholder="e.g. Family emergency, personal work..."
                  />
                  <CharacterCounter current={formData.reason.length} max={REASON_MAX_LENGTH} />
                  {touched.reason && <FormFieldError error={errors.reason} />}
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="bg-white p-6 md:px-10 border-t border-brand-blue/5 rounded-b-[2rem]">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setIsPopupOpen(false)}
                  className="px-6 py-4 bg-bg-slate border border-brand-blue/5 text-brand-text/40 font-black rounded-2xl hover:bg-brand-blue-dark hover:text-white transition-all uppercase tracking-widest text-[11px] shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="leaveForm"
                  disabled={loading}
                  className="bg-brand-yellow text-brand-text font-black py-4 px-6 rounded-2xl hover:shadow-xl hover:shadow-brand-yellow/30 transition-all active:scale-95 uppercase tracking-widest text-[11px] disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <LeaveDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        leave={selectedLeave}
      />
    </div>
  );
};

export default LeaveRequestPage;





