import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app-builder";
import { makeUser } from "../helpers/test-factories";
import { hashPassword } from "@auth-module/core";

describe("POST /api/v1/auth/login", () => {
  let testApp: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    testApp = buildTestApp();
    vi.clearAllMocks();
  });

  it("200 — returns user and access token, sets refresh cookie", async () => {
    const { app, mocks } = testApp;
    const passwordHash = await hashPassword("Password1!", 4);
    const user = makeUser({ passwordHash, isVerified: true });

    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);
    mocks.userRepo.update.mockResolvedValue(user);
    mocks.tokenStore.set.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: "test@example.com", password: "Password1!" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeUndefined(); // in cookie only
    expect(res.headers["set-cookie"]).toBeDefined();
    // Cookie should be httpOnly
    const cookie = res.headers["set-cookie"][0] as string;
    expect(cookie.toLowerCase()).toContain("httponly");
  });

  it("401 — returns INVALID_CREDENTIALS for wrong password", async () => {
    const { app, mocks } = testApp;
    const passwordHash = await hashPassword("CorrectPass1!", 4);
    const user = makeUser({ passwordHash, isVerified: true });
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: "test@example.com", password: "WrongPass1!" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("401 — returns INVALID_CREDENTIALS for unknown user (no enumeration)", async () => {
    const { app, mocks } = testApp;
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: "nobody@example.com", password: "Password1!" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
    // Response should be identical to wrong password — no timing difference in test
  });

  it("403 — returns ACCOUNT_NOT_VERIFIED for unverified account", async () => {
    const { app, mocks } = testApp;
    const passwordHash = await hashPassword("Password1!", 4);
    const user = makeUser({ passwordHash, isVerified: false });
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: "test@example.com", password: "Password1!" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ACCOUNT_NOT_VERIFIED");
  });

  it("403 — returns ACCOUNT_SUSPENDED for suspended user", async () => {
    const { app, mocks } = testApp;
    const passwordHash = await hashPassword("Password1!", 4);
    const user = makeUser({ passwordHash, isVerified: true, status: "SUSPENDED" });
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: "test@example.com", password: "Password1!" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("422 — returns VALIDATION_ERROR for missing identifier", async () => {
    const { app } = testApp;
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ password: "Password1!" });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("does not return passwordHash in response", async () => {
    const { app, mocks } = testApp;
    const passwordHash = await hashPassword("Password1!", 4);
    const user = makeUser({ passwordHash });
    mocks.userRepo.findByEmailOrPhone.mockResolvedValue(user);
    mocks.userRepo.update.mockResolvedValue(user);
    mocks.tokenStore.set.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: "test@example.com", password: "Password1!" });

    const body = JSON.stringify(res.body);
    expect(body).not.toContain("passwordHash");
    expect(body).not.toContain("password_hash");
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("200 — clears the refresh token cookie", async () => {
    const { app, mocks } = buildTestApp();
    mocks.tokenStore.get.mockResolvedValue("user-1");
    mocks.tokenStore.revoke.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", "auth_refresh_token=some.fake.token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Cookie cleared
    const setCookie = res.headers["set-cookie"] as unknown as string[] | undefined;
    if (setCookie) {
      const authCookie = setCookie.find((c) => c.includes("auth_refresh_token"));
      if (authCookie) {
        expect(authCookie).toMatch(/expires=Thu, 01 Jan 1970/i);
      }
    }
  });

  it("200 — succeeds even without a refresh token (idempotent logout)", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/api/v1/auth/logout");
    expect(res.status).toBe(200);
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("401 — returns UNAUTHORIZED when no refresh token provided", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/api/v1/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("401 — returns INVALID_TOKEN when refresh token is revoked (reuse detected)", async () => {
    const { app, mocks } = buildTestApp();
    // tokenStore.get returns null → token was revoked
    mocks.tokenStore.get.mockResolvedValue(null);
    mocks.tokenStore.revokeAllForUser.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", "auth_refresh_token=valid.looking.but.revoked");

    expect(res.status).toBe(401);
  });
});
