import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { backend, user, session } from "./fixtures";
import { newMeal, createDish } from "../../src/domain/meal";
import { migrateMeal } from "../../src/domain/cookState";
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
  await page.getByRole('button',{name:'Start with a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();
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

test("finishing recalls immutable history and Cook Again resets recorded events", async ({
  page,
  context,
  browser,
}, testInfo) => {
  const remote = server();
  await remote.attach(context);
  await signIn(page);
  await page.getByRole("button", { name: /Plan a new cook/ }).click();
  await page.getByRole('button',{name:'Start with a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();
  await page.getByLabel("Meal name").fill("Friday brisket");
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start cooking", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Complete Trim the brisket", exact: true })
    .click();
  await expect(page.getByText('Your latest changes are not saved. Keep this tab open and download a backup.',{exact:true})).toHaveCount(0);
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:testInfo.outputPath("account-cooking.png"),fullPage:true});
  const recorded = (remote.state.active as { meal: { events: unknown[] } }).meal
    .events;
  await page
    .getByRole("button", { name: "Finish cook", exact: true })
    .first()
    .click();
  await page
    .getByLabel("How did it turn out? (optional)")
    .fill("Tender with good bark");
  await page
    .getByRole("button", { name: "Save finished cook", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Past cooks and backups/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Past cooks and backups/ }).click();
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
  await recalled.getByRole("button", {name:/Past cooks and backups/}).click();
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
  await page.getByRole('button',{name:'Start with a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  remote.setFail(true);
  await page.getByLabel("Meal name").fill("Keep these unsaved changes");
  await expect(page.getByRole("status", {name:"Saving needs attention", exact:true})).toBeVisible();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Could not reach account saving" }),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "Retry saving", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  expect((remote.state.active as { meal: { name: string } }).meal.name).toBe(
    "Keep these unsaved changes",
  );
});

test("earlier guest cooks import only by choice and stay hidden after account switching", async ({
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
  await page.getByText("Earlier cooks", {exact:true}).click();
  await page
    .getByRole("button", { name: "Import these cooks", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  expect(
    (remote.state.active as { meal: { id: string } } | null)?.meal.id,
  ).toBe(guest.id);
  expect(remote.state.history).toHaveLength(1);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("how-many-beers:meal:v1")!).name,
    ),
  ).toBe("Earlier family brisket");
  await page
    .getByRole("dialog", { name: "Your account" })
    .getByRole("button", { name: "Sign out on this device", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Earlier family brisket", { exact: true }),
  ).toHaveCount(0);
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
  await page.getByRole("button", { name: /Past cooks and backups/ }).click();
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
  await page.getByRole('button',{name:'Start with a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();
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
  await page.getByRole('button',{name:'Start with a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  remote.setFail(true);
  await page.getByLabel("Meal name").fill("Survives an outage");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Could not reach account saving" }),
  ).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(
    page.getByText("Survives an outage", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("status", { name: "Cook saved", exact: true })).toHaveCount(
    0,
  );
  remote.setFail(false);
  await page.getByRole("button", { name: "Retry saving", exact: true }).click();
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
  await page.getByRole('button',{name:'Start with a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start cooking", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Finish cook", exact: true })
    .first()
    .click();
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
  await page
    .getByRole("button", { name: "Retry account saving", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Past cooks and backups/ }),
  ).toBeVisible();
  expect(remote.state.revision).toBe(committedRevision);
  expect(remote.state.history).toHaveLength(1);
  await page.getByRole("button", { name: /Past cooks and backups/ }).click();
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
  await page.getByRole('button',{name:'Start with a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();
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
  await page.getByRole('button',{name:'Start with a template',exact:true}).click();
  await page
    .getByRole("button", { name: "Add smoked brisket", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Cook saved", exact: true }),
  ).toBeVisible();
  remote.setFail(true);
  await page.getByLabel("Meal name").fill("A private pending cook");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Could not reach account saving" }),
  ).toBeVisible();
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

test("account cooks open directly and earlier guest cooks stay optional in the menu", async ({
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
  await page.getByText("Earlier cooks", {exact:true}).click();
  await page.screenshot({path:testInfo.outputPath("account-earlier-cooks-menu.png"),fullPage:true});
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download earlier cooks", exact: true })
    .click();
  const file = await download;
  const { readFile } = await import("node:fs/promises");
  const backup = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(backup.active.name).toBe("Earlier cook for safekeeping");
  expect((remote.state.active as { meal: { name: string } }).meal.name).toBe(
    "Existing account cook",
  );
  page.once("dialog",dialog=>dialog.dismiss());
  await page.getByRole("button",{name:"Import these cooks",exact:true}).click();
  expect((remote.state.active as {meal:{name:string}}).meal.name).toBe("Existing account cook");
  await page.getByRole("button",{name:"Close account",exact:true}).click();
  await page.getByRole("button",{name:/Resume planning/}).click();
  await page.getByLabel("Meal name").fill("Official account cook");
  await expect(page.getByRole("status",{name:"Cook saved",exact:true})).toBeVisible();
  expect((remote.state.active as {meal:{name:string}}).meal.name).toBe("Official account cook");
});


test('signed-in empty planner preserves serving time through cancel and reload',async({page,context},info)=>{
 const remote=server();await remote.attach(context);await signIn(page);
 await page.getByRole('button',{name:/Plan a new cook/}).click();
 await expect(page.getByRole('heading',{name:'What do you want to cook?'})).toBeVisible();
 await page.getByLabel('Serve date and time').fill('2026-12-25T18:00');
 await page.getByRole('button',{name:'Upload a recipe',exact:true}).click();await page.getByRole('button',{name:'Cancel adding',exact:true}).click();
 await expect(page.getByLabel('Serve date and time')).toHaveValue('2026-12-25T18:00');
 await expect(page.getByRole('status',{name:'Cook saved',exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:/Plan a new cook/}).click();
 await expect(page.getByRole('heading',{name:'What do you want to cook?'})).toBeVisible();await expect(page.getByLabel('Serve date and time')).toHaveValue('2026-12-25T18:00');
 await page.screenshot({path:info.outputPath('account-empty-planner.png'),fullPage:true});
 await page.getByRole('button',{name:'Start with a template',exact:true}).click();await page.getByRole('button',{name:'Add smoked brisket',exact:true}).click();
 await expect(page.getByRole('heading',{name:'1 dish in this cook'})).toBeVisible();await expect(page.getByRole('status',{name:'Cook saved',exact:true})).toBeVisible();
});
