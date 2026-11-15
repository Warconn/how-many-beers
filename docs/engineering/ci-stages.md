# CI stages and release confidence

## Purpose

Fast, meaningful feedback on every incremental change, while retaining full
regression verification before merging a review-ready PR to dev or main. This
change is **CI-only**: no migrations, production deploys, or application behavior.

## Stage 1: incremental feedback (every push to a draft or ready PR)

- **Types and unit tests**: `npm run typecheck` and `npm run test` on every PR commit.
- **Critical browser smoke**: existing real UI Playwright journeys in desktop
  Chromium, including guest Home/resume, orphaned-plan discard after reload,
  and rejected recipe-save recovery. The tests use synthetic account fixtures,
  not hosted customer data.
- **Local change-specific test**: the developer/Codex runs
  `npm run test:fast -- <changed spec file> --config=<appropriate config>`
  before each push. The CI smoke is deliberately small and does not replace
  targeted tests for changed areas.
- Keep the PR **draft** during incremental iteration. GitHub does not allow a
  draft PR to merge. Converting it to ready explicitly starts Stage 2.

## Stage 2: release-grade full regression (ready PRs, dev/main pushes, manual dispatch)

- Keep existing aggregated required check name **playwright**. It requires
  type/unit, smoke, all browser suites, screenshot collection, and regression
  shards to succeed. A failed or canceled shard fails the aggregate; skipped
  full jobs are never represented as a completed green aggregate.
- **Account Chromium** and **account iPhone WebKit** run concurrently: one
  desktop job plus two independent iPhone WebKit shards, with one Playwright
  worker per job. All four account test files and their cases run on both
  projects unchanged, with iPhone cases partitioned across its two jobs. The account screenshot artifacts are
  independently available and combined into the existing
  `account-review-screenshots` artifact.
- Authentication and offline browser tests keep previous coverage and runner
  OS; general regression is spread over three shards rather than two. Account SQL ownership/RLS tests
  remain in `account-security.yml` for relevant changes and branch pushes.
- Ready PRs into **dev or main** trigger this stage. Full regression also runs
  on pushes to **dev and main** to record integration/release results.
  `ci.yml` separately builds, checks types and runs unit tests for main PRs
  and main pushes.

## Production boundary

The Cloudflare production project deploys from `main` independently of
GitHub Actions. Running full tests on main *after* a push is observability, not
pre-deployment gating. Production safety therefore requires GitHub branch
protection for `main` with at least `playwright`, build verification, and
applicable security checks as required conditions for main PR merges, or a
Cloudflare deployment gate configured outside this repository. Verify those
settings in GitHub/Cloudflare before claiming they are enforced. CI cannot
verify live Supabase account state or a real user's browser IndexedDB.

## Performance evidence and guardrails

- Pre-change run #43674737260: full CI 16m 08s, accounts 15m 33s,
  two regression shards 6m 15s and 6m 51s. Previous account suite 13m 33s
  on #43665831154. Parallel account jobs are expected to reduce the critical
  path, but the actual improvement must be measured from green runs.
- Preserve traces/screenshots and all desktop/iPhone coverage; do not remove
  tests to make the pipeline green. Measure end-to-end wall time and runner
  minutes because extra parallelism increases concurrent runner cost.
- Draft mode avoids repeatedly restarting the entire full suite during normal
  iteration. A ready PR with a new commit still reruns the full suite, and a
  release PR must not merge before every required check is green.
- Compare at least three, ideally five, comparable green full runs to compute
  median and p90, and track the slowest shard/runner minute overhead.

## Iteration 2 measured decision

The first staged-CI ready-PR run, #43676779271, passed every check in
**11m 03s** (31.5% faster than the 16m 08s baseline). Desktop account tests
finished in 7m 14s, but iPhone account tests took 10m 44s and the slowest
regression shard 9m 08s. This exposed two new critical paths. The second
candidate splits only iPhone into two shards and regression into three,
without changing test fixtures, workers per runner, or coverage. Measure
its actual runtime and ensure every shard and aggregate check is green.
