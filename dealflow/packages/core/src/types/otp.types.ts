// ---------------------------------------------------------------------------
// OTP domain types
// ---------------------------------------------------------------------------

/**
 * All supported OTP purposes.
 * Adding a new flow means adding a value here — no other core change needed.
 */
export type OtpPurpose =
  | "REGISTRATION"
  | "PASSWORD_RESET"
  | "LOGIN_VERIFICATION"
  | "PHONE_VERIFICATION"
  | "EMAIL_VERIFICATION";

export interface OtpRecord {
  id: string;
  userId: string;
  purpose: OtpPurpose;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  resendCount: number;
  maxResends: number;
  lastSentAt: Date;
  verifiedAt: Date | null;
  createdAt: Date;
}

export interface CreateOtpInput {
  userId: string;
  purpose: OtpPurpose;
  otpHash: string;
  expiresAt: Date;
  maxAttempts: number;
  maxResends: number;
}

export interface OtpVerificationResult {
  success: boolean;
  attemptsRemaining?: number;
}
