import { OtpProvider, SendOtpOptions } from "@auth-module/core";
import { logger } from "../../utils/logger";

// ---------------------------------------------------------------------------
// ConsoleSmsProvider — development/testing mock for SMS OTPs.
// ---------------------------------------------------------------------------

export class ConsoleSmsProvider implements OtpProvider {
  async sendSmsOtp(options: SendOtpOptions): Promise<void> {
    logger.info("[DEV] SMS OTP", { to: options.to, purpose: options.purpose });
    console.log(`\n📱  [DEV SMS OTP] ───────────────────────────`);
    console.log(`   To:      ${options.to}`);
    console.log(`   Purpose: ${options.purpose}`);
    console.log(`   OTP:     ${options.otp}`);
    console.log(`   Expires: ${options.expiresInMinutes ?? 5} minutes`);
    console.log(`─────────────────────────────────────────────\n`);
  }

  async sendEmailOtp(_options: SendOtpOptions): Promise<void> {
    throw new Error("ConsoleSmsProvider does not support email. Use ConsoleEmailProvider.");
  }
}
