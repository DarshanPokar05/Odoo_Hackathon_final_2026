import React from "react";
import { useAuth, useAuthConfig } from "../../context/AuthContext";
import { useAuthForm } from "../../hooks/useAuthForm";
import {
  cardStyle, inputStyle, inputErrorStyle, labelStyle,
  errorTextStyle, buttonStyle, buttonDisabledStyle,
  alertStyle, linkButtonStyle,
} from "../../utils/styles";

// ---------------------------------------------------------------------------
// ForgotPassword — requests a password reset OTP for the given identifier.
// ---------------------------------------------------------------------------

interface ForgotPasswordProps {
  onOtpSent?: (maskedIdentifier: string, identifier: string) => void;
  onBack?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function ForgotPassword({ onOtpSent, onBack, className, style }: ForgotPasswordProps) {
  const { forgotPassword } = useAuth();
  const { config } = useAuthConfig();
  const labels = config.labels;

  const { values, errors, globalError, isLoading, isSuccess, handleChange, handleSubmit } = useAuthForm({
    identifier: "",
  });

  const onSubmit = handleSubmit(async (vals) => {
    const result = await forgotPassword(vals.identifier);
    onOtpSent?.(result.maskedIdentifier, vals.identifier);
  });

  return (
    <div className={className} style={{ ...cardStyle, ...style }}>
      {onBack && (
        <button type="button" onClick={onBack}
          style={{ ...linkButtonStyle, display: "block", marginBottom: "16px" }}
          aria-label="Back to sign in">
          ← {labels.backToLogin}
        </button>
      )}

      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px", color: "var(--auth-text, #111827)" }}>
        {labels.forgotPasswordTitle}
      </h1>
      <p style={{ fontSize: "14px", color: "var(--auth-muted, #6b7280)", marginBottom: "24px" }}>
        Enter your email or phone number and we'll send a reset code.
      </p>

      {globalError && <div role="alert" style={alertStyle("error")}>{globalError}</div>}
      {isSuccess && (
        <div role="status" style={alertStyle("success")}>
          Reset code sent! Check your inbox.
        </div>
      )}

      <form onSubmit={onSubmit} noValidate>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="forgot-identifier" style={labelStyle}>
            Email address {config.enablePhone ? "or phone number" : ""}
          </label>
          <input
            id="forgot-identifier" name="identifier"
            type={config.enablePhone && !config.enableEmail ? "tel" : "email"}
            autoComplete="username"
            placeholder={config.enablePhone ? labels.phonePlaceholder : labels.emailPlaceholder}
            value={values.identifier}
            onChange={handleChange}
            disabled={isLoading || isSuccess}
            required
            aria-describedby={errors.identifier ? "forgot-id-error" : undefined}
            style={errors.identifier ? inputErrorStyle : inputStyle}
          />
          {errors.identifier && (
            <p id="forgot-id-error" style={errorTextStyle} role="alert">{errors.identifier}</p>
          )}
        </div>

        <button type="submit" disabled={isLoading || isSuccess}
          style={isLoading || isSuccess ? buttonDisabledStyle : buttonStyle}
          aria-busy={isLoading}>
          {isLoading ? "Sending…" : labels.forgotPasswordButton}
        </button>
      </form>
    </div>
  );
}
