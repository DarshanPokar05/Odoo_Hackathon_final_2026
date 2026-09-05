/**
 * App.tsx — Root component demonstrating full auth module integration.
 *
 * Integration steps shown here:
 *  1. Wrap app in <AuthProvider> with config
 *  2. Use <ProtectedRoute> to guard private pages
 *  3. Use <AuthFlow> for drop-in auth UI
 *  4. Use useAuth() hook anywhere in the tree
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider } from "@auth-module/frontend";
import type { AuthUIConfig } from "@auth-module/frontend";

import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ProtectedLayout } from "./layouts/ProtectedLayout";

// ─────────────────────────────────────────────────────────────────────────────
// Auth module configuration
// This is the ONLY place you configure the auth module for this app.
// ─────────────────────────────────────────────────────────────────────────────
const authConfig: AuthUIConfig = {
  // Point to your backend API (or use the Vite proxy path "/api/v1")
  apiBaseUrl: "/api/v1",

  appName: "ExampleApp",
  otpLength: 6,

  // Branding
  // logoUrl: "/logo.png",

  // Features
  enableEmail: true,
  enablePhone: false,
  showRememberMe: true,

  // Navigation
  afterLoginPath: "/dashboard",
  afterLogoutPath: "/auth",

  // Custom theme — only override what you want; rest uses defaults
  theme: {
    primaryColor: "#7c3aed",       // Purple brand color
    primaryHoverColor: "#6d28d9",
    borderRadius: "10px",
  },

  // Custom labels — fully optional
  labels: {
    loginTitle: "Welcome to ExampleApp",
    registerTitle: "Join ExampleApp",
  },
};

export default function App() {
  return (
    <AuthProvider config={authConfig}>
      <BrowserRouter>
        <Routes>
          {/* Public auth page */}
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/register" element={<AuthPage initialStep="register" />} />

          {/* Protected area */}
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function NotFound() {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "48px", fontWeight: 800, color: "#7c3aed" }}>404</h1>
      <p style={{ color: "#6b7280", marginBottom: "24px" }}>Page not found.</p>
      <Link to="/" style={{ color: "#7c3aed", textDecoration: "none", fontWeight: 600 }}>
        Go home →
      </Link>
    </div>
  );
}
