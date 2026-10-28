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
