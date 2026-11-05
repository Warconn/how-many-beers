# How Many Beers: Codex working instructions

These are standing instructions for AI coding agents working in `Warconn/how-many-beers`. Read this file together with `README.md`, `docs/core-cook-experience.md`, and the GitHub issue being implemented. Code and tests are the authority for current behavior; prior chat summaries are historical context, not a substitute for inspecting the implementation.

## Product purpose and guiding experience

How Many Beers is a mobile-first companion for planning and executing a cook involving one or multiple dishes, with a combined chronological schedule/checklist. A good first experience is: **set serving time → add dishes → optionally adjust dish steps/settings → start cooking → leave and resume without lost progress**.

Prioritize usable architecture, intuitive interaction and reliability over complex brisket-specific algorithms, speculative AI features or decorative branding. Start with the simple brisket-and-brats journey. A cook is one session with multiple dishes. Templates initialize dishes; they are not separate cook sessions. Recipe text and .txt/.md import are alternate Add Dish paths. Recipe URL parsing is not yet implemented and must not be presented as working.

Visual direction: calm, polished cooking utility with warm neutrals, restrained burnt-orange accents, readable typography, modest borders and useful whitespace. Avoid generic AI-generated dashboard visuals, excessive cards, loud decorative emoji, long walls of settings and unnecessary modes. Make desktop responsive and phone use practical. Favor the visible action the cook needs next.

## Current priorities and decision rules (owner update: November 4 ET / November 5 UTC, 2026)

**Single roadmap source:** [docs/product-roadmap.md](docs/product-roadmap.md). For what Codex should work on, also consult [docs/work-queue.md](docs/work-queue.md) and **recheck live GitHub PRs, branch heads and CI**. Open issues are not automatically an approved coding queue. If work already exists, continue/review it rather than duplicating it.

### Released baseline

[Release PR #100](https://github.com/Warconn/how-many-beers/pull/100) delivered #21 visual system and #97 checkbox-first Cooking Mode, including accepted compact UI and Beerometer cleanup. The merged production main commit was `190bf6168fbaf9fe2c3d75770200101a26bcc539`. Earlier #92, #84, #62/#85, #77 and #86 were already delivered. **Do not restart these completed tickets.** Preserve stable IDs, observed event timestamps, accounts, legacy guest data, the single prominent action and existing data safety.

### Current in-flight and next priorities (in this order)

1. **#61 Cancel Cook:** [PR #104](https://github.com/Warconn/how-many-beers/pull/104) was opened to implement retained soft cancellation. Finish full CI, PostgreSQL/RLS and upgrade/race validation, required hosted schema review and owner acceptance before any merge. It does not establish that migrations or production changes are live.
2. **#71 CI optimization:** [PR #102](https://github.com/Warconn/how-many-beers/pull/102) is an independent parallel two-shard browser CI experiment. Check the *whole* suite, iPhone/WebKit, timing and runner cost; it is not a core cooking feature.
3. **#83 Multiple upcoming cooks:** Owner reports Codex work in flight. Check for a current feature branch/PR; do not claim a merged implementation based on a plan alone. Multiple free signed-in future plans while **one** cook is active; reuse #61 lifecycle protections, no destructive overwrites, separate PR into `dev`.
4. **#103 Recipe-first UX, after #83:** This is the next core user-experience priority. Design “What are you cooking?”, clear saved personal **recipe** vs **past multi-dish cook**, creating from existing templates/text import, quick pre-cook tailoring and repeat use. Do not expand bundled cooking methods or build URL fetching as a prerequisite. **Review design/scope with owner before coding.**
5. **#101 Live cooking phases, after recipe UX planning:** Design meaningful overlapping active dish phases with checkbox start actions, explicit end-of-heat actions, time-based check actions, one global Up Next and **rolling whole-cook time remaining** in the Beerometer. Corrections recalculate linked timing, without rewriting actuals. **Review the model before implementation.**

### Explicit deferrals and boundaries

- **#2 recipe URL import and #11 timers/notifications are LATER**, deliberately postponed until the core #103/#101 cooking flow is stable and tested in real cooks. #101 may compute when a checkpoint is due but must not sneak in notifications/snooze/permission flows.
- **#3** remains advanced cross-dish dependency/equipment optimization, separate from #101's simultaneous phase display/forecasting. **#83** is separate saved cook sessions, not multiple dishes in one dinner.
- **#68 and #69 are closed/consolidated into #105** as deferred data/privacy and offline-reliability considerations. A demonstrated security issue, real data-loss bug, or legal requirement must still be addressed promptly.
- **#12, #14, #15, #16, #17 and #18 are closed as not planned**. Do not automatically reopen equipment profiles, probes, shared sessions, grocery/nutrition, AI coach or expanded method templates.
- #6, #9, #13, #46, #67 and #70 are Later/parked, not current Codex assignments. Avoid paid tiers, social login or speculative features in core work.
- For all work: branch from latest `dev`, separate scoped PR into `dev`, run full appropriate CI and inspect actual desktop/mobile results. **Do not auto-merge or deploy to `main` without explicit owner approval.** Do not run hosted Supabase migrations or mutate production cook/account data without authorization.

### Approved free-tier product boundary

- **All accounts are free for now. No paid tier, subscriptions or billing implementation.**
- Guests can try the cooking workflow without sign-in, but the intended **new guest experience** has no persistent saves, tracked completed-cook history or account tracking. Clearly disclose that mode's limits.
- Signed-in users have exactly **one** saved active/planning cook, plus a list of **unlimited completed cooks** (subject to reasonable technical limits). View details and Cook Again stay free.
- **No cooking analytics dashboard** required. A simple, useful Previous Cooks list is the focus.
- Multiple free future account plans are approved as #83 (after #61). **After #83**, #103 explores a free reusable personal recipe library separate from completed cook history; this is not delivered yet. One active cooking session remains the constraint.
- **Migration is a non-negotiable constraint:** current builds already preserve guest sessions and history in browser storage, with backup/restore. Never erase, orphan or silently reset existing legacy guest data while moving toward the new guest/account behavior. Offer explicit safe migration/backup. Keep real cook progress safe even when connectivity fails.
- Scope of #19 is identity/ownership/security; scope of #20's Now slice is saving, retrieval, history and basic cross-device access. Do not make full advanced sync a prerequisite to first account-backed history.
- The live public origin is **https://howmanybeers.app** on Cloudflare. The integrated dev preview is **https://dev.how-many-beers.pages.dev/**. The owner confirmed Cloudflare Pages uses `main` as its Production branch; `dev` and feature branches use Preview variables. Any legacy GitHub Pages references are historical, not current production routing.

### Working with the backlog

1. For "what next?", verify [docs/product-roadmap.md](docs/product-roadmap.md), the top issue and live PR/status, then recommend finishing in-flight work before the first unstarted approved item.
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
same cook later. Keep one active/planning cook per browser, existing autosave,
archive/history, IDs and actual timestamps. Failed writes must not claim success.
Suggested times do not automatically start a session. Cloud sync, background reminders
and a library of multiple future plans remain separate work.

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

Account saving uses a small status icon beside the Account control (cloud check, saving activity or attention warning), with accessible labels and hover text. Do not restore the separate Saved to account row. Keep actual save failures explicit and actionable.

For account environment setup, follow [dev and feature testing](docs/dev-account-testing.md). The default how-many-beers.pages.dev origin follows main, not dev. Dev and trusted feature previews share the dev Supabase project/data but have separate origin sessions.

## Dynamic feature account previews (October 28, 2026)

The owner requested automatic account access for future feat branches. Preview configuration supports `https://feat-*.how-many-beers.pages.dev` alongside exact dev, only with development auth settings. Supabase redirects use the matching pattern with the fixed `/account/callback/` path. Keep production exact; do not expand to all pages.dev hosts, hash deployments or unrelated branch prefixes. New feature branches must include the updated matcher from dev.
