import { test, expect } from '@playwright/test';
import { createDish, newMeal, type Meal } from '../src/domain/meal';
import { addStep, cookTimeline, migrateMeal, recordEvent, type ExtendedMeal } from '../src/domain/cookState';
import { parseRecipeText } from '../src/domain/recipe';

test.use({ timezoneId: 'America/New_York' });
async function load(page: import('@playwright/test').Page, meal: Meal) {
  await page.goto('/');
  await page.evaluate(value => { localStorage.clear(); localStorage.setItem('how-many-beers:meal:v1', JSON.stringify(value)); }, meal);
  await page.reload();
  await page.getByRole('button', { name: /Resume planning|View cook/ }).click();
}
function seed() { return { ...newMeal(), serveAt: '2026-11-25T18:00', dishes: [createDish('brisket'), createDish('brats')] }; }
async function saved(page: import('@playwright/test').Page): Promise<ExtendedMeal> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
}

test('schedule opens the shared editor; overnight timing and details preserve active history', async ({ page }, info) => {
  const meal = seed(), task = cookTimeline(meal).find(t => t.id === meal.dishes[0].id + ':start')!;
  let active = recordEvent(recordEvent(meal, task.id, 'completed', '2026-10-25T10:00:00.000Z'), task.id, 'temperature', '2026-10-25T10:05:00.000Z', 165, '°F');
  active = { ...active, mode: 'cooking', notes: { [task.id]: 'Keep bark notes' }, taskOrder: cookTimeline(active).map(t => t.id).reverse() };
  await load(page, active);
  const schedule = page.getByRole('complementary', { name: 'Live schedule' });
  await schedule.getByRole('button', { name: /Show full schedule/ }).click();
  await schedule.getByRole('button', { name: 'Edit Put brisket on smoker for Smoked brisket', exact: true }).click();
  const form = page.getByRole('form', { name: 'Edit step', exact: true });
  await expect(form).toBeVisible();
  await form.getByLabel('Planned date and time', { exact: true }).fill('2026-11-26T00:30');
  await form.getByLabel('Estimated duration (minutes)', { exact: true }).fill('90');
  await form.getByLabel('Equipment for this step', { exact: true }).fill('Patio smoker');
  await form.getByLabel('Target food temperature (°F)', { exact: true }).fill('170');
  await form.evaluate(el => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: info.outputPath('step-timing.png'), fullPage: false });
  await info.attach('step-timing.png', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await form.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Smoked brisket steps' }).getByRole('article', { name: task.title, exact: true }).getByText(/90 min/)).toBeVisible();
  const after = await saved(page);
  expect(after.taskOverrides![task.id]).toMatchObject({ scheduledAt: '2026-11-26T05:30:00.000Z', durationMinutes: 90, equipment: 'Patio smoker', targetTempF: 170 });
  expect(after.events).toEqual(active.events);
  expect(after.completed).toEqual(active.completed);
  expect(after.notes).toEqual(active.notes);
  expect(after.dishes[1]).toEqual(active.dishes[1]);
  const dates = await schedule.locator('li time[datetime]').evaluateAll(nodes => nodes.map(node => Date.parse(node.getAttribute('datetime')!)));
  expect(dates).toHaveLength(cookTimeline(meal).length);
  expect(dates).toEqual([...dates].sort((a, b) => a - b));
  await page.reload();
  await page.getByRole('button', { name: /View cook/ }).click();
  await page.getByRole('button', { name: 'Edit Smoked brisket', exact: true }).click();
  await page.getByRole('region', { name: 'Smoked brisket steps' }).getByRole('article', { name: task.title, exact: true }).getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Planned date and time', { exact: true })).toHaveValue('2026-11-26T00:30');
});

test('imported and general prep steps support dates, unknown durations, cancellation and plan reset', async ({ page }) => {
  const meal = { ...newMeal(), serveAt: '2026-11-25T18:00', dishes: [parseRecipeText('Soup', 'Chop\nSimmer')] };
  meal.dishes[0].steps![0].minutes = 10;
  let state = addStep(meal, 'Set table', '', null);
  const custom = state.customTasks![0];
  await load(page, state);
  await page.getByRole('button', { name: 'Edit Soup', exact: true }).click();
  const row = page.getByRole('region', { name: 'Soup steps' }).getByRole('article', { name: 'Chop', exact: true });
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  const form = page.getByRole('form', { name: 'Edit step', exact: true });
  await form.getByLabel('Planned date and time', { exact: true }).fill('2026-11-26T00:15');
  await form.getByLabel('Estimated duration (minutes)', { exact: true }).fill('25');
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await saved(page)).toEqual(migrateMeal(state));
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await form.getByLabel('Planned date and time', { exact: true }).fill('2026-11-26T00:15');
  await form.getByLabel('Estimated duration (minutes)', { exact: true }).fill('25');
  await form.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await page.getByLabel('Serve date and time').fill('2026-11-26T18:00');
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(form.getByLabel('Planned date and time', { exact: true })).toHaveValue('2026-11-26T00:15');
  await form.getByRole('button', { name: 'Use plan timing', exact: true }).click();
  await expect(form.getByLabel('Estimated duration (minutes)', { exact: true })).toHaveValue('10');
  await form.getByRole('button', { name: 'Save & Close', exact: true }).click();
  const importedId = meal.dishes[0].id + ':' + meal.dishes[0].steps![0].id;
  expect((await saved(page)).taskOverrides?.[importedId]?.scheduledAt).toBeUndefined();
  const schedule = page.getByRole('complementary', { name: 'Live schedule' });
  await schedule.getByRole('button', { name: 'Edit Set table for General prep', exact: true }).click();
  await form.getByLabel('Planned date and time', { exact: true }).fill('2026-11-26T17:30');
  await form.getByLabel('Estimated duration (minutes)', { exact: true }).fill('5');
  await form.getByRole('button', { name: 'Save & Close', exact: true }).click();
  expect((await saved(page)).taskOverrides![custom.id]).toMatchObject({ scheduledAt: '2026-11-26T22:30:00.000Z', durationMinutes: 5 });
  await page.getByRole('region', { name: 'Cooking checklist preview' }).getByRole('article', { name: 'Set table', exact: true }).getByRole('button', { name: 'Edit', exact: true }).click();
  await form.getByLabel('Planned date and time', { exact: true }).fill('');
  await form.getByLabel('Estimated duration (minutes)', { exact: true }).fill('');
  await form.getByRole('button', { name: 'Save & Close', exact: true }).click();
  expect((await saved(page)).taskOverrides![custom.id]).toMatchObject({ scheduledAt: null });
});

test('date editor rejects missing DST times and requires an explicit ambiguous offset', async ({ page }) => {
  const meal = seed();
  await load(page, meal);
  await page.getByRole('button', { name: 'Edit Smoked brisket', exact: true }).click();
  const row = page.getByRole('region', { name: 'Smoked brisket steps' }).getByRole('article').first();
  const taskId = cookTimeline(meal)[0].id;
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  const form = page.getByRole('form', { name: 'Edit step', exact: true });
  await form.getByLabel('Planned date and time', { exact: true }).fill('2026-03-08T02:30');
  await form.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('does not exist');
  await expect(form.getByLabel('Planned date and time', { exact: true })).toHaveValue('2026-03-08T02:30');
  await form.getByLabel('Planned date and time', { exact: true }).fill('2026-11-01T01:30');
  await form.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('UTC offset');
  await form.getByLabel('UTC offset for this time', { exact: true }).selectOption('2026-11-01T06:30:00.000Z');
  await form.getByLabel('Estimated duration (minutes)', { exact: true }).fill('0');
  await form.getByRole('button', { name: 'Save & Close', exact: true }).click();
  expect((await saved(page)).taskOverrides![taskId]).toMatchObject({ scheduledAt: '2026-11-01T06:30:00.000Z', durationMinutes: 0 });
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await form.getByLabel('Instructions', { exact: true }).fill('Keep the second occurrence of 1:30 AM.');
  await form.getByRole('button', { name: 'Save & Close', exact: true }).click();
  expect((await saved(page)).taskOverrides![taskId].scheduledAt).toBe('2026-11-01T06:30:00.000Z');
});
