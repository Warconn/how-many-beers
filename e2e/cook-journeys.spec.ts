import {test, expect, type Page} from '@playwright/test';
import type {ExtendedMeal} from '../src/domain/cookState';
import type {HistoryLibrary} from '../src/domain/cookHistory';

test.use({timezoneId: 'America/New_York'});
// These scenarios exercise multiple full user journeys, rather than increasing
// assertion timeouts or waiting longer for a missing edit/save.
test.setTimeout(60_000);
const readMeal = (page: Page) => page.evaluate<ExtendedMeal>(() =>
  JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
const readHistory = (page: Page) => page.evaluate<HistoryLibrary>(() =>
  JSON.parse(localStorage.getItem('how-many-beers:history:v1')!));
async function begin(page: Page, at: string, name: string) {
  await page.clock.install({time: new Date(at)});
  await page.clock.pauseAt(new Date(at));
  await page.goto('/');
  await page.getByRole('button', {name: /Plan a cook/}).click();
  await page.getByLabel('Serve date and time', {exact: true}).fill('2026-11-08T13:00');
  await page.getByLabel('Meal name', {exact: true}).fill(name);
}
async function addTemplate(page: Page, title: string) {
  await page.getByRole('button', {name: 'Choose a template', exact: true}).click();
  await page.getByRole('button', {name: title, exact: true}).click();
  await page.getByRole('button', {name: 'Add to meal', exact: true}).click();
}

test('overnight brisket from a new plan keeps actuals, an expired estimate and Hold until serving honest', async ({page}, info) => {
  await begin(page, '2026-11-08T03:00:00Z', 'Browns Brisket rehearsal');
  await addTemplate(page, 'Add smoked brisket');
  await page.getByRole('button', {name: 'Edit Smoked brisket', exact: true}).click();
  const editor = page.getByRole('region', {name: 'Dish editor', exact: true});
  await editor.getByText('Dish settings', {exact: true}).click();
  await editor.getByLabel('Brisket weight (lb)', {exact: true}).fill('7');
  await editor.getByRole('button', {name: 'Use recommended timing', exact: true}).click();
  const plan = await readMeal(page), dish = plan.dishes[0], loadId = dish.id + ':start';
  expect(dish.cookMinutes).toBe(480);
  const steps = page.getByRole('region', {name: 'Smoked brisket steps', exact: true});
  await steps.getByRole('button', {name: 'Change planned time: Put brisket on smoker', exact: true}).click();
  const timeForm = steps.getByRole('form', {name: 'Edit planned time', exact: true});
  await timeForm.getByLabel('Planned date and time', {exact: true}).fill('2026-11-07T23:34');
  await timeForm.getByRole('button', {name: 'Save', exact: true}).click();
  const edited = await readMeal(page);
  expect(edited.taskOverrides?.[loadId]).toEqual({scheduledAt: '2026-11-08T04:34:00.000Z'});
  expect(edited.dishes).toEqual(plan.dishes);
  expect(edited.serveAt).toBe('2026-11-08T13:00');
  await page.getByRole('button', {name: 'Save plan for later', exact: true}).click();
  await page.reload();
  await page.getByRole('button', {name: /Resume planning/}).click();
  expect(await readMeal(page)).toEqual(edited);
  await page.getByRole('button', {name: 'Start cooking', exact: true}).click();
  const current = page.getByRole('region', {name: 'Current step', exact: true});
  for (const title of ['Trim brisket', 'Season brisket', 'Preheat smoker']) {
    await current.getByRole('checkbox', {name: 'Complete ' + title, exact: true}).click();
  }
  await page.clock.fastForward(94 * 60_000); // Saturday 11:34 PM local.
  await current.getByRole('checkbox', {name: 'Complete Put brisket on smoker', exact: true}).click();
  const loaded = await readMeal(page);
  expect(loaded.events?.find(e => e.taskId === loadId && e.kind === 'completed')?.occurredAt).toBe('2026-11-08T04:34:00.000Z');
  await page.clock.fastForward(8.5 * 3_600_000); // Beyond the 8-hour planning estimate.
  await expect(current.getByRole('checkbox', {name: 'Complete Check bark and temperature', exact: true})).not.toBeChecked();
  const overdue = await readMeal(page);
  expect(overdue.events).toEqual(loaded.events);
  expect(overdue.completed[dish.id + ':finish']).toBeUndefined();
  expect(overdue.mode).toBe('cooking');
  for (const title of ['Check bark and temperature', 'Wrap when bark is ready']) {
    await current.getByRole('checkbox', {name: 'Complete ' + title, exact: true}).click();
  }
  await page.clock.fastForward(15 * 60_000); // Probe-tender and pulled at 8:19 AM.
  await current.getByRole('checkbox', {name: 'Complete Probe for tenderness', exact: true}).click();
  const hold = current.getByRole('checkbox', {name: 'Complete Hold until serving', exact: true});
  await expect(hold).not.toBeChecked();
  const holding = await readMeal(page);
  expect(holding.events?.find(e => e.taskId === dish.id + ':finish' && e.kind === 'completed')?.occurredAt).toBe('2026-11-08T13:19:00.000Z');
  await page.clock.fastForward(60 * 60_000);
  await page.reload();
  await page.getByRole('button', {name: /Continue cooking/}).click();
  await expect(hold).not.toBeChecked();
  expect((await readMeal(page)).events).toEqual(holding.events);
  await page.clock.fastForward(221 * 60_000); // Sunday 1 PM, still on Hold.
  await expect(hold).not.toBeChecked();
  await expect(current.getByRole('article')).toHaveAccessibleName('Hold until serving');
  expect((await readMeal(page)).events).toEqual(holding.events);
  await current.screenshot({path: info.outputPath('overnight-hold.png'), scale: 'css', style: 'nextjs-portal{display:none}'});
  await page.getByText('Cook details & tools', {exact: true}).click();
  await page.getByRole('button', {name: 'Finish cook early', exact: true}).click();
  await page.getByLabel('How did it turn out? (optional)').fill('Served after the flexible hold.');
  await page.getByRole('button', {name: 'Save finished cook', exact: true}).click();
  const archive = (await readHistory(page)).cooks.find(c => c.id === edited.id)!;
  expect(archive.meal.events).toEqual(holding.events);
  expect(archive.meal.dishes).toEqual(plan.dishes);
  expect(archive.meal.serveAt).toBe(edited.serveAt);
  expect(archive.meal.taskOverrides).toEqual(holding.taskOverrides);
  expect(archive.meal.completed[dish.id + ':rest']).toBeUndefined();
  expect(archive.archivedAt).toBe('2026-11-08T18:00:00.000Z');
  await page.getByRole('button', {name: /Past cooks/}).click();
  await page.getByLabel('Find a past cook').fill('Browns Brisket rehearsal');
  await page.getByRole('button', {name: 'View cook', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Saved cook details'})).toContainText('Served after the flexible hold.');
});

test('a template plus an uploaded recipe finishes as one meal and Cook Again creates independent fresh dishes', async ({page}, info) => {
  await begin(page, '2026-11-08T15:00:00Z', 'Brats and pumpkin seeds');
  await addTemplate(page, 'Add grilled beer-bath brats');
  await page.getByRole('button', {name: '+ Add a dish', exact: true}).click();
  await page.getByRole('button', {name: 'Add your own recipe', exact: true}).click();
  await page.getByLabel('Upload .txt or .md', {exact: true}).setInputFiles({
    name: 'Pumpkin seeds.md', mimeType: 'text/markdown',
    buffer: Buffer.from('# Pumpkin seeds\n## Instructions\n1. Season seeds (5 minutes).\n2. Roast seeds (15 minutes).\n3. Remove seeds and cool (10 minutes).')
  });
  await page.getByRole('button', {name: 'Preview recipe steps', exact: true}).click();
  await page.getByRole('button', {name: 'Add to meal', exact: true}).click();
  await expect(page.locator('.workspace-dish')).toHaveCount(2);
  const planned = await readMeal(page);
  expect(planned.dishes.map(d => d.name)).toEqual(['Grilled beer-bath brats', 'Pumpkin seeds']);
  await page.getByRole('button', {name: 'Save plan for later', exact: true}).click();
  await page.reload();
  await page.getByRole('button', {name: 'Start cooking', exact: true}).click();
  await page.getByRole('button', {name: 'Full checklist', exact: true}).click();
  const list = page.getByRole('region', {name: 'Full cook checklist', exact: true});
  for (const checkbox of await list.getByRole('checkbox').all()) {
    await page.clock.fastForward(60_000);
    await checkbox.check();
  }
  const finished = await readMeal(page);
  for (const dish of planned.dishes) {
    expect(finished.events?.some(e => e.taskId.startsWith(dish.id + ':') && e.kind === 'completed')).toBe(true);
  }
  // Completing the cooling action starts passive work; elapsed time is not an archive.
  await page.clock.fastForward(10 * 60_000);
  expect((await readMeal(page)).mode).toBe('cooking');
  expect((await readMeal(page)).events).toEqual(finished.events);
  await expect(page.getByRole('button', {name: 'Finish cook', exact: true})).toHaveCount(1);
  await page.getByRole('button', {name: 'Finish cook', exact: true}).click();
  await page.getByRole('button', {name: 'Save finished cook', exact: true}).click();
  await page.getByRole('button', {name: /Past cooks/}).click();
  await page.getByRole('button', {name: 'View cook', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Saved cook details'})).toContainText('Pumpkin seeds');
  const archived = (await readHistory(page)).cooks[0];
  expect(archived.meal.events).toEqual(finished.events);
  expect(archived.meal.dishes).toEqual(planned.dishes);
  await page.screenshot({path: info.outputPath('mixed-meal-history.png'), fullPage: true, scale: 'css', style: 'nextjs-portal{display:none}'});
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', {name: 'Cook again', exact: true}).click();
  await expect(page.getByRole('button', {name: /Resume planning/})).toBeVisible();
  const repeated = await readMeal(page);
  expect(repeated.id).not.toBe(planned.id);
  expect(repeated.dishes.map(d => d.name)).toEqual(planned.dishes.map(d => d.name));
  expect(repeated.dishes.every(d => !planned.dishes.some(old => old.id === d.id))).toBe(true);
  expect(repeated.events).toEqual([]);
  expect(repeated.completed).toEqual({});
  expect((await readHistory(page)).cooks[0]).toEqual(archived);
  await page.reload();
  await page.getByRole('button', {name: /Resume planning/}).click();
  await expect(page.locator('.workspace-dish')).toHaveCount(2);
  expect((await readMeal(page)).dishes).toEqual(repeated.dishes);
});
