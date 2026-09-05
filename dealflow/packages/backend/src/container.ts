import { AuthConfig } from "@auth-module/core";
import { prisma } from "./db/prisma.client";
import { UserRepository } from "./repositories/user.repository";
import { OtpRepository } from "./repositories/otp.repository";
import { PrismaTokenStore } from "./repositories/token.repository";
import { ConsoleEmailProvider } from "./providers/email/console-email.provider";
import { SmtpEmailProvider } from "./providers/email/smtp-email.provider";
import { ConsoleSmsProvider } from "./providers/sms/console-sms.provider";
import { TwilioSmsProvider } from "./providers/sms/twilio-sms.provider";
import { CompositeOtpProvider } from "./providers/otp/composite-otp.provider";
import { OtpService } from "./services/otp.service";
import { TokenService } from "./services/token.service";
import { AuthService } from "./services/auth.service";
import { AuthController } from "./api/v1/auth/auth.controller";
import { OtpProvider } from "@auth-module/core";

// ---------------------------------------------------------------------------
// DI container — wires all dependencies together.
// Override individual pieces by passing custom providers.
// ---------------------------------------------------------------------------

export interface ContainerOptions {
  config: AuthConfig;
  emailProvider?: OtpProvider;
  smsProvider?: OtpProvider;
}

export interface Container {
  authService: AuthService;
  authController: AuthController;
}

export function buildContainer(options: ContainerOptions): Container {
  const { config } = options;

  // Repositories
  const userRepo = new UserRepository(prisma);
  const otpRepo = new OtpRepository(prisma);
  const tokenStore = new PrismaTokenStore(prisma);

  // Providers — use injected or build from env
  const emailProvider = options.emailProvider ?? buildEmailProvider(config);
  const smsProvider = options.smsProvider ?? buildSmsProvider(config);
  const compositeProvider = new CompositeOtpProvider(emailProvider, smsProvider);

  // Services
  const otpService = new OtpService(otpRepo, compositeProvider, config);
  const tokenService = new TokenService(tokenStore, config);
  const authService = new AuthService(userRepo, otpService, tokenService, config);

  // Controller
  const authController = new AuthController(authService, config);

  return { authService, authController };
}

function buildEmailProvider(config: AuthConfig): OtpProvider {
  const provider = process.env["EMAIL_PROVIDER"] ?? "console";
  if (provider === "smtp") {
    return new SmtpEmailProvider({
      host: process.env["SMTP_HOST"] ?? "localhost",
      port: parseInt(process.env["SMTP_PORT"] ?? "587"),
      user: process.env["SMTP_USER"] ?? "",
      pass: process.env["SMTP_PASS"] ?? "",
      from: process.env["SMTP_FROM"] ?? "no-reply@example.com",
      appName: config.app.name,
    });
  }
  return new ConsoleEmailProvider();
}

function buildSmsProvider(_config: AuthConfig): OtpProvider {
  const provider = process.env["SMS_PROVIDER"] ?? "console";
  if (provider === "twilio") {
    return new TwilioSmsProvider({
      accountSid: process.env["TWILIO_ACCOUNT_SID"] ?? "",
      authToken: process.env["TWILIO_AUTH_TOKEN"] ?? "",
      fromNumber: process.env["TWILIO_FROM_NUMBER"] ?? "",
    });
  }
  return new ConsoleSmsProvider();
}
