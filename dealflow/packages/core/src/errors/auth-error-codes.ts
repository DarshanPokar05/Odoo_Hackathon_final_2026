// ---------------------------------------------------------------------------
// Canonical error code registry
// Every authentication error thrown by the module uses one of these codes.
// Frontend and backend both import from here — no string literals scattered
// around the codebase.
// ---------------------------------------------------------------------------

export const AuthErrorCode = {
  // Registration
  USER_ALREADY_EXISTS: "USER_ALREADY_EXISTS",
  INVALID_IDENTIFIER: "INVALID_IDENTIFIER",

  // Credentials
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  ACCOUNT_NOT_VERIFIED: "ACCOUNT_NOT_VERIFIED",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",

  // OTP
  INVALID_OTP: "INVALID_OTP",
  OTP_EXPIRED: "OTP_EXPIRED",
  OTP_ATTEMPTS_EXCEEDED: "OTP_ATTEMPTS_EXCEEDED",
  OTP_RESEND_COOLDOWN: "OTP_RESEND_COOLDOWN",
  OTP_RESEND_LIMIT: "OTP_RESEND_LIMIT",
  OTP_NOT_FOUND: "OTP_NOT_FOUND",

  // Password
  PASSWORD_TOO_WEAK: "PASSWORD_TOO_WEAK",
  PASSWORD_MISMATCH: "PASSWORD_MISMATCH",
  INVALID_RESET_TOKEN: "INVALID_RESET_TOKEN",

  // Session / tokens
  SESSION_EXPIRED: "SESSION_EXPIRED",
  INVALID_TOKEN: "INVALID_TOKEN",
  UNAUTHORIZED: "UNAUTHORIZED",
  TOKEN_REUSE_DETECTED: "TOKEN_REUSE_DETECTED",

  // Rate limiting
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Generic
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_FOUND: "NOT_FOUND",
} as const;

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];
