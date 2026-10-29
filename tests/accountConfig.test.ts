import { afterEach, it, expect, vi } from "vitest";
import { accountConfig, callbackUrl } from "../src/auth/config";
afterEach(() => vi.unstubAllEnvs());
const configured = () => {
  vi.stubEnv("NEXT_PUBLIC_ENABLE_ACCOUNTS", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_fixture");
  vi.stubEnv("NEXT_PUBLIC_AUTH_ENV", "development");
  vi.stubEnv(
    "NEXT_PUBLIC_ACCOUNT_ORIGINS",
    "https://preview.example,https://howmanybeers.app",
  );
};
it("fails closed unless enabled and the origin is explicitly trusted", () => {
  expect(accountConfig("https://preview.example")).toBeNull();
  configured();
  expect(accountConfig("https://preview.example")).not.toBeNull();
  expect(accountConfig("https://untrusted.example")).toBeNull();
});
it("never enables the public site with development rollout settings", () => {
  configured();
  expect(accountConfig("https://howmanybeers.app")).toBeNull();
});
it("rejects credentials, paths, insecure URLs and secret keys", () => {
  configured();
  for (const url of [
    "http://project.supabase.co",
    "https://user:pass@project.supabase.co",
    "https://project.supabase.co/path",
  ]) {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    expect(accountConfig("https://preview.example")).toBeNull();
  }
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_secret_fixture");
  expect(accountConfig("https://preview.example")).toBeNull();
});
it("callbacks retain the supported deployment base and fixed account destination", () => {
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/how-many-beers");
  expect(callbackUrl("https://preview.example")).toBe(
    "https://preview.example/how-many-beers/account/callback/",
  );
});
it("offers email alone until social providers are explicitly configured", () => {
  configured();
  vi.stubEnv("NEXT_PUBLIC_AUTH_PROVIDERS", "");
  expect(accountConfig("https://preview.example")?.providers).toEqual([]);
  vi.stubEnv("NEXT_PUBLIC_AUTH_PROVIDERS", "google,unknown");
  expect(accountConfig("https://preview.example")?.providers).toEqual([
    "google",
  ]);
});

it("accepts any feat preview in the configured Pages project while keeping dev exact", () => {
  configured();
  vi.stubEnv("NEXT_PUBLIC_ACCOUNT_ORIGINS", "https://dev.how-many-beers.pages.dev,https://feat-*.how-many-beers.pages.dev");
  for (const origin of ["https://dev.how-many-beers.pages.dev", "https://feat-19-account-foundation.how-many-beers.pages.dev", "https://feat-new-cook-history.how-many-beers.pages.dev"]) {
    expect(accountConfig(origin), origin).not.toBeNull();
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
    expect(callbackUrl(origin)).toBe(origin + "/account/callback/");
  }
});
it("rejects unrelated, nested, malformed and non-HTTPS origins under a feat wildcard", () => {
  configured();
  vi.stubEnv("NEXT_PUBLIC_ACCOUNT_ORIGINS", "https://feat-*.how-many-beers.pages.dev");
  for (const origin of [
    "https://howmanybeers.app", "https://how-many-beers.pages.dev", "https://main.how-many-beers.pages.dev",
    "https://dev.how-many-beers.pages.dev", "https://a4b9b55.how-many-beers.pages.dev", "https://fix-bug.how-many-beers.pages.dev",
    "https://feat-test.other-project.pages.dev", "https://feat-test.how-many-beers.pages.dev.evil.example",
    "https://feat-test.nested.how-many-beers.pages.dev", "https://feat-.how-many-beers.pages.dev", "https://feat-trailing-.how-many-beers.pages.dev",
    "https://feat-" + "a".repeat(60) + ".how-many-beers.pages.dev",
    "http://feat-test.how-many-beers.pages.dev", "https://feat-test.how-many-beers.pages.dev:8443",
    "https://user@feat-test.how-many-beers.pages.dev", "https://feat-test.how-many-beers.pages.dev/path", "https://feat-test.how-many-beers.pages.dev?test=1",
  ]) expect(accountConfig(origin), origin).toBeNull();
});
it("does not interpret broader wildcard rules or enable feat patterns in production", () => {
  configured();
  const origin="https://feat-test.how-many-beers.pages.dev";
  for (const rule of ["*", "https://*.pages.dev", "https://*.how-many-beers.pages.dev", "http://feat-*.how-many-beers.pages.dev", "https://feat-*.how-many-beers.pages.dev/**"]) {
    vi.stubEnv("NEXT_PUBLIC_ACCOUNT_ORIGINS", rule);
    expect(accountConfig(origin), rule).toBeNull();
  }
  vi.stubEnv("NEXT_PUBLIC_AUTH_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_ACCOUNT_ORIGINS", "https://howmanybeers.app,https://feat-*.how-many-beers.pages.dev");
  expect(accountConfig(origin)).toBeNull();
  expect(accountConfig("https://howmanybeers.app")).not.toBeNull();
});
