import { describe, it, expect } from "vitest";
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  getOtpExpiry,
  getResendCooldownRemaining,
  hashPassword,
  verifyPassword,
  assertPasswordStrength,
  normalizeIdentifier,
  identifierType,
  maskEmail,
  maskPhone,
  maskIdentifier,
} from "@auth-module/core";
import { makeTestConfig } from "../helpers/test-factories";

// ── OTP utils ──────────────────────────────────────────────────────────────────

describe("generateOtp", () => {
  it("generates a numeric string of correct length", () => {
    const otp = generateOtp(6);
    expect(otp).toHaveLength(6);
    expect(/^\d{6}$/.test(otp)).toBe(true);
  });

  it("pads short values with leading zeros", () => {
    // Run many times to ensure leading zero handling is correct
    for (let i = 0; i < 50; i++) {
      const otp = generateOtp(6);
      expect(otp).toHaveLength(6);
    }
  });

  it("generates different OTPs on each call", () => {
    const otps = new Set(Array.from({ length: 20 }, () => generateOtp(6)));
    expect(otps.size).toBeGreaterThan(1);
  });

  it("respects custom length", () => {
    expect(generateOtp(4)).toHaveLength(4);
    expect(generateOtp(8)).toHaveLength(8);
  });
});

describe("hashOtp / verifyOtp", () => {
  it("verifies correct OTP", async () => {
    const otp = "123456";
    const hash = await hashOtp(otp, 4);
    expect(await verifyOtp(otp, hash)).toBe(true);
  });

  it("rejects incorrect OTP", async () => {
    const hash = await hashOtp("123456", 4);
    expect(await verifyOtp("654321", hash)).toBe(false);
  });

  it("produces different hashes for same OTP (salted)", async () => {
    const hash1 = await hashOtp("123456", 4);
    const hash2 = await hashOtp("123456", 4);
    expect(hash1).not.toBe(hash2);
  });
});

describe("getOtpExpiry", () => {
  it("returns a date in the future", () => {
    const expiry = getOtpExpiry(300);
    expect(expiry.getTime()).toBeGreaterThan(Date.now());
  });

  it("expiry is approximately expirationSeconds from now", () => {
    const before = Date.now();
    const expiry = getOtpExpiry(300);
    const after = Date.now();
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + 300_000 - 10);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + 300_000 + 10);
  });
});

describe("getResendCooldownRemaining", () => {
  it("returns 0 when cooldown has passed", () => {
    const lastSent = new Date(Date.now() - 120_000); // 2 min ago
    expect(getResendCooldownRemaining(lastSent, 60)).toBe(0);
  });

  it("returns positive seconds when within cooldown", () => {
    const lastSent = new Date(Date.now() - 10_000); // 10s ago
    const remaining = getResendCooldownRemaining(lastSent, 60);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(50);
  });
});

// ── Password utils ─────────────────────────────────────────────────────────────

describe("hashPassword / verifyPassword", () => {
  it("verifies correct password", async () => {
    const hash = await hashPassword("Password1!", 4);
    expect(await verifyPassword("Password1!", hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("Password1!", 4);
    expect(await verifyPassword("WrongPass1!", hash)).toBe(false);
  });

  it("produces different hashes for same password (salted)", async () => {
    const h1 = await hashPassword("Password1!", 4);
    const h2 = await hashPassword("Password1!", 4);
    expect(h1).not.toBe(h2);
  });
});

describe("assertPasswordStrength", () => {
  const { password: cfg } = makeTestConfig();

  it("passes a strong password", () => {
    expect(() => assertPasswordStrength("Str0ng!Pass", cfg)).not.toThrow();
  });

  it("throws PASSWORD_TOO_WEAK for short password", () => {
    expect(() => assertPasswordStrength("Sh0rt!", cfg))
      .toThrow(expect.objectContaining({ code: "PASSWORD_TOO_WEAK" }));
  });

  it("throws PASSWORD_TOO_WEAK for missing uppercase", () => {
    expect(() => assertPasswordStrength("password1!", cfg))
      .toThrow(expect.objectContaining({ code: "PASSWORD_TOO_WEAK" }));
  });

  it("throws PASSWORD_TOO_WEAK for missing number", () => {
    expect(() => assertPasswordStrength("Password!", cfg))
      .toThrow(expect.objectContaining({ code: "PASSWORD_TOO_WEAK" }));
  });

  it("throws PASSWORD_TOO_WEAK for missing special char", () => {
    expect(() => assertPasswordStrength("Password1", cfg))
      .toThrow(expect.objectContaining({ code: "PASSWORD_TOO_WEAK" }));
  });
});

// ── Sanitize utils ─────────────────────────────────────────────────────────────

describe("normalizeIdentifier", () => {
  it("lowercases email and trims whitespace", () => {
    expect(normalizeIdentifier("  User@EXAMPLE.COM  ")).toBe("user@example.com");
  });

  it("strips whitespace from phone", () => {
    expect(normalizeIdentifier("+1 202 555 1234")).toBe("+12025551234");
  });
});

describe("identifierType", () => {
  it("identifies email", () => {
    expect(identifierType("user@example.com")).toBe("email");
  });

  it("identifies phone (starts with +)", () => {
    expect(identifierType("+12025551234")).toBe("phone");
  });
});

describe("maskEmail", () => {
  it("masks local part keeping first char", () => {
    expect(maskEmail("alice@example.com")).toBe("a***@example.com");
  });

  it("handles single-char local", () => {
    expect(maskEmail("a@example.com")).toContain("***@example.com");
  });
});

describe("maskPhone", () => {
  it("shows only last 4 digits", () => {
    expect(maskPhone("+12025551234")).toBe("****1234");
  });
});

describe("maskIdentifier", () => {
  it("masks email", () => {
    expect(maskIdentifier("bob@example.com")).toBe("b***@example.com");
  });

  it("masks phone", () => {
    expect(maskIdentifier("+12025551234")).toBe("****1234");
  });
});
