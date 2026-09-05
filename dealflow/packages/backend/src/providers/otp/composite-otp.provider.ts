import { OtpProvider, SendOtpOptions } from "@auth-module/core";

// ---------------------------------------------------------------------------
// CompositeOtpProvider — routes to email or SMS provider based on the `to`
// field. A `+` prefix = phone number → SMS; otherwise → email.
// This is the single OtpProvider instance injected into services.
// ---------------------------------------------------------------------------

export class CompositeOtpProvider implements OtpProvider {
  constructor(
    private readonly emailProvider: OtpProvider,
    private readonly smsProvider: OtpProvider,
  ) {}

  async sendEmailOtp(options: SendOtpOptions): Promise<void> {
    return this.emailProvider.sendEmailOtp(options);
  }

  async sendSmsOtp(options: SendOtpOptions): Promise<void> {
    return this.smsProvider.sendSmsOtp(options);
  }

  /**
   * Routes based on the `to` value: phone numbers get SMS, everything else email.
   */
  async send(options: SendOtpOptions): Promise<void> {
    if (options.to.startsWith("+")) {
      return this.sendSmsOtp(options);
    }
    return this.sendEmailOtp(options);
  }
}
