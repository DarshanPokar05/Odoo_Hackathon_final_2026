import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { AuthConfig } from "@auth-module/core";
import { createAuthRouter } from "./api/v1/auth/auth.routes";
import { AuthController } from "./api/v1/auth/auth.controller";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { globalRateLimit } from "./middleware/rate-limit.middleware";

// ---------------------------------------------------------------------------
// createApp — Express application factory.
// Accepts an AuthController (which already has services/config injected)
// so the same app can be composed differently in tests vs production.
// ---------------------------------------------------------------------------

export interface CreateAppOptions {
  controller: AuthController;
  config: AuthConfig;
  allowedOrigins?: string[];
}

export function createApp(options: CreateAppOptions): Application {
  const { controller, config, allowedOrigins = ["http://localhost:3000"] } = options;
  const app = express();

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: config.app.environment === "production" ? undefined : false,
  }));

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: "10kb" }));
  app.use(express.urlencoded({ extended: true, limit: "10kb" }));
  app.use(cookieParser());

  // ── Logging ───────────────────────────────────────────────────────────────
  if (config.app.environment !== "test") {
    app.use(morgan(config.app.environment === "production" ? "combined" : "dev"));
  }

  // ── Global rate limit ─────────────────────────────────────────────────────
  app.use(globalRateLimit());

  // ── Health check ──────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ── Auth routes ───────────────────────────────────────────────────────────
  app.use("/api/v1/auth", createAuthRouter(controller, config));

  // ── 404 & error handlers (must be last) ──────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
