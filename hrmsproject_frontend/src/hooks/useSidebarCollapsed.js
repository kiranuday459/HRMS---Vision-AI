import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sidebarCollapsed";
const EVENT = "sidebar-collapsed-change";

const read = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

/**
 * Shared desktop sidebar collapse state used by every dashboard role
 * (Admin, HR, Reporting Manager, Employee).
 *
 * Persists to localStorage so the choice survives page refreshes, route
 * changes, and navigation between dashboards, and broadcasts a window event so
 * every mounted sidebar instance stays in sync (and across tabs via the native
 * `storage` event).
 *
 * @returns {[boolean, () => void, (value: boolean) => void]}
 *   [collapsed, toggle, setCollapsed]
 */
export default function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(read);

  useEffect(() => {
    const sync = () => setCollapsedState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setCollapsed = useCallback((value) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      /* ignore persistence failures (e.g. private mode) */
    }
    setCollapsedState(value);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const toggle = useCallback(() => {
    setCollapsed(!read());
  }, [setCollapsed]);

  return [collapsed, toggle, setCollapsed];
}
