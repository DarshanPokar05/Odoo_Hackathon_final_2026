import { PublicUser } from "@auth-module/core";

// ---------------------------------------------------------------------------
// Frontend-specific types — UI state, config, and component props shapes.
// ---------------------------------------------------------------------------

export type AuthStep =
  | "login"
  | "register"
  | "otp-verification"
  | "forgot-password"
  | "reset-password"
  | "success";

export interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (name: string, email: string | undefined, phone: string | undefined, password: string, confirmPassword: string) => Promise<{ maskedIdentifier: string }>;
  verifyRegistrationOtp: (identifier: string, otp: string) => Promise<void>;
  resendRegistrationOtp: (identifier: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  forgotPassword: (identifier: string) => Promise<{ maskedIdentifier: string }>;
  verifyResetOtp: (identifier: string, otp: string) => Promise<{ resetToken: string }>;
  resetPassword: (identifier: string, otp: string, newPassword: string, confirmPassword: string) => Promise<void>;
}

// ── UI configuration injected via AuthProvider ────────────────────────────

export interface AuthUIConfig {
  /** API base URL (e.g. "http://localhost:4000/api/v1") */
  apiBaseUrl: string;
  /** OTP digit count — must match backend config */
  otpLength?: number;
  /** App logo URL */
  logoUrl?: string;
  /** App name shown in headings */
  appName?: string;
  /** Redirect path after successful login */
  afterLoginPath?: string;
  /** Redirect path after logout */
  afterLogoutPath?: string;
  /** Whether to show "Remember me" on login */
  showRememberMe?: boolean;
  /** Enable phone number as identifier */
  enablePhone?: boolean;
  /** Enable email as identifier */
  enableEmail?: boolean;
  /** Custom CSS class applied to the auth card wrapper */
  cardClassName?: string;
  /** Custom theme tokens */
  theme?: Partial<AuthTheme>;
  /** Custom labels override */
  labels?: Partial<AuthLabels>;
}

export interface AuthTheme {
  primaryColor: string;
  primaryHoverColor: string;
  errorColor: string;
  successColor: string;
  textColor: string;
  mutedTextColor: string;
  backgroundColor: string;
  cardBackgroundColor: string;
  borderColor: string;
  borderRadius: string;
  fontFamily: string;
}

export interface AuthLabels {
  loginTitle: string;
  loginSubtitle: string;
  registerTitle: string;
  registerSubtitle: string;
  otpTitle: string;
  otpSubtitle: string;
  forgotPasswordTitle: string;
  resetPasswordTitle: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  passwordPlaceholder: string;
  confirmPasswordPlaceholder: string;
  namePlaceholder: string;
  otpPlaceholder: string;
  loginButton: string;
  registerButton: string;
  verifyButton: string;
  resendButton: string;
  forgotPasswordButton: string;
  resetPasswordButton: string;
  backToLogin: string;
  noAccount: string;
  hasAccount: string;
}

export const defaultLabels: AuthLabels = {
  loginTitle: "Welcome back",
  loginSubtitle: "Sign in to your account",
  registerTitle: "Create an account",
  registerSubtitle: "Fill in the details below",
  otpTitle: "Verify your account",
  otpSubtitle: "Enter the code sent to",
  forgotPasswordTitle: "Reset your password",
  resetPasswordTitle: "Create new password",
  emailPlaceholder: "Email address",
  phonePlaceholder: "Phone number (+12025551234)",
  passwordPlaceholder: "Password",
  confirmPasswordPlaceholder: "Confirm password",
  namePlaceholder: "Full name",
  otpPlaceholder: "Enter OTP",
  loginButton: "Sign in",
  registerButton: "Create account",
  verifyButton: "Verify",
  resendButton: "Resend code",
  forgotPasswordButton: "Send reset code",
  resetPasswordButton: "Reset password",
  backToLogin: "Back to sign in",
  noAccount: "Don't have an account?",
  hasAccount: "Already have an account?",
};

export const defaultTheme: AuthTheme = {
  primaryColor: "#2563eb",
  primaryHoverColor: "#1d4ed8",
  errorColor: "#dc2626",
  successColor: "#16a34a",
  textColor: "#111827",
  mutedTextColor: "#6b7280",
  backgroundColor: "#f9fafb",
  cardBackgroundColor: "#ffffff",
  borderColor: "#e5e7eb",
  borderRadius: "8px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};
