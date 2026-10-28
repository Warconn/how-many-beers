import { test, expect, type Page } from "@playwright/test";
export const api = "https://auth.example.test/auth/v1/";
export const user = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "cook@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-10-27T12:00:00Z",
};
const token = (profile = user) =>
  [
    "eyJhbGciOiJIUzI1NiJ9",
    Buffer.from(
      JSON.stringify({
        sub: profile.id,
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "fixture",
  ].join(".");
export const session = (profile = user) => ({
  access_token: token(profile),
  refresh_token: "fixture-refresh",
  token_type: "bearer",
  expires_in: 3600,
  user: profile,
});
export async function backend(
  page: Page,
  { invalid = false, profile = user } = {},
) {
  await page.route(api + "**", async (route) => {
    const path = new URL(route.request().url());
    if (path.pathname.endsWith("/otp")) return route.fulfill({ json: {} });
    if (path.pathname.endsWith("/verify"))
      return invalid
        ? route.fulfill({
            status: 403,
            json: { error_code: "otp_expired", msg: "Expired" },
          })
        : route.fulfill({ json: session(profile) });
    if (path.pathname.endsWith("/user"))
      return route.fulfill({ json: profile });
    if (path.pathname.endsWith("/logout"))
      return route.fulfill({ status: 204, body: "" });
    if (path.pathname.endsWith("/token"))
      return invalid
        ? route.fulfill({
            status: 400,
            json: { error: "invalid_grant", error_description: "Expired" },
          })
        : route.fulfill({ json: session(profile) });
    if (path.pathname.endsWith("/authorize")) {
      expect(path.searchParams.get("redirect_to")).toBe(
        "http://127.0.0.1:3108/account/callback/",
      );
      expect(path.searchParams.get("code_challenge_method")).toBe("s256");
      expect(path.searchParams.get("code_challenge")).toMatch(/^[\w-]+$/);
      // WebKit interception cannot fulfill a 302. Simulate the provider's
      // completion page instead; the app still exchanges the returned code.
      return route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><title>Provider fixture</title><script>location.replace("http://127.0.0.1:3108/account/callback/?code=fixture-code")</script>',
      });
    }
    throw Error("Unexpected auth endpoint " + path.pathname);
  });
}
