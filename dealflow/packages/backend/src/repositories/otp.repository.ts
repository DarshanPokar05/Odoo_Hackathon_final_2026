import { PrismaClient } from "@prisma/client";
import { OtpRecord, OtpPurpose, CreateOtpInput } from "@auth-module/core";

// ---------------------------------------------------------------------------
// OtpRepository — manages OTP lifecycle in the database.
// ---------------------------------------------------------------------------

export class OtpRepository {
  constructor(private readonly db: PrismaClient) {}

  private toOtpRecord(row: {
    id: string; userId: string; purpose: string; otpHash: string;
    expiresAt: Date; attempts: number; maxAttempts: number;
    resendCount: number; maxResends: number; lastSentAt: Date;
    verifiedAt: Date | null; createdAt: Date;
  }): OtpRecord {
    return {
      id: row.id,
      userId: row.userId,
      purpose: row.purpose as OtpPurpose,
      otpHash: row.otpHash,
      expiresAt: row.expiresAt,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      resendCount: row.resendCount,
      maxResends: row.maxResends,
      lastSentAt: row.lastSentAt,
      verifiedAt: row.verifiedAt,
      createdAt: row.createdAt,
    };
  }

  async findActiveByUserAndPurpose(userId: string, purpose: OtpPurpose): Promise<OtpRecord | null> {
    const row = await this.db.otpRecord.findUnique({
      where: { userId_purpose: { userId, purpose } },
    });
    return row ? this.toOtpRecord(row) : null;
  }

  /**
   * Creates or replaces the OTP for a given user+purpose.
   * Upsert ensures previous OTP is atomically invalidated.
   */
  async upsert(input: CreateOtpInput): Promise<OtpRecord> {
    const now = new Date();
    const row = await this.db.otpRecord.upsert({
      where: { userId_purpose: { userId: input.userId, purpose: input.purpose } },
      create: {
        userId: input.userId,
        purpose: input.purpose,
        otpHash: input.otpHash,
        expiresAt: input.expiresAt,
        maxAttempts: input.maxAttempts,
        maxResends: input.maxResends,
        lastSentAt: now,
        attempts: 0,
        resendCount: 0,
      },
      update: {
        otpHash: input.otpHash,
        expiresAt: input.expiresAt,
        attempts: 0,
        resendCount: { increment: 1 },
        lastSentAt: now,
        verifiedAt: null,
      },
    });
    return this.toOtpRecord(row);
  }

  async incrementAttempts(id: string): Promise<OtpRecord> {
    const row = await this.db.otpRecord.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
    return this.toOtpRecord(row);
  }

  async markVerified(id: string): Promise<OtpRecord> {
    const row = await this.db.otpRecord.update({
      where: { id },
      data: { verifiedAt: new Date() },
    });
    return this.toOtpRecord(row);
  }

  async deleteByUserAndPurpose(userId: string, purpose: OtpPurpose): Promise<void> {
    await this.db.otpRecord.deleteMany({ where: { userId, purpose } });
  }

  /** Cleanup job: remove expired OTPs that were already verified or too old. */
  async deleteExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // older than 24h
    const result = await this.db.otpRecord.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    return result.count;
  }
}
