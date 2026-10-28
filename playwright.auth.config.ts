import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/auth",
  testMatch:["**/sign-in.spec.ts", "**/preview-origins.spec.ts"],
  outputDir: "test-results-auth",
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:3108",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "auth-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "auth-iphone", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3108",
    url: "http://127.0.0.1:3108",
    reuseExistingServer: !process.env.CI,
    env: {
      DEPLOY_TARGET: "cloudflare",
      NEXT_PUBLIC_ENABLE_ACCOUNTS: "true",
      NEXT_PUBLIC_AUTH_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: "https://auth.example.test",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
      NEXT_PUBLIC_ACCOUNT_ORIGINS: "http://127.0.0.1:3108,https://dev.how-many-beers.pages.dev,https://feat-*.how-many-beers.pages.dev",
      NEXT_PUBLIC_AUTH_PROVIDERS: "google,apple",
    },
  },
});
