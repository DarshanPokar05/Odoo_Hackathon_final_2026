import React from "react";
import { useNavigate } from "react-router-dom";
import { AuthFlow } from "@auth-module/frontend";

// ---------------------------------------------------------------------------
// AuthPage — single page that hosts the complete auth flow widget.
// AuthFlow internally manages transitions between all auth screens.
// ---------------------------------------------------------------------------

interface AuthPageProps {
  initialStep?: "login" | "register";
}

export function AuthPage({ initialStep = "login" }: AuthPageProps) {
  const navigate = useNavigate();

  return (
    <AuthFlow
      initialStep={initialStep}
      onAuthenticated={() => navigate("/dashboard", { replace: true })}
      onPasswordResetSuccess={() => navigate("/auth", { replace: true })}
    />
  );
}
