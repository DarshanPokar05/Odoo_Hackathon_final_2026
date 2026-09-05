import * as nodemailer from "nodemailer";
import { OtpProvider, SendOtpOptions } from "@auth-module/core";
import { logger } from "../../utils/logger";

// ---------------------------------------------------------------------------
// SmtpEmailProvider — sends OTP emails via any SMTP server (Gmail, Mailgun,
// Postmark, etc.). Add nodemailer to the package deps to use this.
// ---------------------------------------------------------------------------

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  user: string;
  pass: string;
  from: string;
  appName?: string;
}

export class SmtpEmailProvider implements OtpProvider {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly appName: string;

  constructor(config: SmtpConfig) {
    this.from = config.from;
    this.appName = config.appName ?? "AuthModule";
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      auth: { user: config.user, pass: config.pass },
    });
  }

  async sendEmailOtp(options: SendOtpOptions): Promise<void> {
    const subject = this.buildSubject(options.purpose);
    const html = this.buildHtml(options);

    try {
      await this.transporter.sendMail({
        from: `"${this.appName}" <${this.from}>`,
        to: options.to,
        subject,
        html,
      });
      logger.info("OTP email sent", { to: options.to, purpose: options.purpose });
    } catch (err) {
      logger.error("Failed to send OTP email", { to: options.to, error: (err as Error).message });
      throw new Error("Failed to send verification email. Please try again.");
    }
  }

  async sendSmsOtp(_options: SendOtpOptions): Promise<void> {
    throw new Error("SmtpEmailProvider does not support SMS.");
  }

  private buildSubject(purpose: string): string {
    const subjects: Record<string, string> = {
      REGISTRATION: `Verify your email — ${this.appName}`,
      PASSWORD_RESET: `Reset your password — ${this.appName}`,
      EMAIL_VERIFICATION: `Verify your email — ${this.appName}`,
      LOGIN_VERIFICATION: `Login verification — ${this.appName}`,
      PHONE_VERIFICATION: `Verify your phone — ${this.appName}`,
    };
    return subjects[purpose] ?? `Your verification code — ${this.appName}`;
  }

  private buildHtml(options: SendOtpOptions): string {
    const expiresIn = options.expiresInMinutes ?? 5;
    return `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px;">
        <h2 style="color:#111827;margin-bottom:8px;">${this.appName}</h2>
        <p style="color:#374151;">Hi ${options.userName ?? "there"},</p>
        <p style="color:#374151;">Your verification code is:</p>
        <div style="background:#f3f4f6;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:700;letter-spacing:0.25em;color:#111827;">${options.otp}</span>
        </div>
        <p style="color:#6b7280;font-size:14px;">This code expires in <strong>${expiresIn} minutes</strong>. Do not share it with anyone.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9ca3af;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;
  }
}
