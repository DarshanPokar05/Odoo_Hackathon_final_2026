import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "../../services/auth.service";
import { OtpService } from "../../services/otp.service";
import { TokenService } from "../../services/token.service";
import { UserRepository } from "../../repositories/user.repository";
import { hashPassword } from "@auth-module/core";
import {
  makeTestConfig,
  makeMockUserRepo,
  makeMockOtpRepo,
  makeMockTokenStore,
  makeMockOtpProvider,
  makeUser,
  makeOtpRecord,
} from "../helpers/test-factories";
import { CompositeOtpProvider } from "../../providers/otp/composite-otp.provider";
import { OtpRepository } from "../../repositories/otp.repository";
import { PrismaTokenStore } from "../../repositories/token.repository";

// ── Setup helpers ─────────────────────────────────────────────────────────────

function buildServices() {
  const config = makeTestConfig();
  const userRepo = makeMockUserRepo();
  const otpRepo = makeMockOtpRepo();
  const tokenStore = makeMockTokenStore();
  const otpProvider = makeMockOtpProvider();
  const composite = new CompositeOtpProvider(otpProvider, otpProvider);

  const otpService = new OtpService(otpRepo as unknown as OtpRepository, composite, config);
  const tokenService = new TokenService(tokenStore as unknown as PrismaTokenStore, config);
  const authService = new AuthService(
    userRepo as unknown as UserRepository,
    otpService,
    tokenService,
    config,
  );

  return { authService, userRepo, otpRepo, tokenStore, otpProvider, config };
}

// ── Registration tests ─────────────────────────────────────────────────────────

describe("AuthService.register", () => {
  let ctx: ReturnType<typeof buildServices>;

  beforeEach(() => {
    ctx = buildServices();
    vi.clearAllMocks();
  });

  it("creates user, sends OTP, returns masked identifier", async () => {
    ctx.userRepo.emailExists.mockResolvedValue(false);
    ctx.userRepo.create.mockResolvedValue(makeUser({ id: "new-user", isVerified: false }));
    ctx.otpRepo.upsert.mockResolvedValue(makeOtpRecord());

    const result = await ctx.authService.register({
      name: "Alice",
      email: "alice@example.com",
      password: "Password1!",
      confirmPassword: "Password1!",
    });

    expect(result.maskedIdentifier).toMatch(/a\*\*\*@example\.com/);
    expect(ctx.userRepo.create).toHaveBeenCalledOnce();
    expect(ctx.otpProvider.sendEmailOtp).toHaveBeenCalledOnce();
  });

  it("throws USER_ALREADY_EXISTS for duplicate email", async () => {
    ctx.userRepo.emailExists.mockResolvedValue(true);

    await expect(
      ctx.authService.register({
        name: "Alice",
        email: "alice@example.com",
        password: "Password1!",
        confirmPassword: "Password1!",
      }),
    ).rejects.toMatchObject({ code: "USER_ALREADY_EXISTS" });

    expect(ctx.userRepo.create).not.toHaveBeenCalled();
  });

  it("throws USER_ALREADY_EXISTS for duplicate phone", async () => {
    ctx.userRepo.phoneExists.mockResolvedValue(true);

    await expect(
      ctx.authService.register({
        name: "Alice",
        phone: "+12025551234",
        password: "Password1!",
        confirmPassword: "Password1!",
      }),
    ).rejects.toMatchObject({ code: "USER_ALREADY_EXISTS" });
  });

  it("throws VALIDATION_ERROR for mismatched passwords", async () => {
    await expect(
      ctx.authService.register({
        name: "Alice",
        email: "alice@example.com",
        password: "Password1!",
        confirmPassword: "Different1!",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("throws PASSWORD_TOO_WEAK for weak password", async () => {
    ctx.userRepo.emailExists.mockResolvedValue(false);

    await expect(
      ctx.authService.register({
        name: "Alice",
        email: "alice@example.com",
        password: "weakpass",
        confirmPassword: "weakpass",
      }),
    ).rejects.toMatchObject({ code: "PASSWORD_TOO_WEAK" });
  });

  it("throws VALIDATION_ERROR when neither email nor phone provided", async () => {
    await expect(
      ctx.authService.register({
        name: "Alice",
        password: "Password1!",
        confirmPassword: "Password1!",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

// ── Login tests ───────────────────────────────────────────────────────────────

describe("AuthService.login", () => {
  let ctx: ReturnType<typeof buildServices>;

  beforeEach(async () => {
    ctx = buildServices();
    vi.clearAllMocks();
  });

  it("returns tokens and user on valid credentials", async () => {
    const passwordHash = await hashPassword("Password1!", 4);
    const user = makeUser({ passwordHash, isVerified: true });

    ctx.userRepo.findByEmailOrPhone.mockResolvedValue(user);
    ctx.userRepo.update.mockResolvedValue(user);
    ctx.tokenStore.set.mockResolvedValue(undefined);

    const result = await ctx.authService.login({
      identifier: "test@example.com",
      password: "Password1!",
    });

    expect(result.user.id).toBe(user.id);
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();
  });

  it("throws INVALID_CREDENTIALS for wrong password", async () => {
    const passwordHash = await hashPassword("CorrectPass1!", 4);
    const user = makeUser({ passwordHash, isVerified: true });

    ctx.userRepo.findByEmailOrPhone.mockResolvedValue(user);

    await expect(
      ctx.authService.login({ identifier: "test@example.com", password: "WrongPass1!" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("throws INVALID_CREDENTIALS for non-existent user (no enumeration)", async () => {
    ctx.userRepo.findByEmailOrPhone.mockResolvedValue(null);

    await expect(
      ctx.authService.login({ identifier: "nobody@example.com", password: "Password1!" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("throws ACCOUNT_NOT_VERIFIED for unverified user", async () => {
    const passwordHash = await hashPassword("Password1!", 4);
    const user = makeUser({ passwordHash, isVerified: false });

    ctx.userRepo.findByEmailOrPhone.mockResolvedValue(user);

    await expect(
      ctx.authService.login({ identifier: "test@example.com", password: "Password1!" }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_VERIFIED" });
  });

  it("throws ACCOUNT_SUSPENDED for suspended user", async () => {
    const passwordHash = await hashPassword("Password1!", 4);
    const user = makeUser({ passwordHash, isVerified: true, status: "SUSPENDED" });

    ctx.userRepo.findByEmailOrPhone.mockResolvedValue(user);

    await expect(
      ctx.authService.login({ identifier: "test@example.com", password: "Password1!" }),
    ).rejects.toMatchObject({ code: "ACCOUNT_SUSPENDED" });
  });
});

// ── OTP Verification tests ─────────────────────────────────────────────────────

describe("AuthService.verifyRegistrationOtp", () => {
  it("marks user verified, issues tokens, returns user", async () => {
    const ctx = buildServices();
    vi.clearAllMocks();

    const unverifiedUser = makeUser({ isVerified: false });
    const verifiedUser = makeUser({ isVerified: true });

    ctx.userRepo.findByEmailOrPhone.mockResolvedValue(unverifiedUser);

    // Spy on OtpService.verify
    const verifyOtpSpy = vi.spyOn(
      ctx.authService["otpService"] as OtpService,
      "verify",
    ).mockResolvedValue(undefined);

    ctx.userRepo.markVerified.mockResolvedValue(verifiedUser);
    ctx.userRepo.update.mockResolvedValue(verifiedUser);
    ctx.tokenStore.set.mockResolvedValue(undefined);

    const spy2 = vi.spyOn(
      ctx.authService["otpService"] as OtpService,
      "invalidate",
    ).mockResolvedValue(undefined);

    const result = await ctx.authService.verifyRegistrationOtp("test@example.com", "123456");

    expect(verifyOtpSpy).toHaveBeenCalledWith({
      userId: unverifiedUser.id,
      purpose: "REGISTRATION",
      plainOtp: "123456",
    });
    expect(ctx.userRepo.markVerified).toHaveBeenCalledWith(unverifiedUser.id);
    expect(result.user.isVerified).toBe(true);
    expect(result.tokens.accessToken).toBeTruthy();
    void spy2;
  });

  it("throws INVALID_CREDENTIALS for unknown identifier (enumeration protection)", async () => {
    const ctx = buildServices();
    ctx.userRepo.findByEmailOrPhone.mockResolvedValue(null);

    await expect(
      ctx.authService.verifyRegistrationOtp("nobody@example.com", "123456"),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
});

// ── Forgot password tests ──────────────────────────────────────────────────────

describe("AuthService.forgotPassword", () => {
  it("sends OTP and returns masked identifier for known user", async () => {
    const ctx = buildServices();
    vi.clearAllMocks();

    const user = makeUser({ isVerified: true });
    ctx.userRepo.findByEmailOrPhone.mockResolvedValue(user);
    ctx.otpRepo.upsert.mockResolvedValue(makeOtpRecord({ purpose: "PASSWORD_RESET" }));

    const result = await ctx.authService.forgotPassword({ identifier: "test@example.com" });

    expect(result.maskedIdentifier).toBeTruthy();
    expect(ctx.otpProvider.sendEmailOtp).toHaveBeenCalledOnce();
  });

  it("returns masked identifier even for unknown user (enumeration protection)", async () => {
    const ctx = buildServices();
    ctx.userRepo.findByEmailOrPhone.mockResolvedValue(null);

    const result = await ctx.authService.forgotPassword({ identifier: "ghost@example.com" });

    expect(result.maskedIdentifier).toBeTruthy();
    expect(ctx.otpProvider.sendEmailOtp).not.toHaveBeenCalled();
  });
});

// ── Reset password tests ───────────────────────────────────────────────────────

describe("AuthService.resetPassword", () => {
  it("updates password hash, invalidates OTP and revokes all tokens", async () => {
    const ctx = buildServices();
    vi.clearAllMocks();

    const user = makeUser();
    ctx.userRepo.findByEmailOrPhone.mockResolvedValue(user);

    // Simulate a verified OTP record
    vi.spyOn(ctx.authService["otpService"] as OtpService, "findRecord")
      .mockResolvedValue(makeOtpRecord({ purpose: "PASSWORD_RESET", verifiedAt: new Date() }));

    ctx.userRepo.update.mockResolvedValue(user);
    ctx.otpRepo.deleteByUserAndPurpose.mockResolvedValue(undefined);
    ctx.tokenStore.revokeAllForUser.mockResolvedValue(undefined);

    await expect(
      ctx.authService.resetPassword({
        identifier: "test@example.com",
        otp: "123456",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      }),
    ).resolves.toBeUndefined();

    expect(ctx.userRepo.update).toHaveBeenCalledOnce();
    expect(ctx.tokenStore.revokeAllForUser).toHaveBeenCalledWith(user.id);
  });

  it("throws PASSWORD_MISMATCH when passwords don't match", async () => {
    const ctx = buildServices();

    await expect(
      ctx.authService.resetPassword({
        identifier: "test@example.com",
        otp: "123456",
        newPassword: "NewPassword1!",
        confirmPassword: "Different1!",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("throws INVALID_TOKEN when OTP not verified yet", async () => {
    const ctx = buildServices();
    vi.clearAllMocks();

    const user = makeUser();
    ctx.userRepo.findByEmailOrPhone.mockResolvedValue(user);

    vi.spyOn(ctx.authService["otpService"] as OtpService, "findRecord")
      .mockResolvedValue(makeOtpRecord({ purpose: "PASSWORD_RESET", verifiedAt: null }));

    await expect(
      ctx.authService.resetPassword({
        identifier: "test@example.com",
        otp: "123456",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      }),
    ).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });
});
