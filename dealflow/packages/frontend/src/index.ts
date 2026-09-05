// ---------------------------------------------------------------------------
// @auth-module/frontend — public API
// ---------------------------------------------------------------------------

// Context
export { AuthProvider, useAuth, useAuthConfig } from "./context/AuthContext";

// Components
export {
  AuthLoading,
  LoginForm,
  RegisterForm,
  OtpVerification,
  ForgotPassword,
  ResetPassword,
  ProtectedRoute,
  AuthFlow,
} from "./components/auth";

// Hooks
export { useAuthForm } from "./hooks/useAuthForm";
export { useOtpTimer } from "./hooks/useOtpTimer";

// API client
export { AuthApiClient, AuthApiError } from "./api/auth.api";

// Types
export type {
  AuthUIConfig,
  AuthTheme,
  AuthLabels,
  AuthState,
  AuthContextValue,
  AuthStep,
} from "./types/auth-ui.types";

export { defaultTheme, defaultLabels } from "./types/auth-ui.types";

// Utils
export { injectThemeCssVars } from "./utils/styles";
