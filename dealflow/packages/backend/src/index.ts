import "dotenv/config";
import { createAuthConfig } from "@auth-module/core";
import { createApp } from "./app";
import { buildContainer } from "./container";
import { connectDatabase, disconnectDatabase } from "./db/prisma.client";
import { logger } from "./utils/logger";

// ---------------------------------------------------------------------------
// Entry point — boot the server.
// ---------------------------------------------------------------------------

async function main() {
  // 1. Build config (reads env vars)
  const config = createAuthConfig({
    otp: {
      length: parseInt(process.env["AUTH_OTP_LENGTH"] ?? "6"),
      expirationSeconds: parseInt(process.env["AUTH_OTP_EXPIRATION_SECONDS"] ?? "300"),
      resendCooldownSeconds: parseInt(process.env["AUTH_OTP_RESEND_COOLDOWN_SECONDS"] ?? "60"),
      maxAttempts: parseInt(process.env["AUTH_MAX_OTP_ATTEMPTS"] ?? "5"),
      maxResends: parseInt(process.env["AUTH_MAX_OTP_RESENDS"] ?? "5"),
    },
    password: {
      minLength: parseInt(process.env["AUTH_PASSWORD_MIN_LENGTH"] ?? "8"),
    },
  });

  // 2. Connect database
  await connectDatabase();
  logger.info("Database connected");

  // 3. Build DI container
  const container = buildContainer({ config });

  // 4. Create Express app
  const allowedOrigins = (process.env["ALLOWED_ORIGINS"] ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim());

  const app = createApp({
    controller: container.authController,
    config,
    allowedOrigins,
  });

  // 5. Start server
  const port = parseInt(process.env["PORT"] ?? "4000");
  const server = app.listen(port, () => {
    logger.info(`Auth module server running on http://localhost:${port}`);
    logger.info(`Environment: ${config.app.environment}`);
  });

  // 6. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase();
      logger.info("Server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error("Failed to start server", { error: (err as Error).message });
  process.exit(1);
});
