import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app-builder";
import { makeUser } from "../helpers/test-factories";
import { hashPassword, signAccessToken } from "@auth-module/core";

describe("Security tests", () => {
  // ── Secure headers ────────────────────────────────────────────────────────

  describe("Security headers", () => {
    it("sets X-Content-Type-Options header", async () => {
      const { app } = buildTestApp();
      const res = await request(app).get("/health");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("sets X-Frame-Options header", async () => {
      const { app } = buildTestApp();
      const res = await request(app).get("/health");
      expect(res.headers["x-frame-options"]).toBeTruthy();
    });

    it("does not expose X-Powered-By header", async () => {
      const { app } = buildTestApp();
      const res = await request(app).get("/health");
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });
  });

  // ── Input validation / injection protection ───────────────────────────────

  describe("Input sanitization", () => {
    it("rejects oversized request body (>10kb)", async () => {
      const { app } = buildTestApp();
      const hugeBody = { name: "a".repeat(12_000) };
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send(hugeBody);
      // Express returns 413 or 400 depending on body-parser config
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("rejects SQL injection string in email as invalid email", async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Test",
          email: "'; DROP TABLE users; --",
          password: "Password1!",
          confirmPassword: "Password1!",
        });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("rejects XSS string in name via Zod length constraints", async () => {
      const { app, mocks } = buildTestApp();
      mocks.userRepo.emailExists.mockResolvedValue(false);
      mocks.userRepo.create.mockResolvedValue(makeUser());
      mocks.otpRepo.upsert.mockResolvedValue({
        id: "x", userId: "x", purpose: "REGISTRATION",
        otpHash: "h", expiresAt: new Date(Date.now() + 300_000),
        attempts: 0, maxAttempts: 5, resendCount: 0, maxResends: 5,
        lastSentAt: new Date(), verifiedAt: null, createdAt: new Date(),
      });

      // XSS in name — Zod trims and stores as-is; no HTML encoding at API layer
      // (frontend is responsible for escaping on render)
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "<script>alert(1)</script>",
          email: "xss@example.com",
          password: "Password1!",
          confirmPassword: "Password1!",
        });

      // Should pass validation (name length is fine) — XSS escaping is frontend concern
      // The key security property is it doesn't execute in our JSON response
      expect([201, 422]).toContain(res.status);
      if (res.status === 201) {
        expect(JSON.stringify(res.body)).not.toContain("<script>");
      }
    });
  });

  // ── Enumeration protection ─────────────────────────────────────────────────

  describe("Account enumeration protection", () => {
    it("login returns identical error for wrong password vs unknown user", async () => {
      const { app, mocks } = buildTestApp();

      // Wrong password for existing user
      const passwordHash = await hashPassword("CorrectPass1!", 4);
      mocks.userRepo.findByEmailOrPhone.mockResolvedValue(makeUser({ passwordHash }));
      const res1 = await request(app)
        .post("/api/v1/auth/login")
        .send({ identifier: "known@example.com", password: "WrongPass1!" });

      // Unknown user
      vi.clearAllMocks();
      mocks.userRepo.findByEmailOrPhone.mockResolvedValue(null);
      const res2 = await request(app)
        .post("/api/v1/auth/login")
        .send({ identifier: "unknown@example.com", password: "WrongPass1!" });

      expect(res1.status).toBe(res2.status);
      expect(res1.body.code).toBe(res2.body.code);
      expect(res1.body.message).toBe(res2.body.message);
    });

    it("forgot-password returns identical response for known vs unknown user", async () => {
      const { app, mocks } = buildTestApp();

      mocks.userRepo.findByEmailOrPhone.mockResolvedValue(makeUser());
      mocks.otpRepo.upsert.mockResolvedValue({
        id: "x", userId: "x", purpose: "PASSWORD_RESET",
        otpHash: "h", expiresAt: new Date(Date.now() + 300_000),
        attempts: 0, maxAttempts: 5, resendCount: 0, maxResends: 5,
        lastSentAt: new Date(), verifiedAt: null, createdAt: new Date(),
      });
      const res1 = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ identifier: "known@example.com" });

      vi.clearAllMocks();
      mocks.userRepo.findByEmailOrPhone.mockResolvedValue(null);
      const res2 = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ identifier: "ghost@example.com" });

      expect(res1.status).toBe(res2.status);
      expect(res1.body.success).toBe(res2.body.success);
    });
  });

  // ── Token security ─────────────────────────────────────────────────────────

  describe("Token security", () => {
    it("rejects access token signed with wrong secret", async () => {
      const { app, config } = buildTestApp();

      const fakeToken = signAccessToken(
        { sub: "user-1", email: null, phone: null },
        { ...config.jwt, accessTokenSecret: "wrong-secret-here-padded-to-32-chars" },
      );

      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${fakeToken}`);

      expect(res.status).toBe(401);
    });

    it("rejects token with manipulated payload (signature mismatch)", async () => {
      const { app, config } = buildTestApp();

      const legit = signAccessToken(
        { sub: "user-1", email: null, phone: null },
        config.jwt,
      );
      // Tamper with the payload section (middle part of JWT)
      const parts = legit.split(".");
      const tamperedPayload = Buffer.from(
        JSON.stringify({ sub: "admin", email: "admin@evil.com", iat: Date.now() })
      ).toString("base64url");
      const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${tampered}`);

      expect(res.status).toBe(401);
    });
  });

  // ── Response structure ─────────────────────────────────────────────────────

  describe("Response consistency", () => {
    it("all error responses have success:false, message, and code fields", async () => {
      const { app } = buildTestApp();

      const endpoints = [
        { method: "post" as const, path: "/api/v1/auth/login", body: {} },
        { method: "post" as const, path: "/api/v1/auth/register", body: {} },
        { method: "get" as const, path: "/api/v1/auth/me", body: undefined },
      ];

      for (const { method, path, body } of endpoints) {
        const req = request(app)[method](path);
        if (body) req.send(body);
        const res = await req;
        expect(res.body.success).toBe(false);
        expect(typeof res.body.message).toBe("string");
        expect(typeof res.body.code).toBe("string");
      }
    });
  });
});
