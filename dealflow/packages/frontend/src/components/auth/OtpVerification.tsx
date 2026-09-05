import React, { useRef, useState, useEffect } from "react";
import { useAuth, useAuthConfig } from "../../context/AuthContext";
import { useOtpTimer } from "../../hooks/useOtpTimer";
import {
  cardStyle, buttonStyle, buttonDisabledStyle,
  alertStyle, linkButtonStyle, errorTextStyle,
} from "../../utils/styles";

interface OtpVerificationProps {
  identifier: string;
  maskedIdentifier: string;
  purpose: "REGISTRATION" | "PASSWORD_RESET";
  /** Called after successful verification. For PASSWORD_RESET passes back the verified OTP. */
  onSuccess?: (verifiedOtp?: string) => void;
  onBack?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function OtpVerification({
  identifier,
  maskedIdentifier,
  purpose,
  onSuccess,
  onBack,
  className,
  style,
}: OtpVerificationProps) {
  const { verifyRegistrationOtp, verifyResetOtp, resendRegistrationOtp, forgotPassword } = useAuth();
  const { config } = useAuthConfig();
  const otpLength = config.otpLength;

  const [digits, setDigits] = useState<string[]>(Array(otpLength).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { secondsLeft, canResend, startTimer } = useOtpTimer(60);
  // Track whether auto-submit is already in progress to prevent duplicate calls
  const submittingRef = useRef(false);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Auto-submit only when all digits are filled and not already submitting
  useEffect(() => {
    const allFilled = digits.length === otpLength && digits.every((d) => d !== "");
    if (allFilled && !submittingRef.current && !isLoading && !isSuccess) {
      void handleVerify(digits.join(""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];

    if (value.length > 1) {
      const pasted = value.replace(/\D/g, "").slice(0, otpLength);
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i] ?? "";
      }
      setDigits(newDigits);
      inputRefs.current[Math.min(pasted.length, otpLength - 1)]?.focus();
      return;
    }

    newDigits[index] = value;
    setDigits(newDigits);
    setError(null);

    if (value && index < otpLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = "";
      setDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < otpLength - 1) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, otpLength);
    const newDigits = Array(otpLength).fill("");
    for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i] ?? "";
    setDigits(newDigits);
    inputRefs.current[Math.min(pasted.length, otpLength - 1)]?.focus();
  };

  const handleVerify = async (otp?: string) => {
    if (submittingRef.current || isLoading || isSuccess) return;
    const code = otp ?? digits.join("");
    if (code.length < otpLength) {
      setError(`Please enter all ${otpLength} digits`);
      return;
    }
    submittingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      if (purpose === "REGISTRATION") {
        await verifyRegistrationOtp(identifier, code);
        setIsSuccess(true);
        onSuccess?.();
      } else {
        // PASSWORD_RESET — verify OTP and pass back the code so the
        // reset-password step can submit it with the new password
        await verifyResetOtp(identifier, code);
        setIsSuccess(true);
        onSuccess?.(code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setDigits(Array(otpLength).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
      submittingRef.current = false;
    }
  };

  const handleResend = async () => {
    setResendError(null);
    setResendSuccess(false);
    try {
      if (purpose === "REGISTRATION") {
        await resendRegistrationOtp(identifier);
      } else {
        await forgotPassword(identifier);
      }
      setResendSuccess(true);
      startTimer(60);
      setDigits(Array(otpLength).fill(""));
      inputRefs.current[0]?.focus();
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to resend code");
    }
  };

  return (
    <div className={className} style={{ ...cardStyle, textAlign: "center", ...style }}>
      {onBack && (
        <button type="button" onClick={onBack}
          style={{ ...linkButtonStyle, float: "left", marginBottom: "8px" }}
          aria-label="Go back">
          ← Back
        </button>
      )}
      <div style={{ clear: "both" }} />

      <div style={{ fontSize: "40px", marginBottom: "8px" }} aria-hidden="true">📧</div>
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px", color: "var(--auth-text, #111827)" }}>
        {config.labels.otpTitle}
      </h1>
      <p style={{ fontSize: "14px", color: "var(--auth-muted, #6b7280)", marginBottom: "24px" }}>
        {config.labels.otpSubtitle} <strong>{maskedIdentifier}</strong>
      </p>

      {error && <div role="alert" style={alertStyle("error")}>{error}</div>}
      {resendError && <div role="alert" style={alertStyle("error")}>{resendError}</div>}
      {resendSuccess && <div role="status" style={alertStyle("success")}>A new code has been sent.</div>}
      {isSuccess && <div role="status" style={alertStyle("success")}>Verified successfully!</div>}

      <div
        style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "24px" }}
        onPaste={handlePaste}
        role="group"
        aria-label={`Enter ${otpLength}-digit verification code`}
      >
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            value={digit}
            onChange={(e) => handleDigitChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={isLoading || isSuccess}
            aria-label={`Digit ${i + 1}`}
            autoComplete="one-time-code"
            style={{
              width: "44px",
              height: "52px",
              textAlign: "center",
              fontSize: "20px",
              fontWeight: 600,
              border: `2px solid ${digit ? "var(--auth-primary, #2563eb)" : "var(--auth-border, #e5e7eb)"}`,
              borderRadius: "var(--auth-radius, 8px)",
              outline: "none",
              color: "var(--auth-text, #111827)",
              background: "#fff",
              transition: "border-color 0.15s",
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => void handleVerify()}
        disabled={isLoading || isSuccess || digits.some((d) => !d)}
        style={isLoading || isSuccess || digits.some((d) => !d) ? buttonDisabledStyle : buttonStyle}
        aria-busy={isLoading}
      >
        {isLoading ? "Verifying…" : config.labels.verifyButton}
      </button>

      <p style={{ marginTop: "16px", fontSize: "13px", color: "var(--auth-muted, #6b7280)" }}>
        Didn't receive a code?{" "}
        {canResend ? (
          <button type="button" onClick={() => void handleResend()} style={linkButtonStyle}>
            {config.labels.resendButton}
          </button>
        ) : (
          <span>Resend in {secondsLeft}s</span>
        )}
      </p>
      {!canResend && <p style={errorTextStyle}></p>}
    </div>
  );
}
