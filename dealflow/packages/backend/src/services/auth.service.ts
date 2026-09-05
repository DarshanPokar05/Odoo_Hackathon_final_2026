import {
  AuthConfig,
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  AuthResponse,
  AuthTokens,
  PublicUser,
  AuthErrors,
  hashPassword,
  verifyPassword,
  assertPasswordStrength,
  normalizeIdentifier,
  maskIdentifier,
  buildRegisterSchema,
  buildLoginSchema,
  buildForgotPasswordSchema,
  buildResetPasswordSchema,
} from "@auth-module/core";
import { UserRepository } from "../repositories/user.repository";
import { OtpService } from "./otp.service";
import { TokenService } from "./token.service";
import { logger } from "../utils/logger";

// ---------------------------------------------------------------------------
// AuthService — orchestrates all authentication flows.
// This is the single entry point consumed by the API routes.
// ---------------------------------------------------------------------------

export class AuthService {
  private readonly registerSchema;
  private readonly loginSchema;
  private readonly forgotPasswordSchema;
  private readonly resetPasswordSchema;

  constructor(
    private readonly userRepo: UserRepository,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    private readonly config: AuthConfig,
  ) {
    this.registerSchema = buildRegisterSchema(config);
    this.loginSchema = buildLoginSchema();
    this.forgotPasswordSchema = buildForgotPasswordSchema();
    this.resetPasswordSchema = buildResetPasswordSchema(config);
  }

  // ── Registration ──────────────────────────────────────────────────────────

  async register(input: RegisterInput): Promise<{ maskedIdentifier: string }> {
    const data = this.registerSchema.parse(input);

    // Password already validated by Zod schema; double-check strength
    assertPasswordStrength(data.password, this.config.password);

    // Duplicate check — same error for email AND phone (no enumeration)
    if (data.email) {
      const exists = await this.userRepo.emailExists(data.email);
      if (exists) throw AuthErrors.userAlreadyExists();
    }
    if (data.phone) {
      const exists = await this.userRepo.phoneExists(data.phone);
      if (exists) throw AuthErrors.userAlreadyExists();
    }

    const passwordHash = await hashPassword(data.password, this.config.password.saltRounds);

    const user = await this.userRepo.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash,
    });

    const identifier = (data.email ?? data.phone)!;
    await this.otpService.generateAndSend({
      userId: user.id,
      identifier,
      purpose: "REGISTRATION",
      userName: user.name,
    });

    logger.info("User registered — awaiting OTP verification", { userId: user.id });
    return { maskedIdentifier: maskIdentifier(identifier) };
  }

  async verifyRegistrationOtp(identifier: string, otp: string): Promise<AuthResponse> {
    identifier = normalizeIdentifier(identifier);
    const user = await this.userRepo.findByEmailOrPhone(identifier);
    if (!user) throw AuthErrors.invalidCredentials(); // enumeration protection

    await this.otpService.verify({ userId: user.id, purpose: "REGISTRATION", plainOtp: otp });
    const verified = await this.userRepo.markVerified(user.id);
    await this.otpService.invalidate(user.id, "REGISTRATION");

    await this.userRepo.updateLastLogin(user.id);
    const tokens = await this.tokenService.issueTokens(verified.id, verified.email, verified.phone);

    logger.info("Registration verified", { userId: user.id });
    return { user: this.userRepo.toPublicUser(verified), tokens };
  }

  async resendRegistrationOtp(identifier: string): Promise<{ maskedIdentifier: string }> {
    identifier = normalizeIdentifier(identifier);
    const user = await this.userRepo.findByEmailOrPhone(identifier);
    // Return success even if user not found — enumeration protection
    if (!user || user.isVerified) {
      return { maskedIdentifier: maskIdentifier(identifier) };
    }

    await this.otpService.generateAndSend({
      userId: user.id,
      identifier,
      purpose: "REGISTRATION",
      userName: user.name,
      isResend: true,
    });

    return { maskedIdentifier: maskIdentifier(identifier) };
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(input: LoginInput): Promise<AuthResponse> {
    const data = this.loginSchema.parse(input);
    const identifier = normalizeIdentifier(data.identifier);

    const user = await this.userRepo.findByEmailOrPhone(identifier);

    // Use constant-time comparison even on non-existent user to prevent timing attacks
    const dummyHash = "$2a$12$invalidhashfornonexistentuser000000000000000000000";
    const passwordValid = await verifyPassword(
      data.password,
      user?.passwordHash ?? dummyHash,
    );

    if (!user || !passwordValid) {
      throw AuthErrors.invalidCredentials();
    }

    if (!user.isVerified) throw AuthErrors.accountNotVerified();
    if (user.status === "SUSPENDED") throw AuthErrors.accountSuspended();

    await this.userRepo.updateLastLogin(user.id);
    const tokens = await this.tokenService.issueTokens(user.id, user.email, user.phone);

    logger.info("User logged in", { userId: user.id });
    return { user: this.userRepo.toPublicUser(user), tokens };
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout(refreshToken: string): Promise<void> {
    await this.tokenService.revokeToken(refreshToken);
    logger.info("User logged out");
  }

  // ── Token refresh ─────────────────────────────────────────────────────────

  async refreshSession(refreshToken: string): Promise<AuthTokens> {
    const { userId } = await this.tokenService.rotateRefreshToken(refreshToken);
    // Re-issue with correct email/phone from DB so the new access token has them populated
    const user = await this.userRepo.findById(userId);
    if (!user || user.status !== "ACTIVE") {
      await this.tokenService.revokeAllForUser(userId);
      throw AuthErrors.unauthorized();
    }
    // Re-issue fresh tokens with correct email/phone
    const freshTokens = await this.tokenService.issueTokens(user.id, user.email, user.phone);
    return freshTokens;
  }

  // ── Forgot password ───────────────────────────────────────────────────────

  async forgotPassword(input: ForgotPasswordInput): Promise<{ maskedIdentifier: string }> {
    const data = this.forgotPasswordSchema.parse(input);
    const identifier = normalizeIdentifier(data.identifier);

    const user = await this.userRepo.findByEmailOrPhone(identifier);

    // Always return success — enumeration protection
    if (user && user.isVerified) {
      await this.otpService.generateAndSend({
        userId: user.id,
        identifier,
        purpose: "PASSWORD_RESET",
        userName: user.name,
      });
      logger.info("Password reset OTP sent", { userId: user.id });
    }

    return { maskedIdentifier: maskIdentifier(identifier) };
  }

  async verifyPasswordResetOtp(identifier: string, otp: string): Promise<{ resetToken: string }> {
    identifier = normalizeIdentifier(identifier);
    const user = await this.userRepo.findByEmailOrPhone(identifier);
    if (!user) throw AuthErrors.invalidCredentials();

    await this.otpService.verify({ userId: user.id, purpose: "PASSWORD_RESET", plainOtp: otp });

    // Issue a short-lived single-use access token to authorize the reset step
    const tokens = await this.tokenService.issueTokens(user.id, user.email, user.phone);
    logger.info("Password reset OTP verified", { userId: user.id });
    return { resetToken: tokens.accessToken };
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const data = this.resetPasswordSchema.parse(input);
    const identifier = normalizeIdentifier(data.identifier);

    const user = await this.userRepo.findByEmailOrPhone(identifier);
    if (!user) throw AuthErrors.invalidCredentials();

    // OTP must still be in verified (but not yet invalidated) state
    const otpRecord = await this.otpService.findRecord(user.id, "PASSWORD_RESET");
    if (!otpRecord || !otpRecord.verifiedAt) throw AuthErrors.invalidToken();

    assertPasswordStrength(data.newPassword, this.config.password);

    const newHash = await hashPassword(data.newPassword, this.config.password.saltRounds);
    await this.userRepo.update(user.id, { passwordHash: newHash });

    // Invalidate OTP and ALL refresh tokens (force re-login on all devices)
    await this.otpService.invalidate(user.id, "PASSWORD_RESET");
    await this.tokenService.revokeAllForUser(user.id);

    logger.info("Password reset completed", { userId: user.id });
  }

  // ── Get current user ──────────────────────────────────────────────────────

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await this.userRepo.findById(userId);
    if (!user || user.status !== "ACTIVE") throw AuthErrors.unauthorized();
    return this.userRepo.toPublicUser(user);
  }
}
