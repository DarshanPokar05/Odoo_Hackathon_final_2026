/**
 * Global test setup — runs before every test file.
 * Sets required environment variables so the auth config initialises
 * without needing a real .env file during CI.
 */
process.env["NODE_ENV"] = "test";
process.env["AUTH_ACCESS_TOKEN_SECRET"] = "test-access-secret-at-least-32-chars-long";
process.env["AUTH_REFRESH_TOKEN_SECRET"] = "test-refresh-secret-at-least-32-chars-long";
process.env["AUTH_ACCESS_TOKEN_EXPIRES_IN"] = "15m";
process.env["AUTH_REFRESH_TOKEN_EXPIRES_IN"] = "7d";
process.env["AUTH_JWT_ISSUER"] = "auth-module-test";
process.env["AUTH_JWT_AUDIENCE"] = "auth-module-test-client";
process.env["DATABASE_URL"] = process.env["TEST_DATABASE_URL"] ?? "postgresql://postgres:password@localhost:5432/auth_module_test";
