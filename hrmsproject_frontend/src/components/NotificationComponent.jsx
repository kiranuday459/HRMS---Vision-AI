import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle, Clock, X, CalendarDays } from 'lucide-react';
import YearlyHolidayCalendar from '../pages/common/YearlyHolidayCalendar';
import api from '../utils/api';

const NotificationComponent = () => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredId, setHoveredId] = useState(null);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchNotifications = async () => {
        try {
            const response = await api('/api/notifications');
            if (response.ok) {
                const result = await response.json();
                const normalized = (result.data || []).map(n => ({
                    ...n,
                    isRead: !!(n.isRead ?? n.read ?? false)
                }));
                setNotifications(normalized);
                setUnreadCount(normalized.filter(n => !n.isRead).length);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    const markAsRead = async (id) => {
        try {
            await api(`/api/notifications/${id}/read`, {
                method: 'POST'
            });
            fetchNotifications();
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const deleteNotification = async (id, e) => {
        e.stopPropagation();
        try {
            const response = await api(`/api/notifications/${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                setNotifications(prev => {
                    const deleted = prev.find(n => n.id === id);
                    if (deleted && !deleted.isRead) setUnreadCount(c => Math.max(0, c - 1));
                    return prev.filter(n => n.id !== id);
                });
            }
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api('/api/notifications/read-all', {
                method: 'POST'
            });
            fetchNotifications();
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const getTimeAgo = (dateString) => {
        const diffInSeconds = Math.floor((new Date() - new Date(dateString)) / 1000);
        if (diffInSeconds < 60) return 'just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    };

    const toggleDropdown = () => {
        if (!isOpen) fetchNotifications();
        setIsOpen(!isOpen);
    };

    return (
        /* Wrapper — flex row so calendar icon and bell sit side by side */
        <div className="flex items-center gap-1">

            {/* ── Holiday Calendar Icon ── */}
            <button
                onClick={() => setCalendarOpen(true)}
                title="Holiday Calendar"
                className="relative p-2 text-brand-text/60 hover:text-brand-text hover:bg-brand-blue/5 rounded-xl transition-all"
            >
                <CalendarDays size={20} strokeWidth={2.5} />
            </button>

            {/* ── Notification Bell ── */}
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={toggleDropdown}
                    className="relative p-2 text-brand-text/60 hover:text-brand-text hover:bg-brand-blue/5 rounded-xl transition-all"
                >
                    <Bell size={20} strokeWidth={2.5} />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>

                {isOpen && (
                    <div className="fixed sm:absolute right-4 sm:right-0 top-16 sm:top-full mt-2 w-[calc(100vw-32px)] sm:w-80 bg-white rounded-2xl shadow-2xl border border-brand-blue/5 overflow-hidden z-[100] animate-in fade-in zoom-in duration-200 origin-top-right">
                        <div className="p-4 border-b border-brand-blue/5 flex justify-between items-center bg-brand-blue-dark text-white">
                            <h3 className="font-bold text-xs uppercase tracking-widest">Notifications</h3>
                            {unreadCount > 0 && (
                                <button onClick={markAllAsRead} className="text-[10px] font-black hover:text-brand-yellow transition-colors underline">
                                    Mark all as read
                                </button>
                            )}
                        </div>

                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-slate-50/30">
                            {notifications.length > 0 ? (
                                notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        className={`p-4 border-b border-brand-blue/5 hover:bg-white transition-colors cursor-pointer relative group ${!n.isRead ? 'bg-brand-blue/5' : ''}`}
                                        onClick={() => !n.isRead && markAsRead(n.id)}
                                        onMouseEnter={() => setHoveredId(n.id)}
                                        onMouseLeave={() => setHoveredId(null)}
                                    >
                                        <div className="flex gap-3 pr-6">
                                            <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!n.isRead ? 'bg-brand-blue' : 'bg-transparent'}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs font-bold ${!n.isRead ? 'text-brand-text' : 'text-brand-text/60'}`}>{n.title}</p>
                                                <p className="text-[11px] text-brand-text/40 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <div className="flex items-center gap-1 text-slate-300">
                                                        <Clock size={10} />
                                                        <span className="text-[9px] font-bold uppercase tracking-wider">{getTimeAgo(n.createdAt)}</span>
                                                    </div>
                                                    <span className="text-[10px] text-brand-text/20">•</span>
                                                    <span className="text-[9px] font-black text-brand-text/20 uppercase tracking-widest">{n.type}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Unread → green tick on hover */}
                                        {!n.isRead && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                                                className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 text-brand-text/20 hover:text-brand-text transition-all"
                                                title="Mark as read"
                                            >
                                                <CheckCircle size={14} />
                                            </button>
                                        )}

                                        {/* Read → red × on hover to delete */}
                                        {n.isRead && hoveredId === n.id && (
                                            <button
                                                onClick={(e) => deleteNotification(n.id, e)}
                                                className="absolute right-4 top-4 flex items-center justify-center w-5 h-5 rounded-full bg-red-100 hover:bg-red-500 text-red-500 hover:text-white transition-all duration-150 shadow-sm"
                                                title="Dismiss notification"
                                            >
                                                <X size={11} strokeWidth={3} />
                                            </button>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="p-10 text-center">
                                    <p className="text-[10px] font-bold text-brand-text/20 uppercase tracking-widest">No notifications yet</p>
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-white border-t border-brand-blue/5 text-center">
                            <p className="text-[9px] font-black text-brand-text/20 uppercase tracking-widest leading-none">Stay updated with your activities</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Holiday Calendar Full-screen Modal ── */}
            <YearlyHolidayCalendar
                isOpen={calendarOpen}
                onClose={() => setCalendarOpen(false)}
            />
        </div>
    );
};

export default NotificationComponent;




