import { AuthErrorCode } from "./auth-error-codes";

// ---------------------------------------------------------------------------
// AuthError — typed, structured error class used throughout the module.
// The `code` maps to AuthErrorCode; `httpStatus` is set by the thrower so
// the Express adapter can respond correctly without a giant switch statement.
// ---------------------------------------------------------------------------

export class AuthError extends Error {
  public readonly code: AuthErrorCode;
  public readonly httpStatus: number;
  public readonly isOperational: boolean;

  constructor(
    code: AuthErrorCode,
    message: string,
    httpStatus = 400,
    isOperational = true,
  ) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.isOperational = isOperational;

    // Maintain proper prototype chain in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      success: false as const,
      message: this.message,
      code: this.code,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory helpers — keeps throw sites readable
// ---------------------------------------------------------------------------

export const AuthErrors = {
  userAlreadyExists: () =>
    new AuthError(AuthErrorCode.USER_ALREADY_EXISTS, "An account with these credentials already exists.", 409),

  invalidCredentials: () =>
    new AuthError(AuthErrorCode.INVALID_CREDENTIALS, "Invalid credentials.", 401),

  accountNotVerified: () =>
    new AuthError(AuthErrorCode.ACCOUNT_NOT_VERIFIED, "Account is not yet verified. Please complete OTP verification.", 403),

  accountSuspended: () =>
    new AuthError(AuthErrorCode.ACCOUNT_SUSPENDED, "Account has been suspended. Please contact support.", 403),

  invalidOtp: (attemptsRemaining?: number) =>
    new AuthError(
      AuthErrorCode.INVALID_OTP,
      attemptsRemaining !== undefined
        ? `Invalid OTP. ${attemptsRemaining} attempt(s) remaining.`
        : "Invalid OTP.",
      400,
    ),

  otpExpired: () =>
    new AuthError(AuthErrorCode.OTP_EXPIRED, "OTP has expired. Please request a new one.", 400),

  otpAttemptsExceeded: () =>
    new AuthError(AuthErrorCode.OTP_ATTEMPTS_EXCEEDED, "Maximum verification attempts exceeded. Please request a new OTP.", 429),

  otpResendCooldown: (secondsRemaining: number) =>
    new AuthError(AuthErrorCode.OTP_RESEND_COOLDOWN, `Please wait ${secondsRemaining} second(s) before requesting a new OTP.`, 429),

  otpResendLimit: () =>
    new AuthError(AuthErrorCode.OTP_RESEND_LIMIT, "Maximum OTP resend limit reached. Please try again later.", 429),

  otpNotFound: () =>
    new AuthError(AuthErrorCode.OTP_NOT_FOUND, "No active OTP request found. Please start the process again.", 404),

  passwordTooWeak: (reason?: string) =>
    new AuthError(AuthErrorCode.PASSWORD_TOO_WEAK, reason ?? "Password does not meet strength requirements.", 400),

  passwordMismatch: () =>
    new AuthError(AuthErrorCode.PASSWORD_MISMATCH, "Passwords do not match.", 400),

  sessionExpired: () =>
    new AuthError(AuthErrorCode.SESSION_EXPIRED, "Session has expired. Please log in again.", 401),

  invalidToken: () =>
    new AuthError(AuthErrorCode.INVALID_TOKEN, "Invalid or malformed token.", 401),

  unauthorized: () =>
    new AuthError(AuthErrorCode.UNAUTHORIZED, "Authentication required.", 401),

  rateLimitExceeded: () =>
    new AuthError(AuthErrorCode.RATE_LIMIT_EXCEEDED, "Too many requests. Please try again later.", 429),

  validationError: (message: string) =>
    new AuthError(AuthErrorCode.VALIDATION_ERROR, message, 422),

  notFound: (entity = "Resource") =>
    new AuthError(AuthErrorCode.NOT_FOUND, `${entity} not found.`, 404),

  internal: () =>
    new AuthError(AuthErrorCode.INTERNAL_ERROR, "An unexpected error occurred.", 500, false),
};
