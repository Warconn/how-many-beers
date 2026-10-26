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
  await page.getByRole("button", { name: "Add smoked brisket" }).click();
  await expect(page.getByRole("heading", { name: /1 dish in this cook/ })).toBeVisible();

  await page.getByRole("button", { name: "+ Add a dish", exact: true }).click();
  await page.getByRole("button", { name: "Add grilled beer-bath brats" }).click();
  await expect(page.getByRole("heading", { name: /2 dishes in this cook/ })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Live schedule" })).toBeVisible();
  await expect(page.locator(".workspace-dish")).toHaveCount(2);

  await page.getByRole("button", { name: /Home/ }).first().click();
  await expect(page.getByRole("button", { name: /Resume planning/ })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Resume planning/ }).click();
  await expect(page.locator(".workspace-dish")).toHaveCount(2);
});

test("resuming an in-progress cook preserves cooking status", async ({ page }) => {
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await page.getByRole("button", { name: "Add smoked brisket" }).click();
  await page.getByRole("button", { name: /Start the cook/ }).click();
  await expect(page.getByText("Today's checklist")).toBeVisible();
  await page.getByRole("button", { name: /Home/ }).first().click();
  await expect(page.getByRole("button", { name: /Continue cooking/ })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /View cook/ }).click();
  await expect(page.getByText(/Cook in progress/).first()).toBeVisible();
  await page.locator(".notice").getByRole("button", { name: "Return to cooking →", exact: true }).click();
  await expect(page.getByText("Today's checklist")).toBeVisible();
});


test("template picker adds dishes and keeps their settings separate", async ({ page }) => {
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await expect(page.getByRole("heading", { name: "Choose a template" })).toBeVisible();
  await page.getByRole("button", { name: "Add smoked brisket" }).click();
  await expect(page.getByRole("heading", { name: /1 dish in this cook/ })).toBeVisible();
  await page.getByRole("button", { name: "+ Add a dish", exact: true }).click();
  await page.getByRole("button", { name: "Add grilled beer-bath brats" }).click();
  await expect(page.locator(".workspace-dish")).toHaveCount(2);
  await page.getByRole("button", { name: "Edit Smoked brisket", exact: true }).click();
  await page.getByText("Dish settings", { exact: true }).click();
  await page.getByLabel("Dish name").fill("Saturday brisket");
  await page.getByRole("button", { name: "Edit Saturday brisket", exact: true }).click();
  await expect(page.getByText("Saturday brisket").first()).toBeVisible();
  await expect(page.getByText("Grilled beer-bath brats").first()).toBeVisible();
  await page.getByRole("button", { name: /Home/ }).first().click();
  await page.reload();
  await page.getByRole("button", { name: /Resume planning/ }).click();
  await expect(page.locator(".workspace-dish")).toHaveCount(2);
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

test("guided planner keeps menu beside schedule and allows full schedule expansion", async ({ page }) => {
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole("button", {name:/Plan a new cook/}).click();
  await page.getByRole("button", {name:"Add smoked brisket"}).click();
  const planner=await page.locator(".guided-main").boundingBox();
  const schedule=await page.getByRole("complementary",{name:"Live schedule"}).boundingBox();
  expect(planner && schedule).toBeTruthy();
  if(!planner||!schedule)return;
  expect(schedule.x).toBeGreaterThan(planner.x+planner.width-10);
  await expect(page.getByRole("button",{name:/Show full schedule/})).toBeVisible();
  await page.getByRole("button",{name:/Show full schedule/}).click();
  await expect(page.locator(".schedule-list li")).toHaveCount(8);
  await page.getByRole("button",{name:/Show less/}).click();
  await expect(page.locator(".schedule-list li")).toHaveCount(4);
});
test("mobile planner keeps planning controls first and schedule accessible",async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("button",{name:/Plan a new cook/}).click();
  const p=await page.locator(".guided-main").boundingBox();
  const sched=await page.getByRole("complementary",{name:"Live schedule"}).boundingBox();
  expect(p&&sched).toBeTruthy();
  if(!p||!sched)return;
  expect(sched.y).toBeGreaterThan(p.y);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test("a recipe can be imported from the same Add Dish interface as templates", async ({ page }) => {
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await expect(page.getByRole("heading", { name: "Add a dish" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start from template" })).toBeVisible();
  await page.getByRole("button", { name: "Import a recipe" }).click();
  await expect(page.getByLabel("Recipe title")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose a template" })).toHaveCount(0);
  await page.getByLabel("Recipe title").fill("Mac and cheese");
  await page.getByLabel("Recipe instructions").fill("Preheat oven\nCook pasta\nBake");
  await page.getByRole("button", { name: "Preview recipe steps" }).click();
  await page.getByRole("button", { name: "Add to this cook" }).click();
  await expect(page.getByRole("heading", { name: /1 dish in this cook/ })).toBeVisible();
  await page.getByRole("button", { name: "+ Add a dish", exact: true }).click();
  await page.getByRole("button", { name: "Start from template" }).click();
  await page.getByRole("button", { name: "Add grilled beer-bath brats" }).click();
  await expect(page.locator(".workspace-dish")).toHaveCount(2);
  await expect(page.getByRole("complementary", { name: "Live schedule" })).toBeVisible();
});

test("planner expands one dish to manage its steps without edit mode",async({page})=>{
 await page.getByRole("button",{name:/Plan a new cook/}).click();
 await page.getByRole("button",{name:"Add smoked brisket"}).click();
 await page.getByRole("button",{name:"+ Add a dish",exact:true}).click();
 await page.getByRole("button",{name:"Add grilled beer-bath brats"}).click();
 await page.getByRole("button",{name:"Edit Smoked brisket",exact:true}).click();
 await expect(page.getByRole("region",{name:"Smoked brisket steps"})).toBeVisible();
 await expect(page.getByRole("button",{name:"Add a step to Smoked brisket"})).toBeVisible();
 await page.getByRole("button",{name:"Add a step to Smoked brisket"}).click();
 await page.getByLabel("Step title").fill("Get wood pellets");
 await page.getByRole("button",{name:"Save step"}).click();
 await expect(page.getByText("Get wood pellets")).toBeVisible();
 await page.reload();
 await page.getByRole("button",{name:/Resume planning/}).click();
 await page.getByRole("button",{name:"Edit Smoked brisket",exact:true}).click();
 await expect(page.getByText("Get wood pellets")).toBeVisible();
});
