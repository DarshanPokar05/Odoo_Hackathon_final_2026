// ---------------------------------------------------------------------------
// Centralized auth configuration with defaults.
// The consuming application overrides values via environment variables or
// by calling createAuthConfig() with a partial override object.
// ---------------------------------------------------------------------------

export interface AuthConfig {
  // OTP settings
  otp: {
    length: number;           // digits in the OTP (default 6)
    expirationSeconds: number; // how long the OTP is valid (default 300 = 5 min)
    resendCooldownSeconds: number; // min gap between resends (default 60)
    maxAttempts: number;      // wrong guesses before lockout (default 5)
    maxResends: number;       // resend requests before hard limit (default 5)
    saltRounds: number;       // bcrypt rounds for OTP hashing (default 10)
  };

  // Password settings
  password: {
    minLength: number;        // default 8
    requireUppercase: boolean; // default true
    requireLowercase: boolean; // default true
    requireNumbers: boolean;  // default true
    requireSpecialChars: boolean; // default true
    saltRounds: number;       // bcrypt rounds (default 12)
  };

  // JWT / token settings
  jwt: {
    accessTokenSecret: string;
    refreshTokenSecret: string;
    accessTokenExpiresIn: string; // e.g. "15m"
    refreshTokenExpiresIn: string; // e.g. "7d"
    issuer: string;
    audience: string;
  };

  // Session / cookie settings
  session: {
    cookieName: string;
    secure: boolean;          // true in production (HTTPS only)
    httpOnly: boolean;
    sameSite: "strict" | "lax" | "none";
    domain?: string;
  };

  // Rate limiting
  rateLimit: {
    loginWindowMs: number;    // default 15 * 60 * 1000 (15 min)
    loginMaxAttempts: number; // default 10
    registrationWindowMs: number;
    registrationMaxAttempts: number;
  };

  // App settings
  app: {
    name: string;
    baseUrl: string;
    environment: "development" | "test" | "production";
  };
}

const defaults: AuthConfig = {
  otp: {
    length: 6,
    expirationSeconds: 300,
    resendCooldownSeconds: 60,
    maxAttempts: 5,
    maxResends: 5,
    saltRounds: 10,
  },
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    saltRounds: 12,
  },
  jwt: {
    accessTokenSecret: process.env["AUTH_ACCESS_TOKEN_SECRET"] ?? "CHANGE_ME_ACCESS_SECRET",
    refreshTokenSecret: process.env["AUTH_REFRESH_TOKEN_SECRET"] ?? "CHANGE_ME_REFRESH_SECRET",
    accessTokenExpiresIn: process.env["AUTH_ACCESS_TOKEN_EXPIRES_IN"] ?? "15m",
    refreshTokenExpiresIn: process.env["AUTH_REFRESH_TOKEN_EXPIRES_IN"] ?? "7d",
    issuer: process.env["AUTH_JWT_ISSUER"] ?? "auth-module",
    audience: process.env["AUTH_JWT_AUDIENCE"] ?? "auth-module-client",
  },
  session: {
    cookieName: process.env["AUTH_COOKIE_NAME"] ?? "auth_refresh_token",
    secure: process.env["NODE_ENV"] === "production",
    httpOnly: true,
    sameSite: "strict",
  },
  rateLimit: {
    loginWindowMs: 15 * 60 * 1000,
    loginMaxAttempts: 10,
    registrationWindowMs: 60 * 60 * 1000,
    registrationMaxAttempts: 5,
  },
  app: {
    name: process.env["AUTH_APP_NAME"] ?? "AuthModule",
    baseUrl: process.env["AUTH_APP_BASE_URL"] ?? "http://localhost:3000",
    environment: (process.env["NODE_ENV"] as AuthConfig["app"]["environment"]) ?? "development",
  },
};

/**
 * Deep-merges caller overrides onto the defaults.
 * Call this once at app startup and pass the result to all services.
 */
export function createAuthConfig(overrides?: DeepPartial<AuthConfig>): AuthConfig {
  if (!overrides) return defaults;
  return deepMerge(defaults as unknown as Record<string, unknown>, overrides as unknown as Record<string, unknown>) as unknown as AuthConfig;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const bv = base[key];
    const ov = override[key];
    if (ov !== null && typeof ov === "object" && !Array.isArray(ov) &&
        bv !== null && typeof bv === "object" && !Array.isArray(bv)) {
      result[key] = deepMerge(bv as Record<string, unknown>, ov as Record<string, unknown>);
    } else if (ov !== undefined) {
      result[key] = ov;
    }
  }
  return result;
}
