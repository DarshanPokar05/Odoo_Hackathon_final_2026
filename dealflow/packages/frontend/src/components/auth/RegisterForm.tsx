import React, { useState } from "react";
import { useAuth, useAuthConfig } from "../../context/AuthContext";
import { useAuthForm } from "../../hooks/useAuthForm";
import {
  cardStyle, inputStyle, inputErrorStyle, labelStyle,
  errorTextStyle, buttonStyle, buttonDisabledStyle,
  alertStyle, linkButtonStyle,
} from "../../utils/styles";

// ---------------------------------------------------------------------------
// RegisterForm — collects name, email/phone, password, confirm password.
// Calls register() and calls onOtpRequired() with the masked identifier
// so the parent can show OtpVerification.
// ---------------------------------------------------------------------------

interface RegisterFormProps {
  onOtpRequired?: (maskedIdentifier: string, identifier: string) => void;
  onLoginClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function RegisterForm({ onOtpRequired, onLoginClick, className, style }: RegisterFormProps) {
  const { register } = useAuth();
  const { config } = useAuthConfig();
  const labels = config.labels;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { values, errors, globalError, isLoading, handleChange, handleSubmit } = useAuthForm({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const onSubmit = handleSubmit(async (vals) => {
    const email = config.enableEmail && vals.email ? vals.email : undefined;
    const phone = config.enablePhone && vals.phone ? vals.phone : undefined;
    const result = await register(vals.name, email, phone, vals.password, vals.confirmPassword);
    const identifier = (email ?? phone)!;
    onOtpRequired?.(result.maskedIdentifier, identifier);
  });

  return (
    <div className={className} style={{ ...cardStyle, ...style }}>
      {config.logoUrl && (
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <img src={config.logoUrl} alt={config.appName} style={{ height: "40px" }} />
        </div>
      )}
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px", color: "var(--auth-text, #111827)" }}>
        {labels.registerTitle}
      </h1>
      <p style={{ fontSize: "14px", color: "var(--auth-muted, #6b7280)", marginBottom: "24px" }}>
        {labels.registerSubtitle}
      </p>

      {globalError && <div role="alert" style={alertStyle("error")}>{globalError}</div>}

      <form onSubmit={onSubmit} noValidate>
        {/* Name */}
        <div style={{ marginBottom: "14px" }}>
          <label htmlFor="reg-name" style={labelStyle}>Full name</label>
          <input
            id="reg-name" name="name" type="text" autoComplete="name"
            placeholder={labels.namePlaceholder} value={values.name}
            onChange={handleChange} disabled={isLoading} required
            aria-describedby={errors.name ? "reg-name-error" : undefined}
            style={errors.name ? inputErrorStyle : inputStyle}
          />
          {errors.name && <p id="reg-name-error" style={errorTextStyle} role="alert">{errors.name}</p>}
        </div>

        {/* Email */}
        {config.enableEmail && (
          <div style={{ marginBottom: "14px" }}>
            <label htmlFor="reg-email" style={labelStyle}>
              Email address{config.enablePhone ? " (or use phone below)" : ""}
            </label>
            <input
              id="reg-email" name="email" type="email" autoComplete="email"
              placeholder={labels.emailPlaceholder} value={values.email}
              onChange={handleChange} disabled={isLoading}
              required={!config.enablePhone}
              aria-describedby={errors.email ? "reg-email-error" : undefined}
              style={errors.email ? inputErrorStyle : inputStyle}
            />
            {errors.email && <p id="reg-email-error" style={errorTextStyle} role="alert">{errors.email}</p>}
          </div>
        )}

        {/* Phone */}
        {config.enablePhone && (
          <div style={{ marginBottom: "14px" }}>
            <label htmlFor="reg-phone" style={labelStyle}>
              Phone number{config.enableEmail ? " (or use email above)" : ""}
            </label>
            <input
              id="reg-phone" name="phone" type="tel" autoComplete="tel"
              placeholder={labels.phonePlaceholder} value={values.phone}
              onChange={handleChange} disabled={isLoading}
              required={!config.enableEmail}
              aria-describedby={errors.phone ? "reg-phone-error" : undefined}
              style={errors.phone ? inputErrorStyle : inputStyle}
            />
            {errors.phone && <p id="reg-phone-error" style={errorTextStyle} role="alert">{errors.phone}</p>}
          </div>
        )}

        {/* Password */}
        <div style={{ marginBottom: "14px" }}>
          <label htmlFor="reg-password" style={labelStyle}>Password</label>
          <div style={{ position: "relative" }}>
            <input
              id="reg-password" name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={labels.passwordPlaceholder} value={values.password}
              onChange={handleChange} disabled={isLoading} required
              aria-describedby={errors.password ? "reg-password-error" : undefined}
              style={{ ...(errors.password ? inputErrorStyle : inputStyle), paddingRight: "40px" }}
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)}
              style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}
              aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>
          {errors.password && <p id="reg-password-error" style={errorTextStyle} role="alert">{errors.password}</p>}
          <p style={{ fontSize: "11px", color: "var(--auth-muted, #6b7280)", marginTop: "4px" }}>
            Min 8 chars, uppercase, lowercase, number, special character.
          </p>
        </div>

        {/* Confirm password */}
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="reg-confirm" style={labelStyle}>Confirm password</label>
          <div style={{ position: "relative" }}>
            <input
              id="reg-confirm" name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder={labels.confirmPasswordPlaceholder} value={values.confirmPassword}
              onChange={handleChange} disabled={isLoading} required
              aria-describedby={errors.confirmPassword ? "reg-confirm-error" : undefined}
              style={{ ...(errors.confirmPassword ? inputErrorStyle : inputStyle), paddingRight: "40px" }}
            />
            <button type="button" onClick={() => setShowConfirm((v) => !v)}
              style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}
              aria-label={showConfirm ? "Hide password" : "Show password"}>
              {showConfirm ? "🙈" : "👁"}
            </button>
          </div>
          {errors.confirmPassword && <p id="reg-confirm-error" style={errorTextStyle} role="alert">{errors.confirmPassword}</p>}
        </div>

        <button type="submit" disabled={isLoading}
          style={isLoading ? buttonDisabledStyle : buttonStyle} aria-busy={isLoading}>
          {isLoading ? "Creating account…" : labels.registerButton}
        </button>
      </form>

      {onLoginClick && (
        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "var(--auth-muted, #6b7280)" }}>
          {labels.hasAccount}{" "}
          <button type="button" onClick={onLoginClick} style={linkButtonStyle}>
            Sign in
          </button>
        </p>
      )}
    </div>
  );
}
