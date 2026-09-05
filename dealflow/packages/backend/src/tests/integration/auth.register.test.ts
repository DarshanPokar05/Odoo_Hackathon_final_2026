import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app-builder";
import { makeUser, makeOtpRecord } from "../helpers/test-factories";

describe("POST /api/v1/auth/register", () => {
  let testApp: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    testApp = buildTestApp();
    vi.clearAllMocks();
  });

  const validPayload = {
    name: "Alice",
    email: "alice@example.com",
    password: "Password1!",
    confirmPassword: "Password1!",
  };

  it("201 — registers user and returns masked identifier", async () => {
    const { app, mocks } = testApp;
    mocks.userRepo.emailExists.mockResolvedValue(false);
    mocks.userRepo.create.mockResolvedValue(makeUser({ isVerified: false }));
    mocks.otpRepo.upsert.mockResolvedValue(makeOtpRecord());

    const res = await request(app).post("/api/v1/auth/register").send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.maskedIdentifier).toContain("***");
  });

  it("409 — returns USER_ALREADY_EXISTS for duplicate email", async () => {
    const { app, mocks } = testApp;
    mocks.userRepo.emailExists.mockResolvedValue(true);

    const res = await request(app).post("/api/v1/auth/register").send(validPayload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("USER_ALREADY_EXISTS");
  });

  it("422 — returns VALIDATION_ERROR for missing name", async () => {
    const { app } = testApp;
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validPayload, name: "" });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("422 — returns VALIDATION_ERROR for invalid email", async () => {
    const { app } = testApp;
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validPayload, email: "not-an-email" });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("422 — returns VALIDATION_ERROR for mismatched passwords", async () => {
    const { app } = testApp;
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validPayload, confirmPassword: "Different1!" });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("400 — returns PASSWORD_TOO_WEAK for weak password", async () => {
    const { app, mocks } = testApp;
    mocks.userRepo.emailExists.mockResolvedValue(false);

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validPayload, password: "weakpass", confirmPassword: "weakpass" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PASSWORD_TOO_WEAK");
  });

  it("does not return password or hash in response", async () => {
    const { app, mocks } = testApp;
    mocks.userRepo.emailExists.mockResolvedValue(false);
    mocks.userRepo.create.mockResolvedValue(makeUser({ isVerified: false }));
    mocks.otpRepo.upsert.mockResolvedValue(makeOtpRecord());

    const res = await request(app).post("/api/v1/auth/register").send(validPayload);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain("password");
    expect(body).not.toContain("hash");
  });
});
