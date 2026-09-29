import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginBG from '../../assets/Color-blur-abstract-background-vector.jpg';
import Logo from '../../assets/visionai-logo.png';
import api from '../../utils/api';

const LoginPage = ({ setUser }) => {
  const [username, setUsername] = useState(() => localStorage.getItem('lastUsername') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sessionMsg, setSessionMsg] = useState('');
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [maxAttempts, setMaxAttempts] = useState(5);
  const navigate = useNavigate();

  // Check lockout status from server whenever username changes or on mount
  const checkLockoutStatus = async (userToCheck) => {
    if (!userToCheck || !userToCheck.trim()) {
      setIsLocked(false);
      setLockoutTimer(0);
      setRemainingAttempts(null);
      return;
    }
    try {
      const res = await api(`/api/auth/lockout-status?username=${encodeURIComponent(userToCheck.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.maxAttempts === 'number') {
          setMaxAttempts(data.maxAttempts);
        }
        if (data.isLocked) {
          setIsLocked(true);
          setLockoutTimer(data.lockoutSeconds || 0);
          setRemainingAttempts(0);
          const mins = Math.floor((data.lockoutSeconds || 0) / 60);
          const secs = (data.lockoutSeconds || 0) % 60;
          const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          setError(
            data.message || `Your account is temporarily locked. Please try again in ${timeFormatted}.`
          );
        } else {
          setIsLocked(false);
          setLockoutTimer(0);
          if (typeof data.failedAttempts === 'number' && data.failedAttempts > 0) {
            setRemainingAttempts(data.remainingAttempts);
          } else {
            setRemainingAttempts(null);
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch lockout status", err);
    }
  };

  // Check initial lockout state for saved username on page load
  useEffect(() => {
    if (username) {
      checkLockoutStatus(username);
    }
  }, []);

  // Show an expiry notice when redirected here by a session timeout — either via
  // the idle timer (sessionStorage flag) or a 401/403 redirect (?reason=session_expired).
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('reason');
    if (reason === 'session_expired' || sessionStorage.getItem('sessionExpired')) {
      setSessionMsg('Your session has expired. Please log in again.');
      sessionStorage.removeItem('sessionExpired');
    }
  }, []);

  // Dynamic live countdown timer effect (ticks down every second)
  useEffect(() => {
    if (lockoutTimer <= 0) return;

    const interval = setInterval(() => {
      setLockoutTimer((prev) => {
        if (prev <= 1) {
          setIsLocked(false);
          setError(''); // Lockout timer finished
          setRemainingAttempts(null);
          if (username) {
            checkLockoutStatus(username);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutTimer, username]);

  const handleUsernameChange = (e) => {
    const val = e.target.value;
    setUsername(val);
    localStorage.setItem('lastUsername', val);
    if (!val.trim()) {
      setIsLocked(false);
      setLockoutTimer(0);
      setRemainingAttempts(null);
      setError('');
    } else {
      checkLockoutStatus(val);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (isLocked || lockoutTimer > 0) {
      setError("Your account is temporarily locked. Please try again after the lockout period expires.");
      return;
    }

    setError("");
    if (username) {
      localStorage.setItem('lastUsername', username.trim());
    }

    console.log("🔵 Login started");

    try {
      const loginRes = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
      });

      console.log("🟢 Login response:", loginRes.status);

      if (!loginRes.ok) {
        const data = await loginRes.json().catch(() => ({}));

        if (loginRes.status === 429 || data.isLocked || (data.lockoutSeconds && data.lockoutSeconds > 0)) {
          setIsLocked(true);
          setLockoutTimer(data.lockoutSeconds || 900);
          setRemainingAttempts(0);
          const mins = Math.floor((data.lockoutSeconds || 900) / 60);
          const secs = (data.lockoutSeconds || 900) % 60;
          const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          setError(
            data.message || `Your account is temporarily locked. Please try again in ${timeFormatted}.`
          );
          return;
        }

        if (typeof data.remainingAttempts === 'number') {
          setRemainingAttempts(data.remainingAttempts);
        }

        setError(data.message || "Invalid username or password");
        return;
      }

      const { token } = await loginRes.json();
      localStorage.setItem("token", token);
      console.log("🔵 Token stored");

      console.log("🔵 Calling /me");

      const meRes = await api("/api/me");

      console.log("🟢 /me response:", meRes.status);

      if (!meRes.ok) {
        setError("Session error. Please login again.");
        return;
      }

      const user = await meRes.json();
      const normalizedUser = {
        id: user.id || user.user?.id,
        userId: user.userId || user.user?.userId,
        employeeId: user.employeeId,
        role: user.role || user.user?.role,
        email: user.email || user.user?.email,
      };

      console.log("🟢 User:", user);

      try {
        const empRes = await api("/api/me/employee");
        if (empRes.ok) {
          const empJson = await empRes.json();
          const empData = empJson.data || empJson;
          if (empData) {
            if (empData.id) {
              normalizedUser.employeeId = empData.id;
            }
            if (empData.oryfolksId) {
              normalizedUser.oryfolksId = empData.oryfolksId;
            }
            if (empData.firstName) {
              normalizedUser.firstName = empData.firstName;
              normalizedUser.lastName = empData.lastName;
              normalizedUser.fullName = `${empData.firstName} ${empData.lastName || ""}`.trim();
              normalizedUser.designation = empData.designation;
            }
          }
        }
      } catch (ignore) {
        console.warn("Could not fetch employee profile for details", ignore);
      }

      localStorage.setItem("user", JSON.stringify(normalizedUser));
      setUser(normalizedUser);

      console.log("🔵 Navigating…");

      switch (normalizedUser.role) {
        case "ADMIN":
          navigate("/admin");
          break;
        case "HR":
          navigate("/hr");
          break;
        case "REPORTING_MANAGER":
          navigate("/manager");
          break;
        case "EMPLOYEE":
          navigate("/employee");
          break;
        default:
          navigate("/");
      }
    } catch (err) {
      console.error("🔴 Unexpected error:", err);
      setError("Something went wrong. Try again.");
    }
  };

  return (
    <div
      className="flex justify-center items-center min-h-screen bg-cover bg-center bg-no-repeat font-brand relative overflow-hidden"
      style={{ backgroundImage: `url(${LoginBG})` }}
    >
      {/* Background Overlay for readability */}
      <div className="absolute inset-0 bg-brand-blue/30 backdrop-blur-[2px]" />

      <div className="w-full max-w-[460px] p-10 bg-brand-card/95 backdrop-blur-xl rounded-[32px] shadow-2xl relative z-10 border border-brand-stone/20 ring-1 ring-black/5 mx-4">
        <div className="flex flex-col items-center mb-6">
          <img src={Logo} alt="VisionAi Logo" className="h-14 mb-2 object-contain" />
          <h2 className="text-2xl font-bold text-brand-text">HRMS Login</h2>
          <p className="text-xs text-brand-text/60 mt-1 font-medium">Maximum {maxAttempts} login attempts are allowed.</p>
        </div>

        {sessionMsg && !error && (
          <div className="bg-amber-50 text-amber-700 p-3 rounded-lg text-center mb-4 text-sm font-medium border border-amber-200">
            {sessionMsg}
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-center mb-4 text-sm font-medium border border-red-100 whitespace-pre-line leading-relaxed">
            {lockoutTimer > 0
              ? `Your account is temporarily locked. Please try again in ${String(Math.floor(lockoutTimer / 60)).padStart(2, '0')}:${String(lockoutTimer % 60).padStart(2, '0')}.`
              : error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-brand-text/80">Username</label>
            <input
              type="text"
              value={username}
              onChange={handleUsernameChange}
              required
              disabled={isLocked || lockoutTimer > 0}
              className="w-full p-3 rounded-lg border border-brand-blue/20 bg-white/50 focus:bg-white focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow/20 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter your username"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-brand-text/80">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLocked || lockoutTimer > 0}
              className="w-full p-3 rounded-lg border border-brand-blue/20 bg-white/50 focus:bg-white focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow/20 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={isLocked || lockoutTimer > 0}
            className={`w-full py-3 bg-brand-blue-dark text-white rounded-lg font-bold hover:bg-brand-blue-hover active:scale-[0.98] transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group ${
              isLocked || lockoutTimer > 0 ? "opacity-50 cursor-not-allowed hover:bg-brand-blue-dark active:scale-100" : ""
            }`}
          >
            <span>LOGIN</span>
            <svg
              className="w-4 h-4 group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>

          <div className="text-center pt-2">
            <p
              className="text-sm text-brand-text/60 hover:text-brand-yellow cursor-pointer transition-colors font-medium inline-block"
              onClick={() => navigate('/forgot-password')}
            >
              Forgot password?
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
