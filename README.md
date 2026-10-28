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
- **The Beerometer.** A prominent banner stays visible through planning and cooking, showing the selected dish’s cook duration in beers and hours. The playful time scale is explicit: one beer equals 90 minutes.

**Timing is guidance, not a food-safety decision.** Estimated step times and recipe templates cannot confirm that food is cooked or held safely. Use actual checks and appropriate food-safety guidance.

### Your cooks stay on this device

How Many Beers currently saves your active plan, progress, and cook history **in this browser's local storage**. You can refresh or return later in the same browser and site without an account.

There is **no automatic account sync or transfer between devices or browsers**. Clearing browser/site data, using a private browsing session, or changing to a different site origin can leave those saved cooks unavailable. Use the in-app **JSON backup/export** if you want a copy you can restore. Browser-local storage is convenient, but it is not a cloud backup.

### Offline cooking and recovery

Offline files prepare in the background after an online visit. You can keep using an existing cook, record progress and finish/save it without a connection once the shell is cached. The app has no install/offline help panel or routine readiness messages. Browser storage and cached files can still be cleared or evicted.

Routine save-status labels are hidden. If a write fails, keep the tab open, download a backup and retry. Unreadable saved data opens a protected recovery screen instead of being replaced. App updates wait for an explicit reload, with open drafts protected. Keep one cooking tab open; another tab's newer data must be reloaded before saving. See [offline reliability and recovery](docs/offline-reliability.md) for behavior and test coverage.

## Run it locally

The project uses **Next.js, React, and TypeScript**. Use Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
```

The build uses Next.js static export. The canonical production site is https://howmanybeers.app on Cloudflare. `dev` is the integration and QA branch; `main` is the stable release branch. GitHub Pages is a legacy deployment target. Set `DEPLOY_TARGET=cloudflare` for a domain-root build; the legacy build uses `/how-many-beers/`. See [agent/development guidance](AGENTS.md) for the branch and review workflow.

## Current work queue

The immediate coding sequence is **#50 Home cleanup → #19 free account foundation → #20 initial account-backed cooks/history**. The Home implementation is merged into dev for final QA. QA/reliability, timing validation and branding verification run alongside account work. Timers, URL import, deeper scheduling and advanced sync remain **Next**, with their order chosen separately. See [the detailed work queue](docs/work-queue.md) and [agent guidance](AGENTS.md).

## Account foundation work

The first #19 delivery adds a private cook schema and database ownership tests; sign-in and cloud saving are not enabled yet. See [account setup, Free-plan limits and security gates](docs/account-foundation.md). Run `bash scripts/test-account-security.sh` to exercise the migration against isolated PostgreSQL with Docker.

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
