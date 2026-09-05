/**
 * Integration test app builder — creates a fully wired Express app
 * with mocked repositories so no real DB is needed.
 */
import { Application } from "express";
import { createApp } from "../../app";
import { AuthController } from "../../api/v1/auth/auth.controller";
import { AuthService } from "../../services/auth.service";
import { OtpService } from "../../services/otp.service";
import { TokenService } from "../../services/token.service";
import { CompositeOtpProvider } from "../../providers/otp/composite-otp.provider";
import { UserRepository } from "../../repositories/user.repository";
import { OtpRepository } from "../../repositories/otp.repository";
import { PrismaTokenStore } from "../../repositories/token.repository";
import {
  makeTestConfig,
  makeMockUserRepo,
  makeMockOtpRepo,
  makeMockTokenStore,
  makeMockOtpProvider,
} from "./test-factories";
import type { AuthConfig, OtpProvider } from "@auth-module/core";

export interface TestApp {
  app: Application;
  config: AuthConfig;
  mocks: {
    userRepo: ReturnType<typeof makeMockUserRepo>;
    otpRepo: ReturnType<typeof makeMockOtpRepo>;
    tokenStore: ReturnType<typeof makeMockTokenStore>;
    otpProvider: OtpProvider;
    authService: AuthService;
  };
}

export function buildTestApp(): TestApp {
  const config = makeTestConfig();
  const userRepo = makeMockUserRepo();
  const otpRepo = makeMockOtpRepo();
  const tokenStore = makeMockTokenStore();
  const otpProvider = makeMockOtpProvider();

  const compositeProvider = new CompositeOtpProvider(otpProvider, otpProvider);

  const otpService = new OtpService(
    otpRepo as unknown as OtpRepository,
    compositeProvider,
    config,
  );

  const tokenService = new TokenService(
    tokenStore as unknown as PrismaTokenStore,
    config,
  );

  const authService = new AuthService(
    userRepo as unknown as UserRepository,
    otpService,
    tokenService,
    config,
  );

  const controller = new AuthController(authService, config);

  const app = createApp({
    controller,
    config,
    allowedOrigins: ["http://localhost:3000"],
  });

  return {
    app,
    config,
    mocks: { userRepo, otpRepo, tokenStore, otpProvider, authService },
  };
}
