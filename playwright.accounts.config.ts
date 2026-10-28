import base from "./playwright.auth.config";
import { defineConfig } from "@playwright/test";
const server = base.webServer as {
  command: string;
  url: string;
  env: Record<string, string>;
  reuseExistingServer: boolean;
};
export default defineConfig({
  ...base,
  testMatch: "**/account-cooks.spec.ts",
  outputDir: "test-results-accounts",
  webServer: {
    ...server,
    env: { ...server.env, NEXT_PUBLIC_ENABLE_CLOUD_COOKS: "true" },
  },
});
