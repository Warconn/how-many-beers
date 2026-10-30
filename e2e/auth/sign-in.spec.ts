import { test, expect } from "@playwright/test";
import { api, user, session, backend } from "./fixtures";
test("email sign-in, reload and local sign-out preserve browser-local cook data", async ({
  page,
}, info) => {
  await backend(page);
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("how-many-beers:meal:v1", '{"fixture":"legacy-data"}'),
  );
  await page.goto("/account/");
  await expect(
    page.getByText(/Account cook saving isn’t available/),
  ).toBeVisible();
  await page.getByLabel("Email address").fill(user.email);
  await page
    .getByRole("button", { name: "Send sign-in code", exact: true })
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
    page.getByRole("button", { name: "Send sign-in code", exact: true }),
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
    .getByRole("button", { name: "Send sign-in code", exact: true })
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
    page.getByRole("button", { name: "Send sign-in code", exact: true }),
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
    .getByRole("button", { name: "Send sign-in code", exact: true })
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
    other.getByRole("button", { name: "Send sign-in code", exact: true }),
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
    page.getByRole("button", { name: "Send sign-in code", exact: true }),
  ).toBeVisible();
});

test("planner sign-in stays in the workspace and preserves an open recipe draft", async ({
  page,
}, info) => {
  await backend(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await page.getByRole('button',{name:'Start with a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();
  await page.getByRole("button", { name: "+ Add a dish", exact: true }).click();
  await page
    .getByRole("button", { name: "Import a recipe", exact: true })
    .click();
  await page.getByLabel("Recipe title").fill("Friday beans");
  const before = await page.evaluate(() =>
    localStorage.getItem("how-many-beers:meal:v1"),
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Your account" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Email address").fill(user.email);
  await dialog
    .getByRole("button", { name: "Send sign-in code", exact: true })
    .click();
  await dialog.getByLabel("Email code").fill("123456");
  await dialog
    .getByRole("button", { name: "Verify code", exact: true })
    .click();
  await expect(
    dialog.getByText("Signed in as " + user.email, { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("account-planning-dialog.png"),
  });
  await dialog
    .getByRole("button", { name: "Close account", exact: true })
    .click();
  await expect(page.getByLabel("Recipe title")).toHaveValue("Friday beans");
  await expect(
    page.getByRole("button", { name: "Account", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(() => localStorage.getItem("how-many-beers:meal:v1")),
  ).toBe(before);
  expect(page.url()).toBe("http://127.0.0.1:3108/");
});

test("account access works in cooking and history without changing cook progress", async ({
  page,
}, info) => {
  await backend(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await page.getByRole('button',{name:'Start with a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start cooking", exact: true })
    .click();
  const before = await page.evaluate(() =>
    localStorage.getItem("how-many-beers:meal:v1"),
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Your account" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Close account", exact: true })
    .click();
  await expect(
    page.getByText("Today's checklist", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("how-many-beers:meal:v1")),
  ).toBe(before);
  await page.screenshot({
    path: info.outputPath("account-cooking-header.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: /Home/ }).first().click();
  await page.getByRole("button", { name: /Past cooks and backups/ }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cook History", exact: true }),
  ).toBeVisible();
});

test("redirected sign-in can return to the same cooking view with exact saved progress", async ({
  page,
}) => {
  await backend(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await page.getByRole('button',{name:'Start with a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start cooking", exact: true })
    .click();
  const before = await page.evaluate(() =>
    localStorage.getItem("how-many-beers:meal:v1"),
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Your account" })
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(
    page.getByText("Signed in as " + user.email, { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "← Back to cook", exact: true }).click();
  await expect(
    page.getByText("Today's checklist", { exact: true }),
  ).toBeVisible();
  expect(page.url()).toBe("http://127.0.0.1:3108/");
  expect(
    await page.evaluate(() => localStorage.getItem("how-many-beers:meal:v1")),
  ).toBe(before);
});

test("verification errors hide cached identity and offer retry without touching the cook", async ({
  page,
}) => {
  await backend(page);
  await page.goto("/");
  await page.evaluate(
    ({ value }) =>
      localStorage.setItem("how-many-beers:auth:v1", JSON.stringify(value)),
    {
      value: { ...session(), expires_at: Math.floor(Date.now() / 1000) + 3600 },
    },
  );
  let unavailable = true;
  await page.route(api + "user", (route) =>
    unavailable
      ? route.fulfill({
          status: 400,
          json: { code: "unexpected_failure", msg: "Temporary auth failure" },
        })
      : route.fulfill({ json: user }),
  );
  await page.reload();
  const before = await page.evaluate(() =>
    localStorage.getItem("how-many-beers:meal:v1"),
  );
  await page.getByRole("button", { name: "Account", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Your account" });
  await expect(
    dialog.getByText(/Reconnect to confirm your account/),
  ).toBeVisible();
  await expect(
    dialog.getByText("Signed in as " + user.email, { exact: true }),
  ).toHaveCount(0);
  unavailable = false;
  await dialog
    .getByRole("button", { name: "Retry account connection", exact: true })
    .click();
  await expect(
    dialog.getByText("Signed in as " + user.email, { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("how-many-beers:meal:v1")),
  ).toBe(before);
});
