import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";
import { AuthConfig } from "../config/auth.config";
import { AccessTokenPayload, RefreshTokenPayload } from "../types/auth.types";
import { AuthErrors } from "../errors/auth-error";

// ---------------------------------------------------------------------------
// JWT utilities
// ---------------------------------------------------------------------------

/**
 * Signs a short-lived JWT access token.
 */
export function signAccessToken(
  payload: Omit<AccessTokenPayload, "iat" | "exp">,
  cfg: AuthConfig["jwt"],
): string {
  return jwt.sign(payload, cfg.accessTokenSecret, {
    expiresIn: cfg.accessTokenExpiresIn,
    issuer: cfg.issuer,
    audience: cfg.audience,
  } as jwt.SignOptions);
}

/**
 * Signs a long-lived JWT refresh token.
 * Each token includes a unique `tokenId` (jti) for rotation and revocation.
 */
export function signRefreshToken(
  payload: Omit<RefreshTokenPayload, "iat" | "exp">,
  cfg: AuthConfig["jwt"],
): string {
  return jwt.sign(payload, cfg.refreshTokenSecret, {
    expiresIn: cfg.refreshTokenExpiresIn,
    issuer: cfg.issuer,
    audience: cfg.audience,
    jwtid: payload.tokenId,
  } as jwt.SignOptions);
}

/**
 * Verifies and decodes an access token.
 * Throws AuthError on invalid/expired token.
 */
export function verifyAccessToken(token: string, cfg: AuthConfig["jwt"]): AccessTokenPayload {
  try {
    return jwt.verify(token, cfg.accessTokenSecret, {
      issuer: cfg.issuer,
      audience: cfg.audience,
    }) as AccessTokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw AuthErrors.sessionExpired();
    throw AuthErrors.invalidToken();
  }
}

/**
 * Verifies and decodes a refresh token.
 * Throws AuthError on invalid/expired token.
 */
export function verifyRefreshToken(token: string, cfg: AuthConfig["jwt"]): RefreshTokenPayload {
  try {
    return jwt.verify(token, cfg.refreshTokenSecret, {
      issuer: cfg.issuer,
      audience: cfg.audience,
    }) as RefreshTokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw AuthErrors.sessionExpired();
    throw AuthErrors.invalidToken();
  }
}

/**
 * Generates a secure unique token ID (jti) for refresh tokens.
 */
export function generateTokenId(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Parses the expiry duration string (e.g. "7d", "15m") into seconds.
 */
export function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration);
  if (!match) return 900; // default 15 minutes
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[unit] ?? 1);
}
