# How Many Beers: Codex working instructions

These are standing instructions for AI coding agents working in `Warconn/how-many-beers`. Read this file together with `README.md`, `docs/core-cook-experience.md`, and the GitHub issue being implemented. Code and tests are the authority for current behavior; prior chat summaries are historical context, not a substitute for inspecting the implementation.

## Product purpose and guiding experience

How Many Beers is a mobile-first companion for planning and executing a cook involving one or multiple dishes, with a combined chronological schedule/checklist. A good first experience is: **set serving time → add dishes → optionally adjust dish steps/settings → start cooking → leave and resume without lost progress**.

Prioritize usable architecture, intuitive interaction and reliability over complex brisket-specific algorithms, speculative AI features or decorative branding. Start with the simple brisket-and-brats journey. A cook is one session with multiple dishes. Templates initialize dishes; they are not separate cook sessions. Recipe text and .txt/.md import are alternate Add Dish paths. Recipe URL parsing is not yet implemented and must not be presented as working.

Visual direction: calm, polished cooking utility with warm neutrals, restrained burnt-orange accents, readable typography, modest borders and useful whitespace. Avoid generic AI-generated dashboard visuals, excessive cards, loud decorative emoji, long walls of settings and unnecessary modes. Make desktop responsive and phone use practical. Favor the visible action the cook needs next.

## Current priorities and decision rules (November 5, 2026)

**This is the approved coding queue, not just a list of open tickets.** When asked "what should Codex work on next?", use this ordered list together with live issue status. Do not infer execution order from issue numbers, creation dates, the existence of a "Next" label, or an older chat/README. Recheck issue and PR status before recommending work. If a task is already complete or in progress, skip or continue it as appropriate rather than duplicate work.

### NOW: Finish and stabilize the approved production release

The November 5 release contains #21 (visual design system, PR #98) and #97
(checklist-first Cooking Mode, PR #99), plus the accepted November 3 compact
planning/cooking layout and Beerometer cleanup. These extend production #96
(`925cbacd348afd43640d69b2db1c173352c95fd1`), which delivered #92 (#93/#95),
#84 (#94), #62/#85 (#89), #77 (#80/#90) and #86 (#91). Do not duplicate these
implementations. See docs/releases/2026-11-05.md for the release contract/evidence;
verify live main/dev and release PR status before describing deployment as complete.

The owner explicitly authorized this stabilization and production promotion after
all gates pass: finish #99, full CI, merge dev, full integration CI on that dev
commit, release PR dev → main, full candidate CI/build, then merge and confirm the
actual Cloudflare deployment of the intended main commit. Never bypass failures
or force a merge. Inspect desktop/mobile/iPhone screenshots. No production account
or cook-data mutations during smoke tests. Significant unresolved issues block
promotion. Reconcile #21/#97 after release, not merely after implementation.

Cooking defaults to one action, concise instructions, relevant duration/checkpoint
and a checkbox. Optional physical starts/corrections and temperature/equipment
logging live in Step details. A checkbox is not proof of elapsed cooking/resting.
Corrections append events; preserve original observations, stable IDs, saved cooks,
authentication, ownership, guest behavior and planning/forecast semantics. Keep the
accepted Beerometer simplification: no duplicate initial projected duration or zero
elapsed reading. Do not redesign accepted functions or the execution model.

**Next planning sequence remains #61, then #83**, but neither is implementation
scope for this release. Review docs/cook-lifecycle-plan.md before database work.
#83 must wait for #61's lifecycle/migration design. #69/#70 sync, #2 URL import,
paid tiers and social login are also excluded. The owner's new in-progress timing
concept requires a separate discovery conversation; do not infer requirements or
change the timing engine ahead of that discussion. No manual QA/acceptance tickets.
#87 is the completed historical queue; #4 was owner-tested and #5 closed at the
owner's request without claiming extra calibration research.

### Approved free-tier product boundary

- **All accounts are free for now. No paid tier, subscriptions or billing implementation.**
- Guests can try the cooking workflow without sign-in, but the intended **new guest experience** has no persistent saves, tracked completed-cook history or account tracking. Clearly disclose that mode's limits.
- Signed-in users have exactly **one** saved active/planning cook, plus a list of **unlimited completed cooks** (subject to reasonable technical limits). View details and Cook Again stay free.
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
