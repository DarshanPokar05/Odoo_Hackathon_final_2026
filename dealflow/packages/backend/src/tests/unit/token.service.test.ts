import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenService } from "../../services/token.service";
import { PrismaTokenStore } from "../../repositories/token.repository";
import { verifyAccessToken } from "@auth-module/core";
import { makeTestConfig, makeMockTokenStore } from "../helpers/test-factories";

function buildTokenService() {
  const config = makeTestConfig();
  const tokenStore = makeMockTokenStore();
  const tokenService = new TokenService(tokenStore as unknown as PrismaTokenStore, config);
  return { tokenService, tokenStore, config };
}

describe("TokenService", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ── issueTokens ─────────────────────────────────────────────────────────────

  describe("issueTokens", () => {
    it("returns signed access and refresh tokens with correct payload", async () => {
      const { tokenService, tokenStore, config } = buildTokenService();
      tokenStore.set.mockResolvedValue(undefined);

      const tokens = await tokenService.issueTokens("user-1", "user@example.com", null);

      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();
      expect(tokens.expiresIn).toBeGreaterThan(0);

      // Verify access token payload
      const payload = verifyAccessToken(tokens.accessToken, config.jwt);
      expect(payload.sub).toBe("user-1");
      expect(payload.email).toBe("user@example.com");

      // Verify token was stored
      expect(tokenStore.set).toHaveBeenCalledOnce();
    });

    it("stores the token jti in the token store with correct expiry", async () => {
      const { tokenService, tokenStore } = buildTokenService();
      tokenStore.set.mockResolvedValue(undefined);

      await tokenService.issueTokens("user-42", "u@example.com", null);

      const [jti, userId, expiresAt] = (tokenStore.set as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(jti).toHaveLength(64); // 32 bytes hex
      expect(userId).toBe("user-42");
      expect(expiresAt).toBeInstanceOf(Date);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  // ── rotateRefreshToken ──────────────────────────────────────────────────────

  describe("rotateRefreshToken", () => {
    it("revokes old token and issues new pair", async () => {
      const { tokenService, tokenStore, config } = buildTokenService();
      tokenStore.set.mockResolvedValue(undefined);

      // Issue initial tokens
      const initial = await tokenService.issueTokens("user-1", "user@example.com", null);

      // Store returns valid user id for the jti
      const jti = (tokenStore.set as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      tokenStore.get.mockResolvedValue("user-1");
      tokenStore.revoke.mockResolvedValue(undefined);
      vi.clearAllMocks();
      tokenStore.set.mockResolvedValue(undefined);

      const { tokens, userId } = await tokenService.rotateRefreshToken(initial.refreshToken);

      expect(userId).toBe("user-1");
      expect(tokens.accessToken).toBeTruthy();
      expect(tokenStore.revoke).toHaveBeenCalledWith(jti);
      expect(tokenStore.set).toHaveBeenCalledOnce(); // new token stored

      // New tokens should be different
      expect(tokens.accessToken).not.toBe(initial.accessToken);
      void config;
    });

    it("revokes all user tokens on reuse detection", async () => {
      const { tokenService, tokenStore } = buildTokenService();
      tokenStore.set.mockResolvedValue(undefined);

      const initial = await tokenService.issueTokens("user-1", "user@example.com", null);

      // Simulate revoked token (returns null)
      tokenStore.get.mockResolvedValue(null);
      tokenStore.revokeAllForUser.mockResolvedValue(undefined);

      await expect(
        tokenService.rotateRefreshToken(initial.refreshToken),
      ).rejects.toMatchObject({ code: "INVALID_TOKEN" });

      expect(tokenStore.revokeAllForUser).toHaveBeenCalledWith("user-1");
    });

    it("throws SESSION_EXPIRED for an expired refresh token", async () => {
      const { tokenService, config } = buildTokenService();

      // Manually sign a token with 1ms expiry
      const { signRefreshToken, generateTokenId } = await import("@auth-module/core");
      const expiredToken = signRefreshToken(
        { sub: "user-1", tokenId: generateTokenId() },
        { ...config.jwt, refreshTokenExpiresIn: "1ms" },
      );

      // Give the token time to expire
      await new Promise((r) => setTimeout(r, 5));

      await expect(
        tokenService.rotateRefreshToken(expiredToken),
      ).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    });
  });

  // ── revokeToken ─────────────────────────────────────────────────────────────

  describe("revokeToken", () => {
    it("revokes the specific token jti", async () => {
      const { tokenService, tokenStore } = buildTokenService();
      tokenStore.set.mockResolvedValue(undefined);

      const tokens = await tokenService.issueTokens("user-1", "u@e.com", null);
      const jti = (tokenStore.set as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      tokenStore.revoke.mockResolvedValue(undefined);

      await tokenService.revokeToken(tokens.refreshToken);

      expect(tokenStore.revoke).toHaveBeenCalledWith(jti);
    });

    it("silently swallows invalid token on revoke (already expired)", async () => {
      const { tokenService, tokenStore } = buildTokenService();

      await expect(
        tokenService.revokeToken("completely.invalid.token"),
      ).resolves.toBeUndefined();

      expect(tokenStore.revoke).not.toHaveBeenCalled();
    });
  });

  // ── revokeAllForUser ────────────────────────────────────────────────────────

  describe("revokeAllForUser", () => {
    it("calls revokeAllForUser on the token store", async () => {
      const { tokenService, tokenStore } = buildTokenService();
      tokenStore.revokeAllForUser.mockResolvedValue(undefined);

      await tokenService.revokeAllForUser("user-99");

      expect(tokenStore.revokeAllForUser).toHaveBeenCalledWith("user-99");
    });
  });
});

// ── Core utils tests ───────────────────────────────────────────────────────────

describe("verifyAccessToken", () => {
  it("throws SESSION_EXPIRED for expired token", async () => {
    const config = makeTestConfig();
    const { signAccessToken } = await import("@auth-module/core");

    const token = signAccessToken(
      { sub: "u1", email: null, phone: null },
      { ...config.jwt, accessTokenExpiresIn: "1ms" },
    );
    await new Promise((r) => setTimeout(r, 5));

    expect(() => verifyAccessToken(token, config.jwt)).toThrow();
  });

  it("throws INVALID_TOKEN for tampered token", () => {
    const config = makeTestConfig();
    expect(() => verifyAccessToken("bad.token.here", config.jwt)).toThrow();
  });
});
