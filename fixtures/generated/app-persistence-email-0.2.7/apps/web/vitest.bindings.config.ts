import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/bindings/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
