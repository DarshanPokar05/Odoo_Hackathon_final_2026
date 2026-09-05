import { PrismaClient } from "@prisma/client";
import { TokenStore } from "@auth-module/core";

// ---------------------------------------------------------------------------
// PrismaTokenStore — implements TokenStore using the RefreshToken table.
// Swap this for a Redis implementation in high-throughput environments.
// ---------------------------------------------------------------------------

export class PrismaTokenStore implements TokenStore {
  constructor(private readonly db: PrismaClient) {}

  async set(jti: string, userId: string, expiresAt: Date): Promise<void> {
    await this.db.refreshToken.create({ data: { jti, userId, expiresAt } });
  }

  async get(jti: string): Promise<string | null> {
    const token = await this.db.refreshToken.findUnique({ where: { jti } });
    if (!token) return null;
    if (token.revokedAt !== null) return null;
    if (token.expiresAt < new Date()) return null;
    return token.userId;
  }

  async revoke(jti: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Cleanup: remove expired tokens older than 24h */
  async deleteExpired(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.db.refreshToken.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
  }
}
