import React, { useState } from "react";
import { useAuth, useAuthConfig } from "../../context/AuthContext";
import { useAuthForm } from "../../hooks/useAuthForm";
import {
  cardStyle, inputStyle, inputErrorStyle, labelStyle,
  errorTextStyle, buttonStyle, buttonDisabledStyle,
  alertStyle, linkButtonStyle,
} from "../../utils/styles";

// ---------------------------------------------------------------------------
// ResetPassword — shown after OTP for password reset is verified.
// Collects new password and confirm password, then calls resetPassword().
// ---------------------------------------------------------------------------

interface ResetPasswordProps {
  identifier: string;
  otp: string;
  onSuccess?: () => void;
  onBack?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function ResetPassword({ identifier, otp, onSuccess, onBack, className, style }: ResetPasswordProps) {
  const { resetPassword } = useAuth();
  const { config } = useAuthConfig();
  const labels = config.labels;
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { values, errors, globalError, isLoading, isSuccess, handleChange, handleSubmit } = useAuthForm({
    newPassword: "",
    confirmPassword: "",
  });

  const onSubmit = handleSubmit(async (vals) => {
    await resetPassword(identifier, otp, vals.newPassword, vals.confirmPassword);
    onSuccess?.();
  });

  return (
    <div className={className} style={{ ...cardStyle, ...style }}>
      {onBack && (
        <button type="button" onClick={onBack}
          style={{ ...linkButtonStyle, display: "block", marginBottom: "16px" }}>
          ← Back
        </button>
      )}

      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px", color: "var(--auth-text, #111827)" }}>
        {labels.resetPasswordTitle}
      </h1>
      <p style={{ fontSize: "14px", color: "var(--auth-muted, #6b7280)", marginBottom: "24px" }}>
        Choose a strong new password.
      </p>

      {globalError && <div role="alert" style={alertStyle("error")}>{globalError}</div>}
      {isSuccess && (
        <div role="status" style={alertStyle("success")}>
          Password reset successfully! You can now sign in.
        </div>
      )}

      <form onSubmit={onSubmit} noValidate>
        {/* New password */}
        <div style={{ marginBottom: "14px" }}>
          <label htmlFor="reset-new" style={labelStyle}>New password</label>
          <div style={{ position: "relative" }}>
            <input
              id="reset-new" name="newPassword"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              placeholder={labels.passwordPlaceholder}
              value={values.newPassword} onChange={handleChange}
              disabled={isLoading || isSuccess} required
              style={{ ...(errors.newPassword ? inputErrorStyle : inputStyle), paddingRight: "40px" }}
            />
            <button type="button" onClick={() => setShowNew((v) => !v)}
              style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
              {showNew ? "🙈" : "👁"}
            </button>
          </div>
          {errors.newPassword && <p style={errorTextStyle} role="alert">{errors.newPassword}</p>}
          <p style={{ fontSize: "11px", color: "var(--auth-muted, #6b7280)", marginTop: "4px" }}>
            Min 8 chars, uppercase, lowercase, number, special character.
          </p>
        </div>

        {/* Confirm */}
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="reset-confirm" style={labelStyle}>Confirm new password</label>
          <div style={{ position: "relative" }}>
            <input
              id="reset-confirm" name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder={labels.confirmPasswordPlaceholder}
              value={values.confirmPassword} onChange={handleChange}
              disabled={isLoading || isSuccess} required
              style={{ ...(errors.confirmPassword ? inputErrorStyle : inputStyle), paddingRight: "40px" }}
            />
            <button type="button" onClick={() => setShowConfirm((v) => !v)}
              style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
              {showConfirm ? "🙈" : "👁"}
            </button>
          </div>
          {errors.confirmPassword && <p style={errorTextStyle} role="alert">{errors.confirmPassword}</p>}
        </div>

        <button type="submit" disabled={isLoading || isSuccess}
          style={isLoading || isSuccess ? buttonDisabledStyle : buttonStyle}
          aria-busy={isLoading}>
          {isLoading ? "Resetting…" : labels.resetPasswordButton}
        </button>
      </form>
    </div>
  );
}
