import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("home is a clean starting point with history access", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "What's cooking?" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Plan a new cook/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Past cooks and backups/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("plan brisket and brats, see their combined timeline, then resume", async ({ page }) => {
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await expect(page.getByRole("heading", { name: /0 dishes in this cook/ })).toBeVisible();
  await page.getByRole("button", { name: "+ Add dish", exact: true }).click();
  await expect(page.getByRole("heading", { name: /1 dish in this cook/ })).toBeVisible();

  await page.getByLabel("Choose a starting template").selectOption("brats");
  await page.getByRole("button", { name: "+ Add dish", exact: true }).click();
  await expect(page.getByRole("heading", { name: /2 dishes in this cook/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cooking timeline" })).toBeVisible();
  await expect(page.locator(".workspace-dish")).toHaveCount(2);

  await page.getByRole("button", { name: /Home/ }).first().click();
  await expect(page.getByRole("button", { name: /Resume planning/ })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Resume planning/ }).click();
  await expect(page.locator(".workspace-dish")).toHaveCount(2);
});

test("resuming an in-progress cook preserves cooking status", async ({ page }) => {
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await page.getByRole("button", { name: "+ Add dish", exact: true }).click();
  await page.getByRole("button", { name: /Done editing/ }).click();
  await page.getByRole("button", { name: /Start the cook/ }).click();
  await expect(page.getByText("Today's checklist")).toBeVisible();
  await page.getByRole("button", { name: /Home/ }).first().click();
  await expect(page.getByRole("button", { name: /Continue cooking/ })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /View cook/ }).click();
  await expect(page.getByText(/Cook in progress/).first()).toBeVisible();
  await page.getByRole("button", { name: /Return to cooking/ }).click();
  await expect(page.getByText("Today's checklist")).toBeVisible();
});

test("desktop Home keeps heading and primary action in the left column", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const intro = await page.locator(".home-intro").boundingBox();
  const actions = await page.locator(".home-new").boundingBox();
  const guide = await page.locator(".home-guide").boundingBox();
  expect(intro && actions && guide).toBeTruthy();
  if (!intro || !actions || !guide) return;
  expect(Math.abs(intro.x - actions.x), "Heading and start card must share a left edge").toBeLessThan(8);
  expect(actions.y, "Start card should follow heading").toBeGreaterThan(intro.y);
  expect(guide.x, "Game Plan must be in the right column").toBeGreaterThan(actions.x + actions.width - 8);
  expect(guide.y, "Game Plan should start near the top, not halfway down").toBeLessThan(intro.y + 100);
  await testInfo.attach("home-desktop.png", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
});

test("mobile Home stacks content in a sensible order", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const intro = await page.locator(".home-intro").boundingBox();
  const actions = await page.locator(".home-new").boundingBox();
  const guide = await page.locator(".home-guide").boundingBox();
  expect(intro && actions && guide).toBeTruthy();
  if (!intro || !actions || !guide) return;
  expect(intro.y).toBeLessThan(actions.y);
  expect(actions.y + actions.height).toBeLessThan(guide.y);
  await testInfo.attach("home-mobile.png", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
});

test("home fits common viewport widths without horizontal overflow", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `Unexpected horizontal overflow at ${width}px`).toBe(false);
  }
});
