# CI and local testing (#54)

## Test levels

Install with `npm ci --no-audit --no-fund` and `npx playwright install --with-deps chromium webkit`.

- Iteration: `npm run test:fast -- e2e/home-cleanup.spec.ts` runs types, all unit tests and the selected browser spec on desktop and mobile. Playwright arguments pass through, including `--grep` and `--config=playwright.accounts.config.ts`. A missing selector fails with usage rather than silently launching everything.
- Offline iteration: `npm run test:offline -- e2e/offline/cook-offline.spec.ts` builds the actual static app and runs the selected checks. Use an existing spec filename from `e2e/offline/`.
- Integration/release: `npm run test:full` runs types, units, mocked sign-in, mocked account saving/recovery, desktop/mobile regression and production-built Android Chromium/iPhone WebKit offline/update tests. Local suites are sequential because Next configurations share `.next`.
- UI changes still require launching the real app, interacting with affected journeys, capturing and inspecting desktop/mobile screenshots, correcting defects and retesting. Fast checks do not replace visual review or full promotion checks.

GitHub runs types/units and four browser suites (regression split over two shards) on isolated runners in parallel for PRs to dev/main, dev pushes and manual runs. No test coverage was removed. The existing `regression` and `playwright` checks are always-run aggregates and fail if any dependency fails, is skipped or is canceled. Failure in one matrix suite does not cancel the others. Reports/traces/screenshots upload per suite even on failure and remain 14 days. Existing main build and database-security workflows remain intact.

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

## Regression sharding follow-up (#71)

The owner approved a focused CI improvement alongside #61/#83. The regression
suite now uses two Playwright shards on isolated runners. `fullyParallel` stays
unchanged; Playwright discovers and partitions the complete configured suite, so
new desktop/mobile/iPhone tests join automatically. The current 257 cases partition
into a disjoint union of 129 and 128. No files, browsers or assertions are removed.
Auth, account and production/offline jobs retain their existing commands and scope.

Both existing gate names are retained. `regression` always runs after both shards
and requires their matrix result to be `success`. The final `playwright` check always
requires types/units, auth/accounts/offline and the regression gate to succeed.
Failed, skipped or canceled work cannot satisfy either gate. `fail-fast: false`
retains the other shard's diagnostics when one fails. Branch protection settings
were not readable with this task's integration, so no hosting/protection changes
are claimed. Main build and PostgreSQL security workflows are untouched.

Regression HTML reports, videos, screenshots and traces upload as
`playwright-regression-1-report` and `playwright-regression-2-report`; other suite
artifact names stay unchanged. The `regression` job combines review images into
the existing small `cooking-review-screenshots` artifact, including evidence from
finished tests if another shard fails. It also includes each shard's JSON timing
report, allowing per-file/browser profiling without downloading large videos.
Combined review upload remains required, and partial evidence never turns a failed
shard green. Actual screenshot inspection remains a review step.

### Measured baseline

Five successful recent runs of the same unsharded workflow, using GitHub API job
and step timestamps. Wall time is workflow creation to final update, including
queue/coordination. Runner-minutes sum actual job started→completed seconds across
all jobs, divided by 60; this is consumed job time, not a GitHub invoice estimate.
Caches below describe the regression job's npm cache; browsers/OS install fresh.

| Run | Regression cases | npm cache | Workflow wall (s) | Regression job (s) | Runner-minutes |
| --- | ---: | --- | ---: | ---: | ---: |
| [41959800717](https://github.com/Warconn/how-many-beers/actions/runs/41959800717) | 257 | Cold/miss | 653 | 645 | 20.83 |
| [41958964075](https://github.com/Warconn/how-many-beers/actions/runs/41958964075) | 257 | Warm/hit | 440 | 433 | 17.83 |
| [41957730149](https://github.com/Warconn/how-many-beers/actions/runs/41957730149) | 257 | Warm/hit | 632 | 597 | 20.88 |
| [41546865267](https://github.com/Warconn/how-many-beers/actions/runs/41546865267) | 253 | Warm/hit | 700 | 688 | 21.02 |
| [41376714922](https://github.com/Warconn/how-many-beers/actions/runs/41376714922) | 253 | Warm/hit | 469 | 439 | 18.78 |

Five-run wall median **632s**, p90 **700s** (nearest-rank, small sample); runner-time
median **20.83min**, p90 **21.02min**. The three identical 257-case runs also have a
632s wall median, with p90 653s. The two older runs have four fewer cases (1.6%) and
are context rather than exact-workload comparisons. Runner variance is substantial;
a small number of faster runs cannot establish a reliable p90 improvement.

Regression test execution took 382–619s, browser/OS install 33–49s and dependency
install 4–8s. Account jobs took 290–326s and are the likely next critical path after
sharding. This supports splitting execution rather than adding browser-cache
maintenance. The additional runner repeats setup and may increase total job time;
measure that tradeoff alongside wall time. Cloudflare deployment timing/gating is
unchanged and no hosting speed improvement is claimed.

### Validation and resulting measurements

Pending the focused feature PR's full CI. Before pushing, actionlint, typecheck and
277 unit tests passed. Local discovery verified exact disjoint shard coverage.
Actual local Chromium sharded runs passed 9 desktop and 9 mobile checks, produced
valid JSON timing reports with zero skipped/flaky cases, and desktop/mobile
screenshots were opened and inspected. Real WebKit, auth/account recovery and
production/offline remain mandatory in full CI.
