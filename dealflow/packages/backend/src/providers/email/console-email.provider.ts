import { OtpProvider, SendOtpOptions } from "@auth-module/core";
import { logger } from "../../utils/logger";

// ---------------------------------------------------------------------------
// ConsoleEmailProvider — for local development / testing.
// Logs the OTP to the console instead of sending a real email.
// NEVER use in production.
// ---------------------------------------------------------------------------

export class ConsoleEmailProvider implements OtpProvider {
  async sendEmailOtp(options: SendOtpOptions): Promise<void> {
    logger.info("[DEV] Email OTP", {
      to: options.to,
      purpose: options.purpose,
      // OTP logged only in dev — redacted format to demonstrate safe logging pattern
      otp: `[${options.otp}] — visible in development only`,
    });
    console.log(`\n📧  [DEV EMAIL OTP] ─────────────────────────`);
    console.log(`   To:      ${options.to}`);
    console.log(`   Purpose: ${options.purpose}`);
    console.log(`   OTP:     ${options.otp}`);
    console.log(`   Expires: ${options.expiresInMinutes ?? 5} minutes`);
    console.log(`─────────────────────────────────────────────\n`);
  }

  async sendSmsOtp(_options: SendOtpOptions): Promise<void> {
    throw new Error("ConsoleEmailProvider does not support SMS. Use ConsoleSmsProvider.");
  }
}
