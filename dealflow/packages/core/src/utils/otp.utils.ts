import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// OTP utilities — all cryptographically secure.
// Plain OTPs are generated in memory and passed only to the provider.
// Only the bcrypt hash is persisted.
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically secure numeric OTP of `length` digits.
 * Uses crypto.randomInt for uniform distribution.
 */
export function generateOtp(length = 6): string {
  const max = Math.pow(10, length);
  const otp = crypto.randomInt(0, max);
  return otp.toString().padStart(length, "0");
}

/**
 * Hashes the plain OTP using bcrypt.
 * saltRounds should be lower than password hashing (10 is fine — OTPs are short-lived).
 */
export async function hashOtp(plainOtp: string, saltRounds = 10): Promise<string> {
  return bcrypt.hash(plainOtp, saltRounds);
}

/**
 * Verifies a plain OTP against a stored bcrypt hash.
 */
export async function verifyOtp(plainOtp: string, otpHash: string): Promise<boolean> {
  return bcrypt.compare(plainOtp, otpHash);
}

/**
 * Returns the Date at which a generated OTP expires.
 */
export function getOtpExpiry(expirationSeconds: number): Date {
  return new Date(Date.now() + expirationSeconds * 1000);
}

/**
 * Checks if an OTP record is still within its resend cooldown window.
 * Returns seconds remaining (0 = no cooldown active).
 */
export function getResendCooldownRemaining(lastSentAt: Date, cooldownSeconds: number): number {
  const elapsedMs = Date.now() - lastSentAt.getTime();
  const cooldownMs = cooldownSeconds * 1000;
  if (elapsedMs >= cooldownMs) return 0;
  return Math.ceil((cooldownMs - elapsedMs) / 1000);
}
