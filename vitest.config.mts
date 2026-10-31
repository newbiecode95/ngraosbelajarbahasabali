import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    // Suites share a remote database/tunnel; concurrency is exercised explicitly
    // inside the 20-player and saturated-pool tests, not across test fixtures.
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
