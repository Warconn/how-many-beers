import { test, expect } from '@playwright/test';
import { newMeal, createDish } from '../src/domain/meal';
import { cookTimeline, migrateMeal, recordEvent } from '../src/domain/cookState';
import { parseRecipeText } from '../src/domain/recipe';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('empty and invalid plans explain why starting is disabled', async ({ page }) => {
  await page.getByRole('button', { name: /Plan a new cook/ }).click();
  await expect(page.getByText('READY WHEN YOU ARE', { exact: true })).toHaveCount(0);
  const start = page.getByRole('button', { name: 'Start cooking', exact: true });
  await expect(start).toBeDisabled();
  await expect(page.getByText('Add a dish or prep step to start.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Add a checklist step/ }).click();
  await page.getByLabel('Step title', { exact: true }).fill('Set the table');
  await page.getByRole('button', { name: 'Add step', exact: true }).click();
  await expect(start).toBeEnabled();
  await page.getByRole('button', { name: 'Add smoked brisket', exact: true }).click();
  await page.getByLabel('Serve date and time').fill('');
  await expect(start).toBeDisabled();
  await expect(page.getByText('Set a valid serving date and time to start.', { exact: true })).toBeVisible();
  await page.getByLabel('Serve date and time').fill('2026-11-25T18:00');
  await expect(start).toBeEnabled();
});

test('planned cook has one compact action beneath the menu and optional checklist', async ({ page }, info) => {
  await page.getByRole('button', { name: /Plan a new cook/ }).click();
  await page.getByRole('button', { name: 'Add smoked brisket' }).click();
  await page.getByRole('button', { name: '+ Add a dish', exact: true }).click();
  await page.getByRole('button', { name: 'Add grilled beer-bath brats' }).click();
  await page.getByRole('button', { name: 'Edit Grilled beer-bath brats', exact: true }).click();
  const actions = page.getByRole('region', { name: 'Cooking actions' });
  await expect(page.locator('.ready-panel')).toHaveCount(0);
  await expect(page.getByText('One cook, everything on the menu.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Start a fresh plan/ })).toHaveCount(0);
  await expect(actions.getByRole('button', { name: 'Start cooking', exact: true })).toHaveCount(1);
  const menuBox = await page.getByRole('region', { name: 'Cook overview' }).boundingBox();
  const actionBox = await actions.boundingBox();
  expect(actionBox!.y).toBeGreaterThanOrEqual(menuBox!.y + menuBox!.height);
  expect(actionBox!.y - menuBox!.y - menuBox!.height).toBeLessThan(40);
  expect(actionBox!.height).toBeLessThan(200);
  await expect(page.getByRole('region', { name: 'Cooking checklist preview' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Review checklist', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Cooking checklist preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Hide checklist', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Cooking checklist preview' })).toHaveCount(0);
  await expect(page.getByText(/Schedules are estimates, not food-safety checks/)).toBeVisible();
  await page.getByRole('region', { name: 'Cook overview' }).evaluate(el => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: info.outputPath('cook-action.png'), fullPage: false });
  await info.attach('cook-action.png', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await actions.getByRole('button', { name: 'Start cooking', exact: true }).click();
  await expect(page.getByText("Today's checklist")).toBeVisible();
  const started = await page.evaluate(() => JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
  expect(started.mode).toBe('cooking');
  expect(started.startedAt).toBeTruthy();
  const stepLabel = await page.getByRole('checkbox', { name: /^Complete / }).first().getAttribute('aria-label');
  await page.getByRole('checkbox', { name: stepLabel!, exact: true }).click();
  await expect.poll(async () => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!).completed).length)).toBe(1);
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
  expect(progress.events.some((event: { kind: string }) => event.kind === 'completed')).toBe(true);
  await page.getByRole('button', { name: '← View your cook', exact: true }).click();
  await page.getByRole('button', { name: 'Continue cooking', exact: true }).click();
  await expect(page.getByText("Today's checklist")).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Continue cooking/ }).click();
  await expect(page.getByText("Today's checklist")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!))).toEqual(progress);
});

test('continue returns to saved cooking without changing timestamps or progress', async ({ page }) => {
  const meal = { ...newMeal(), dishes: [createDish('brisket')], mode: 'cooking' as const, serveAt: '' };
  const task = cookTimeline(meal)[0];
  const saved = recordEvent(recordEvent(meal, task.id, 'completed', '2026-10-25T12:00:00.000Z'), task.id, 'temperature', '2026-10-25T12:01:00.000Z', 165, '°F');
  saved.notes[task.id] = 'Keep this note';
  await page.evaluate(value => localStorage.setItem('how-many-beers:meal:v1', JSON.stringify(value)), saved);
  await page.reload();
  await page.getByRole('button', { name: /View cook/ }).click();
  const actions = page.getByRole('region', { name: 'Cooking actions' });
  await expect(actions.getByRole('button', { name: 'Continue cooking', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Start cooking', exact: true })).toHaveCount(0);
  await actions.getByRole('button', { name: 'Continue cooking', exact: true }).click();
  await expect(page.getByText("Today's checklist")).toBeVisible();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!))).toEqual(migrateMeal(saved));
  await page.reload();
  await page.getByRole('button', { name: /Continue cooking/ }).click();
  await expect(page.getByText("Today's checklist")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!))).toEqual(migrateMeal(saved));
});

test('equipment and untimed-step warnings remain visible before starting', async ({ page }, info) => {
  const meal = newMeal();
  const brisket = createDish('brisket');
  const brats = { ...createDish('brats'), equipment: brisket.equipment };
  meal.dishes = [brisket, brats, parseRecipeText('Sides', 'Chop vegetables\nRoast until done')];
  await page.evaluate(value => localStorage.setItem('how-many-beers:meal:v1', JSON.stringify(value)), meal);
  await page.reload();
  await page.getByRole('button', { name: /Resume planning/ }).click();
  const notes = page.getByRole('region', { name: 'Plan notes' });
  await expect(notes.getByText(/Shared equipment/)).toBeVisible();
  await expect(notes.getByText(/Some steps have no timing/)).toBeVisible();
  await expect(notes.getByText(/Schedules are estimates, not food-safety checks/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start cooking', exact: true })).toBeEnabled();
  await page.getByRole('region', { name: 'Cooking actions' }).evaluate(el => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: info.outputPath('cook-warnings.png'), fullPage: false });
  await info.attach('cook-warnings.png', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
});

test('legacy started cook keeps its original start when continuing', async ({ page }) => {
  const saved = migrateMeal({ ...newMeal(), dishes: [createDish('brisket')], mode: undefined, startedAt: '2026-10-25T12:00:00.000Z' });
  await page.evaluate(value => localStorage.setItem('how-many-beers:meal:v1', JSON.stringify(value)), saved);
  await page.reload();
  await page.getByRole('button', { name: /Resume planning/ }).click();
  await page.getByRole('button', { name: 'Continue cooking', exact: true }).click();
  await expect(page.getByText("Today's checklist")).toBeVisible();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!))).toEqual({ ...saved, mode: 'cooking' });
});
