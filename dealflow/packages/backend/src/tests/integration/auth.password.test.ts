import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app-builder";
import { makeUser, makeOtpRecord } from "../helpers/test-factories";
import { AuthErrors } from "@auth-module/core";

describe("POST /api/v1/auth/forgot-password", () => {
  let testApp: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    testApp = buildTestApp();
    vi.clearAllMocks();
  });

  it("200 — returns masked identifier for known user", async () => {
    const { app, mocks } = testApp;
    const user = makeUser({ isVerified: true });
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);
    mocks.otpRepo.upsert.mockResolvedValue(makeOtpRecord({ purpose: "PASSWORD_RESET" }));

    const res = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ identifier: "test@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.maskedIdentifier).toContain("***");
    expect(res.body.message).toContain("If an account exists");
  });

  it("200 — returns same response for unknown user (enumeration protection)", async () => {
    const { app, mocks } = testApp;
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ identifier: "ghost@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Should not reveal user doesn't exist
    expect(res.body.data.maskedIdentifier).toBeTruthy();
  });

  it("422 — returns VALIDATION_ERROR for missing identifier", async () => {
    const { app } = testApp;
    const res = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/v1/auth/verify-reset-otp", () => {
  it("200 — returns resetToken on valid OTP", async () => {
    const { app, mocks } = buildTestApp();
    const user = makeUser();
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);
    vi.spyOn(mocks.authService["otpService"], "verify").mockResolvedValue(undefined);
    mocks.tokenStore.set.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/v1/auth/verify-reset-otp")
      .send({ identifier: "test@example.com", otp: "123456", purpose: "PASSWORD_RESET" });

    expect(res.status).toBe(200);
    expect(res.body.data.resetToken).toBeTruthy();
  });

  it("400 — returns INVALID_OTP for wrong OTP", async () => {
    const { app, mocks } = buildTestApp();
    const user = makeUser();
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);
    vi.spyOn(mocks.authService["otpService"], "verify")
      .mockRejectedValue(AuthErrors.invalidOtp(3));

    const res = await request(app)
      .post("/api/v1/auth/verify-reset-otp")
      .send({ identifier: "test@example.com", otp: "000000", purpose: "PASSWORD_RESET" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_OTP");
  });
});

describe("POST /api/v1/auth/reset-password", () => {
  it("200 — resets password successfully", async () => {
    const { app, mocks } = buildTestApp();
    const user = makeUser();
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);

    vi.spyOn(
      mocks.authService["otpService"],
      "findRecord",
    ).mockResolvedValue(makeOtpRecord({ purpose: "PASSWORD_RESET", verifiedAt: new Date() }));

    mocks.userRepo.update.mockResolvedValue(user);
    mocks.otpRepo.deleteByUserAndPurpose.mockResolvedValue(undefined);
    mocks.tokenStore.revokeAllForUser.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        identifier: "test@example.com",
        otp: "123456",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("reset successfully");
    // All tokens revoked after password reset
    expect(mocks.tokenStore.revokeAllForUser).toHaveBeenCalledWith(user.id);
  });

  it("422 — returns VALIDATION_ERROR for mismatched passwords", async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        identifier: "test@example.com",
        otp: "123456",
        newPassword: "NewPassword1!",
        confirmPassword: "DifferentPass1!",
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("400 — returns PASSWORD_TOO_WEAK for weak new password", async () => {
    const { app, mocks } = buildTestApp();
    const user = makeUser();
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);

    vi.spyOn(
      mocks.authService["otpService"],
      "findRecord",
    ).mockResolvedValue(makeOtpRecord({ purpose: "PASSWORD_RESET", verifiedAt: new Date() }));

    const res = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        identifier: "test@example.com",
        otp: "123456",
        newPassword: "weakpass",
        confirmPassword: "weakpass",
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PASSWORD_TOO_WEAK");
  });

  it("401 — cannot reuse reset token after successful reset", async () => {
    const { app, mocks } = buildTestApp();
    const user = makeUser();
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);

    // OTP not verified (already consumed/deleted)
    vi.spyOn(
      mocks.authService["otpService"],
      "findRecord",
    ).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        identifier: "test@example.com",
        otp: "123456",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });
});
