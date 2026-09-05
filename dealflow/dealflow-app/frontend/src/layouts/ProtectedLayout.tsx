import React from "react";
import { Outlet, Navigate, Link, useNavigate } from "react-router-dom";
import { useAuth, ProtectedRoute, AuthLoading } from "@auth-module/frontend";

// ---------------------------------------------------------------------------
// ProtectedLayout — wraps all private routes.
// Redirects to /auth if not authenticated; shows top-nav with logout.
// ---------------------------------------------------------------------------

export function ProtectedLayout() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  return (
    <ProtectedRoute
      fallback={<Navigate to="/auth" replace />}
      loadingFallback={<AuthLoading message="Checking session…" />}
    >
      <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
        {/* Navigation bar */}
        <nav style={{
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "60px",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <span style={{ fontWeight: 800, fontSize: "18px", color: "#7c3aed" }}>ExampleApp</span>
            <Link to="/dashboard" style={navLinkStyle}>Dashboard</Link>
            <Link to="/profile" style={navLinkStyle}>Profile</Link>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {isAuthenticated && user && (
              <span style={{ fontSize: "13px", color: "#6b7280" }}>
                {user.email ?? user.phone}
              </span>
            )}
            <button
              onClick={() => void handleLogout()}
              style={{
                background: "none",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                padding: "6px 14px",
                fontSize: "13px",
                cursor: "pointer",
                color: "#374151",
              }}
            >
              Sign out
            </button>
          </div>
        </nav>

        {/* Page content */}
        <main style={{ padding: "32px 24px", maxWidth: "1100px", margin: "0 auto" }}>
          <Outlet />
        </main>
      </div>
    </ProtectedRoute>
  );
}

const navLinkStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#374151",
  textDecoration: "none",
  fontWeight: 500,
};
