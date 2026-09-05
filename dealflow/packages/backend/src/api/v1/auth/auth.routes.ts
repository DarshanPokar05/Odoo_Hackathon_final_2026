import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authenticate } from "../../../middleware/authenticate.middleware";
import {
  loginRateLimit,
  registrationRateLimit,
  otpRateLimit,
} from "../../../middleware/rate-limit.middleware";
import { validate } from "../../../middleware/validate.middleware";
import { AuthConfig, buildVerifyOtpSchema, buildResendOtpSchema } from "@auth-module/core";

// ---------------------------------------------------------------------------
// Auth router factory — returns a configured Express Router.
// Rate limits and validation are applied per-route.
//
// Routes:
//   POST /register
//   POST /verify-registration
//   POST /resend-registration-otp
//   POST /login
//   POST /logout
//   POST /refresh
//   POST /forgot-password
//   POST /verify-reset-otp
//   POST /reset-password
//   GET  /me
// ---------------------------------------------------------------------------

export function createAuthRouter(controller: AuthController, config: AuthConfig): Router {
  const router = Router();

  const verifyOtpSchema = buildVerifyOtpSchema(config.otp.length);
  const resendOtpSchema = buildResendOtpSchema();

  // Registration
  router.post("/register", registrationRateLimit(config), controller.register);
  router.post("/verify-registration", otpRateLimit(), validate(verifyOtpSchema), controller.verifyRegistration);
  router.post("/resend-registration-otp", otpRateLimit(), validate(resendOtpSchema), controller.resendRegistrationOtp);

  // Session
  router.post("/login", loginRateLimit(config), controller.login);
  router.post("/logout", controller.logout);
  router.post("/refresh", controller.refresh);

  // Password reset
  router.post("/forgot-password", otpRateLimit(), controller.forgotPassword);
  router.post("/verify-reset-otp", otpRateLimit(), validate(verifyOtpSchema), controller.verifyResetOtp);
  router.post("/reset-password", controller.resetPassword);

  // Authenticated routes
  router.get("/me", authenticate(config), controller.me);

  return router;
}
