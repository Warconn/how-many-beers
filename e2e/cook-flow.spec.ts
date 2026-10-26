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

test("home fits common viewport widths without horizontal overflow", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `Unexpected horizontal overflow at ${width}px`).toBe(false);
  }
});
