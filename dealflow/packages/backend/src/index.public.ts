// ---------------------------------------------------------------------------
// @auth-module/backend — public module API
// Consumers import from here to embed the auth module into their own Express app.
// ---------------------------------------------------------------------------

export { createApp } from "./app";
export { buildContainer } from "./container";
export type { ContainerOptions, Container } from "./container";
export type { CreateAppOptions } from "./app";

// Repositories
export { UserRepository } from "./repositories/user.repository";
export { OtpRepository } from "./repositories/otp.repository";
export { PrismaTokenStore } from "./repositories/token.repository";

// Services
export { AuthService } from "./services/auth.service";
export { OtpService } from "./services/otp.service";
export { TokenService } from "./services/token.service";

// Controllers & Routes
export { AuthController } from "./api/v1/auth/auth.controller";
export { createAuthRouter } from "./api/v1/auth/auth.routes";

// Middleware
export { authenticate, optionalAuthenticate } from "./middleware/authenticate.middleware";
export { errorHandler, notFoundHandler } from "./middleware/error.middleware";
export { loginRateLimit, registrationRateLimit, otpRateLimit } from "./middleware/rate-limit.middleware";

// Providers
export { ConsoleEmailProvider } from "./providers/email/console-email.provider";
export { SmtpEmailProvider } from "./providers/email/smtp-email.provider";
export { ConsoleSmsProvider } from "./providers/sms/console-sms.provider";
export { TwilioSmsProvider } from "./providers/sms/twilio-sms.provider";
export { CompositeOtpProvider } from "./providers/otp/composite-otp.provider";

// DB
export { prisma, connectDatabase, disconnectDatabase } from "./db/prisma.client";
