import React, { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import api from "../utils/api";

const OTP_LENGTH = 6;
const OTP_TOTAL_SECONDS = 15 * 60; // 15:00
const RESEND_COOLDOWN_SECONDS = 30;

const BLUE = "#185FA5";

function pad2(n) {
    return String(n).padStart(2, "0");
}

/**
 * Client Timesheet activation OTP modal (Part 8). Six single-digit boxes with auto-advance,
 * backspace-back, and full-code paste; a 15:00 expiry countdown; and Resend (enabled after
 * a 30s cooldown). On successful verification it toasts, calls onVerified(), and closes so
 * the banner disappears and the sidebar button appears without a reload.
 */
export default function ClientOtpVerifyModal({ isOpen, onClose, projectName, onVerified }) {
    const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(""));
    const [secondsLeft, setSecondsLeft] = useState(OTP_TOTAL_SECONDS);
    const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_SECONDS);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [resending, setResending] = useState(false);
    const inputsRef = useRef([]);

    const expired = secondsLeft <= 0;

    // (Re)initialise every time the modal opens.
    useEffect(() => {
        if (!isOpen) return;
        setDigits(Array(OTP_LENGTH).fill(""));
        setSecondsLeft(OTP_TOTAL_SECONDS);
        setResendIn(RESEND_COOLDOWN_SECONDS);
        setError("");
        setSubmitting(false);
        setResending(false);
        // Focus the first box shortly after mount.
        const t = setTimeout(() => inputsRef.current[0]?.focus(), 50);
        return () => clearTimeout(t);
    }, [isOpen]);

    // One-second ticker for both the expiry countdown and the resend cooldown.
    useEffect(() => {
        if (!isOpen) return;
        const id = setInterval(() => {
            setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
            setResendIn((r) => (r > 0 ? r - 1 : 0));
        }, 1000);
        return () => clearInterval(id);
    }, [isOpen]);

    const focusBox = (i) => {
        const el = inputsRef.current[i];
        if (el) el.focus();
    };

    const handleChange = (i, val) => {
        const ch = val.replace(/\D/g, "");
        if (!ch) {
            // Clear this box (e.g. user selected + deleted).
            setDigits((d) => {
                const next = [...d];
                next[i] = "";
                return next;
            });
            return;
        }
        // Take the last typed character so re-typing over a filled box works.
        const digit = ch[ch.length - 1];
        setDigits((d) => {
            const next = [...d];
            next[i] = digit;
            return next;
        });
        setError("");
        if (i < OTP_LENGTH - 1) focusBox(i + 1);
    };

    const handleKeyDown = (i, e) => {
        if (e.key === "Backspace") {
            if (digits[i]) {
                setDigits((d) => {
                    const next = [...d];
                    next[i] = "";
                    return next;
                });
            } else if (i > 0) {
                focusBox(i - 1);
                setDigits((d) => {
                    const next = [...d];
                    next[i - 1] = "";
                    return next;
                });
            }
        } else if (e.key === "ArrowLeft" && i > 0) {
            focusBox(i - 1);
        } else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) {
            focusBox(i + 1);
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const text = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, OTP_LENGTH);
        if (!text) return;
        const next = Array(OTP_LENGTH).fill("");
        for (let k = 0; k < text.length; k++) next[k] = text[k];
        setDigits(next);
        setError("");
        const lastIdx = Math.min(text.length, OTP_LENGTH) - 1;
        focusBox(lastIdx < OTP_LENGTH - 1 ? text.length : OTP_LENGTH - 1);
    };

    const clearBoxes = useCallback(() => {
        setDigits(Array(OTP_LENGTH).fill(""));
        focusBox(0);
    }, []);

    const handleVerify = async () => {
        const otp = digits.join("");
        if (otp.length !== OTP_LENGTH) {
            setError("Please enter the 6-digit OTP.");
            return;
        }
        if (expired) {
            setError("OTP has expired. Please request a new one.");
            clearBoxes();
            return;
        }
        setSubmitting(true);
        setError("");
        try {
            const res = await api("/api/client-timesheet/verify-otp", {
                method: "POST",
                body: JSON.stringify({ otp }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                toast.success("Client Timesheet access activated!");
                onVerified && onVerified();
                onClose && onClose();
            } else {
                const msg = data.message || data.error || "Something went wrong. Please try again.";
                setError(msg);
                clearBoxes();
            }
        } catch {
            setError("Something went wrong. Please try again.");
            clearBoxes();
        } finally {
            setSubmitting(false);
        }
    };

    const handleResend = async () => {
        if (resendIn > 0 || resending) return;
        setResending(true);
        setError("");
        try {
            const res = await api("/api/client-timesheet/resend-otp", { method: "POST" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                toast.success("A new OTP has been sent to your email");
                setSecondsLeft(OTP_TOTAL_SECONDS);
                setResendIn(RESEND_COOLDOWN_SECONDS);
                clearBoxes();
            } else {
                setError(data.message || data.error || "Could not resend OTP. Please try again.");
            }
        } catch {
            setError("Could not resend OTP. Please try again.");
        } finally {
            setResending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Close"
                >
                    <X size={20} />
                </button>

                <h3 className="text-lg font-black tracking-tight" style={{ color: "#1e3a5f" }}>
                    Verify Client Timesheet Access
                </h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                    An OTP was sent to your registered email when you were assigned to project{" "}
                    <span className="font-bold text-slate-700">{projectName || "your client project"}</span>.
                    Enter it below to activate access.
                </p>

                {/* OTP boxes */}
                <div className="flex justify-center gap-2 sm:gap-3 mt-6" onPaste={handlePaste}>
                    {digits.map((d, i) => (
                        <input
                            key={i}
                            ref={(el) => (inputsRef.current[i] = el)}
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={1}
                            value={d}
                            disabled={submitting}
                            onChange={(e) => handleChange(i, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(i, e)}
                            className="w-11 h-14 sm:w-12 sm:h-14 text-center text-2xl font-black rounded-lg border-2 outline-none transition-all focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20"
                            style={{ borderColor: d ? BLUE : "#E3E8EF", color: "#1e3a5f" }}
                        />
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <p className="mt-3 text-center text-sm font-semibold text-red-500">{error}</p>
                )}

                {/* Countdown */}
                <p className="mt-4 text-center text-sm text-slate-500">
                    {expired ? (
                        <span className="font-bold text-red-500">OTP expired. Please request a new one.</span>
                    ) : (
                        <>
                            OTP expires in{" "}
                            <span className="font-black tabular-nums" style={{ color: "#1e3a5f" }}>
                                {pad2(Math.floor(secondsLeft / 60))}:{pad2(secondsLeft % 60)}
                            </span>
                        </>
                    )}
                </p>

                {/* Resend */}
                <p className="mt-2 text-center text-sm text-slate-500">
                    Didn&apos;t receive it?{" "}
                    <button
                        onClick={handleResend}
                        disabled={resendIn > 0 || resending}
                        className="font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:underline"
                        style={{ color: BLUE }}
                    >
                        {resending ? "Resending…" : "Resend OTP"}
                    </button>
                    {resendIn > 0 && (
                        <span className="text-slate-400"> (active in {resendIn}s)</span>
                    )}
                </p>

                {/* Verify */}
                <button
                    onClick={handleVerify}
                    disabled={submitting || digits.join("").length !== OTP_LENGTH}
                    className="mt-6 w-full py-3 rounded-md text-white font-bold text-sm tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                    style={{ background: BLUE }}
                >
                    {submitting ? "Verifying…" : "VERIFY"}
                </button>
            </div>
        </div>
    );
}
