# CI and local testing (#54)

## Test levels

Install with `npm ci --no-audit --no-fund` and `npx playwright install --with-deps chromium webkit`.

- Iteration: `npm run test:fast -- e2e/home-cleanup.spec.ts` runs types, all unit tests and the selected browser spec on desktop and mobile. Playwright arguments pass through, including `--grep` and `--config=playwright.accounts.config.ts`. A missing selector fails with usage rather than silently launching everything.
- Offline iteration: `npm run test:offline -- e2e/offline/cook-offline.spec.ts` builds the actual static app and runs the selected checks. Use an existing spec filename from `e2e/offline/`.
- Integration/release: `npm run test:full` runs types, units, mocked sign-in, mocked account saving/recovery, desktop/mobile regression and production-built Android Chromium/iPhone WebKit offline/update tests. Local suites are sequential because Next configurations share `.next`.
- UI changes still require launching the real app, interacting with affected journeys, capturing and inspecting desktop/mobile screenshots, correcting defects and retesting. Fast checks do not replace visual review or full promotion checks.

GitHub runs types/units and four browser suites on isolated runners in parallel for PRs to dev/main, dev pushes and manual runs. No test coverage was removed. The existing `playwright` check is an always-run aggregate and fails if any dependency fails, is skipped or is canceled. Failure in one matrix suite does not cancel the others. Reports/traces/screenshots upload per suite even on failure and remain 14 days. Existing main build and database-security workflows remain intact.

Npm downloads use setup-node caching keyed by package-lock. Browser caching is intentionally deferred: OS dependencies must still install and the measured browser installation is small compared to suite time. Each suite installs only its needed browsers. New commits cancel obsolete PR runs; dev push runs remain intact. PR validation and post-merge dev validation are retained because the integrated commit can differ from the feature commit. Existing main build verification remains a separate release check.

## Review evidence

Download `playwright-<suite>-report` artifacts from Actions. Inspect PNGs and open HTML with `npx playwright show-report <report-directory>`; inspect traces with `npx playwright show-trace <trace.zip>`. Locally use `--headed`, `--ui` or `--trace on` with the relevant Playwright command. Tests that explicitly attach screenshots retain them; ordinary automatic screenshots capture failures. Do not replace reviewed visual evidence with only type/unit checks.

## Baseline

Representative dev run [40758015881](https://github.com/Warconn/how-many-beers/actions/runs/40758015881), October 28, 2026, successful:

| Stage | Seconds |
| --- | ---: |
| Dependency installation | 9 |
| Browser and OS installation | 46 |
| Typecheck | 6 |
| Units | 3 |
| Sign-in | 103 |
| Account saving/recovery | 131 |
| Desktop/mobile regression | 242 |
| Production build + offline/update | 77 |
| Artifact upload | 4 |
| Total job | 628 |

These are GitHub step timestamps, not estimates. Splitting suites should make regression the critical path, with additional runner setup overhead. Improved measured timings will be recorded after the feature run completes.

Cloudflare's check on that dev commit reports identical start/end timestamps (19:52:15 UTC), which cannot establish actual deployment duration. Cloudflare API/dashboard deployment-stage timestamps are unavailable in this task; no deployment-speed improvement is claimed. Cloudflare deploys independently of Actions, so passing Actions is a promotion requirement, not proof that hosting is gated on CI. Hosting settings were not changed.

## Validation

The feature PR must pass all suites, including existing UI and offline/reliability specs. After the reviewed change lands in dev, inspect the separate dev run before full-day owner QA and any main promotion. Production promotion remains separate.

Local validation: typecheck and 136 unit tests pass. Browser download is blocked by the workspace domain policy and local server execution requires additional network permission; browser verification is delegated to the feature CI run.
