import {changeStepDuration} from '../helpers/stepEditing';
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { backend, user, session } from "./fixtures";
import { newMeal, createDish } from "../../src/domain/meal";
import { migrateMeal, type ExtendedMeal } from "../../src/domain/cookState";
import {holdAppFrames,releaseAppFrames} from '../helpers/appFrames';
import { archiveCook, emptyHistory } from "../../src/domain/cookHistory";
const rpc = "https://auth.example.test/rest/v1/rpc/";
type Workspace = {
  revision: number;
  writeId: string | null;
  active: unknown;
  history: unknown[];
};
function server() {
  const state: Workspace = {
      revision: 0,
      writeId: null,
      active: null,
      history: [],
    },
    owners = new Map([[user.id, state]]);
  let fail = false,
    lose = false;
  return {
    state,
    setFail: (value: boolean) => {
      fail = value;
    },
    loseNext: () => {
      lose = true;
    },
    attach: async (context: BrowserContext) => {
      await context.route(rpc + "**", async (route) => {
        const body = route.request().postDataJSON();
        const token = route.request().headers().authorization?.split(" ")[1];
        const subject = token
          ? JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
              .sub
          : null;
        if (body.expected_owner !== subject)
          return route.fulfill({
            status: 403,
            json: { code: "42501", message: "Owner mismatch" },
          });
        if (!owners.has(subject))
          owners.set(subject, {
            revision: 0,
            writeId: null,
            active: null,
            history: [],
          });
        const current = owners.get(subject)!;
        if (fail)
          return route.fulfill({
            status: 503,
            json: { code: "unavailable", message: "Unavailable" },
          });
        if (route.request().url().endsWith("/save_cook_workspace")) {
          if (body.write_id === current.writeId)
            return route.fulfill({ json: current });
          if (body.expected_revision !== current.revision)
            return route.fulfill({
              status: 409,
              json: { code: "40001", message: "Revision conflict" },
            });
          current.active = body.document.active;
          current.history = body.document.history;
          current.revision++;
          current.writeId = body.write_id;
          if (lose) {
            lose = false;
            return route.abort("failed");
          }
        }
        return route.fulfill({ json: current });
      });
    },
  };
}
async function signIn(page: Page, profile = user) {
  await backend(page, { profile });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Your account" });
  await dialog.getByLabel("Email address").fill(profile.email);
  await dialog
    .getByRole("button", { name: "Send sign-in code", exact: true })
    .click();
  await dialog.getByLabel("Email code").fill("123456");
  await dialog
    .getByRole("button", { name: "Verify code", exact: true })
    .click();
  await expect(
    dialog.getByText("Signed in as " + profile.email, { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Close account", exact: true })
    .click();
}
test("a signed-in cook is acknowledged and recovered in a fresh browser context", async ({
  page,
  browser,
  context,
}, testInfo) => {
  const remote = server();
  await remote.attach(context);
  await signIn(page);
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await page.getByRole('button',{name:'Choose a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.locator('.site-header').screenshot({path:testInfo.outputPath('account-saved-header.png')});
  await page.screenshot({path:testInfo.outputPath("account-planning.png"),fullPage:true});
  const other = await browser.newContext();
  await remote.attach(other);
  const next = await other.newPage();
  await backend(next);
  await next.goto("/");
  await next.evaluate(
    ({ value }) =>
      localStorage.setItem("how-many-beers:auth:v1", JSON.stringify(value)),
    {
      value: { ...session(), expires_at: Math.floor(Date.now() / 1000) + 3600 },
    },
  );
  await next.reload();
  await expect(
    next.getByRole("button", { name: /Resume planning/ }),
  ).toBeVisible();
  await next.getByRole("button", { name: /Resume planning/ }).click();
  await expect(
    next.getByRole("button", { name: "Edit Smoked brisket", exact: true }),
  ).toBeVisible();
  await other.close();
});

test('post-add frame preserves an immediate meal-name edit through start, history and Cook Again (#118)',async({page,context},info)=>{
 const remote=server(),oldDish=createDish('side');
 const previous=archiveCook({...newMeal(),name:'Earlier dinner',serveAt:'2026-11-01T18:00:00Z',dishes:[oldDish],events:[{id:'previous-actual',taskId:oldDish.id+':start',kind:'started' as const,occurredAt:'2026-11-01T17:00:00Z'}]} as ExtendedMeal,emptyHistory(),'Keep this history','2026-11-01T19:00:00Z').cooks.map(c=>({...c,serveInstant:new Date(c.meal.serveAt).toISOString()}));
 remote.state.history=structuredClone(previous);await remote.attach(context);await signIn(page);
 await page.getByRole('button',{name:/Plan a new cook/}).click();
 await page.getByLabel('Serve date and time',{exact:true}).fill('2026-11-13T18:00');
 await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add smoked brisket',exact:true}).click();
 await holdAppFrames(page);
 await page.getByRole('button',{name:'Add to meal',exact:true}).click();
 await expect(page.getByRole('region',{name:'Review your method',exact:true})).toHaveCount(0);
 const name=page.getByLabel('Meal name',{exact:true});await name.click();await name.press('ControlOrMeta+A');
 const frames=await releaseAppFrames(page);
 // Type through the real keyboard target, without re-focusing the locator.
 await page.keyboard.type('Friday brisket');
 const focusEvidence=await page.evaluate(frames=>({frames,focused:document.activeElement?.id,name:(document.getElementById('meal-name') as HTMLInputElement)?.value}),frames);
 await info.attach('post-add-focus',{body:JSON.stringify(focusEvidence),contentType:'application/json'});
 await expect(name).toHaveValue('Friday brisket');await expect(name).toBeFocused();
 // Serving edits use the same save path; this does not assert they were lost in
 // the original incident. Start immediately, without waiting for the save icon.
 await page.getByLabel('Serve date and time',{exact:true}).fill('2026-11-13T18:30');
 await page.getByRole('button',{name:'Start cooking',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Friday brisket',exact:true})).toBeVisible();
 const active=()=>remote.state.active as {meal:ExtendedMeal};
 expect(active().meal.name).toBe('Friday brisket');expect(active().meal.serveAt).toBe('2026-11-13T18:30');
 const mealId=active().meal.id;await page.getByRole('checkbox',{name:'Complete Trim brisket',exact:true}).click();
 await expect(page.getByRole('status',{name:'Cook saved',exact:true})).toBeVisible();
 const actuals=structuredClone(active().meal.events);expect(actuals?.length).toBeGreaterThan(0);expect(remote.state.history).toEqual(previous);
 await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();
 expect(active().meal.id).toBe(mealId);expect(active().meal.events).toEqual(actuals);expect(active().meal.name).toBe('Friday brisket');
 await page.getByText('Cook details & tools',{exact:true}).click();await page.getByRole('button',{name:'Finish cook early',exact:true}).click();await page.getByRole('button',{name:'Save finished cook',exact:true}).click();
 await page.getByRole('button',{name:/Past cooks/}).click();await page.getByLabel('Find a past cook').fill('Friday');await page.getByRole('button',{name:'View cook',exact:true}).click();
 const archived=remote.state.history.find(c=>(c as {meal:ExtendedMeal}).meal.id===mealId) as {meal:ExtendedMeal};
 expect(archived.meal.events).toEqual(actuals);expect(archived.meal.serveAt).toBe('2026-11-13T18:30');expect(remote.state.history).toEqual(expect.arrayContaining(previous));
 await page.screenshot({path:info.outputPath('118-preserved-history.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});
 await page.getByRole('button',{name:'Cook again',exact:true}).click();
 expect(active().meal.name).toBe('Friday brisket');expect(active().meal.events).toEqual([]);expect(active().meal.completed).toEqual({});expect(remote.state.history).toEqual(expect.arrayContaining([archived,...previous]));
});

test("finishing recalls immutable history and Cook Again resets recorded events", async ({
  page,
  context,
  browser,
}, testInfo) => {
  const remote = server();
  await remote.attach(context);
  await signIn(page);
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await page.getByRole('button',{name:'Choose a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();
  await page.getByLabel("Meal name").fill("Friday brisket");
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start cooking", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Complete Trim brisket", exact: true })
    .click();
  await expect(page.getByText('Your latest changes are not saved. Keep this tab open and download a backup.',{exact:true})).toHaveCount(0);
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:testInfo.outputPath("account-cooking.png"),fullPage:true});
  const recorded = (remote.state.active as { meal: { events: unknown[] } }).meal
    .events;
  await page.getByText('Cook details & tools',{exact:true}).click();
  await page.getByRole('button',{name:'Finish cook early',exact:true}).click();
  await page
    .getByLabel("How did it turn out? (optional)")
    .fill("Tender with good bark");
  await page
    .getByRole("button", { name: "Save finished cook", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Past cooks/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Past cooks/ }).click();
  await page.getByLabel("Find a past cook").fill("Friday");
  await page.getByRole("button", { name: "View cook", exact: true }).click();
  await expect(
    page.getByText("Tender with good bark", { exact: true }),
  ).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:testInfo.outputPath("account-history.png"),fullPage:true});
  const reader = await browser.newContext();
  await remote.attach(reader);
  const recalled = await reader.newPage();
  await backend(recalled);
  await recalled.goto("/");
  await recalled.evaluate(value => localStorage.setItem("how-many-beers:auth:v1", JSON.stringify(value)), {...session(), expires_at:Math.floor(Date.now()/1000)+3600});
  await recalled.reload();
  await recalled.getByRole("button", {name:/Past cooks/}).click();
  await recalled.getByRole("button", {name:"View cook", exact:true}).click();
  await expect(recalled.getByText("Tender with good bark", {exact:true})).toBeVisible();
  await reader.close();
  const archived = JSON.parse(JSON.stringify(remote.state.history[0]));
  expect((archived as { meal: { events: unknown[] } }).meal.events).toEqual(
    recorded,
  );
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cook again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Resume planning/ }),
  ).toBeVisible();
  expect(
    (remote.state.active as { meal: { events: unknown[] } }).meal.events,
  ).toEqual([]);
  expect(remote.state.history[0]).toEqual(archived);
});

test("failed account writes remain unsaved, block logout and recover through retry", async ({
  page,
  context,
}) => {
  const remote = server();
  await remote.attach(context);
  await signIn(page);
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await page.getByRole('button',{name:'Choose a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  remote.setFail(true);
  await page.getByLabel("Meal name").fill("Keep these unsaved changes");
  await expect(page.getByRole("status", {name:"Saving needs attention", exact:true})).toBeVisible();
  await expect(page.getByRole('status',{name:'Saving needs attention',exact:true})).toBeVisible();await expect(page.locator('#storage-warning')).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Cook saved", exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Account", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Your account" });
  await dialog
    .getByRole("button", { name: "Sign out on this device", exact: true })
    .click();
  await expect(dialog.getByText(/This cook has unsaved changes/)).toBeVisible();
  await dialog
    .getByRole("button", { name: "Close account", exact: true })
    .click();
  remote.setFail(false);
  await page.getByText('Save details',{exact:true}).click();await page.getByRole('button',{name:'Retry account saving',exact:true}).click();
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  expect((remote.state.active as { meal: { name: string } }).meal.name).toBe(
    "Keep these unsaved changes",
  );
});

test("earlier records stay untouched without migration prompts across account switching", async ({
  page,
  context,
}) => {
  const remote = server();
  await remote.attach(context);
  await backend(page);
  await page.goto("/");
  const guest = migrateMeal({
    ...newMeal(),
    name: "Earlier family brisket",
    dishes: [createDish("brisket")],
  });
  const history = archiveCook(
    { ...guest, id: crypto.randomUUID() },
    emptyHistory(),
    "From before accounts",
    "2026-10-28T20:00:00Z",
  );
  await page.evaluate(
    ({ guest, history }) => {
      localStorage.setItem("how-many-beers:meal:v1", JSON.stringify(guest));
      localStorage.setItem(
        "how-many-beers:history:v1",
        JSON.stringify(history),
      );
    },
    { guest, history },
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Resume planning/ }),
  ).toBeVisible();
  await signIn(page);
  await expect(page.getByRole("region", {name:"Choose your account cook"})).toHaveCount(0);
  await expect(page.getByRole("button", {name:/Plan a new cook/})).toBeEnabled();
  expect(remote.state.active).toBeNull();
  await page.getByRole("button", {name:"Account",exact:true}).click();
  await expect(page.getByText("Signed in as "+user.email,{exact:true})).toBeVisible();
  await expect(page.getByText('Earlier cooks',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Import these cooks',exact:true})).toHaveCount(0);
  expect(remote.state.active).toBeNull();expect(remote.state.history).toHaveLength(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!))).toEqual(guest);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:history:v1')!))).toEqual(history);
  await page
    .getByRole("dialog", { name: "Your account" })
    .getByRole("button", { name: "Sign out on this device", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("how-many-beers:meal:v1")!).name)).toBe("Earlier family brisket");
  const other = {
    ...user,
    id: "00000000-0000-4000-8000-000000000002",
    email: "other@example.test",
  };
  await signIn(page, other);
  await expect(
    page.getByRole("button", { name: /Plan a new cook/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Earlier family brisket", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Past cooks/ }).click();
  await expect(
    page.getByText("Earlier family brisket", { exact: true }),
  ).toHaveCount(0);
});

test("a stale device exports pending work and loads the newer account version explicitly", async ({
  page,
  context,
}) => {
  const remote = server();
  await remote.attach(context);
  await signIn(page);
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await page.getByRole('button',{name:'Choose a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  remote.state.revision++;
  (remote.state.active as { meal: { name: string } }).meal.name =
    "Newer phone plan";
  await page.getByLabel("Meal name").fill("Pending laptop plan");
  await expect(
    page.getByRole("region", { name: "Account cook recovery" }),
  ).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByText('Save details',{exact:true}).click();
await page
    .getByRole("button", { name: "Load account version", exact: true })
    .click();
  await expect(
    page.getByText("Newer phone plan", { exact: true }).first(),
  ).toBeVisible();
  expect((remote.state.active as { meal: { name: string } }).meal.name).toBe(
    "Newer phone plan",
  );
});

test("a pending account edit survives reload in IndexedDB and saves after reconnecting", async ({
  page,
  context,
}) => {
  const remote = server();
  await remote.attach(context);
  await signIn(page);
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await page.getByRole('button',{name:'Choose a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  remote.setFail(true);
  await page.getByLabel("Meal name").fill("Survives an outage");
  await expect(page.getByRole('status',{name:'Saving needs attention',exact:true})).toBeVisible();await expect(page.locator('#storage-warning')).toHaveCount(0);
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(
    page.getByText("Survives an outage", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("status", { name: "Cook saved", exact: true })).toHaveCount(
    0,
  );
  remote.setFail(false);
  await page.getByText('Save details',{exact:true}).click();await page.getByRole('button',{name:'Retry account saving',exact:true}).click();
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  expect((remote.state.active as { meal: { name: string } }).meal.name).toBe(
    "Survives an outage",
  );
});

test("an unconfirmed finish retries once without duplicating completed history", async ({
  page,
  context,
}) => {
  const remote = server();
  await remote.attach(context);
  await signIn(page);
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await page.getByRole('button',{name:'Choose a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();
  await page
    .getByRole("button", { name: "Start cooking", exact: true })
    .click();
  await page.getByText('Cook details & tools',{exact:true}).click();
  await page.getByRole('button',{name:'Finish cook early',exact:true}).click();
  await page
    .getByLabel("How did it turn out? (optional)")
    .fill("Preserve this outcome");
  remote.loseNext();
  await page
    .getByRole("button", { name: "Save finished cook", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Account cook recovery" }),
  ).toBeVisible();
  const committedRevision = remote.state.revision;
  await page.getByText('Save details',{exact:true}).click();
await page
    .getByRole("button", { name: "Retry account saving", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Past cooks/ }),
  ).toBeVisible();
  expect(remote.state.revision).toBe(committedRevision);
  expect(remote.state.history).toHaveLength(1);
  await page.getByRole("button", { name: /Past cooks/ }).click();
  await page.getByRole("button", { name: "View cook", exact: true }).click();
  await expect(
    page.getByText("Preserve this outcome", { exact: true }),
  ).toBeVisible();
});

test("guest trial is candid, does not persist cooks, and offers account saving", async ({
  page,
}) => {
  await backend(page);
  await page.goto("/");
  await expect(
    page.getByText(/Guest cooks aren’t kept after you leave/),
  ).toBeVisible();
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await page.getByRole('button',{name:'Choose a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();
  expect(
    await page.evaluate(() => localStorage.getItem("how-many-beers:meal:v1")),
  ).toBeNull();
  await expect(
    page.getByText(/saved on this device|browser-local|stay on this device/i),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Sign in to save plan", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Your account" }),
  ).toBeVisible();
});

test("confirmed logout hides pending work from another account and restores it for its owner", async ({
  page,
  context,
}) => {
  const remote = server();
  await remote.attach(context);
  await signIn(page);
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await page.getByRole('button',{name:'Choose a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  remote.setFail(true);
  await page.getByLabel("Meal name").fill("A private pending cook");
  await expect(page.getByRole('status',{name:'Saving needs attention',exact:true})).toBeVisible();await expect(page.locator('#storage-warning')).toHaveCount(0);
  await page.getByRole("button", { name: "Account", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Your account" });
  await dialog
    .getByRole("button", { name: "Sign out on this device", exact: true })
    .click();
  page.on("dialog", (dialog) => dialog.accept());
  await dialog
    .getByRole("button", { name: "Sign out anyway", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("A private pending cook", { exact: true }),
  ).toHaveCount(0);
  remote.setFail(false);
  await signIn(page, {
    ...user,
    id: "00000000-0000-4000-8000-000000000002",
    email: "other@example.test",
  });
  await expect(
    page.getByText("A private pending cook", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Account", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Your account" });
  await dialog
    .getByRole("button", { name: "Sign out on this device", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await signIn(page);
  await expect(
    page.getByText("A private pending cook", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
});

test("account menu stays clean while earlier records remain untouched", async ({
  page,
  context,
}, testInfo) => {
  const remote = server();
  await remote.attach(context);
  await backend(page);
  await page.goto("/");
  const earlier = migrateMeal({
    ...newMeal(),
    name: "Earlier cook for safekeeping",
    dishes: [createDish("brisket")],
  });
  await page.evaluate(
    (value) =>
      localStorage.setItem("how-many-beers:meal:v1", JSON.stringify(value)),
    earlier,
  );
  await page.reload();
  const current = migrateMeal({
    ...newMeal(),
    name: "Existing account cook",
    dishes: [createDish("brats")],
  });
  remote.state.active = {
    meal: current,
    serveInstant: new Date(current.serveAt).toISOString(),
  };
  remote.state.revision = 1;
  await signIn(page);
  await expect(page.getByRole("region", {name:"Choose your account cook"})).toHaveCount(0);
  await expect(page.getByText("Existing account cook", {exact:true}).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Existing account cook", {exact:true}).first()).toBeVisible();
  await expect(page.getByRole("button", {name:/Resume planning/})).toBeEnabled();
  await expect(page.getByText("Earlier cooks", {exact:true})).toBeHidden();
  await page.screenshot({path:testInfo.outputPath("account-home-clean.png"),fullPage:true});
  await page.getByRole("button", {name:"Account",exact:true}).click();
  await expect(page.getByText("Signed in as "+user.email,{exact:true})).toBeVisible();
  await expect(page.getByText('Earlier cooks',{exact:true})).toHaveCount(0);
  await expect(page.getByText('No update is waiting.',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Download earlier cooks',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Import these cooks',exact:true})).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath('account-clean-menu.png'),fullPage:true});
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!))).toEqual(earlier);
  expect((remote.state.active as {meal:{name:string}}).meal.name).toBe('Existing account cook');
  await page.getByRole("button",{name:"Close account",exact:true}).click();
  await page.getByRole("button",{name:/Resume planning/}).click();
  await page.getByLabel("Meal name").fill("Official account cook");
  await expect(page.getByRole("status",{name:"Cook saved",exact:true})).toBeVisible();
  expect((remote.state.active as {meal:{name:string}}).meal.name).toBe("Official account cook");
});


test('signed-in meal-first planning preserves serving time through cancel and reload',async({page,context},info)=>{
 const remote=server();await remote.attach(context);await signIn(page);
 await page.getByRole('button',{name:/Plan a new cook/}).click();await expect(page.getByRole('heading',{name:'What do you want to cook?'})).toBeVisible();await expect(page.getByLabel('Serve date and time')).toBeVisible();
 await page.getByRole('button',{name:'Add your own recipe',exact:true}).click();await page.getByRole('button',{name:'Cancel adding',exact:true}).click();await expect(page.getByLabel('Serve date and time')).toBeVisible();
 await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add smoked brisket',exact:true}).click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();await page.getByLabel('Serve date and time').fill('2026-12-25T18:00');await expect(page.getByRole('status',{name:'Cook saved',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'+ Add a dish',exact:true}).click();await page.getByRole('button',{name:'Cancel adding',exact:true}).click();await expect(page.getByLabel('Serve date and time')).toHaveValue('2026-12-25T18:00');
 await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await expect(page.getByLabel('Serve date and time')).toHaveValue('2026-12-25T18:00');await expect(page.getByRole('heading',{name:'1 dish in this cook'})).toBeVisible();
 await page.screenshot({path:info.outputPath('account-meal-first-planner.png'),fullPage:true});
});

test('imported duration edits save and reload without changing another dish or history',async({page,context},info)=>{
 const remote=server();await remote.attach(context);await signIn(page);
 await page.getByRole('button',{name:/Plan a new cook/}).click();await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();
 await page.getByLabel('Serve date and time').fill('2026-11-26T00:05');await expect(page.getByRole('status',{name:'Cook saved',exact:true})).toBeVisible();
 const original=JSON.stringify((remote.state.active as {meal:{dishes:unknown[]}}).meal.dishes[0]),history=JSON.stringify(remote.state.history);
 await page.getByRole('button',{name:'+ Add a dish',exact:true}).click();await page.getByRole('button',{name:'Add your own recipe',exact:true}).click();await page.getByLabel('Recipe title').fill('Pumpkin seeds');await page.getByLabel('Recipe instructions').fill('Clean seeds\nRoast seeds\nCool completely');await page.getByRole('button',{name:'Preview recipe steps'}).click();await page.getByRole('button',{name:'Add to meal'}).click();
 await page.getByRole('button',{name:'Edit Pumpkin seeds',exact:true}).click();const steps=page.getByRole('region',{name:'Pumpkin seeds steps',exact:true});
 for(const [name,minutes] of [['Clean seeds','5'],['Roast seeds','15'],['Cool completely','10']]){
  await changeStepDuration(steps.getByRole('article',{name,exact:true}),minutes);
 }
 await expect(page.getByRole('status',{name:'Cook saved',exact:true})).toBeVisible();await expect(steps.getByRole('article',{name:'Clean seeds',exact:true}).locator('time')).toHaveAttribute('datetime',/23:35/);
 expect(JSON.stringify((remote.state.active as {meal:{dishes:unknown[]}}).meal.dishes[0])).toBe(original);expect(JSON.stringify(remote.state.history)).toBe(history);
 await page.screenshot({path:info.outputPath('account-imported-timing.png'),fullPage:true});await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Edit Pumpkin seeds',exact:true}).click();await expect(steps.getByRole('article',{name:'Clean seeds',exact:true})).toContainText('Estimated 5 min');await expect(steps.getByRole('article',{name:'Clean seeds',exact:true}).locator('time')).toHaveAttribute('datetime',/23:35/);
});


test('guest imported durations produce a plan without persisting a trial cook',async({page})=>{
 await backend(page);await page.goto('/');await page.getByRole('button',{name:/Plan a new cook/}).click();await page.getByRole('button',{name:'Add your own recipe',exact:true}).click();await page.getByLabel('Recipe title').fill('Trial seeds');await page.getByLabel('Recipe instructions').fill('Clean seeds\nRoast seeds');await page.getByRole('button',{name:'Preview recipe steps'}).click();await page.getByRole('button',{name:'Add to meal'}).click();await page.getByRole('button',{name:'Edit Trial seeds',exact:true}).click();
 for(const [name,minutes] of [['Clean seeds','5'],['Roast seeds','10']]){
  await changeStepDuration(page.getByRole('region',{name:'Trial seeds steps',exact:true}).getByRole('article',{name,exact:true}),minutes);
 }
 await expect(page.getByRole('region',{name:'Cook duration in beers'}).locator('strong')).toHaveText('0.2');
 expect(await page.evaluate(()=>localStorage.getItem('how-many-beers:meal:v1'))).toBeNull();await page.reload();await expect(page.getByRole('button',{name:/Plan a new cook/})).toBeVisible();await expect(page.getByRole('button',{name:'Edit Trial seeds',exact:true})).toHaveCount(0);
});

test('extracted recipe times save to an account without duration re-entry',async({page,context})=>{
 const remote=server();remote.state.history=archiveCook({...newMeal(),dishes:[createDish('brisket')]},emptyHistory(),'Keep original history','2026-10-28T23:00Z').cooks.map(c=>({...c,serveInstant:c.meal.serveAt}));await remote.attach(context);await signIn(page);
 await page.getByRole('button',{name:/Plan a new cook/}).click();await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();await page.getByLabel('Serve date and time').fill('2026-11-26T00:05');await expect(page.getByRole('status',{name:'Cook saved',exact:true})).toBeVisible();
 const other=JSON.stringify((remote.state.active as {meal:{dishes:unknown[]}}).meal.dishes[0]),history=JSON.stringify(remote.state.history);
 const source='# Seeds\n## Ingredients\n1 cup seeds\n## Equipment\nPellet smoker\n## Source\nFamily notes\n## Instructions\nClean seeds (5 minutes).\nRoast seeds at 425°F for 10–15 minutes.\nCool seeds (10 minutes).';
 await page.getByRole('button',{name:'+ Add a dish',exact:true}).click();await page.getByRole('button',{name:'Add your own recipe',exact:true}).click();await page.getByLabel('Recipe title').fill('Extracted seeds');await page.getByLabel('Recipe instructions').fill(source);await page.getByRole('button',{name:'Preview recipe steps'}).click();const preview=page.getByRole('region',{name:'Review your method'});await expect(preview.getByLabel('Equipment',{exact:true})).toHaveValue('Pellet Smoker');await preview.getByRole('button',{name:'Add to meal',exact:true}).click();await page.getByRole('button',{name:'Edit Extracted seeds',exact:true}).click();await page.getByText('Dish settings',{exact:true}).click();await page.getByText('Ingredients & recipe reference',{exact:true}).click();await page.getByLabel('Ingredients (one per line)').fill('2 cups seeds');await page.getByLabel('Source / notes').fill('Family notes, corrected');await page.getByText('Recipe temperatures',{exact:true}).click();await page.getByRole('spinbutton',{name:'Step 2 temperature 1',exact:true}).fill('450');await expect(page.getByRole('status',{name:'Cook saved',exact:true})).toBeVisible();
 expect(JSON.stringify((remote.state.active as {meal:{dishes:unknown[]}}).meal.dishes[0])).toBe(other);expect(JSON.stringify(remote.state.history)).toBe(history);
 await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Edit Extracted seeds',exact:true}).click();const steps=page.getByRole('region',{name:'Extracted seeds steps',exact:true});await expect(steps.getByRole('article').first()).toContainText('Estimated 5 min');await expect(steps.getByRole('article').first().locator('time')).toHaveAttribute('datetime',/23:35/);await expect(steps.getByRole('article').last()).toHaveAccessibleName('Serve');await page.getByText('Dish settings',{exact:true}).click();await page.getByText('Ingredients & recipe reference',{exact:true}).click();await expect(page.getByLabel('Ingredients (one per line)')).toHaveValue('2 cups seeds');await expect(page.getByLabel('Source / notes')).toHaveValue('Family notes, corrected');await page.getByText('Recipe temperatures',{exact:true}).click();await expect(page.getByRole('spinbutton',{name:'Step 2 temperature 1',exact:true})).toHaveValue('450');await page.getByText('Original recipe',{exact:true}).click();await expect(page.locator('.recipe-original pre')).toHaveText(source);
});

test('guest can accept extracted timings without persisting the recipe',async({page})=>{
 await backend(page);await page.goto('/');await page.getByRole('button',{name:/Plan a new cook/}).click();await page.getByRole('button',{name:'Add your own recipe',exact:true}).click();await page.getByLabel('Recipe title').fill('Guest extracted seeds');await page.getByLabel('Recipe instructions').fill('# Seeds\n## Ingredients\n1 cup seeds\n## Instructions\nClean seeds (5 minutes).\nRoast seeds on pellet smoker at 425°F (10 minutes).');await page.getByRole('button',{name:'Preview recipe steps'}).click();const preview=page.getByRole('region',{name:'Review your method'});await expect(preview.getByLabel('Equipment',{exact:true})).toHaveValue('Pellet Smoker');await preview.getByRole('button',{name:'Add to meal',exact:true}).click();await page.getByRole('button',{name:'Edit Guest extracted seeds',exact:true}).click();await page.getByText('Dish settings',{exact:true}).click();await page.getByText('Ingredients & recipe reference',{exact:true}).click();await page.getByLabel('Ingredients (one per line)').fill('2 cups seeds');await page.getByText('Recipe temperatures',{exact:true}).click();await page.getByRole('spinbutton',{name:'Step 2 temperature 1',exact:true}).fill('450');await expect(page.getByRole('region',{name:'Cook duration in beers'}).locator('strong')).toHaveText('0.2');expect(await page.evaluate(()=>localStorage.getItem('how-many-beers:meal:v1'))).toBeNull();await page.reload();await expect(page.getByRole('button',{name:'Edit Guest extracted seeds',exact:true})).toHaveCount(0);
});

test('live estimates survive account reload without rewriting saved plans, activity or history',async({page,context})=>{
 const {parseRecipeText}=await import('../../src/domain/recipe');const {recordEvent}=await import('../../src/domain/cookState');
 const remote=server(),dish=parseRecipeText('Live seeds','Prep (5 minutes)\nRoast (15 minutes)\nCool (10 minutes)');
 let meal=migrateMeal({...newMeal(),serveAt:'2026-11-01T13:00Z',mode:'cooking',startedAt:'2026-10-29T21:00Z',dishes:[dish]});meal=recordEvent(meal,dish.id+':step-1','completed','2026-10-29T21:03Z');meal=recordEvent(meal,dish.id+':step-2','started','2026-10-29T21:04Z');meal.notes[dish.id+':step-2']='Keep notes';
 remote.state.active={meal,serveInstant:'2026-11-01T13:00:00.000Z'};remote.state.revision=1;
 const archived=archiveCook({...newMeal(),name:'Preserved history',serveAt:'2026-10-28T22:00Z',dishes:[createDish('brats')]},emptyHistory(),'Keep feedback','2026-10-28T23:00Z');remote.state.history=archived.cooks.map(c=>({...c,serveInstant:'2026-10-28T22:00:00.000Z'}));
 await remote.attach(context);await signIn(page);await page.clock.install({time:new Date('2026-10-29T21:08:59Z')});await page.clock.pauseAt(new Date('2026-10-29T21:09Z'));await page.getByRole('button',{name:/Continue cooking/}).click();
 const guide=page.getByRole('region',{name:'Current step',exact:true});await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-29T21:19:00.000Z');await expect(page.getByLabel('Cook estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-29T21:29:00.000Z');await expect(page.getByRole('region',{name:'Cook duration in beers'})).not.toContainText('Projected cook');await page.getByText('Cook details & tools',{exact:true}).click();await expect(page.getByRole('region',{name:'Cooking tools'})).toContainText('Projected total 29 min');const content=()=>JSON.stringify({active:remote.state.active,history:remote.state.history}),before=content(),revision=remote.state.revision;await page.clock.fastForward(60000);await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-29T21:19:00.000Z');expect(content()).toBe(before);expect(remote.state.revision).toBe(revision);await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-29T21:19:00.000Z');expect(content()).toBe(before);
});

test('compact step edits and order survive account saves with advanced options closed',async({page,context})=>{
 const remote=server();await remote.attach(context);await signIn(page);
 await page.getByRole('button',{name:/Plan a new cook/}).click();await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();
 await page.getByRole('button',{name:'Edit Grilled beer-bath brats',exact:true}).click();
 const steps=page.getByRole('region',{name:'Grilled beer-bath brats steps',exact:true}),first=steps.getByRole('article',{name:'Build the brat and vegetable tray',exact:true});
 await first.getByRole('button',{name:/^Edit(?: |$)/}).click();const form=page.getByRole('form',{name:'Edit step',exact:true});
 await form.getByText(/^More options/).click();await form.getByLabel('Planned date and time',{exact:true}).fill('2026-01-01T12:30');await form.getByLabel('Equipment for this step',{exact:true}).fill('Patio grill');await form.getByLabel('Target food temperature (°F)',{exact:true}).fill('165');await form.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('status',{name:'Cook saved',exact:true})).toBeVisible();
 const original=JSON.parse(JSON.stringify((remote.state.active as {meal:unknown}).meal)),id=Object.keys(original.taskOverrides)[0];
 await first.getByRole('button',{name:/^Edit(?: |$)/}).click();await expect(form.getByLabel('Planned date and time',{exact:true})).toBeVisible();await form.getByLabel('Step name').fill('Build the tray carefully');await form.getByLabel('Instructions',{exact:true}).fill('Keep the vegetables covered.');await form.getByRole('button',{name:'Save',exact:true}).click();
 await steps.getByRole('button',{name:'Move Build the tray carefully',exact:true}).press('ArrowDown');await expect(page.getByRole('status',{name:'Cook saved',exact:true})).toBeVisible();
 await expect.poll(()=>(remote.state.active as {meal:typeof original}).meal.taskOverrides[id].title).toBe('Build the tray carefully');
 await expect.poll(()=>(remote.state.active as {meal:typeof original}).meal.taskOrder?.[1]).toBe(id);
 const saved=(remote.state.active as {meal:typeof original}).meal;expect(saved.taskOverrides[id]).toMatchObject({...original.taskOverrides[id],title:'Build the tray carefully',instructions:'Keep the vegetables covered.'});expect(saved.events).toEqual(original.events);expect(saved.completed).toEqual(original.completed);
 await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Edit Grilled beer-bath brats',exact:true}).click();const edited=steps.getByRole('article',{name:'Build the tray carefully',exact:true});await expect(steps.getByRole('article').nth(1)).toHaveAttribute('aria-label','Build the tray carefully');await edited.getByRole('button',{name:/^Edit(?: |$)/}).click();await form.getByText(/^More options/).click();await expect(form.getByLabel('Equipment for this step',{exact:true})).toHaveValue('Patio grill');await expect(form.getByLabel('Planned date and time',{exact:true})).toHaveValue('2026-01-01T12:30');await expect(form.getByLabel('Target food temperature (°F)',{exact:true})).toHaveValue('165');
 await form.getByRole('button',{name:'Cancel',exact:true}).click();
 await edited.getByRole('button',{name:'Change planned time: Build the tray carefully',exact:true}).click();
 const timeForm=edited.getByRole('form',{name:'Edit planned time',exact:true});await timeForm.getByLabel('Planned date and time',{exact:true}).fill('2026-01-01T23:30');await timeForm.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(()=>(remote.state.active as {meal:typeof original}).meal.taskOverrides[id].scheduledAt).toBe('2026-01-01T23:30:00.000Z');
 const final=(remote.state.active as {meal:typeof original}).meal;
 expect(final.taskOverrides[id]).toEqual({...saved.taskOverrides[id],scheduledAt:'2026-01-01T23:30:00.000Z'});expect(final.events).toEqual(saved.events);expect(final.dishes).toEqual(saved.dishes);expect(final.serveAt).toBe(saved.serveAt);
});


test('trial guest sees honest finish choices and can finish without persisting a cook',async({page})=>{
 await backend(page);await page.goto('/');await page.getByRole('button',{name:/Plan a new cook/}).click();await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();await page.getByRole('button',{name:'Start cooking',exact:true}).click();await page.getByText('Cook details & tools',{exact:true}).click();await page.getByRole('button',{name:'Finish cook early',exact:true}).click();const finish=page.getByRole('region',{name:'Finish cook',exact:true});await expect(finish).toContainText('This trial cook is not saved.');await expect(finish.getByRole('button',{name:'Sign in to save this cook',exact:true})).toBeVisible();page.once('dialog',dialog=>dialog.accept());await finish.getByRole('button',{name:'Finish without saving',exact:true}).click();await expect(page.getByRole('button',{name:/Plan a new cook/})).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('how-many-beers:meal:v1'))).toBeNull();
});

test('completed cook has one primary finish and account history retains its actual records',async({page,context})=>{
 const {cookTimeline,recordEvent}=await import('../../src/domain/cookState');const remote=server();let meal=migrateMeal({...newMeal(),name:'Completed brats',serveAt:'2026-11-01T18:00Z',mode:'cooking',startedAt:'2026-11-01T15:00Z',dishes:[createDish('brats')]});for(const t of cookTimeline(meal))meal=recordEvent(meal,t.id,'completed','2026-11-01T18:00Z');meal.notes[cookTimeline(meal)[0].id]='Keep this note';remote.state.active={meal,serveInstant:'2026-11-01T18:00:00.000Z'};remote.state.revision=1;
 await remote.attach(context);await signIn(page);await page.getByRole('button',{name:/Continue cooking/}).click();await expect(page.getByRole('button',{name:'Finish cook',exact:true})).toHaveCount(1);await page.getByRole('button',{name:'Finish cook',exact:true}).click();await page.getByLabel('How did it turn out? (optional)').fill('Good meal');await page.getByRole('button',{name:'Save finished cook',exact:true}).click();await expect.poll(()=>remote.state.history.length).toBe(1);const saved=remote.state.history[0] as {meal:typeof meal;feedback:string};expect(saved.meal.completed).toEqual(meal.completed);expect(saved.meal.notes).toEqual(meal.notes);expect(saved.feedback).toBe('Good meal');expect(saved.meal.events).toEqual(meal.events);
});

test('planning reorder persists its new timing through account reload without altering history',async({page,context})=>{
 const {cookTimeline}=await import('../../src/domain/cookState');const remote=server(),meal=migrateMeal({...newMeal(),serveAt:'2026-11-08T18:00Z',dishes:[createDish('brats'),createDish('side')]});
 remote.state.active={meal,serveInstant:'2026-11-08T18:00:00.000Z'};remote.state.revision=1;
 const archived=archiveCook({...newMeal(),dishes:[createDish('brats')]},emptyHistory(),'Original feedback','2026-10-28T23:00Z');remote.state.history=archived.cooks.map(c=>({...c,serveInstant:'2026-10-28T22:00:00.000Z'}));const history=JSON.stringify(remote.state.history),other=JSON.stringify(meal.dishes[1]);
 await remote.attach(context);await signIn(page);await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Edit Grilled beer-bath brats',exact:true}).click();const region=page.getByRole('region',{name:'Grilled beer-bath brats steps',exact:true});await region.getByRole('button',{name:'Move Preheat grill to 250°F',exact:true}).press('ArrowUp');
 await expect.poll(()=>(remote.state.active as {meal:typeof meal}).meal.dishes[0].planningSequence?.[0]).toBe('preheat');await expect(page.getByRole('status',{name:'Cook saved',exact:true})).toBeVisible();
 const saved=(remote.state.active as {meal:typeof meal}).meal,tasks=cookTimeline(saved).filter(t=>t.dishId===meal.dishes[0].id);expect(tasks[0].scheduledAt).toBe('2026-11-08T15:05:00.000Z');expect(tasks[1].scheduledAt).toBe('2026-11-08T15:25:00.000Z');expect(JSON.stringify(saved.dishes[1])).toBe(other);expect(JSON.stringify(remote.state.history)).toBe(history);expect(saved.events).toEqual(meal.events);
 await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Edit Grilled beer-bath brats',exact:true}).click();await expect(region.getByRole('article').first()).toHaveAttribute('aria-label','Preheat grill to 250°F');expect(cookTimeline((remote.state.active as {meal:typeof meal}).meal)).toEqual(cookTimeline(saved));expect(JSON.stringify(remote.state.history)).toBe(history);
});

test('unrestricted planning sequence and changed duration survive account reload with history intact',async({page,context})=>{
 const {cookTimeline,recordEvent}=await import('../../src/domain/cookState');const remote=server(),meal=migrateMeal({...newMeal(),serveAt:'2026-11-08T18:00Z',dishes:[createDish('brats'),createDish('side')]});
 const prep=cookTimeline(meal).find(t=>t.id===meal.dishes[0].id+':prep')!;meal.taskOverrides={[prep.id]:{scheduledAt:'2026-11-08T12:00:00.000Z'}};remote.state.active={meal,serveInstant:'2026-11-08T18:00:00.000Z'};remote.state.revision=1;
 let old=migrateMeal({...newMeal(),dishes:[createDish('brisket')]});old=recordEvent(old,cookTimeline(old)[0].id,'completed','2026-10-28T12:00Z');old.notes[cookTimeline(old)[0].id]='Original notes';remote.state.history=archiveCook(old,emptyHistory(),'Original feedback','2026-10-28T23:00Z').cooks.map(c=>({...c,serveInstant:'2026-10-28T22:00:00.000Z'}));const history=JSON.stringify(remote.state.history),other=JSON.stringify(meal.dishes[1]);
 await remote.attach(context);await signIn(page);await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Edit Grilled beer-bath brats',exact:true}).click();const region=page.getByRole('region',{name:'Grilled beer-bath brats steps',exact:true});await region.getByRole('button',{name:'Move Cover and cook the brat tray',exact:true}).press('ArrowUp');const cook=region.getByRole('article',{name:'Cover and cook the brat tray',exact:true});await cook.getByRole('button',{name:/^Edit(?: |$)/}).click();const form=page.getByRole('form',{name:'Edit step',exact:true});await form.getByText(/^More options/).click();await form.getByLabel('Duration unit',{exact:true}).selectOption('minutes');await form.getByLabel('Estimated duration (minutes)',{exact:true}).fill('150');await form.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(()=>(remote.state.active as {meal:typeof meal}).meal.taskOverrides?.[meal.dishes[0].id+':start']?.durationMinutes).toBe(150);await expect(page.getByRole('status',{name:'Cook saved',exact:true})).toBeVisible();const saved=(remote.state.active as {meal:typeof meal}).meal,tasks=cookTimeline(saved).filter(t=>t.dishId===meal.dishes[0].id);expect(tasks.slice(0,3).map(t=>t.scheduledAt)).toEqual(['2026-11-08T12:00:00.000Z','2026-11-08T12:20:00.000Z','2026-11-08T14:50:00.000Z']);expect(JSON.stringify(saved.dishes[1])).toBe(other);expect(JSON.stringify(remote.state.history)).toBe(history);expect(saved.events).toEqual(meal.events);
 await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();expect(cookTimeline((remote.state.active as {meal:typeof meal}).meal)).toEqual(cookTimeline(saved));expect(JSON.stringify(remote.state.history)).toBe(history);
});

test('another tab shows one accurate save notice without duplicate recovery panels',async({page,context},info)=>{
 const remote=server();await remote.attach(context);await signIn(page);
 await page.getByRole('button',{name:/Plan a new cook/}).click();
 await page.getByRole('button',{name:'Choose a template',exact:true}).click();
 await page.getByRole('button',{name:'Add smoked brisket',exact:true}).click();
 await page.getByRole('button',{name:'Add to meal',exact:true}).click();
 await expect(page.getByRole('status',{name:'Cook saved',exact:true})).toBeVisible();
 const before=JSON.stringify(remote.state),other=await context.newPage();await backend(other);await other.goto('/');
 const notice=other.getByRole('region',{name:'Account cook recovery',exact:true});
 await expect(notice).toHaveCount(1);await expect(notice).toContainText('This cook is open in another tab.');
 await expect(other.locator('#storage-warning')).toHaveCount(0);
 await expect(other.getByText('Keep your cook safe',{exact:true})).toHaveCount(0);
 await expect(other.getByText('Another device has a newer version.',{exact:false})).toHaveCount(0);
 await expect(other.getByRole('button',{name:'Retry account saving',exact:true})).toBeHidden();
 await other.screenshot({path:info.outputPath('single-tab-notice.png'),fullPage:false});
 await notice.getByText('Save details',{exact:true}).click();await expect(notice.getByRole('button',{name:'Download backup',exact:true})).toBeVisible();
 expect(JSON.stringify(remote.state)).toBe(before);await other.close();
});
