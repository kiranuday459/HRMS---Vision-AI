import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoginBG from "../../assets/Color-blur-abstract-background-vector.jpg";
import Logo from "../../assets/visionai-logo.png";
import api from "../../utils/api";
import { validatePassword } from "../../utils/passwordValidator";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState(1); // 1=email, 2=otp, 3=password
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  // STEP 1: Send OTP
  const sendOtp = async () => {
    setError("");
    setMessage("");

    try {
      const res = await api(
        `/api/auth/forgot-password?email=${email}`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        throw new Error();
      }

      setMessage("OTP sent to your email");
      setStep(2);

    } catch {
      setError("No account found with this email. Please try again.");
    }
  };

  // STEP 2: Verify OTP
  const verifyOtp = async () => {
    setError("");
    setMessage("");

    try {
      const res = await api(
        `/api/auth/verify-otp?email=${email}&otp=${otp}`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        throw new Error();
      }

      setMessage("OTP verified successfully. Enter your new password.");
      setStep(3);

    } catch {
      setError("Invalid OTP or OTP expired");
    }
  };

  // STEP 3: Verify OTP & reset password
  const resetPassword = async () => {
    setError("");
    setMessage("");

    // 1. Enforce password validation rules
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    // 2. Check password confirmation match
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const res = await api(
        `/api/auth/reset-password?email=${email}&otp=${otp}&newPassword=${encodeURIComponent(newPassword)}`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Reset failed. Please try again.");
      }

      alert("Password reset successful");
      navigate("/login");

    } catch (err) {
      setError(err.message || "Reset failed. Please try again.");
    }
  };

  const inputClass =
    "w-full p-3 rounded-lg border border-brand-blue/20 bg-white/50 focus:bg-white focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow/20 outline-none transition-all";
  const labelClass = "text-sm font-semibold text-brand-text/80";
  const primaryBtn =
    "w-full py-3 bg-brand-blue-dark text-white rounded-lg font-bold hover:bg-brand-blue-hover active:scale-[0.98] transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group";
  const ArrowIcon = () => (
    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );

  // Requirements checklist helper for real-time feedback
  const requirements = [
    { label: "8+ characters", met: newPassword.length >= 8 },
    { label: "Uppercase letter (A-Z)", met: /[A-Z]/.test(newPassword) },
    { label: "Lowercase letter (a-z)", met: /[a-z]/.test(newPassword) },
    { label: "Number (0-9)", met: /[0-9]/.test(newPassword) },
    { label: "Special character (!@#$...)", met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword) },
    { label: "No sequential (1234/abcd) or repeated (aaaa/1111) chars", met: newPassword ? !validatePassword(newPassword)?.includes("sequential") && !validatePassword(newPassword)?.includes("repeated") : false }
  ];

  return (
    <div
      className="flex justify-center items-center min-h-screen bg-cover bg-center bg-no-repeat font-brand relative overflow-hidden"
      style={{ backgroundImage: `url(${LoginBG})` }}
    >
      {/* Background Overlay for readability — same as login page */}
      <div className="absolute inset-0 bg-brand-blue/30 backdrop-blur-[2px]" />

      <div className="w-full max-w-[460px] p-10 bg-brand-card/95 backdrop-blur-xl rounded-[32px] shadow-2xl relative z-10 border border-brand-stone/20 ring-1 ring-black/5 mx-4">
        <div className="flex flex-col items-center mb-6">
          <img src={Logo} alt="VisionAi Logo" className="h-14 mb-2 object-contain" />
          <h2 className="text-2xl font-bold text-brand-text">Forgot Password</h2>
          <p className="text-[13px] text-brand-text/50 text-center mt-1">
            {step === 1 && "Enter your registered email and we'll send you a one-time password (OTP) to reset it."}
            {step === 2 && "Enter the OTP we sent to your email address."}
            {step === 3 && "Choose a new password for your account."}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-center mb-4 text-sm font-medium border border-red-100">
            {error}
          </div>
        )}
        {message && !error && (
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg text-center mb-4 text-sm font-medium border border-emerald-100">
            {message}
          </div>
        )}

        <div className="space-y-6">
          {/* STEP 1: Enter Email */}
          {step === 1 && (
            <>
              <div className="space-y-1">
                <label className={labelClass}>Email Address</label>
                <input
                  type="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

              <button onClick={sendOtp} className={primaryBtn}>
                <span>Send OTP</span>
                <ArrowIcon />
              </button>
            </>
          )}

          {/* STEP 2: Enter OTP */}
          {step === 2 && (
            <>
              <div className="space-y-1">
                <label className={labelClass}>Enter OTP</label>
                <input
                  type="text"
                  placeholder="6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

              <button onClick={verifyOtp} className={primaryBtn}>
                <span>Verify OTP</span>
                <ArrowIcon />
              </button>
              <p
                className="text-center text-sm text-brand-text/60 hover:text-brand-yellow cursor-pointer transition-colors font-medium"
                onClick={() => setStep(1)}
              >
                Resend OTP?
              </p>
            </>
          )}

          {/* STEP 3: New Password */}
          {step === 3 && (
            <>
              <div className="space-y-1">
                <label className={labelClass}>New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError("");
                  }}
                  required
                  className={inputClass}
                />

                {/* Password requirement indicators */}
                {newPassword && (
                  <div className="p-3 mt-2 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <p className="font-semibold text-slate-600 mb-1">Password Requirements:</p>
                    {requirements.map((req, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className={req.met ? "text-emerald-600 font-bold" : "text-slate-400"}>
                          {req.met ? "✓" : "○"}
                        </span>
                        <span className={req.met ? "text-emerald-700 font-medium" : "text-slate-500"}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Confirm New Password</label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError("");
                  }}
                  required
                  className={inputClass}
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-500 font-medium mt-1">Passwords do not match</p>
                )}
              </div>

              <button onClick={resetPassword} className={primaryBtn}>
                <span>Update Password</span>
                <ArrowIcon />
              </button>
            </>
          )}

          <div className="text-center pt-2">
            <p
              className="text-sm text-brand-text/60 hover:text-brand-yellow cursor-pointer transition-colors font-medium inline-block"
              onClick={() => navigate("/login")}
            >
              ← Back to Login
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
