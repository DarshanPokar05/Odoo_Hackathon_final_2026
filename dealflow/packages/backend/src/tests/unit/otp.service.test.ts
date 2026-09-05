import { describe, it, expect, vi, beforeEach } from "vitest";
import { OtpService } from "../../services/otp.service";
import { CompositeOtpProvider } from "../../providers/otp/composite-otp.provider";
import { OtpRepository } from "../../repositories/otp.repository";
import { hashOtp } from "@auth-module/core";
import {
  makeTestConfig,
  makeMockOtpRepo,
  makeMockOtpProvider,
  makeOtpRecord,
} from "../helpers/test-factories";

describe("OtpService", () => {
  let otpService: OtpService;
  let mockOtpRepo: ReturnType<typeof makeMockOtpRepo>;
  let mockProvider: ReturnType<typeof makeMockOtpProvider>;

  beforeEach(() => {
    vi.clearAllMocks();
    const config = makeTestConfig();
    mockOtpRepo = makeMockOtpRepo();
    mockProvider = makeMockOtpProvider();
    const composite = new CompositeOtpProvider(mockProvider, mockProvider);
    otpService = new OtpService(
      mockOtpRepo as unknown as OtpRepository,
      composite,
      config,
    );
  });

  // ── generateAndSend ────────────────────────────────────────────────────────

  describe("generateAndSend", () => {
    it("creates a new OTP record and sends to email", async () => {
      mockOtpRepo.upsert.mockResolvedValue(makeOtpRecord());

      await otpService.generateAndSend({
        userId: "user-1",
        identifier: "user@example.com",
        purpose: "REGISTRATION",
        userName: "Alice",
      });

      expect(mockOtpRepo.upsert).toHaveBeenCalledOnce();
      expect(mockProvider.sendEmailOtp).toHaveBeenCalledOnce();
      const callArg = (mockProvider.sendEmailOtp as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg.to).toBe("user@example.com");
      expect(callArg.purpose).toBe("REGISTRATION");
      expect(callArg.otp).toHaveLength(6);
      expect(/^\d{6}$/.test(callArg.otp)).toBe(true);
    });

    it("routes phone identifiers to SMS provider", async () => {
      mockOtpRepo.upsert.mockResolvedValue(makeOtpRecord());

      await otpService.generateAndSend({
        userId: "user-1",
        identifier: "+12025551234",
        purpose: "REGISTRATION",
      });

      expect(mockProvider.sendSmsOtp).toHaveBeenCalledOnce();
      expect(mockProvider.sendEmailOtp).not.toHaveBeenCalled();
    });

    it("throws OTP_RESEND_COOLDOWN when cooldown is active", async () => {
      const record = makeOtpRecord({
        resendCount: 1,
        lastSentAt: new Date(), // just sent — within 60s cooldown
      });
      mockOtpRepo.findActiveByUserAndPurpose.mockResolvedValue(record);

      await expect(
        otpService.generateAndSend({
          userId: "user-1",
          identifier: "user@example.com",
          purpose: "REGISTRATION",
          isResend: true,
        }),
      ).rejects.toMatchObject({ code: "OTP_RESEND_COOLDOWN" });

      expect(mockProvider.sendEmailOtp).not.toHaveBeenCalled();
    });

    it("throws OTP_RESEND_LIMIT when max resends reached", async () => {
      const record = makeOtpRecord({
        resendCount: 5,
        maxResends: 5,
        lastSentAt: new Date(Date.now() - 120_000), // cooldown passed
      });
      mockOtpRepo.findActiveByUserAndPurpose.mockResolvedValue(record);

      await expect(
        otpService.generateAndSend({
          userId: "user-1",
          identifier: "user@example.com",
          purpose: "REGISTRATION",
          isResend: true,
        }),
      ).rejects.toMatchObject({ code: "OTP_RESEND_LIMIT" });
    });

    it("allows resend after cooldown expires", async () => {
      const record = makeOtpRecord({
        resendCount: 1,
        maxResends: 5,
        lastSentAt: new Date(Date.now() - 120_000), // 2 min ago — past cooldown
      });
      mockOtpRepo.findActiveByUserAndPurpose.mockResolvedValue(record);
      mockOtpRepo.upsert.mockResolvedValue(makeOtpRecord({ resendCount: 2 }));

      await otpService.generateAndSend({
        userId: "user-1",
        identifier: "user@example.com",
        purpose: "REGISTRATION",
        isResend: true,
      });

      expect(mockOtpRepo.upsert).toHaveBeenCalledOnce();
      expect(mockProvider.sendEmailOtp).toHaveBeenCalledOnce();
    });
  });

  // ── verify ─────────────────────────────────────────────────────────────────

  describe("verify", () => {
    it("marks OTP verified on correct code", async () => {
      const plainOtp = "123456";
      const otpHash = await hashOtp(plainOtp, 4);
      const record = makeOtpRecord({ otpHash, attempts: 0 });

      mockOtpRepo.findActiveByUserAndPurpose.mockResolvedValue(record);
      mockOtpRepo.incrementAttempts.mockResolvedValue({ ...record, attempts: 1 });
      mockOtpRepo.markVerified.mockResolvedValue({ ...record, verifiedAt: new Date() });

      await expect(
        otpService.verify({ userId: "user-1", purpose: "REGISTRATION", plainOtp }),
      ).resolves.toBeUndefined();

      expect(mockOtpRepo.markVerified).toHaveBeenCalledWith(record.id);
    });

    it("throws INVALID_OTP and shows remaining attempts on wrong code", async () => {
      const otpHash = await hashOtp("999999", 4);
      const record = makeOtpRecord({ otpHash, attempts: 0, maxAttempts: 5 });

      mockOtpRepo.findActiveByUserAndPurpose.mockResolvedValue(record);
      mockOtpRepo.incrementAttempts.mockResolvedValue({ ...record, attempts: 1 });

      await expect(
        otpService.verify({ userId: "user-1", purpose: "REGISTRATION", plainOtp: "111111" }),
      ).rejects.toMatchObject({ code: "INVALID_OTP", message: expect.stringContaining("4 attempt(s) remaining") });
    });

    it("throws OTP_EXPIRED when OTP is past its expiry", async () => {
      const record = makeOtpRecord({
        expiresAt: new Date(Date.now() - 1000), // already expired
      });
      mockOtpRepo.findActiveByUserAndPurpose.mockResolvedValue(record);
      mockOtpRepo.incrementAttempts.mockResolvedValue({ ...record, attempts: 1 });

      await expect(
        otpService.verify({ userId: "user-1", purpose: "REGISTRATION", plainOtp: "123456" }),
      ).rejects.toMatchObject({ code: "OTP_EXPIRED" });
    });

    it("throws OTP_ATTEMPTS_EXCEEDED when max attempts already reached", async () => {
      const record = makeOtpRecord({ attempts: 5, maxAttempts: 5 });
      mockOtpRepo.findActiveByUserAndPurpose.mockResolvedValue(record);

      await expect(
        otpService.verify({ userId: "user-1", purpose: "REGISTRATION", plainOtp: "123456" }),
      ).rejects.toMatchObject({ code: "OTP_ATTEMPTS_EXCEEDED" });

      expect(mockOtpRepo.incrementAttempts).not.toHaveBeenCalled();
    });

    it("throws OTP_NOT_FOUND when no active OTP exists", async () => {
      mockOtpRepo.findActiveByUserAndPurpose.mockResolvedValue(null);

      await expect(
        otpService.verify({ userId: "user-1", purpose: "REGISTRATION", plainOtp: "123456" }),
      ).rejects.toMatchObject({ code: "OTP_NOT_FOUND" });
    });

    it("throws OTP_NOT_FOUND when OTP was already verified (replay attack)", async () => {
      const record = makeOtpRecord({ verifiedAt: new Date() }); // already verified
      mockOtpRepo.findActiveByUserAndPurpose.mockResolvedValue(record);

      await expect(
        otpService.verify({ userId: "user-1", purpose: "REGISTRATION", plainOtp: "123456" }),
      ).rejects.toMatchObject({ code: "OTP_NOT_FOUND" });
    });

    it("throws OTP_ATTEMPTS_EXCEEDED on last failed attempt", async () => {
      const otpHash = await hashOtp("999999", 4);
      const record = makeOtpRecord({ otpHash, attempts: 4, maxAttempts: 5 });

      mockOtpRepo.findActiveByUserAndPurpose.mockResolvedValue(record);
      mockOtpRepo.incrementAttempts.mockResolvedValue({ ...record, attempts: 5 });

      await expect(
        otpService.verify({ userId: "user-1", purpose: "REGISTRATION", plainOtp: "111111" }),
      ).rejects.toMatchObject({ code: "OTP_ATTEMPTS_EXCEEDED" });
    });
  });

  // ── invalidate ─────────────────────────────────────────────────────────────

  describe("invalidate", () => {
    it("deletes the OTP record by user and purpose", async () => {
      mockOtpRepo.deleteByUserAndPurpose.mockResolvedValue(undefined);
      await otpService.invalidate("user-1", "REGISTRATION");
      expect(mockOtpRepo.deleteByUserAndPurpose).toHaveBeenCalledWith("user-1", "REGISTRATION");
    });
  });
});
