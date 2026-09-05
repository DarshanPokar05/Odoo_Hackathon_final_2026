import React from "react";

// ---------------------------------------------------------------------------
// AuthLoading — full-screen loading spinner shown during auth initialization.
// ---------------------------------------------------------------------------

interface AuthLoadingProps {
  message?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function AuthLoading({ message = "Loading...", style, className }: AuthLoadingProps) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        gap: "12px",
        color: "#6b7280",
        ...style,
      }}
      role="status"
      aria-label={message}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        aria-hidden="true"
        style={{ animation: "auth-spin 0.8s linear infinite" }}
      >
        <style>{`@keyframes auth-spin { to { transform: rotate(360deg); } }`}</style>
        <circle
          cx="20" cy="20" r="16"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="3"
        />
        <circle
          cx="20" cy="20" r="16"
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="60 40"
        />
      </svg>
      <span style={{ fontSize: "14px" }}>{message}</span>
    </div>
  );
}
