// ---------------------------------------------------------------------------
// Provider abstraction interfaces
// Implementations live in packages/backend/src/providers.
// The core never imports a concrete provider — only these interfaces.
// ---------------------------------------------------------------------------

import { OtpPurpose } from "./otp.types";

// ── OTP / Notification provider ───────────────────────────────────────────

export interface SendOtpOptions {
  to: string;           // email address or phone number
  otp: string;          // plain OTP (only ever passed to provider, never stored)
  purpose: OtpPurpose;
  userName?: string;
  expiresInMinutes?: number;
}

export interface OtpProvider {
  sendEmailOtp(options: SendOtpOptions): Promise<void>;
  sendSmsOtp(options: SendOtpOptions): Promise<void>;
}

// ── Logger interface ──────────────────────────────────────────────────────

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

// ── Token store (for refresh token revocation) ────────────────────────────

export interface TokenStore {
  /** Persist a refresh token jti with its expiry timestamp */
  set(jti: string, userId: string, expiresAt: Date): Promise<void>;
  /** Returns userId if valid, null if revoked/not found */
  get(jti: string): Promise<string | null>;
  /** Revoke a single token */
  revoke(jti: string): Promise<void>;
  /** Revoke all tokens for a user (logout-all-devices) */
  revokeAllForUser(userId: string): Promise<void>;
}
