/**
 * Test factories — create in-memory objects for unit tests.
 * No real DB connections; everything is mocked via vi.fn().
 */
import { vi } from "vitest";
import { createAuthConfig } from "@auth-module/core";
import type { User, OtpRecord, OtpProvider, Logger } from "@auth-module/core";

// ── Config ──────────────────────────────────────────────────────────────────

export function makeTestConfig() {
  return createAuthConfig({
    otp: {
      length: 6,
      expirationSeconds: 300,
      resendCooldownSeconds: 60,
      maxAttempts: 5,
      maxResends: 5,
      saltRounds: 4, // very low for fast tests
    },
    password: {
      saltRounds: 4, // very low for fast tests
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
    },
  });
}

// ── Domain objects ────────────────────────────────────────────────────────────

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-123",
    name: "Test User",
    email: "test@example.com",
    phone: null,
    passwordHash: "$2a$04$mockhashvalue..........................................................",
    isVerified: true,
    status: "ACTIVE",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    lastLoginAt: null,
    ...overrides,
  };
}

export function makeOtpRecord(overrides: Partial<OtpRecord> = {}): OtpRecord {
  return {
    id: "otp-123",
    userId: "user-123",
    purpose: "REGISTRATION",
    otpHash: "$2a$04$mockhashvalue..........................................................",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min from now
    attempts: 0,
    maxAttempts: 5,
    resendCount: 0,
    maxResends: 5,
    lastSentAt: new Date(Date.now() - 10_000), // 10s ago
    verifiedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ── Mocked repositories ────────────────────────────────────────────────────────

export function makeMockUserRepo() {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByPhone: vi.fn(),
    findByEmailOrPhone: vi.fn(),
    emailExists: vi.fn(),
    phoneExists: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    markVerified: vi.fn(),
    updateLastLogin: vi.fn(),
    toPublicUser: vi.fn((user: User) => {
      const { passwordHash: _ph, updatedAt: _ua, ...pub } = user;
      void _ph; void _ua;
      return pub;
    }),
  };
}

export function makeMockOtpRepo() {
  return {
    findActiveByUserAndPurpose: vi.fn(),
    upsert: vi.fn(),
    incrementAttempts: vi.fn(),
    markVerified: vi.fn(),
    deleteByUserAndPurpose: vi.fn(),
    deleteExpired: vi.fn(),
  };
}

export function makeMockTokenStore() {
  return {
    set: vi.fn(),
    get: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
    deleteExpired: vi.fn(),
  };
}

// ── Mock OTP provider ─────────────────────────────────────────────────────────

export function makeMockOtpProvider(): OtpProvider {
  return {
    sendEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendSmsOtp: vi.fn().mockResolvedValue(undefined),
  };
}

// ── Mock logger ────────────────────────────────────────────────────────────────

export function makeMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}
