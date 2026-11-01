import { defineConfig } from "vitest/config";
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
  test: {
    // Suites share a remote database/tunnel; concurrency is exercised explicitly
    // inside the 20-player and saturated-pool tests, not across test fixtures.
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
