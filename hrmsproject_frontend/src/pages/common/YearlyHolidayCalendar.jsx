import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, List as ListIcon, Search, Save, Trash2, MapPin, CheckCircle2 } from "lucide-react";
import { toast } from 'react-toastify';
import api from "../../utils/api";

export default function YearlyHolidayCalendar({ isOpen, onClose }) {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState("calendar"); // 'calendar' or 'list'
    const [startMonthIndex, setStartMonthIndex] = useState(new Date().getMonth()); // For monthly calendar view

    // Admin features
    const [selectedDate, setSelectedDate] = useState(null);
    const [holidayName, setHolidayName] = useState("");
    const [showInput, setShowInput] = useState(false);
    const [editingHolidayId, setEditingHolidayId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const user = JSON.parse(localStorage.getItem("user")) || {};
    const isAdmin = user.role === "ADMIN";

    useEffect(() => {
        if (isOpen) {
            fetchHolidays();
        }
    }, [isOpen, selectedYear]);

    const fetchHolidays = async () => {
        try {
            setLoading(true);
            const res = await api(`/api/holidays/year/${selectedYear}`);
            const data = await res.json();
            if (res.ok && data.status === "success") {
                setHolidays(data.data || []);
            } else {
                toast.error("Failed to load holidays");
            }
        } catch (error) {
            console.error("Error fetching holidays:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDateClick = (dateStr) => {
        if (!isAdmin) return;
        const existing = holidays.find(h => h.holidayDate === dateStr);
        setSelectedDate(dateStr);
        if (existing) {
            setHolidayName(existing.holidayName);
            setEditingHolidayId(existing.id);
        } else {
            setHolidayName("");
            setEditingHolidayId(null);
        }
        setShowInput(true);
    };

    const handleSaveHoliday = async () => {
        if (!holidayName.trim() || isSaving) return;

        setIsSaving(true);
        setSaveSuccess(false);

        const payload = { holidayName: holidayName, holidayDate: selectedDate };
        try {
            const endpoint = editingHolidayId ? `/api/holidays/${editingHolidayId}` : "/api/holidays";
            const method = editingHolidayId ? "PUT" : "POST";

            const res = await api(endpoint, {
                method,
                body: JSON.stringify(payload)
            });

            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (err) {
                console.error("Non-JSON response:", text);
                toast.error("An internal error occurred. Please check console.");
                setIsSaving(false);
                return;
            }

            if (res.ok && data.status === "success") {
                setSaveSuccess(true);
                toast.success(editingHolidayId ? "Registry Updated" : "Holiday Committed");

                setTimeout(() => {
                    setShowInput(false);
                    fetchHolidays();
                    setSaveSuccess(false);
                    setIsSaving(false);
                }, 1000);
            } else {
                toast.error(data.message || "Execution Failed");
                setIsSaving(false);
            }
        } catch (error) {
            console.error("Error saving holiday:", error);
            toast.error("Network link failure");
            setIsSaving(false);
        }
    };

    const handleDeleteHoliday = async () => {
        if (!editingHolidayId || !window.confirm("Delete holiday?")) return;
        try {
            const res = await api(`/api/holidays/${editingHolidayId}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                toast.success("Holiday Purged");
                setShowInput(false);
                fetchHolidays();
            } else {
                toast.error(data.message || "Deletion Failed");
            }
        } catch (error) {
            console.error("Error deleting holiday:", error);
            toast.error("Network Link Failure");
        }
    };

    if (!isOpen) return null;

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingHoliday = [...holidays]
        .filter(h => h.holidayDate >= todayStr)
        .sort((a, b) => a.holidayDate.localeCompare(b.holidayDate))[0];

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 lg:p-10 animate-in fade-in duration-300">
            <div className="bg-white rounded-[48px] w-full max-w-4xl h-full max-h-[85vh] overflow-hidden shadow-[0_32px_128px_-16px_rgba(0,0,0,0.2)] flex border border-white/40">

                {/* Left Sidebar - Illustration & Status */}
                <div className="w-80 bg-[#e8f0fe] h-full p-10 flex flex-col items-center justify-between border-r border-slate-100 hidden lg:flex shrink-0">
                    <div className="w-full">
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Japanese Holiday Calendar</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-10">Japan public holidays for the selected year</p>

                        {/* Illustration Placeholder */}
                        {/* <div className="relative w-full aspect-square bg-white/40 rounded-[32px] border border-white/60 mb-10 flex items-center justify-center p-8">
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/20 to-brand-blue-hover/40 rounded-[32px]" />
                            <div className="relative z-10 flex flex-col items-center gap-6">
                                <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center">
                                    <CalendarIcon size={48} className="text-indigo-500" strokeWidth={1.5} />
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <div className="flex gap-2">
                                        {[1, 2, 3].map(i => <div key={i} className="w-8 h-2 bg-indigo-200 rounded-full" />)}
                                    </div>
                                    <div className="w-16 h-2 bg-indigo-100 rounded-full" />
                                </div>
                            </div>
                        </div> */}

                        {/* Status Cards */}
                        <div className="space-y-6 w-full">
                            <div className="bg-white/60 p-6 rounded-[24px] border border-white/80 shadow-sm">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Today</p>
                                <p className="text-lg font-black text-slate-800 tracking-tight">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                <p className="text-xs font-bold text-indigo-500 mt-1 uppercase tracking-widest">Normal Working Day</p>
                            </div>

                            {upcomingHoliday && (
                                <div className="bg-slate-800 p-6 rounded-[24px] shadow-lg shadow-slate-200">
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                        Upcoming Holiday
                                    </p>
                                    <p className="text-lg font-black text-white tracking-tight">{upcomingHoliday.holidayName}</p>
                                    <p className="text-xs font-bold text-white/60 mt-2 uppercase tracking-widest">
                                        {new Date(upcomingHoliday.holidayDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="w-full pt-10 border-t border-slate-200/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                                <MapPin size={18} className="text-slate-400" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">Global Office</p>
                                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Standard Policy Applied</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Pane */}
                <div className="flex-1 flex flex-col min-w-0 bg-white">
                    {/* Header with Toggles & Nav */}
                    <header className="p-8 pb-4 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3 bg-slate-100/50 p-1.5 rounded-[20px] border border-slate-100">
                            <button
                                onClick={() => setView("list")}
                                className={`px-6 py-2 rounded-[16px] flex items-center gap-2 transition-all ${view === 'list' ? 'bg-white shadow-sm text-slate-800 font-bold' : 'text-slate-400 font-medium hover:text-slate-600'}`}
                            >
                                <ListIcon size={16} />
                                <span className="text-xs uppercase tracking-widest font-black">List</span>
                            </button>
                            <button
                                onClick={() => setView("calendar")}
                                className={`px-6 py-2 rounded-[16px] flex items-center gap-2 transition-all ${view === 'calendar' ? 'bg-indigo-500 shadow-lg shadow-indigo-100 text-white font-bold' : 'text-slate-400 font-medium hover:text-slate-600'}`}
                            >
                                <CalendarIcon size={16} />
                                <span className="text-xs uppercase tracking-widest font-black">Calendar</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                                <button
                                    onClick={() => setSelectedYear(prev => prev - 1)}
                                    className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="px-4 text-sm font-black text-slate-800 tracking-widest">{selectedYear}</span>
                                <button
                                    onClick={() => setSelectedYear(prev => prev + 1)}
                                    className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl flex items-center justify-center transition-all border border-slate-100"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </header>

                    {/* View Area */}
                    <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
                        {view === 'calendar' ? (
                            <div className="space-y-16">
                                {/* Pagination for Calendar (shows 1 month) */}
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-2">
                                        <button
                                            disabled={startMonthIndex === 0}
                                            onClick={() => setStartMonthIndex(prev => prev - 1)}
                                            className="p-2 hover:bg-slate-100 rounded-xl disabled:opacity-20 transition-all text-slate-400"
                                        >
                                            <ChevronLeft size={24} />
                                        </button>
                                        <button
                                            disabled={startMonthIndex >= 11}
                                            onClick={() => setStartMonthIndex(prev => prev + 1)}
                                            className="p-2 hover:bg-slate-100 rounded-xl disabled:opacity-20 transition-all text-slate-400"
                                        >
                                            <ChevronRight size={24} />
                                        </button>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Monthly Overview</p>
                                </div>

                                <div className="grid grid-cols-1 gap-12">
                                    {[startMonthIndex].map(monthIdx => {
                                        if (monthIdx > 11) return null;
                                        const daysInMonth = getDaysInMonth(selectedYear, monthIdx);
                                        const firstDay = getFirstDayOfMonth(selectedYear, monthIdx);
                                        const days = [];
                                        for (let i = 0; i < firstDay; i++) days.push(<div key={`pad-${i}`} />);
                                        for (let d = 1; d <= daysInMonth; d++) {
                                            const dStr = `${selectedYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                            const hol = holidays.find(h => h.holidayDate === dStr);
                                            const isToday = dStr === todayStr;
                                            days.push(
                                                <div
                                                    key={d}
                                                    onClick={() => handleDateClick(dStr)}
                                                    className={`
                                                        h-10 w-full rounded-[14px] flex items-center justify-center text-sm font-bold cursor-pointer transition-all relative group
                                                        ${hol ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-100 hover:scale-110 z-10' : 'text-slate-600 hover:bg-slate-50'}
                                                        ${isToday && !hol ? 'text-indigo-500 ring-2 ring-indigo-500 ring-inset' : ''}
                                                    `}
                                                >
                                                    {d}
                                                    {hol && (
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-white text-slate-800 text-[9px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[100] pointer-events-none shadow-2xl border border-slate-100 ring-4 ring-white/50">
                                                            {hol.holidayName}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={monthIdx} className="flex flex-col gap-6">
                                                <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-3 uppercase text-xs tracking-[0.2em] opacity-40">
                                                    {months[monthIdx]} {selectedYear}
                                                </h3>
                                                <div className="grid grid-cols-7 gap-2">
                                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                                        <div key={day} className="text-[9px] font-black text-slate-300 uppercase tracking-widest text-center py-2">{day}</div>
                                                    ))}
                                                    {days}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Full Year List</h3>
                                    <span className="px-4 py-1.5 bg-indigo-50 text-indigo-500 text-[10px] font-black uppercase tracking-widest rounded-full">{holidays.length} Holidays Scheduled</span>
                                </div>

                                <div className="border border-slate-100 rounded-[32px] overflow-hidden bg-slate-50/30">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-white">
                                                <th className="p-6 pl-10 text-[10px] font-black text-slate-400 uppercase tracking-widest">Holiday</th>
                                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Day</th>
                                                <th className="p-6 pr-10 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {loading ? (
                                                <tr><td colSpan="3" className="p-20 text-center animate-pulse text-xs font-black text-slate-300 uppercase tracking-widest">Synchronizing Registry...</td></tr>
                                            ) : holidays.length === 0 ? (
                                                <tr><td colSpan="3" className="p-20 text-center text-xs font-black text-slate-300 uppercase tracking-widest">No holidays scheduled for this period</td></tr>
                                            ) : (
                                                [...holidays].sort((a, b) => a.holidayDate.localeCompare(b.holidayDate)).map(h => (
                                                    <tr key={h.id} onClick={() => handleDateClick(h.holidayDate)} className="group hover:bg-white transition-all cursor-pointer">
                                                        <td className="p-6 pl-10">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                                                <span className="text-sm font-bold text-slate-700 tracking-tight group-hover:text-indigo-500 transition-colors">{h.holidayName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-6">
                                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{new Date(h.holidayDate).toLocaleDateString('en-GB', { weekday: 'long' })}</span>
                                                        </td>
                                                        <td className="p-6 pr-10 text-right">
                                                            <span className="text-sm font-black text-slate-800 tracking-tighter">{new Date(h.holidayDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Admin Input Modal */}
                {showInput && isAdmin && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200">
                            <div className="bg-slate-800 p-8 flex items-center justify-between text-white">
                                <div>
                                    <h4 className="text-xl font-black tracking-tight">{new Date(selectedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</h4>
                                    <p className="text-[10px] text-white/40 uppercase font-black tracking-[0.2em] mt-1">Management Console</p>
                                </div>
                                <button onClick={() => setShowInput(false)} className="w-10 h-10 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-10 space-y-8">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 mb-3 block">Holiday Designation</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={holidayName}
                                        onChange={(e) => setHolidayName(e.target.value)}
                                        placeholder="e.g. Christmas Day"
                                        className="w-full h-14 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-[20px] px-6 text-sm font-bold text-slate-800 outline-none transition-all placeholder:text-slate-300"
                                    />
                                </div>

                                <div className="flex gap-4">
                                    {editingHolidayId && (
                                        <button
                                            onClick={handleDeleteHoliday}
                                            className="w-14 h-14 flex items-center justify-center bg-red-50 text-red-500 rounded-[20px] hover:bg-red-500 hover:text-white transition-all border border-red-100"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    )}
                                    <button
                                        disabled={isSaving}
                                        onClick={handleSaveHoliday}
                                        className={`flex-1 h-14 font-black text-xs uppercase tracking-widest rounded-[20px] shadow-lg transition-all flex items-center justify-center gap-3 relative overflow-hidden active:scale-95
                                            ${saveSuccess
                                                ? 'bg-emerald-500 text-white shadow-emerald-200'
                                                : isSaving
                                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                                                    : 'bg-indigo-500 text-white shadow-indigo-100 hover:bg-indigo-600 hover:-translate-y-0.5'
                                            }`}
                                    >
                                        {isSaving && !saveSuccess ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                                                Processing...
                                            </>
                                        ) : saveSuccess ? (
                                            <>
                                                <CheckCircle2 size={18} strokeWidth={3} className="animate-bounce" />
                                                Saved Successfully
                                            </>
                                        ) : (
                                            <>
                                                <Save size={18} strokeWidth={2.5} />
                                                {editingHolidayId ? "Update Registry" : "Commit Holiday"}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}


