const hostname = window.location.hostname;
const BASE_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
    ? "http://localhost:8080"
    : "";

/**
 * Decode a JWT and report whether it is expired.
 * Returns true ONLY when we can confirm expiry (has a numeric `exp` in the past).
 * If the token is missing, malformed, or has no `exp`, we return false so we never
 * force-logout a user we can't positively prove is expired.
 */
export function isTokenExpired(token) {
    if (!token) return false;
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (!payload || typeof payload.exp !== "number") return false;
        return Date.now() >= payload.exp * 1000;
    } catch (e) {
        return false;
    }
}

/**
 * Global session-expiry handler. Clears every place auth state can live and
 * redirects to the login page with a reason flag. Runs at most once per page
 * lifetime so concurrent failing requests don't fight over the redirect.
 */
let loggingOut = false;
export function forceLogout(reason = "session_expired") {
    if (loggingOut) return;
    loggingOut = true;
    try {
        localStorage.clear();
        sessionStorage.clear();
        // Keep a flag too (survives the same-tab reload) so the login page can
        // show the expiry message even without reading the query param.
        sessionStorage.setItem("sessionExpired", "1");
        document.cookie.split(";").forEach((c) => {
            const name = c.split("=")[0].trim();
            if (name) {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
            }
        });
    } catch (e) {
        /* ignore storage errors */
    }
    if (!window.location.pathname.includes("/login")) {
        window.location.replace(`/login?reason=${reason}`);
    }
}

const api = async (endpoint, options = {}) => {
    const token = localStorage.getItem("token");

    const headers = {
        ...options.headers,
    };

    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers,
    };

    // If it's a relative path, prepend BASE_URL
    const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;

    const response = await fetch(url, config);

    // Global interceptor: any expired/forbidden session → logout + redirect.
    // Skipped on the auth screens (/login, /forgot-password) where a 401/403 is a
    // normal credential response, not an expired session.
    const path = window.location.pathname;
    const onAuthScreen = path.includes("/login") || path.includes("/forgot-password");
    if (!onAuthScreen && (response.status === 401 || response.status === 403)) {
        forceLogout("session_expired");
        // Return a promise that never settles so callers don't run their
        // `.json()` / error branches and flash a "Failed to load" message
        // while the browser is navigating to /login.
        return new Promise(() => {});
    }

    return response;
};

export default api;
