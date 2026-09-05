import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app-builder";
import { makeUser, makeOtpRecord } from "../helpers/test-factories";
import { AuthErrors } from "@auth-module/core";

describe("POST /api/v1/auth/verify-registration", () => {
  let testApp: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    testApp = buildTestApp();
    vi.clearAllMocks();
  });

  const payload = {
    identifier: "alice@example.com",
    otp: "123456",
    purpose: "REGISTRATION",
  };

  it("200 — returns user and access token on valid OTP", async () => {
    const { app, mocks } = testApp;
    const user = makeUser({ isVerified: false });
    const verifiedUser = makeUser({ isVerified: true });

    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);

    // Spy on OtpService to bypass bcrypt in integration test
    vi.spyOn(mocks.authService["otpService"], "verify").mockResolvedValue(undefined);
    vi.spyOn(mocks.authService["otpService"], "invalidate").mockResolvedValue(undefined);

    mocks.userRepo.markVerified.mockResolvedValue(verifiedUser);
    mocks.userRepo.update.mockResolvedValue(verifiedUser);
    mocks.tokenStore.set.mockResolvedValue(undefined);

    const res = await request(app).post("/api/v1/auth/verify-registration").send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.isVerified).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    // Refresh token should be in httpOnly cookie, not response body
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("400 — returns INVALID_OTP on wrong code", async () => {
    const { app, mocks } = testApp;
    const user = makeUser({ isVerified: false });
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);
    vi.spyOn(mocks.authService["otpService"], "verify")
      .mockRejectedValue(AuthErrors.invalidOtp(4));

    const res = await request(app).post("/api/v1/auth/verify-registration").send(payload);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_OTP");
    expect(res.body.message).toContain("4 attempt(s) remaining");
  });

  it("400 — returns OTP_EXPIRED for expired OTP", async () => {
    const { app, mocks } = testApp;
    const user = makeUser({ isVerified: false });
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);
    vi.spyOn(mocks.authService["otpService"], "verify")
      .mockRejectedValue(AuthErrors.otpExpired());

    const res = await request(app).post("/api/v1/auth/verify-registration").send(payload);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("OTP_EXPIRED");
  });

  it("429 — returns OTP_ATTEMPTS_EXCEEDED after max failed attempts", async () => {
    const { app, mocks } = testApp;
    const user = makeUser({ isVerified: false });
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);
    vi.spyOn(mocks.authService["otpService"], "verify")
      .mockRejectedValue(AuthErrors.otpAttemptsExceeded());

    const res = await request(app).post("/api/v1/auth/verify-registration").send(payload);

    expect(res.status).toBe(429);
    expect(res.body.code).toBe("OTP_ATTEMPTS_EXCEEDED");
  });

  it("422 — returns VALIDATION_ERROR for OTP with wrong digit count", async () => {
    const { app } = testApp;
    const res = await request(app)
      .post("/api/v1/auth/verify-registration")
      .send({ ...payload, otp: "123" }); // too short

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("422 — returns VALIDATION_ERROR for non-numeric OTP", async () => {
    const { app } = testApp;
    const res = await request(app)
      .post("/api/v1/auth/verify-registration")
      .send({ ...payload, otp: "abc123" });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/v1/auth/resend-registration-otp", () => {
  it("200 — returns masked identifier (even for unknown user)", async () => {
    const { app, mocks } = buildTestApp();
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(null); // unknown user

    const res = await request(app)
      .post("/api/v1/auth/resend-registration-otp")
      .send({ identifier: "nobody@example.com", purpose: "REGISTRATION" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Does not reveal whether user exists
    expect(res.body.data.maskedIdentifier).toBeTruthy();
  });

  it("429 — returns OTP_RESEND_COOLDOWN within cooldown window", async () => {
    const { app, mocks } = buildTestApp();
    const user = makeUser({ isVerified: false });
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);
    mocks.otpRepo.findActiveByUserAndPurpose.mockResolvedValue(
      makeOtpRecord({ resendCount: 1, lastSentAt: new Date() }) // just sent
    );

    const res = await request(app)
      .post("/api/v1/auth/resend-registration-otp")
      .send({ identifier: "alice@example.com", purpose: "REGISTRATION" });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe("OTP_RESEND_COOLDOWN");
  });

  it("429 — returns OTP_RESEND_LIMIT at max resends", async () => {
    const { app, mocks } = buildTestApp();
    const user = makeUser({ isVerified: false });
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);
    mocks.otpRepo.findActiveByUserAndPurpose.mockResolvedValue(
      makeOtpRecord({
        resendCount: 5,
        maxResends: 5,
        lastSentAt: new Date(Date.now() - 120_000),
      })
    );

    const res = await request(app)
      .post("/api/v1/auth/resend-registration-otp")
      .send({ identifier: "alice@example.com", purpose: "REGISTRATION" });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe("OTP_RESEND_LIMIT");
  });
});
