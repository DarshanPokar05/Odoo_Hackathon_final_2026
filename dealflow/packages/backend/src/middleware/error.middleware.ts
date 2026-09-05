import { Request, Response, NextFunction } from "express";
import { AuthError, AuthErrorCode } from "@auth-module/core";
import { logger } from "../utils/logger";

// ---------------------------------------------------------------------------
// Global error handler middleware — must be registered last in Express.
// Converts AuthError and Zod errors to consistent API envelopes.
// ---------------------------------------------------------------------------

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // AuthError — our typed domain errors
  if (err instanceof AuthError) {
    if (!err.isOperational) {
      logger.error("Non-operational auth error", { code: err.code, message: err.message });
    }
    res.status(err.httpStatus).json({
      success: false,
      message: err.message,
      code: err.code,
    });
    return;
  }

  // Zod validation errors
  if (isZodError(err)) {
    const message = err.errors.map((e: { path: (string | number)[]; message: string }) => `${e.path.join(".")}: ${e.message}`).join(", ");
    res.status(422).json({
      success: false,
      message,
      code: AuthErrorCode.VALIDATION_ERROR,
    });
    return;
  }

  // Express rate-limit errors
  if (err instanceof Error && err.message === "Too Many Requests") {
    res.status(429).json({
      success: false,
      message: "Too many requests. Please try again later.",
      code: AuthErrorCode.RATE_LIMIT_EXCEEDED,
    });
    return;
  }

  // Unknown errors — log fully but respond generically
  logger.error("Unhandled error", { error: err instanceof Error ? err.message : String(err) });
  res.status(500).json({
    success: false,
    message: "An unexpected error occurred.",
    code: AuthErrorCode.INTERNAL_ERROR,
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: "Endpoint not found.",
    code: AuthErrorCode.NOT_FOUND,
  });
}

function isZodError(err: unknown): err is { errors: { path: (string | number)[]; message: string }[] } {
  return (
    typeof err === "object" &&
    err !== null &&
    "errors" in err &&
    Array.isArray((err as { errors: unknown }).errors)
  );
}
