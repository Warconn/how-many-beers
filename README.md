# How Many Beers?

![How Many Beers? beer-clock mark](public/brand/wordmark.svg)

**From First Beer to First Bite.**

Plan every dish. Time your dinner. Enjoy the cook.

Cooking dinner is easier when everything works toward the same finish line. **How Many Beers** helps you plan a meal, coordinate multiple dishes in one schedule, and follow a guided checklist when it's time to cook. Less juggling recipes and timelines. More enjoying the cook.

**[Launch How Many Beers](https://howmanybeers.app)** · [Dev preview for QA](https://dev.how-many-beers.pages.dev/) · [Share feedback or report a bug](https://github.com/Warconn/how-many-beers/issues)

## One dinner. One game plan.

1. **Set serving time.** Pick when you want to eat. Build your plan around dinner, not a pile of separate recipes.
2. **Add dishes.** Choose a starter cooking method or add your own instructions. Put brisket, brats, wings, turkey, or other dishes into the same cook.
3. **Adjust the plan.** See every dish together in the **Live Schedule**. Fine-tune steps, dates, estimated durations, and equipment notes without losing sight of the whole meal.
4. **Cook.** Follow the current step in **Cooking Mode**, preview what's next, or open the full checklist. Check off progress, add notes, and log temperature readings as you go.

## A look at the app

These desktop and mobile screenshots show the current dev workspace, including the prominent Beerometer. Dev changes receive final QA before promotion to production.

| Plan your dinner | Follow the cook |
| --- | --- |
| ![Desktop meal planner showing a cooking plan and save-for-later controls](docs/screenshots/beerometer-planning-desktop.png) | ![Guided cooking experience on desktop](docs/screenshots/beerometer-cooking-desktop.png) |
| ![Mobile meal planner](docs/screenshots/beerometer-planning-mobile.png) | ![Guided cooking experience on mobile](docs/screenshots/beerometer-cooking-mobile.png) |

## What works today

- **A meal with multiple dishes.** Add several dishes to one cook and see a combined chronological schedule.
- **Personal cooking templates.** Brisket with SPG/Cow Cover and staged smoker heat, brined oven turkey with advance thawing preparation, and covered beer-bath brats finished on the Blackstone. Timings remain editable; see [method notes](docs/personal-templates.md).
- **Starter recipes and your own instructions.** Start from built-in methods, paste recipe text, or import a `.txt` or `.md` file. Text import is basic and may need review.
- **An adjustable cooking plan.** Edit dish steps, timing, durations, and planning notes. Changes appear in the shared schedule. Some duration changes move later timed steps in the same dish, but this is not a full automatic dependency or equipment optimizer.
- **Guided Cooking Mode.** Work through the current step, preview the next, check the complete list, record temperatures and notes, and resume a cook in progress.
- **Save, finish, and repeat.** Save a plan for later, keep a cook in progress, and explicitly finish and archive completed cooks. Review history, repeat a past cook, or export and restore a JSON backup.
- **The Beerometer.** Measures the whole multi-dish cook, including advance prep, with estimated beers remaining during cooking, zero once all steps are checked, and separate total/elapsed/actual readings.

**Timing is guidance, not a food-safety decision.** Estimated step times and recipe templates cannot confirm that food is cooked or held safely. Use actual checks and appropriate food-safety guidance.

### Saving and recovery

The account feature preview supports one saved active/planning cook, completed history and retrieval on another device. It is opt-in and requires the dev setup below; production/default builds retain existing browser-backed saving until rollout. In account-enabled builds, new guests can try planning and cooking without persistent saves. Optional earlier-cook import/backup tools live in Account → Earlier cooks. Sign-in opens account cooks directly.

Account edits save automatically. A compact header icon shows saved, saving or attention states, with accessible labels; failures offer retry/export. Keep the tab open when saving needs attention. Stale devices cannot silently overwrite newer account data. Offline files still prepare in the background after an online visit; there are no install/offline help panels or routine device-save labels. Browser data can be cleared or evicted, so keep JSON backups. Private account cache requires verified sign-in after a cold reload; extended concurrent/offline synchronization remains future work. See [account saving and recovery](docs/account-cooks.md) and [existing offline behavior](docs/offline-reliability.md).

## Run it locally

The project uses **Next.js, React, and TypeScript**. Use Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For focused iteration, run `npm run test:fast -- e2e/home-cleanup.spec.ts` (typecheck, unit tests and desktop/mobile browsers). Use the affected spec or account config. Before integration/release, run `npm run test:full` to include auth, account recovery, full regression and production-built offline checks. See [CI testing and timing evidence](docs/ci-testing.md).

To validate a change:

```bash
npm run typecheck
npm run test
npm run build
```

For browser regression tests, install Playwright’s Chromium and WebKit browsers and run:

```bash
npx playwright install chromium webkit
npm run test:e2e
npm run test:offline
npx playwright test --config playwright.auth.config.ts
npx playwright test --config playwright.accounts.config.ts
```

The build uses Next.js static export. The canonical production site is https://howmanybeers.app on Cloudflare. `dev` is the integration and QA branch; `main` is the stable release branch. GitHub Pages is a legacy deployment target. Set `DEPLOY_TARGET=cloudflare` for a domain-root build; the legacy build uses `/how-many-beers/`. See [agent/development guidance](AGENTS.md) for the branch and review workflow.

## Current work queue

The immediate coding sequence is **#50 Home cleanup → #19 free account foundation → #20 initial account-backed cooks/history**. The Home implementation is merged into dev for final QA. QA/reliability, timing validation and branding verification run alongside account work. Timers, URL import, deeper scheduling and advanced sync remain **Next**, with their order chosen separately. See [the detailed work queue](docs/work-queue.md) and [agent guidance](AGENTS.md).

## Account foundation work

The #19/#20 delivery merged into dev adds verified email-code sign-in, owner-only transactional account saving and searchable completed history. The shared account dialog preserves cooking drafts. Google/Apple remain optional and unconfigured in dev. Accounts and cloud cooks default to disabled; enable only after applying the reviewed migrations and configuring the preview. The owner has confirmed live dev email-link sign-in; code-only delivery needs the Supabase template update, and hosted cloud-save/two-account QA remains pending.

See [account setup and security gates](docs/account-foundation.md) and [account cooks setup, architecture and limits](docs/account-cooks.md). Run `bash scripts/test-account-security.sh` to test both migrations against isolated PostgreSQL with Docker. This feature is merged into dev and has not been released to production. Follow [dev versus feature account setup](docs/dev-account-testing.md) to configure Preview variables and Supabase URLs, including automatic access for future `feat/*` previews.

## Documentation

- [Work queue](docs/work-queue.md): tonight’s priority and the prepared implementation order
- [Core cooking experience](docs/core-cook-experience.md): product flows and interaction principles
- [Cooking Mode](docs/cooking-mode.md): guided steps, progress, and finishing
- [Step timing](docs/step-timing.md): edits, duration handling, and schedule limitations
- [Saved plans](docs/saved-plans.md): browser-local persistence and resuming
- [Offline reliability](docs/offline-reliability.md): installation, offline use, recovery and regression tests
- [Brisket estimates](docs/brisket-estimates.md): method assumptions and uncertainty
- [GitHub Issues](https://github.com/Warconn/how-many-beers/issues): bugs, enhancements, release work, and planned capabilities

This repository is public, but no open-source license has been selected. Public visibility does not grant general permission to reuse the code.
