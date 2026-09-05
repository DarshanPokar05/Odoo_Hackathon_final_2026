import { z } from "zod";
import { AuthConfig } from "../config/auth.config";

// ---------------------------------------------------------------------------
// Zod schemas for all auth endpoints.
// Schemas are functions that accept the config so that password rules and
// OTP length come from centralized config rather than hard-coded values.
// ---------------------------------------------------------------------------

/** Phone: E.164 format */
const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, "Phone must be in E.164 format (e.g. +12025551234)");

/** At least one of email or phone required */
export const identifierSchema = z
  .object({
    email: z.string().email("Invalid email address").optional(),
    phone: phoneSchema.optional(),
  })
  .refine((val) => val.email || val.phone, {
    message: "Either email or phone number is required",
    path: ["email"],
  });

export function buildPasswordSchema(cfg: AuthConfig["password"]) {
  let schema = z.string().min(cfg.minLength, `Password must be at least ${cfg.minLength} characters`);

  if (cfg.requireUppercase)
    schema = schema.regex(/[A-Z]/, "Password must contain at least one uppercase letter") as typeof schema;
  if (cfg.requireLowercase)
    schema = schema.regex(/[a-z]/, "Password must contain at least one lowercase letter") as typeof schema;
  if (cfg.requireNumbers)
    schema = schema.regex(/[0-9]/, "Password must contain at least one number") as typeof schema;
  if (cfg.requireSpecialChars)
    schema = schema.regex(/[^A-Za-z0-9]/, "Password must contain at least one special character") as typeof schema;

  return schema;
}

export function buildRegisterSchema(cfg: AuthConfig) {
  const passwordSchema = buildPasswordSchema(cfg.password);
  return z
    .object({
      name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name too long").trim(),
      email: z.string().email("Invalid email address").optional(),
      phone: phoneSchema.optional(),
      password: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((val) => val.email || val.phone, {
      message: "Either email or phone number is required",
      path: ["email"],
    })
    .refine((val) => val.password === val.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });
}

export function buildVerifyOtpSchema(otpLength: number) {
  return z.object({
    identifier: z.string().min(1, "Identifier is required"),
    otp: z
      .string()
      .length(otpLength, `OTP must be ${otpLength} digits`)
      .regex(/^\d+$/, "OTP must contain digits only"),
    purpose: z.enum([
      "REGISTRATION",
      "PASSWORD_RESET",
      "LOGIN_VERIFICATION",
      "PHONE_VERIFICATION",
      "EMAIL_VERIFICATION",
    ]),
  });
}

export function buildResendOtpSchema() {
  return z.object({
    identifier: z.string().min(1, "Identifier is required"),
    purpose: z.enum([
      "REGISTRATION",
      "PASSWORD_RESET",
      "LOGIN_VERIFICATION",
      "PHONE_VERIFICATION",
      "EMAIL_VERIFICATION",
    ]),
  });
}

export function buildLoginSchema() {
  return z.object({
    identifier: z.string().min(1, "Email or phone is required"),
    password: z.string().min(1, "Password is required"),
    rememberMe: z.boolean().optional().default(false),
  });
}

export function buildForgotPasswordSchema() {
  return z.object({
    identifier: z.string().min(1, "Email or phone is required"),
  });
}

export function buildResetPasswordSchema(cfg: AuthConfig) {
  const passwordSchema = buildPasswordSchema(cfg.password);
  return z
    .object({
      identifier: z.string().min(1, "Identifier is required"),
      otp: z.string().min(1, "OTP is required"),
      newPassword: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((val) => val.newPassword === val.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });
}
