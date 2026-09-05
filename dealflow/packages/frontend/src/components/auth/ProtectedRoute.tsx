import React from "react";
import { useAuth } from "../../context/AuthContext";
import { AuthLoading } from "./AuthLoading";

// ---------------------------------------------------------------------------
// ProtectedRoute — wraps any component that requires authentication.
// While auth is initializing shows a loader; if not authenticated renders
// the fallback (defaults to null so the parent can handle redirect).
// Framework-agnostic: works with React Router, TanStack Router, or any
// router — the parent provides the fallback/redirect element.
// ---------------------------------------------------------------------------

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Rendered when not authenticated. Pass a <Navigate to="/login" /> here. */
  fallback?: React.ReactNode;
  /** Rendered during auth initialization. */
  loadingFallback?: React.ReactNode;
  /** Custom check — e.g. require a specific role */
  guard?: (user: NonNullable<ReturnType<typeof useAuth>["user"]>) => boolean;
  /** Rendered when guard() returns false */
  unauthorizedFallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  fallback = null,
  loadingFallback,
  guard,
  unauthorizedFallback = null,
}: ProtectedRouteProps) {
  const { isAuthenticated, isInitialized, isLoading, user } = useAuth();

  // Still initializing (silent refresh in progress)
  if (!isInitialized || isLoading) {
    return <>{loadingFallback ?? <AuthLoading />}</>;
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  // Custom guard check
  if (guard && user && !guard(user)) {
    return <>{unauthorizedFallback}</>;
  }

  return <>{children}</>;
}
