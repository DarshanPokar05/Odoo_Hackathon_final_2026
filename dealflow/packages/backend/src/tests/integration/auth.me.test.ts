import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app-builder";
import { makeUser } from "../helpers/test-factories";
import { signAccessToken } from "@auth-module/core";

describe("GET /api/v1/auth/me", () => {
  let testApp: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    testApp = buildTestApp();
    vi.clearAllMocks();
  });

  function makeBearer(userId: string, config: ReturnType<typeof buildTestApp>["config"]) {
    return `Bearer ${signAccessToken({ sub: userId, email: "test@example.com", phone: null }, config.jwt)}`;
  }

  it("200 — returns current user when authenticated", async () => {
    const { app, mocks, config } = testApp;
    const user = makeUser();
    mocks.userRepo.findById.mockResolvedValue(user);

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", makeBearer(user.id, config));

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    // passwordHash must never appear in response
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("401 — returns UNAUTHORIZED without Authorization header", async () => {
    const { app } = testApp;
    const res = await request(app).get("/api/v1/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("401 — returns INVALID_TOKEN for a malformed token", async () => {
    const { app } = testApp;
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer not.a.valid.token");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });

  it("401 — returns SESSION_EXPIRED for an expired token", async () => {
    const { app, config } = testApp;

    const expiredToken = signAccessToken(
      { sub: "user-1", email: null, phone: null },
      { ...config.jwt, accessTokenExpiresIn: "1ms" },
    );
    await new Promise((r) => setTimeout(r, 5));

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("SESSION_EXPIRED");
  });

  it("401 — returns UNAUTHORIZED when user is not found", async () => {
    const { app, mocks, config } = testApp;
    mocks.userRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", makeBearer("non-existent-user", config));

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });
});

describe("GET /health", () => {
  it("200 — returns ok status", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.timestamp).toBeTruthy();
  });
});

describe("Unknown endpoint", () => {
  it("404 — returns NOT_FOUND", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});
