import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true, // optional: if you want global `describe`, `it`, etc.
    coverage: {
      provider: "v8", // or 'c8' if you prefer that
      reporter: ["text", "html"], // you can add more like 'lcov'
      reportsDirectory: "./coverage", // optional, default is 'coverage'
      exclude: ["**/test/**", "**/*.spec.ts"], // optional
    },
    setupFiles: "./test/setup.ts",
  },
});
