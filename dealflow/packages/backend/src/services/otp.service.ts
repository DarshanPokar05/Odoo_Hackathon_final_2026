import {
  AuthConfig,
  OtpPurpose,
  AuthErrors,
  generateOtp,
  hashOtp,
  verifyOtp,
  getOtpExpiry,
  getResendCooldownRemaining,
} from "@auth-module/core";
import { OtpRepository } from "../repositories/otp.repository";
import { CompositeOtpProvider } from "../providers/otp/composite-otp.provider";
import { logger } from "../utils/logger";

// ---------------------------------------------------------------------------
// OtpService — generates, sends, verifies, and manages OTP lifecycle.
// All security rules (cooldown, max attempts, max resends) are enforced here.
// ---------------------------------------------------------------------------

export class OtpService {
  constructor(
    private readonly otpRepo: OtpRepository,
    private readonly otpProvider: CompositeOtpProvider,
    private readonly config: AuthConfig,
  ) {}

  /**
   * Generates a new OTP, hashes it, persists the record, and dispatches
   * delivery via the configured provider.
   *
   * On subsequent calls (resend), enforces cooldown and resend limits.
   * The new OTP atomically replaces the previous one.
   */
  async generateAndSend(params: {
    userId: string;
    identifier: string;      // email or phone — sent to provider
    purpose: OtpPurpose;
    userName?: string;
    isResend?: boolean;
  }): Promise<void> {
    const { userId, identifier, purpose, userName, isResend = false } = params;
    const cfg = this.config.otp;

    if (isResend) {
      const existing = await this.otpRepo.findActiveByUserAndPurpose(userId, purpose);
      if (existing) {
        // Check resend limit
        if (existing.resendCount >= existing.maxResends) {
          throw AuthErrors.otpResendLimit();
        }
        // Check cooldown
        const cooldownRemaining = getResendCooldownRemaining(existing.lastSentAt, cfg.resendCooldownSeconds);
        if (cooldownRemaining > 0) {
          throw AuthErrors.otpResendCooldown(cooldownRemaining);
        }
      }
    }

    // Generate fresh OTP
    const plainOtp = generateOtp(cfg.length);
    const otpHash = await hashOtp(plainOtp, cfg.saltRounds);
    const expiresAt = getOtpExpiry(cfg.expirationSeconds);

    // Persist (upsert invalidates any previous OTP atomically)
    await this.otpRepo.upsert({
      userId,
      purpose,
      otpHash,
      expiresAt,
      maxAttempts: cfg.maxAttempts,
      maxResends: cfg.maxResends,
    });

    // Send via provider — plain OTP only ever goes to the provider, never stored
    await this.otpProvider.send({
      to: identifier,
      otp: plainOtp,
      purpose,
      userName,
      expiresInMinutes: Math.ceil(cfg.expirationSeconds / 60),
    });

    logger.info("OTP sent", { userId, purpose, isResend });
  }

  /**
   * Verifies the supplied OTP against the stored hash.
   * Increments attempt counter on every call.
   * Marks the record verified on success.
   */
  async verify(params: {
    userId: string;
    purpose: OtpPurpose;
    plainOtp: string;
  }): Promise<void> {
    const { userId, purpose, plainOtp } = params;

    const record = await this.otpRepo.findActiveByUserAndPurpose(userId, purpose);

    if (!record) throw AuthErrors.otpNotFound();

    // Check if already verified (prevents replay)
    if (record.verifiedAt !== null) throw AuthErrors.otpNotFound();

    // Check attempts before verifying to avoid timing oracle on max-exceeded
    if (record.attempts >= record.maxAttempts) {
      throw AuthErrors.otpAttemptsExceeded();
    }

    // Check expiry
    if (record.expiresAt < new Date()) {
      throw AuthErrors.otpExpired();
    }

    // Increment attempts atomically before checking OTP
    const updated = await this.otpRepo.incrementAttempts(record.id);

    // Constant-time comparison via bcrypt
    const isValid = await verifyOtp(plainOtp, record.otpHash);

    if (!isValid) {
      const remaining = updated.maxAttempts - updated.attempts;
      if (remaining <= 0) throw AuthErrors.otpAttemptsExceeded();
      throw AuthErrors.invalidOtp(remaining);
    }

    // Mark as verified
    await this.otpRepo.markVerified(record.id);
    logger.info("OTP verified", { userId, purpose });
  }

  /**
   * Deletes the OTP record after it has been consumed (post-registration,
   * post-password-reset) to prevent reuse.
   */
  async invalidate(userId: string, purpose: OtpPurpose): Promise<void> {
    await this.otpRepo.deleteByUserAndPurpose(userId, purpose);
  }

  /**
   * Returns the active OTP record for a user+purpose without verifying it.
   * Used by AuthService to check if an OTP was already verified before allowing
   * password reset.
   */
  async findRecord(userId: string, purpose: OtpPurpose) {
    return this.otpRepo.findActiveByUserAndPurpose(userId, purpose);
  }
}
