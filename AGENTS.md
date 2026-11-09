# How Many Beers: Codex working instructions

These are standing instructions for AI coding agents working in `Warconn/how-many-beers`. Read this file together with `README.md`, `docs/core-cook-experience.md`, and the GitHub issue being implemented. Code and tests are the authority for current behavior; prior chat summaries are historical context, not a substitute for inspecting the implementation.

## Product purpose and guiding experience

How Many Beers is a mobile-first companion for planning and executing a cook involving one or multiple dishes, with a combined chronological schedule/checklist. A good first experience is: **set serving time → add dishes → optionally adjust dish steps/settings → start cooking → leave and resume without lost progress**.

Prioritize usable architecture, intuitive interaction and reliability over complex brisket-specific algorithms, speculative AI features or decorative branding. Start with the simple brisket-and-brats journey. A cook is one session with multiple dishes. Templates initialize dishes; they are not separate cook sessions. Recipe text and .txt/.md import are alternate Add Dish paths. Recipe URL parsing is not yet implemented and must not be presented as working.

Visual direction: calm, polished cooking utility with warm neutrals, restrained burnt-orange accents, readable typography, modest borders and useful whitespace. Avoid generic AI-generated dashboard visuals, excessive cards, loud decorative emoji, long walls of settings and unnecessary modes. Make desktop responsive and phone use practical. Favor the visible action the cook needs next.

## Current owner direction (November 9, 2026)

PR #131 is owner-approved and merged into dev at `62f4673`. Do not repeat the
post-brisket implementation. The authorized work is now release readiness:
investigate/fix #118 with deterministic WebKit regression coverage; preserve
production fixes while comparing dev/main; run all regression suites; reconcile
delivered issues and documentation; prepare one release PR targeting main.
This explicit release instruction supersedes the usual feature-PR target of dev.
Do not merge main or deploy production without further approval. Do not apply
hosted Supabase migrations. Keep #61/#83/#103 open until production verification.
#114 is the next feature candidate, outside this session; do not implement it.

Handoffs include the exact feature testing URL reported by Cloudflare's successful
check/comment and a short owner test plan. Never infer the hostname from a branch
name: aliases may be shortened.

## Prior priorities and decision rules (November 7, 2026)

Use the live repository and issue acceptance criteria together with this approved
queue. Do not repeat delivered work or infer priority from issue numbers.

### NOW: dev stabilization before a separate production release

Dev delivery includes #101 physical cooking, #61 retained cancellation, #83
multiple upcoming account plans/one active cook, #71 CI improvements, #103's recipe
review/shared controls and #113's removal of routine backup/success clutter.
#115 repairs the browser baseline; #116 delivers #109 serving-time-first planning.
The owner approved integrating #115/#116 and their documentation into dev on
November 7. That approval does not authorize future PR merges, production promotion
or hosted database changes.

Preserve the delivered flow:
**set serving time → choose dishes → review recipes → combined meal → cook**.
The normal planning summary is **Start preparing**, with day/date. Show estimated
meal readiness when the requested target cannot be met. Never silently move the
target or fabricate actual activity. Keep the accepted Beerometer and #101 live
execution model. The read-only planning projection is not #3's resource optimizer.

#117 is delivered in dev through #128. #119/#121 are delivered through #120/#122;
#123 through #129; #124/#125/#126/#127 through #131. #118 is the current
pre-production metadata-edit investigation. The release must preserve the accepted
physical model and Hold → Finish, all actuals, sessions, guest/account boundaries
and saving/history. See docs/work-queue.md and the current release notes.

Both November 5 Supabase migrations are owner-confirmed applied and verified in
dev. Do not reapply them or modify hosted database state in this work.

### Delivered UI and deferred capabilities

The default planner is `/`; old `/recipe-first/` bookmarks redirect there. Preserve
inline instructions, left drag grips, upper-right Edit, grouped Save/Cancel,
separated Remove and Review Meal Plan. Reuse docs/design-system.md.
#103's recipe UI is delivered; reusable personal recipe saving remains deferred.
Advanced scheduling (#3), timers/notifications, recipe URL import (#2), social
login, paid features and advanced synchronization (#69/#70) remain deferred.
Do not create manual QA or acceptance-testing tickets. Real data-loss/security bugs
still take precedence. Stale docs PR #106 was closed as superseded without merging its old queue.

### Existing lifecycle safeguards

#61 retains canceled records, excludes them from active/completed views, permits a
new cook only after acknowledged cancellation, and protects against stale-device
resurrection. Fresh guest trials remain in-memory; legacy guest/account retention
and existing completed history must remain intact. SQL migrations are additive and
must pass real PostgreSQL security, seeded-upgrade and race checks. Capability-gate
new account controls until their RPC/schema exists. Do not change hosted Supabase
without verified environment access and explicit deployment scope.

#83 follows the understood/tested #61 lifecycle foundation: separate account-owned
saved plans, one active cook, independent edits and safe atomic promotion. No future
plan may overwrite active progress. Preserve legacy planning drafts, actual events,
backups, account ownership and guest behavior. See docs/cook-lifecycle-plan.md.

#71 may improve CI independently while preserving all browser projects, account,
offline and security coverage, required aggregate gates and actual screenshot review.
Measure wall-clock and runner cost rather than claiming unmeasured speedups.

Cooking keeps the accepted checklist-first flow and Beerometer display/calculations.
#101's accepted physical timing is delivered; preserve its execution model. #69/#70 sync, URL import, paid/social and unrelated methods remain
out of scope. Do not create manual QA/acceptance tickets.

### Approved free-tier product boundary

- **All accounts are free for now. No paid tier, subscriptions or billing implementation.**
- Guests can try the cooking workflow without sign-in, but the intended **new guest experience** has no persistent saves, tracked completed-cook history or account tracking. Clearly disclose that mode's limits.
- Signed-in users retain **one active cook** and **unlimited completed cooks** (subject to reasonable technical limits). #83 account builds with the savedPlans server capability also support multiple independent upcoming plans; older schema builds keep their one planning/active workspace. View details and Cook Again stay free.
- **No cooking analytics dashboard** required. A simple, useful Previous Cooks list is the focus.
- Multiple future account plans are approved after #61 as #83; the separate personal recipe library remains outside this sequence.
- **Migration is a non-negotiable constraint:** current builds already preserve guest sessions and history in browser storage, with backup/restore. Never erase, orphan or silently reset existing legacy guest data while moving toward the new guest/account behavior. Offer explicit safe migration/backup. Keep real cook progress safe even when connectivity fails.
- Scope of #19 is identity/ownership/security; scope of #20's Now slice is saving, retrieval, history and basic cross-device access. Do not make full advanced sync a prerequisite to first account-backed history.
- The live public origin is **https://howmanybeers.app** on Cloudflare. The integrated dev preview is **https://dev.how-many-beers.pages.dev/**. The owner confirmed Cloudflare Pages uses `main` as its Production branch; `dev` and feature branches use Preview variables. Any legacy GitHub Pages references are historical, not current production routing.

### Working with the backlog

1. For "what next?", verify the top issue and its open PRs/status, then recommend the first unfinished NOW item above.
2. Use explicit acceptance criteria in the corresponding issue for implementation details. An issue's broad technical wish list is not permission to expand an approved Now slice.
3. Keep feature branches small and PRs targeted to `dev`. Do not silently merge, deploy, or reprioritize work.
4. Once the Now queue changes, update this section **in the same planning change** so Codex, issues and user-facing recommendations agree.

## Branches, review and deployment

- `main` is the stable release branch. The canonical live site is https://howmanybeers.app on Cloudflare. GitHub Pages URLs, if still reachable, are legacy.
- `dev` is the integrated preview branch at https://dev.how-many-beers.pages.dev/. Cloudflare Pages uses `main` as its Production branch (owner-confirmed October 28, 2026). Configure dev and feature account builds through Preview variables; Production accounts/cloud saving already work against the separate production Supabase project; preserve those settings.
- Work from an up-to-date `dev` on an isolated `feat/*` branch. Use a feature branch named for the active issue, e.g. `feat/19-free-accounts`. Codex may use a `codex/*` branch if required by the environment. Point the PR at **`dev`, never `main`**.
- Do not commit work in progress directly to `dev` or `main`. Do not merge a PR or deploy to production without explicit approval.
- GitHub Actions should run on feature PRs, and Cloudflare should update the primary dev URL only when reviewed changes merge to `dev`.
- Cloudflare custom preview branches have been discussed/configured by the user for `feat/*` and potentially `codex/*`; **verify the actual saved branch filters before assuming** any branch is published. A feature preview may be available via a branch-specific Pages URL.
- The user has considered excluding test-only and docs-only commits from Cloudflare builds using Build watch paths (for example `e2e/**`, `.github/**`, `docs/**`, etc.). Treat these as **desired settings, not proven configuration**. Cloudflare settings are external and cannot be assumed changed by editing this repo. Any change containing application code should still deploy when merged to `dev`.
- Run tests against the feature code locally/in the Codex cloud environment before pushing. Playwright browser tests run against the application server in the task environment; public preview deployment is optional for hands-on user review.

## Engineering and data integrity

Study `src/domain/meal.ts`, `src/domain/cookState.ts`, `src/domain/schedule.ts` and `src/app/page.tsx` before altering cooking behavior. Preserve stable dish/task IDs, cook histories, completion/temperature/equipment event timestamps, notes, backup/export/import, and localStorage schema compatibility. Opening Home or a planner must **never** silently reset `mode: "cooking"` or completed progress. Starting a new cook must not silently overwrite meaningful unfinished work.

Steps conceptually belong to dishes. The overall schedule is derived from all dishes and custom steps. Step edit/remove/reorder paths already exist; reuse domain helpers and cover event-history preservation rather than building a second inconsistent state model. Built-in template steps may be computed instead of stored as fully independent step entities, so inspect the data model before making editable-step guarantees.

Use accessible labels, keyboard-friendly buttons and mobile tap targets. Expose unscheduled/estimated/condition-driven items truthfully. Never portray timing estimates as food safety guarantees.

## Test-first feature delivery

1. Read the issue, current UX spec, source and existing Playwright flows. Summarize the desired journey and concrete acceptance criteria before editing.
2. Add/adjust Playwright tests for the **user-visible behavior**. Run them against the old behavior and confirm the intended failure when practical.
3. Implement incrementally; run the application locally and use Playwright to interact with the actual UI, inspect screenshots and fix issues.
4. During iteration run `npm run test:fast -- <affected Playwright file/filter/config arguments>` for typecheck, unit tests and focused actual-browser validation. Both desktop and mobile projects run by default. For account changes select `--config=playwright.auth.config.ts` or `--config=playwright.accounts.config.ts`. For offline changes use `npm run test:offline -- <affected spec>` to exercise the production build. Before declaring integration/release ready, install dependencies with `npm ci --no-audit --no-fund`, install Chromium/WebKit with `npx playwright install --with-deps chromium webkit`, and run `npm run test:full`. It includes every browser suite and the production offline build. See [CI and timing evidence](docs/ci-testing.md).

5. Validate desktop and narrow-phone layouts, navigation, visual hierarchy, adding brisket and brats, editing one without changing the other, starting/resuming a cook, reload/localStorage persistence and history.
6. Save useful failure screenshots/traces. Prevent stale selectors from producing false failures, but do not weaken a valid assertion just to make CI green. Only establish/update screenshot goldens after reviewing the intended design.
7. Update README, core UX spec and issue notes whenever scope or product behavior changes. In the PR, explain changes, tests, remaining risks and any known UX debt.
8. Open a PR against `dev`; wait for GitHub CI results and resolve failures on the feature branch. Do not claim a release is live merely because code or CI passed. Keep production promotion as a separate explicit review.

## Communication and collaboration

Keep updates concise, plainspoken and product-oriented. Do not use em dashes. Explain tradeoffs and show the actual tested behavior. Distinguish between implementation complete, local tests passing, CI green, Cloudflare preview deployed and production deployed. Link the issue and PR. If an external account action is unavailable, say so instead of claiming Cloudflare or GitHub settings were changed.

This file is the durable working summary of the October 2026 product discussion, not a transcript. For details beyond it, consult the docs and linked issues.

## Save planned cook follow-up (#39)

Save plan for later explicitly acknowledges the current browser-storage write and
returns Home in planning. Home shows edited start times and supports starting the
same cook later. Legacy browser mode keeps one active/planning cook, existing autosave,
archive/history, IDs and actual timestamps. Failed writes must not claim success.
Suggested times do not automatically start a session. Account cloud saving and multiple upcoming plans are delivered in dev (#83).
Background reminders remain separate work.

## Cooking Mode review iteration (#26)

The user requested guided cooking after finding the grouped list and Save Cook / View
plan footer clunky. Prioritize one detailed current step, next-step preview in a fixed
footer, a flat whole-cook checklist and a distinct Edit plan action. Completion advances
guidance; preview/navigation do not mutate events. Finish cook archives only after
confirmation. Keep unsaved edit/reading drafts protected and Cancel adding compact.

## Duration adjustment follow-up (#41)

The user authorized forwarding duration overruns to following timed recipe/template
steps, superseding #30's display-only duration policy. Keep existing spacing, recipe
order independent of manual checklist order, other dishes independent, and fixed or
recorded steps anchored with explicit conflicts. Do not infer physical durations from
checkpoint gaps or move the serving target. Hours/minutes inputs persist minutes.
First activity captures optional recordedPlanAt planned-position metadata; actual
event timestamps remain immutable. Repeat drops those anchors with actuals. Full
resource/dependency optimization remains #3. See docs/step-timing.md.

## Account menu refinement (October 28, 2026)

The owner confirmed existing cooks are throwaway and migration must not dominate onboarding. Signed-in users land directly on account cooks. Earlier-cook import/download UI is removed during pre-1.0 (#60), with no automatic replacement import; leave stored records and recovery mechanisms intact. App-update actions also belong in that menu (Menu when accounts are disabled); keep background worker detection mounted and retain save/draft safeguards. No automatic reload during an open cook.

Upcoming-plan saving reuses that existing mechanism: automatic bounded transient
retries, owner-scoped protected drafts, and honest status in the existing icon. Do
not add separate plan recovery/retry prompts or Resume draft controls. Never
automatically overwrite a conflicting newer-device plan or claim an unconfirmed
start succeeded. The owner accepted Cancel Cook as implemented; preserve its flow.

Account saving uses a small status icon beside the Account control (cloud check, saving activity or attention warning), with accessible labels and hover text. Do not restore the separate Saved to account row. Keep actual save failures explicit and actionable.

For account environment setup, follow [dev and feature testing](docs/dev-account-testing.md). The default how-many-beers.pages.dev origin follows main, not dev. Dev and trusted feature previews share the dev Supabase project/data but have separate origin sessions.

## Dynamic feature account previews (October 28, 2026)

The owner requested automatic account access for future feat branches. Preview configuration supports `https://feat-*.how-many-beers.pages.dev` alongside exact dev, only with development auth settings. Supabase redirects use the matching pattern with the fixed `/account/callback/` path. Keep production exact; do not expand to all pages.dev hosts, hash deployments or unrelated branch prefixes. New feature branches must include the updated matcher from dev.
