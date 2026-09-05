import * as bcrypt from "bcryptjs";
import { AuthConfig } from "../config/auth.config";
import { AuthErrors } from "../errors/auth-error";

// ---------------------------------------------------------------------------
// Password utilities
// ---------------------------------------------------------------------------

/**
 * Hashes a plaintext password using bcrypt.
 */
export async function hashPassword(plainPassword: string, saltRounds = 12): Promise<string> {
  return bcrypt.hash(plainPassword, saltRounds);
}

/**
 * Verifies a plain password against a bcrypt hash.
 * Constant-time comparison — safe against timing attacks.
 */
export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}

/**
 * Validates password strength against the provided config.
 * Throws AuthError with PASSWORD_TOO_WEAK if not met.
 */
export function assertPasswordStrength(password: string, cfg: AuthConfig["password"]): void {
  const issues: string[] = [];

  if (password.length < cfg.minLength)
    issues.push(`at least ${cfg.minLength} characters`);
  if (cfg.requireUppercase && !/[A-Z]/.test(password))
    issues.push("one uppercase letter");
  if (cfg.requireLowercase && !/[a-z]/.test(password))
    issues.push("one lowercase letter");
  if (cfg.requireNumbers && !/[0-9]/.test(password))
    issues.push("one number");
  if (cfg.requireSpecialChars && !/[^A-Za-z0-9]/.test(password))
    issues.push("one special character");

  if (issues.length > 0) {
    throw AuthErrors.passwordTooWeak(`Password must contain ${issues.join(", ")}.`);
  }
}
