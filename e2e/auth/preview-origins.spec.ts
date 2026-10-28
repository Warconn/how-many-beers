import {test, expect, type Page} from '@playwright/test';
import {backend, api, user} from './fixtures';

// Serve the LOCAL application at simulated HTTPS preview origins. All other
// traffic is aborted except the simulated Auth fixture; no hosted site is read.
async function simulatedOrigin(page: Page, origin: string, localBase: string) {
  await page.routeWebSocket('**', socket => socket.close());
  await page.route('**/*', async route => {
    const requested = new URL(route.request().url());
    if (requested.origin !== origin) return route.abort();
    const local = new URL(localBase);
    local.pathname = requested.pathname;
    local.search = requested.search;
    const response = await page.request.get(local.href);
    return route.fulfill({response});
  });
  await backend(page);
  await page.goto(origin + '/');
}

test('different feat aliases sign in with their own callback origin', async ({page, baseURL}) => {
  for (const origin of [
    'https://feat-new-planner.how-many-beers.pages.dev',
    'https://feat-another-history.how-many-beers.pages.dev',
  ]) {
    await simulatedOrigin(page, origin, baseURL!);
    await page.getByRole('button', {name:'Sign in',exact:true}).click();
    const dialog = page.getByRole('dialog', {name:'Your account'});
    await dialog.getByLabel('Email address').fill(user.email);
    const sending = page.waitForRequest(request => request.url().startsWith(api + 'otp'));
    await dialog.getByRole('button', {name:'Send sign-in code',exact:true}).click();
    expect(new URL((await sending).url()).searchParams.get('redirect_to')).toBe(origin + '/account/callback/');
    await dialog.getByLabel('Email code').fill('123456');
    await dialog.getByRole('button', {name:'Verify code',exact:true}).click();
    await expect(dialog.getByText('Signed in as ' + user.email, {exact:true})).toBeVisible();
    await dialog.getByRole('button', {name:'Close account',exact:true}).click();
  }
});

test('unrelated previews and public production do not expose dev sign-in', async ({page, baseURL}) => {
  for (const origin of [
    'https://main.how-many-beers.pages.dev',
    'https://feat-new-planner.other-project.pages.dev',
    'https://howmanybeers.app',
  ]) {
    await simulatedOrigin(page, origin, baseURL!);
    await expect(page.getByRole('button', {name:'Menu',exact:true})).toBeVisible();
    await expect(page.getByRole('button', {name:'Sign in',exact:true})).toHaveCount(0);
  }
});
