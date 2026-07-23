import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginBG from '../../assets/Color-blur-abstract-background-vector.jpg';
import Logo from '../../assets/visionai-logo.png';
import api from '../../utils/api';

const LoginPage = ({ setUser }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sessionMsg, setSessionMsg] = useState('');
  const navigate = useNavigate();

  // Show an expiry notice when redirected here by a session timeout — either via
  // the idle timer (sessionStorage flag) or a 401/403 redirect (?reason=session_expired).
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('reason');
    if (reason === 'session_expired' || sessionStorage.getItem('sessionExpired')) {
      setSessionMsg('Your session has expired. Please log in again.');
      sessionStorage.removeItem('sessionExpired');
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    console.log("🔵 Login started");

    try {
      const loginRes = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      console.log("🟢 Login response:", loginRes.status);

      if (!loginRes.ok) {
        // Surface backend message (e.g. disabled-account notice) when available
        const data = await loginRes.json().catch(() => ({}));
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
      // ✅ NORMALIZE USER OBJECT (IMPORTANT)
      const normalizedUser = {
        id: user.id || user.user?.id,
        userId: user.userId || user.user?.userId,
        employeeId: user.employeeId, // may be filled later
        role: user.role || user.user?.role, // ⭐ THIS FIXES YOUR ISSUE
        email: user.email || user.user?.email,
      };

      console.log("🟢 User:", user);

      // Try to fetch employee details to get the name and employeeId
      try {
        const empRes = await api("/api/me/employee");
        if (empRes.ok) {
          const empJson = await empRes.json();
          const empData = empJson.data || empJson;
          if (empData) {
            if (empData.id) {
              normalizedUser.employeeId = empData.id;
            }
            if (empData.firstName) {
              normalizedUser.firstName = empData.firstName;
              normalizedUser.lastName = empData.lastName;
              normalizedUser.fullName = `${empData.firstName} ${empData.lastName}`;
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
        </div>

        {sessionMsg && !error && (
          <div className="bg-amber-50 text-amber-700 p-3 rounded-lg text-center mb-4 text-sm font-medium border border-amber-200">
            {sessionMsg}
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-center mb-4 text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-brand-text/80">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full p-3 rounded-lg border border-brand-blue/20 bg-white/50 focus:bg-white focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow/20 outline-none transition-all"
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
              className="w-full p-3 rounded-lg border border-brand-blue/20 bg-white/50 focus:bg-white focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow/20 outline-none transition-all"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-brand-blue-dark text-white rounded-lg font-bold hover:bg-brand-blue-hover active:scale-[0.98] transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
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






