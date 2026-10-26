import { defineConfig, configDefaults } from "vitest/config";

// Browser journeys belong to Playwright, not Vitest.
// Without this exclusion, Vitest imports e2e/*.spec.ts and triggers
// "Playwright Test did not expect test.beforeEach() to be called here".
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
