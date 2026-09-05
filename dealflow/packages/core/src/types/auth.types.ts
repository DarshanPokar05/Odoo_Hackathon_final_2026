// ---------------------------------------------------------------------------
// Auth flow request/response types — shared between backend services and
// frontend API client.
// ---------------------------------------------------------------------------

import { PublicUser } from "./user.types";

// ── Request payloads ──────────────────────────────────────────────────────

export interface RegisterInput {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  confirmPassword: string;
}

export interface VerifyOtpInput {
  identifier: string; // email or phone
  otp: string;
  purpose: "REGISTRATION" | "PASSWORD_RESET";
}

export interface ResendOtpInput {
  identifier: string;
  purpose: "REGISTRATION" | "PASSWORD_RESET";
}

export interface LoginInput {
  identifier: string; // email or phone
  password: string;
  rememberMe?: boolean;
}

export interface ForgotPasswordInput {
  identifier: string;
}

export interface ResetPasswordInput {
  identifier: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

// ── Token payloads ────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub: string;       // user id
  email: string | null;
  phone: string | null;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;   // jti — used for rotation / revocation
  iat?: number;
  exp?: number;
}

// ── Response shapes ───────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expiry
}

export interface AuthResponse {
  user: PublicUser;
  tokens: AuthTokens;
}

// ── Generic API envelope ──────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  message: string;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
  code: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;
