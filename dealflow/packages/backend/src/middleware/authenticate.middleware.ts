import { Request, Response, NextFunction } from "express";
import { AuthConfig, verifyAccessToken, AuthErrors } from "@auth-module/core";

// ---------------------------------------------------------------------------
// authenticate — Express middleware that validates the Bearer access token
// from the Authorization header and attaches the payload to req.auth.
// ---------------------------------------------------------------------------

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string | null;
        phone: string | null;
      };
    }
  }
}

export function authenticate(config: AuthConfig) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return next(AuthErrors.unauthorized());
    }

    const token = authHeader.slice(7);
    try {
      const payload = verifyAccessToken(token, config.jwt);
      req.auth = {
        userId: payload.sub,
        email: payload.email,
        phone: payload.phone,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Optional auth — attaches auth payload if present but doesn't block. */
export function optionalAuthenticate(config: AuthConfig) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const payload = verifyAccessToken(authHeader.slice(7), config.jwt);
        req.auth = { userId: payload.sub, email: payload.email, phone: payload.phone };
      } catch {
        // Ignore — optional
      }
    }
    next();
  };
}
