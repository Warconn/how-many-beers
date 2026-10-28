import { test, expect, type Page } from "@playwright/test";
const api = "https://auth.example.test/auth/v1/";
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "cook@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-10-27T12:00:00Z",
};
const token = () =>
  [
    "eyJhbGciOiJIUzI1NiJ9",
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "fixture",
  ].join(".");
const session = () => ({
  access_token: token(),
  refresh_token: "fixture-refresh",
  token_type: "bearer",
  expires_in: 3600,
  user,
});
async function backend(page: Page, { invalid = false } = {}) {
  await page.route(api + "**", async (route) => {
    const path = new URL(route.request().url());
    if (path.pathname.endsWith("/otp")) return route.fulfill({ json: {} });
    if (path.pathname.endsWith("/verify"))
      return invalid
        ? route.fulfill({
            status: 403,
            json: { error_code: "otp_expired", msg: "Expired" },
          })
        : route.fulfill({ json: session() });
    if (path.pathname.endsWith("/user")) return route.fulfill({ json: user });
    if (path.pathname.endsWith("/logout"))
      return route.fulfill({ status: 204, body: "" });
    if (path.pathname.endsWith("/token"))
      return invalid
        ? route.fulfill({
            status: 400,
            json: { error: "invalid_grant", error_description: "Expired" },
          })
        : route.fulfill({ json: session() });
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
test("email sign-in, reload and local sign-out preserve browser-local cook data", async ({
  page,
}, info) => {
  await backend(page);
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("how-many-beers:meal:v1", '{"fixture":"legacy-data"}'),
  );
  await page.goto("/account/");
  await expect(page.getByText(/Account preview: cook saving/)).toBeVisible();
  await page.getByLabel("Email address").fill(user.email);
  await page
    .getByRole("button", { name: "Send sign-in email", exact: true })
    .click();
  await expect(page.getByText(/Check your email/)).toBeVisible();
  await page.getByLabel("Email code").fill("123456");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(
    page.getByText("Signed in as " + user.email, { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Signed in as " + user.email, { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("account-session.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Sign out on this device", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Send sign-in email", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("how-many-beers:meal:v1")),
  ).toBe('{"fixture":"legacy-data"}');
});
test("invalid email code remains recoverable", async ({ page }) => {
  await backend(page, { invalid: true });
  await page.goto("/account/");
  await page.getByLabel("Email address").fill(user.email);
  await page
    .getByRole("button", { name: "Send sign-in email", exact: true })
    .click();
  await page.getByLabel("Email code").fill("bad");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(page.getByText(/code is invalid or expired/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Email code")).toHaveCount(0);
});
test("OAuth uses a same-origin callback and clears the one-time code", async ({
  page,
}) => {
  await backend(page);
  await page.goto("/account/");
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(
    page.getByText("Signed in as " + user.email, { exact: true }),
  ).toBeVisible();
  expect(page.url()).toBe("http://127.0.0.1:3108/account/");
});
test("cancelled callback is safe and never follows an arbitrary return URL", async ({
  page,
}) => {
  await backend(page);
  await page.goto(
    "/account/callback/?error=access_denied&error_description=private&next=https://evil.example",
  );
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "cancelled, invalid or expired" }),
  ).toBeVisible();
  expect(page.url()).toBe("http://127.0.0.1:3108/account/callback/");
  await page.getByRole("link", { name: "Return to sign in" }).click();
  await expect(
    page.getByRole("button", { name: "Send sign-in email", exact: true }),
  ).toBeVisible();
});

test("verified identity replaces a forged cached profile", async ({ page }) => {
  await backend(page);
  await page.goto("/account/");
  await page.evaluate(
    ({ value }) =>
      localStorage.setItem("how-many-beers:auth:v1", JSON.stringify(value)),
    {
      value: {
        ...session(),
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { ...user, email: "forged@example.test" },
      },
    },
  );
  await page.reload();
  await expect(
    page.getByText("Signed in as " + user.email, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Signed in as forged/)).toHaveCount(0);
});
test("same-origin tabs clear account identity after sign-out", async ({
  page,
  context,
}) => {
  await backend(page);
  await page.goto("/account/");
  await page.getByLabel("Email address").fill(user.email);
  await page
    .getByRole("button", { name: "Send sign-in email", exact: true })
    .click();
  await page.getByLabel("Email code").fill("123456");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(
    page.getByText("Signed in as " + user.email, { exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await backend(other);
  await other.goto("/account/");
  await expect(
    other.getByText("Signed in as " + user.email, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sign out on this device", exact: true })
    .click();
  await expect(
    other.getByRole("button", { name: "Send sign-in email", exact: true }),
  ).toBeVisible();
  await expect(
    other.getByText("Signed in as " + user.email, { exact: true }),
  ).toHaveCount(0);
});

test("failed PKCE exchange clears its code and offers another sign-in attempt", async ({
  page,
}) => {
  await backend(page, { invalid: true });
  await page.goto("/account/callback/?code=expired-code");
  await expect(
    page.getByRole("alert").filter({ hasText: "could not be verified" }),
  ).toBeVisible();
  expect(page.url()).toBe("http://127.0.0.1:3108/account/callback/");
  await page.getByRole("link", { name: "Return to sign in" }).click();
  await expect(
    page.getByRole("button", { name: "Send sign-in email", exact: true }),
  ).toBeVisible();
});
