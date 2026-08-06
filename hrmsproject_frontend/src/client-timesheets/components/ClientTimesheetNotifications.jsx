import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X } from "lucide-react";
import api from "../../utils/api";

const PAGE_SIZE = 10;
const POLL_MS = 30000;
const BASE = "/api/client-timesheet/notifications";

/** "just now" / "5 minutes ago" / "1 hour ago" / "3 days ago". */
function timeAgo(value) {
    if (!value) return "";
    let then;
    if (typeof value === "string") {
        const isoStr = (!value.endsWith("Z") && !value.includes("+") && !value.includes("-") && value.includes("T"))
            ? `${value}Z`
            : value;
        then = new Date(isoStr);
    } else {
        then = new Date(value);
    }
    if (Number.isNaN(then.getTime())) return "";
    const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const units = [
        { limit: 3600, div: 60, label: "minute" },
        { limit: 86400, div: 3600, label: "hour" },
        { limit: 2592000, div: 86400, label: "day" },
        { limit: 31536000, div: 2592000, label: "month" },
    ];
    for (const u of units) {
        if (seconds < u.limit) {
            const n = Math.floor(seconds / u.div);
            return `${n} ${u.label}${n === 1 ? "" : "s"} ago`;
        }
    }
    const years = Math.floor(seconds / 31536000);
    return `${years} year${years === 1 ? "" : "s"} ago`;
}

/**
 * Notification bell for the Client Timesheet workspace top bar. Serves both the employee
 * and admin sides — the API returns only rows addressed to the caller.
 *
 * Deliberately separate from the main HRMS <NotificationComponent>: different endpoints,
 * different table, and it must not show HRMS leave/timesheet activity. Pages in on
 * "Load More" rather than pulling the whole history at once.
 */
export default function ClientTimesheetNotifications() {
    const [items, setItems] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [page, setPage] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const panelRef = useRef(null);

    // Badge-only poll: cheap, and keeps the count current while the panel is closed.
    const refreshCount = useCallback(async () => {
        try {
            const res = await api(`${BASE}/unread-count`);
            if (res.ok) {
                const json = await res.json().catch(() => ({}));
                setUnreadCount(Number(json.data) || 0);
            }
        } catch (err) {
            console.error("Error fetching client timesheet unread count:", err);
        }
    }, []);

    // pageToLoad 0 replaces the list; anything higher appends (Load More).
    const loadPage = useCallback(async (pageToLoad) => {
        setLoading(true);
        try {
            const res = await api(`${BASE}?page=${pageToLoad}&size=${PAGE_SIZE}`);
            if (!res.ok) {
                console.error(`Client timesheet notifications request failed (${res.status}).`);
                return;
            }
            const json = await res.json().catch(() => ({}));
            const data = json.data || {};
            const batch = Array.isArray(data.items) ? data.items : [];
            setItems((prev) => (pageToLoad === 0 ? batch : [...prev, ...batch]));
            setHasMore(!!data.hasMore);
            setPage(Number(data.page) || 0);
            setUnreadCount(Number(data.unreadCount) || 0);
        } catch (err) {
            console.error("Error fetching client timesheet notifications:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshCount();
        const id = setInterval(refreshCount, POLL_MS);
        return () => clearInterval(id);
    }, [refreshCount]);

    useEffect(() => {
        const onClickOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    const toggle = () => {
        const next = !isOpen;
        setIsOpen(next);
        if (next) loadPage(0);
    };

    const markRead = async (id) => {
        try {
            const res = await api(`${BASE}/${id}/read`, { method: "POST" });
            if (res.ok) {
                setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
                setUnreadCount((c) => Math.max(0, c - 1));
            }
        } catch (err) {
            console.error("Error marking notification read:", err);
        }
    };

    const markAllRead = async () => {
        try {
            const res = await api(`${BASE}/read-all`, { method: "POST" });
            if (res.ok) {
                setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
                setUnreadCount(0);
            }
        } catch (err) {
            console.error("Error marking all notifications read:", err);
        }
    };

    const remove = async (id) => {
        try {
            const res = await api(`${BASE}/${id}`, { method: "DELETE" });
            if (res.ok) {
                setItems((prev) => {
                    const gone = prev.find((n) => n.id === id);
                    if (gone && !gone.isRead) setUnreadCount((c) => Math.max(0, c - 1));
                    return prev.filter((n) => n.id !== id);
                });
            }
        } catch (err) {
            console.error("Error deleting notification:", err);
        }
    };

    const clearAll = async () => {
        try {
            const res = await api(BASE, { method: "DELETE" });
            if (res.ok) {
                setItems([]);
                setUnreadCount(0);
                setHasMore(false);
                setPage(0);
            }
        } catch (err) {
            console.error("Error clearing notifications:", err);
        }
    };

    return (
        <div className="relative" ref={panelRef}>
            <button
                type="button"
                onClick={toggle}
                title="Notifications"
                aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
                className="relative w-9 h-9 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0f172a]">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="fixed sm:absolute right-3 sm:right-0 top-14 sm:top-full mt-2 w-[calc(100vw-24px)] sm:w-[420px] bg-white rounded-xl shadow-2xl border border-[#E3E8EF] overflow-hidden z-[300]">
                    <div className="px-5 py-4 flex items-center justify-between gap-4 border-b border-[#E3E8EF]">
                        <h3 className="text-base font-bold text-[#1e293b]">Notifications</h3>
                        <div className="flex items-center gap-4 shrink-0">
                            <button
                                type="button"
                                onClick={markAllRead}
                                disabled={unreadCount === 0}
                                className="text-[13px] font-bold text-[#0d9488] hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                            >
                                Mark all read
                            </button>
                            <button
                                type="button"
                                onClick={clearAll}
                                disabled={items.length === 0}
                                className="text-[13px] font-bold text-red-500 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                            >
                                Clear all
                            </button>
                        </div>
                    </div>

                    <div className="max-h-[380px] overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="py-14 text-center">
                                <p className="text-xs font-bold text-[#94a3b8] uppercase tracking-widest">
                                    {loading ? "Loading..." : "No notifications yet"}
                                </p>
                            </div>
                        ) : (
                            items.map((n) => (
                                <div
                                    key={n.id}
                                    className={`px-5 py-4 border-b border-[#E3E8EF] last:border-b-0 ${n.isRead ? "" : "bg-[#f8fafc]"}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <p className="flex-1 text-[13px] leading-relaxed text-[#334155]">{n.message}</p>
                                        <span
                                            className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.isRead ? "bg-transparent" : "bg-[#0d9488]"}`}
                                            aria-hidden="true"
                                        />
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-3">
                                        <span className="text-xs text-[#94a3b8]">{timeAgo(n.createdAt)}</span>
                                        <div className="flex items-center gap-3 shrink-0">
                                            {!n.isRead && (
                                                <button
                                                    type="button"
                                                    onClick={() => markRead(n.id)}
                                                    className="text-xs font-semibold text-[#64748b] hover:text-[#0d9488] transition-colors"
                                                >
                                                    Mark read
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => remove(n.id)}
                                                title="Delete notification"
                                                aria-label="Delete notification"
                                                className="text-[#94a3b8] hover:text-red-500 transition-colors"
                                            >
                                                <X size={15} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {hasMore && (
                        <div className="border-t border-[#E3E8EF]">
                            <button
                                type="button"
                                onClick={() => loadPage(page + 1)}
                                disabled={loading}
                                className="w-full py-3 text-sm font-bold text-[#0d9488] hover:bg-[#f8fafc] transition-colors disabled:opacity-50"
                            >
                                {loading ? "Loading..." : "Load More"}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
