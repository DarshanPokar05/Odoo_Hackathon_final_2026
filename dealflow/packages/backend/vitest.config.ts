import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/db/seed.ts",
        "src/tests/**",
      ],
    },
    // Run tests sequentially to avoid DB conflicts in integration tests
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
