import {
  AuthConfig,
  AuthTokens,
  AccessTokenPayload,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generateTokenId,
  parseDurationToSeconds,
  AuthErrors,
} from "@auth-module/core";
import { PrismaTokenStore } from "../repositories/token.repository";
import { logger } from "../utils/logger";

export class TokenService {
  constructor(
    private readonly tokenStore: PrismaTokenStore,
    private readonly config: AuthConfig,
  ) {}

  async issueTokens(userId: string, email: string | null, phone: string | null): Promise<AuthTokens> {
    const cfg = this.config.jwt;
    const accessPayload: AccessTokenPayload = { sub: userId, email, phone };
    const tokenId = generateTokenId();
    const accessToken = signAccessToken(accessPayload, cfg);
    const refreshToken = signRefreshToken({ sub: userId, tokenId }, cfg);
    const expiresIn = parseDurationToSeconds(cfg.accessTokenExpiresIn);
    const refreshExpiresAt = new Date(Date.now() + parseDurationToSeconds(cfg.refreshTokenExpiresIn) * 1000);
    await this.tokenStore.set(tokenId, userId, refreshExpiresAt);
    logger.info("Tokens issued", { userId });
    return { accessToken, refreshToken, expiresIn };
  }

  /**
   * Rotates a refresh token. email/phone are NOT in the refresh token payload —
   * pass them from the DB lookup in the caller (or null if unavailable).
   */
  async rotateRefreshToken(
    incomingRefreshToken: string,
    userEmail: string | null = null,
    userPhone: string | null = null,
  ): Promise<{ tokens: AuthTokens; userId: string }> {
    const payload = verifyRefreshToken(incomingRefreshToken, this.config.jwt);
    const { sub: userId, tokenId: jti } = payload;

    const storedUserId = await this.tokenStore.get(jti);
    if (!storedUserId) {
      logger.warn("Refresh token reuse detected — revoking all tokens for user", { userId });
      await this.tokenStore.revokeAllForUser(userId);
      throw AuthErrors.invalidToken();
    }

    await this.tokenStore.revoke(jti);
    const tokens = await this.issueTokens(userId, userEmail, userPhone);
    return { tokens, userId };
  }

  async revokeToken(refreshToken: string): Promise<void> {
    try {
      const payload = verifyRefreshToken(refreshToken, this.config.jwt);
      await this.tokenStore.revoke(payload.tokenId);
      logger.info("Token revoked", { userId: payload.sub });
    } catch {
      // swallow silently — token already invalid/expired
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.tokenStore.revokeAllForUser(userId);
    logger.info("All tokens revoked for user", { userId });
  }
}
