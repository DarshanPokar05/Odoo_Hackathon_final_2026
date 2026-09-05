import winston from "winston";

// ---------------------------------------------------------------------------
// Winston logger — implements the Logger interface from @auth-module/core.
// The format strips any field named "password", "otp", "token", "secret"
// before writing to prevent accidental secret leakage in logs.
// ---------------------------------------------------------------------------

const REDACTED_KEYS = new Set(["password", "otp", "plainOtp", "token", "accessToken", "refreshToken", "secret", "passwordHash", "otpHash"]);

function redactSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = REDACTED_KEYS.has(key) ? "[REDACTED]" : val;
  }
  return result;
}

const safeMetaFormat = winston.format((info) => {
  if (info["meta"] && typeof info["meta"] === "object") {
    info["meta"] = redactSecrets(info["meta"] as Record<string, unknown>);
  }
  return info;
});

export const logger = winston.createLogger({
  level: process.env["NODE_ENV"] === "production" ? "info" : "debug",
  format: winston.format.combine(
    safeMetaFormat(),
    winston.format.timestamp(),
    process.env["NODE_ENV"] === "production"
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
            return `${String(timestamp)} [${String(level)}]: ${String(message)}${metaStr}`;
          }),
        ),
  ),
  transports: [new winston.transports.Console()],
});
