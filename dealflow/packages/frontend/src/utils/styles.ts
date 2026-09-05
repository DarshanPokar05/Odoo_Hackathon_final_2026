import { AuthTheme } from "../types/auth-ui.types";

// ---------------------------------------------------------------------------
// Inline style generators — components use these so no CSS framework is
// required. The consuming app can override by injecting className props.
// ---------------------------------------------------------------------------

export function injectThemeCssVars(theme: AuthTheme): React.CSSProperties {
  return {
    "--auth-primary": theme.primaryColor,
    "--auth-primary-hover": theme.primaryHoverColor,
    "--auth-error": theme.errorColor,
    "--auth-success": theme.successColor,
    "--auth-text": theme.textColor,
    "--auth-muted": theme.mutedTextColor,
    "--auth-bg": theme.backgroundColor,
    "--auth-card-bg": theme.cardBackgroundColor,
    "--auth-border": theme.borderColor,
    "--auth-radius": theme.borderRadius,
    "--auth-font": theme.fontFamily,
  } as React.CSSProperties;
}

export const cardStyle: React.CSSProperties = {
  background: "var(--auth-card-bg, #fff)",
  border: "1px solid var(--auth-border, #e5e7eb)",
  borderRadius: "var(--auth-radius, 8px)",
  padding: "32px",
  width: "100%",
  maxWidth: "420px",
  margin: "0 auto",
  fontFamily: "var(--auth-font, system-ui, sans-serif)",
  boxSizing: "border-box",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--auth-border, #e5e7eb)",
  borderRadius: "var(--auth-radius, 8px)",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  color: "var(--auth-text, #111827)",
  background: "#fff",
  transition: "border-color 0.15s",
};

export const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: "var(--auth-error, #dc2626)",
};

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--auth-text, #111827)",
  marginBottom: "4px",
};

export const errorTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--auth-error, #dc2626)",
  marginTop: "4px",
};

export const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 16px",
  background: "var(--auth-primary, #2563eb)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--auth-radius, 8px)",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 0.15s",
  fontFamily: "inherit",
};

export const buttonDisabledStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#93c5fd",
  cursor: "not-allowed",
};

export const linkButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--auth-primary, #2563eb)",
  cursor: "pointer",
  fontSize: "13px",
  padding: 0,
  fontFamily: "inherit",
  textDecoration: "underline",
};

export const alertStyle = (variant: "error" | "success"): React.CSSProperties => ({
  padding: "10px 12px",
  borderRadius: "var(--auth-radius, 8px)",
  fontSize: "13px",
  marginBottom: "16px",
  background: variant === "error" ? "#fef2f2" : "#f0fdf4",
  color: variant === "error" ? "var(--auth-error, #dc2626)" : "var(--auth-success, #16a34a)",
  border: `1px solid ${variant === "error" ? "#fecaca" : "#bbf7d0"}`,
});
