import { Request, Response, NextFunction } from "express";
import { AuthService } from "../../../services/auth.service";
import { AuthConfig } from "@auth-module/core";

// ---------------------------------------------------------------------------
// AuthController — thin HTTP layer. No business logic here.
// Each method extracts request data, calls AuthService, and writes the
// response envelope. Cookie handling is also managed here.
// ---------------------------------------------------------------------------

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AuthConfig,
  ) {}

  // ── Registration ──────────────────────────────────────────────────────────

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);
      res.status(201).json({
        success: true,
        message: `Verification code sent to ${result.maskedIdentifier}`,
        data: { maskedIdentifier: result.maskedIdentifier },
      });
    } catch (err) { next(err); }
  };

  verifyRegistration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { identifier, otp } = req.body as { identifier: string; otp: string };
      const result = await this.authService.verifyRegistrationOtp(identifier, otp);
      this.setRefreshTokenCookie(res, result.tokens.refreshToken);
      res.status(200).json({
        success: true,
        message: "Registration complete. Welcome!",
        data: { user: result.user, accessToken: result.tokens.accessToken, expiresIn: result.tokens.expiresIn },
      });
    } catch (err) { next(err); }
  };

  resendRegistrationOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { identifier } = req.body as { identifier: string };
      const result = await this.authService.resendRegistrationOtp(identifier);
      res.status(200).json({
        success: true,
        message: `Verification code sent to ${result.maskedIdentifier}`,
        data: { maskedIdentifier: result.maskedIdentifier },
      });
    } catch (err) { next(err); }
  };

  // ── Login ─────────────────────────────────────────────────────────────────

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.login(req.body);
      this.setRefreshTokenCookie(res, result.tokens.refreshToken);
      res.status(200).json({
        success: true,
        message: "Login successful.",
        data: { user: result.user, accessToken: result.tokens.accessToken, expiresIn: result.tokens.expiresIn },
      });
    } catch (err) { next(err); }
  };

  // ── Logout ────────────────────────────────────────────────────────────────

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = this.extractRefreshToken(req);
      if (refreshToken) await this.authService.logout(refreshToken);
      this.clearRefreshTokenCookie(res);
      res.status(200).json({ success: true, message: "Logged out successfully.", data: {} });
    } catch (err) { next(err); }
  };

  // ── Token refresh ─────────────────────────────────────────────────────────

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = this.extractRefreshToken(req);
      if (!refreshToken) {
        res.status(401).json({ success: false, message: "No refresh token provided.", code: "UNAUTHORIZED" });
        return;
      }
      const tokens = await this.authService.refreshSession(refreshToken);
      this.setRefreshTokenCookie(res, tokens.refreshToken);
      res.status(200).json({
        success: true,
        message: "Token refreshed.",
        data: { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn },
      });
    } catch (err) { next(err); }
  };

  // ── Forgot / Reset password ───────────────────────────────────────────────

  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.forgotPassword(req.body);
      res.status(200).json({
        success: true,
        message: `If an account exists, a reset code was sent to ${result.maskedIdentifier}`,
        data: { maskedIdentifier: result.maskedIdentifier },
      });
    } catch (err) { next(err); }
  };

  verifyResetOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { identifier, otp } = req.body as { identifier: string; otp: string };
      const result = await this.authService.verifyPasswordResetOtp(identifier, otp);
      res.status(200).json({
        success: true,
        message: "OTP verified. You may now reset your password.",
        data: { resetToken: result.resetToken },
      });
    } catch (err) { next(err); }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.resetPassword(req.body);
      res.status(200).json({ success: true, message: "Password reset successfully. Please log in.", data: {} });
    } catch (err) { next(err); }
  };

  // ── Current user ──────────────────────────────────────────────────────────

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.authService.getCurrentUser(req.auth!.userId);
      res.status(200).json({ success: true, message: "User retrieved.", data: { user } });
    } catch (err) { next(err); }
  };

  // ── Cookie helpers ────────────────────────────────────────────────────────

  private setRefreshTokenCookie(res: Response, token: string): void {
    const cfg = this.config.session;
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    res.cookie(cfg.cookieName, token, {
      httpOnly: cfg.httpOnly,
      secure: cfg.secure,
      sameSite: cfg.sameSite,
      domain: cfg.domain,
      maxAge: maxAgeMs,
      path: "/",
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    const cfg = this.config.session;
    res.clearCookie(cfg.cookieName, {
      httpOnly: cfg.httpOnly,
      secure: cfg.secure,
      sameSite: cfg.sameSite,
      path: "/",
    });
  }

  private extractRefreshToken(req: Request): string | undefined {
    return (
      (req.cookies as Record<string, string | undefined>)[this.config.session.cookieName] ??
      (req.body as { refreshToken?: string }).refreshToken
    );
  }
}
