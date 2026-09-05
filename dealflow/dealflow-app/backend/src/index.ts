/**
 * Example App — Backend Entry Point
 *
 * This file demonstrates the minimal setup required to integrate
 * @auth-module/backend into a new Express application.
 *
 * Steps:
 *  1. Load environment variables
 *  2. Build auth config (with optional overrides)
 *  3. Build the DI container (repositories, services, controller)
 *  4. Create the Express app
 *  5. Mount additional application routes alongside auth
 *  6. Start the server
 */

import "dotenv/config";
import express from "express";
import {
  createAuthConfig,
} from "@auth-module/core";
import {
  buildContainer,
  createApp,
  connectDatabase,
  disconnectDatabase,
} from "@auth-module/backend";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Auth configuration — override only what differs from defaults
// ─────────────────────────────────────────────────────────────────────────────
const authConfig = createAuthConfig({
  app: {
    name: process.env["AUTH_APP_NAME"] ?? "ExampleApp",
    baseUrl: process.env["AUTH_APP_BASE_URL"] ?? "http://localhost:5173",
    environment: (process.env["NODE_ENV"] as "development" | "production" | "test") ?? "development",
  },
  otp: {
    expirationSeconds: 300,   // 5 minutes
    resendCooldownSeconds: 60,
    maxAttempts: 5,
    maxResends: 3,            // stricter for example app
  },
  password: {
    minLength: 8,
  },
  session: {
    secure: process.env["NODE_ENV"] === "production",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. DI container
// ─────────────────────────────────────────────────────────────────────────────
const container = buildContainer({ config: authConfig });

// ─────────────────────────────────────────────────────────────────────────────
// 3. Express app — mounts auth routes at /api/v1/auth
// ─────────────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env["ALLOWED_ORIGINS"] ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

const app = createApp({
  controller: container.authController,
  config: authConfig,
  allowedOrigins,
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Application-specific routes (example: a protected /api/v1/profile endpoint)
// ─────────────────────────────────────────────────────────────────────────────
import { authenticate } from "@auth-module/backend";
import { Request, Response } from "express";

const appRouter = express.Router();

/**
 * GET /api/v1/profile
 * Protected by the auth module's authenticate middleware.
 * Demonstrates how to secure any endpoint.
 */
appRouter.get(
  "/profile",
  authenticate(authConfig),
  async (req: Request, res: Response) => {
    // req.auth is populated by the authenticate middleware
    const user = await container.authService.getCurrentUser(req.auth!.userId);
    res.json({
      success: true,
      message: "Profile retrieved.",
      data: {
        user,
        // Application-specific data would go here
        subscription: "free",
        preferences: { theme: "light", notifications: true },
      },
    });
  },
);

app.use("/api/v1", appRouter);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Start
// ─────────────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env["PORT"] ?? "4000");

async function start() {
  await connectDatabase();
  console.log("✅ Database connected");

  const server = app.listen(PORT, () => {
    console.log(`\n🚀 Example App Backend`);
    console.log(`   URL:  http://localhost:${PORT}`);
    console.log(`   Env:  ${authConfig.app.environment}`);
    console.log(`\n   Auth endpoints:`);
    console.log(`   POST http://localhost:${PORT}/api/v1/auth/register`);
    console.log(`   POST http://localhost:${PORT}/api/v1/auth/login`);
    console.log(`   GET  http://localhost:${PORT}/api/v1/auth/me`);
    console.log(`   GET  http://localhost:${PORT}/api/v1/profile (protected)\n`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
