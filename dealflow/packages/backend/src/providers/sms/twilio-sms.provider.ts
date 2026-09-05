import { OtpProvider, SendOtpOptions } from "@auth-module/core";
import { logger } from "../../utils/logger";

// ---------------------------------------------------------------------------
// TwilioSmsProvider — sends OTPs via Twilio SMS.
// Install twilio package: pnpm add twilio @types/twilio
// ---------------------------------------------------------------------------

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  appName?: string;
}

export class TwilioSmsProvider implements OtpProvider {
  // Typed as any to avoid requiring the twilio package unless actually used
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;
  private readonly fromNumber: string;
  private readonly appName: string;

  constructor(config: TwilioConfig) {
    this.fromNumber = config.fromNumber;
    this.appName = config.appName ?? "AuthModule";
    // Dynamic require so the package is optional
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const twilio = require("twilio");
      this.client = twilio(config.accountSid, config.authToken);
    } catch {
      throw new Error("Twilio package not installed. Run: pnpm add twilio");
    }
  }

  async sendSmsOtp(options: SendOtpOptions): Promise<void> {
    const body = `Your ${this.appName} verification code is: ${options.otp}. Valid for ${options.expiresInMinutes ?? 5} minutes. Do not share this code.`;
    try {
      await this.client.messages.create({
        body,
        from: this.fromNumber,
        to: options.to,
      });
      logger.info("OTP SMS sent", { to: options.to, purpose: options.purpose });
    } catch (err) {
      logger.error("Failed to send OTP SMS", { to: options.to, error: (err as Error).message });
      throw new Error("Failed to send verification SMS. Please try again.");
    }
  }

  async sendEmailOtp(_options: SendOtpOptions): Promise<void> {
    throw new Error("TwilioSmsProvider does not support email.");
  }
}
