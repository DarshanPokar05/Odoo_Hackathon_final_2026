import React, { useState } from "react";
import { useAuth, useAuthConfig } from "../../context/AuthContext";
import { useAuthForm } from "../../hooks/useAuthForm";
import {
  cardStyle, inputStyle, inputErrorStyle, labelStyle,
  errorTextStyle, buttonStyle, buttonDisabledStyle,
  alertStyle, linkButtonStyle,
} from "../../utils/styles";

// ---------------------------------------------------------------------------
// LoginForm — email/phone + password login with optional remember-me.
// Completely configurable via AuthUIConfig injected through AuthProvider.
// ---------------------------------------------------------------------------

interface LoginFormProps {
  onSuccess?: () => void;
  onForgotPassword?: () => void;
  onRegister?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function LoginForm({ onSuccess, onForgotPassword, onRegister, className, style }: LoginFormProps) {
  const { login } = useAuth();
  const { config } = useAuthConfig();
  const labels = config.labels;
  const [showPassword, setShowPassword] = useState(false);

  const { values, errors, globalError, isLoading, handleChange, handleSubmit } = useAuthForm({
    identifier: "",
    password: "",
    rememberMe: "false",
  });

  const onSubmit = handleSubmit(async (vals) => {
    await login(vals.identifier, vals.password, vals.rememberMe === "true");
    onSuccess?.();
  });

  return (
    <div className={className} style={{ ...cardStyle, ...style }}>
      {/* Header */}
      {config.logoUrl && (
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <img src={config.logoUrl} alt={config.appName} style={{ height: "40px" }} />
        </div>
      )}
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px", color: "var(--auth-text, #111827)" }}>
        {labels.loginTitle}
      </h1>
      <p style={{ fontSize: "14px", color: "var(--auth-muted, #6b7280)", marginBottom: "24px" }}>
        {labels.loginSubtitle}
      </p>

      {/* Global error */}
      {globalError && <div role="alert" style={alertStyle("error")}>{globalError}</div>}

      <form onSubmit={onSubmit} noValidate>
        {/* Identifier */}
        <div style={{ marginBottom: "16px" }}>
          <label htmlFor="login-identifier" style={labelStyle}>
            {config.enablePhone && !config.enableEmail ? "Phone number" : "Email address"}
            {config.enablePhone && config.enableEmail ? " or phone" : ""}
          </label>
          <input
            id="login-identifier"
            name="identifier"
            type={config.enablePhone && !config.enableEmail ? "tel" : "email"}
            autoComplete="username"
            placeholder={config.enablePhone && !config.enableEmail ? labels.phonePlaceholder : labels.emailPlaceholder}
            value={values.identifier}
            onChange={handleChange}
            disabled={isLoading}
            required
            aria-describedby={errors.identifier ? "login-identifier-error" : undefined}
            style={errors.identifier ? inputErrorStyle : inputStyle}
          />
          {errors.identifier && (
            <p id="login-identifier-error" style={errorTextStyle} role="alert">{errors.identifier}</p>
          )}
        </div>

        {/* Password */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <label htmlFor="login-password" style={{ ...labelStyle, marginBottom: 0 }}>
              Password
            </label>
            {onForgotPassword && (
              <button
                type="button"
                onClick={onForgotPassword}
                style={linkButtonStyle}
                aria-label="Forgot password"
              >
                Forgot password?
              </button>
            )}
          </div>
          <div style={{ position: "relative" }}>
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder={labels.passwordPlaceholder}
              value={values.password}
              onChange={handleChange}
              disabled={isLoading}
              required
              aria-describedby={errors.password ? "login-password-error" : undefined}
              style={{ ...(errors.password ? inputErrorStyle : inputStyle), paddingRight: "40px" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: "2px" }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>
          {errors.password && (
            <p id="login-password-error" style={errorTextStyle} role="alert">{errors.password}</p>
          )}
        </div>

        {/* Remember me */}
        {config.showRememberMe && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <input
              id="login-remember"
              name="rememberMe"
              type="checkbox"
              checked={values.rememberMe === "true"}
              onChange={(e) => handleChange({ target: { name: "rememberMe", value: String(e.target.checked) } } as React.ChangeEvent<HTMLInputElement>)}
              disabled={isLoading}
              style={{ width: "16px", height: "16px" }}
            />
            <label htmlFor="login-remember" style={{ fontSize: "13px", color: "var(--auth-muted, #6b7280)", cursor: "pointer" }}>
              Remember me
            </label>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          style={isLoading ? buttonDisabledStyle : buttonStyle}
          aria-busy={isLoading}
        >
          {isLoading ? "Signing in…" : labels.loginButton}
        </button>
      </form>

      {/* Register link */}
      {onRegister && (
        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "var(--auth-muted, #6b7280)" }}>
          {labels.noAccount}{" "}
          <button type="button" onClick={onRegister} style={linkButtonStyle}>
            Sign up
          </button>
        </p>
      )}
    </div>
  );
}
