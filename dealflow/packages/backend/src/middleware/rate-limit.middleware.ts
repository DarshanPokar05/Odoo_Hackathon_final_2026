import rateLimit from "express-rate-limit";
import { AuthConfig, AuthErrorCode } from "@auth-module/core";
import { Request, Response } from "express";

// ---------------------------------------------------------------------------
// Rate limiting middleware — thin wrappers over express-rate-limit.
// Configured from AuthConfig so the consuming app controls the thresholds.
// ---------------------------------------------------------------------------

function rateLimitHandler(_req: Request, res: Response): void {
  res.status(429).json({
    success: false,
    message: "Too many requests. Please try again later.",
    code: AuthErrorCode.RATE_LIMIT_EXCEEDED,
  });
}

export function loginRateLimit(config: AuthConfig) {
  return rateLimit({
    windowMs: config.rateLimit.loginWindowMs,
    max: config.rateLimit.loginMaxAttempts,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
}

export function registrationRateLimit(config: AuthConfig) {
  return rateLimit({
    windowMs: config.rateLimit.registrationWindowMs,
    max: config.rateLimit.registrationMaxAttempts,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
}

export function otpRateLimit() {
  return rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
}

export function globalRateLimit() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
}
