import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { isTokenExpired, forceLogout } from "../utils/api";

// ===== Configurable session timeout =====
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // auto-logout after 30 min of inactivity
export const WARNING_BEFORE_MS = 2 * 60 * 1000; // show warning 2 min before expiry

// Routes where the timer should never run (unauthenticated screens).
const NO_TIMEOUT_PREFIXES = ["/login", "/forgot-password"];

// User activity that counts as "still active". DOM events only — API calls are
// intentionally NOT used, otherwise background polling (e.g. notifications) would
// keep the session alive forever and defeat the timeout.
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click", "wheel"];

// Clear every place the auth token / session could live.
function clearAuth() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (name && /token|auth|session|jwt|jsession/i.test(name)) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    });
  } catch (e) {
    /* ignore */
  }
}

/**
 * App-wide idle session timeout. Mounted once inside the Router.
 * - Resets a countdown on any user activity.
 * - Shows a warning modal WARNING_BEFORE_MS before expiry ("Continue session").
 * - On expiry: clears the session and redirects to /login with an expired flag,
 *   which the login page reads to show "Your session has expired. Please log in again."
 */
export default function SessionManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(WARNING_BEFORE_MS / 1000));

  const warnTimer = useRef(null);
  const expireTimer = useRef(null);
  const countdown = useRef(null);
  const lastReset = useRef(0);

  const active =
    !!localStorage.getItem("token") &&
    !NO_TIMEOUT_PREFIXES.some((p) => location.pathname.startsWith(p));

  // Proactive guard on every page load / route change: if a token exists but is
  // already expired, log out and redirect BEFORE the page fires any API call —
  // so the user never sees a half-loaded page or a "Failed to load" error.
  useEffect(() => {
    const onAuthScreen = NO_TIMEOUT_PREFIXES.some((p) => location.pathname.startsWith(p));
    if (onAuthScreen) return;
    const token = localStorage.getItem("token");
    if (token && isTokenExpired(token)) {
      forceLogout("session_expired");
    }
  }, [location.pathname]);

  const stopTimers = useCallback(() => {
    clearTimeout(warnTimer.current);
    clearTimeout(expireTimer.current);
    clearInterval(countdown.current);
  }, []);

  const handleExpire = useCallback(() => {
    stopTimers();
    setWarning(false);
    clearAuth();
    sessionStorage.setItem("sessionExpired", "1");
    navigate("/login", { replace: true });
  }, [navigate, stopTimers]);

  const armTimers = useCallback(() => {
    stopTimers();
    setWarning(false);
    warnTimer.current = setTimeout(() => {
      setWarning(true);
      setSecondsLeft(Math.floor(WARNING_BEFORE_MS / 1000));
      countdown.current = setInterval(() => {
        setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
      }, 1000);
    }, Math.max(0, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS));
    expireTimer.current = setTimeout(handleExpire, IDLE_TIMEOUT_MS);
  }, [handleExpire, stopTimers]);

  // Any activity (throttled to once/sec) restarts the countdown and hides the warning.
  const resetIdle = useCallback(() => {
    const now = Date.now();
    if (now - lastReset.current < 1000) return;
    lastReset.current = now;
    armTimers();
  }, [armTimers]);

  const continueSession = useCallback(() => {
    lastReset.current = Date.now();
    armTimers();
  }, [armTimers]);

  useEffect(() => {
    if (!active) {
      stopTimers();
      setWarning(false);
      return;
    }
    armTimers();
    const onActivity = () => resetIdle();
    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, onActivity, { passive: true })
    );
    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
      stopTimers();
    };
    // location.pathname is included so the timer re-arms when navigating between authed pages.
  }, [active, location.pathname, armTimers, resetIdle, stopTimers]);

  if (!active || !warning) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center border border-[#E3E8EF]">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#F1EFE8] flex items-center justify-center">
          <svg className="w-6 h-6 text-brand-yellow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-brand-text mb-1">Session about to expire</h3>
        <p className="text-sm text-brand-text-secondary">
          Your session will expire in <span className="font-semibold text-brand-text tabular-nums">{timeStr}</span>.
        </p>
        <p className="text-xs text-brand-text-secondary mt-1 mb-5">
          Click “Continue session” to stay logged in.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleExpire}
            className="flex-1 py-2.5 rounded-md border border-[#E3E8EF] text-[#5F5E5A] text-sm font-medium hover:bg-[#F1EFE8] transition-colors"
          >
            Log out
          </button>
          <button
            type="button"
            onClick={continueSession}
            className="flex-1 py-2.5 rounded-md bg-brand-yellow text-white text-sm font-medium hover:bg-brand-yellow-hover transition-colors"
          >
            Continue session
          </button>
        </div>
      </div>
    </div>
  );
}
