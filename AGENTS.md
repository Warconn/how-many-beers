# How Many Beers: Codex working instructions

These are standing instructions for AI coding agents working in `Warconn/how-many-beers`. Read this file together with `README.md`, `docs/core-cook-experience.md`, and the GitHub issue being implemented. Code and tests are the authority for current behavior; prior chat summaries are historical context, not a substitute for inspecting the implementation.

## Product purpose and guiding experience

How Many Beers is a mobile-first companion for planning and executing a cook involving one or multiple dishes, with a combined chronological schedule/checklist. A good first experience is: **set serving time → add dishes → optionally adjust dish steps/settings → start cooking → leave and resume without lost progress**.

Prioritize usable architecture, intuitive interaction and reliability over complex brisket-specific algorithms, speculative AI features or decorative branding. Start with the simple brisket-and-brats journey. A cook is one session with multiple dishes. Templates initialize dishes; they are not separate cook sessions. Recipe text and .txt/.md import are alternate Add Dish paths. Recipe URL parsing is not yet implemented and must not be presented as working.

Visual direction: calm, polished cooking utility with warm neutrals, restrained burnt-orange accents, readable typography, modest borders and useful whitespace. Avoid generic AI-generated dashboard visuals, excessive cards, loud decorative emoji, long walls of settings and unnecessary modes. Make desktop responsive and phone use practical. Favor the visible action the cook needs next.

## Current priorities and decision rules (October 27, 2026)

**This is the approved coding queue, not just a list of open tickets.** When asked "what should Codex work on next?", use this ordered list together with live issue status. Do not infer execution order from issue numbers, creation dates, the existence of a "Next" label, or an older chat/README. Recheck issue and PR status before recommending work. If a task is already complete or in progress, skip or continue it as appropriate rather than duplicate work.

### NOW: explicit execution sequence

1. **Fast-track [#50 Homepage clutter cleanup](https://github.com/Warconn/how-many-beers/issues/50)** as one small, isolated UI PR. Remove the prominent local/offline status block and "A little less juggling" eyebrow; keep backup/offline behavior and existing user records intact. Coordinate with in-progress [#45 branding](https://github.com/Warconn/how-many-beers/issues/45), but do not block account work on cosmetic polish.
2. **[#19 Free account foundation](https://github.com/Warconn/how-many-beers/issues/19)**: sign-in, secure ownership/authorization, free account lifecycle and schema. This is the highest-priority substantial feature.
3. **[#20 Account-backed cooks/history, NOW slice](https://github.com/Warconn/how-many-beers/issues/20)**: depends on #19. Exactly **one** active/planning cook per signed-in account; a chronological/searchable **list of completed cooks**, open details and Cook Again; recover data on a second device. Preserve meaningful progress and actual event timestamps. Do not attempt all future concurrent-edit/outbox requirements in this release.

**NOW, parallel/release-readiness work:** [#10 PWA/offline data reliability](https://github.com/Warconn/how-many-beers/issues/10), [#4 real-phone and full-cook alpha QA](https://github.com/Warconn/how-many-beers/issues/4), [#5 validation of delivered brisket estimates](https://github.com/Warconn/how-many-beers/issues/5), and [#45 homepage branding](https://github.com/Warconn/how-many-beers/issues/45). These are important open Now items but should not be inserted ahead of #19/#20 just because they are also labeled Now. Work can be parallelized when branches and risk permit.

### NEXT, not immediate coding queue

- [#11 timers and overdue cues](https://github.com/Warconn/how-many-beers/issues/11).
- [#2 URL recipe import](https://github.com/Warconn/how-many-beers/issues/2).
- [#3 deeper cross-dish scheduling](https://github.com/Warconn/how-many-beers/issues/3).
- A separate reusable saved-recipe library (requires account/cook persistence; create/scope an implementation ticket before coding).
- Advanced portion of [#20](https://github.com/Warconn/how-many-beers/issues/20): robust offline outbox/replay, simultaneous live multi-device editing and merge/conflict resolution.
- [#21 cross-app design cleanup](https://github.com/Warconn/how-many-beers/issues/21) after #45 establishes brand components.

**No fixed relative order among Next tickets** has been approved; obtain a fresh product-priority choice before starting one. #11 and #2 appearing in a Codex "next coding priorities" recommendation ahead of unfinished Now scope is a priority mistake. "Later" and monetization [#46](https://github.com/Warconn/how-many-beers/issues/46) do not block free launch.

### Approved free-tier product boundary

- **All accounts are free for now. No paid tier, subscriptions or billing implementation.**
- Guests can try the cooking workflow without sign-in, but the intended **new guest experience** has no persistent saves, tracked completed-cook history or account tracking. Clearly disclose that mode's limits.
- Signed-in users have exactly **one** saved active/planning cook, plus a list of **unlimited completed cooks** (subject to reasonable technical limits). View details and Cook Again stay free.
- **No cooking analytics dashboard** required. A simple, useful Previous Cooks list is the focus.
- Multiple saved future plans and a separate personal recipe library are not Now.
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
- `dev` is the integrated preview branch at https://dev.how-many-beers.pages.dev/. Cloudflare Pages uses `main` as its Production branch (owner-confirmed October 28, 2026). Configure dev and feature account builds through Preview variables; leave Production account rollout disabled until a separate production Supabase project is ready.
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
4. Run these verification commands before declaring implementation complete:

```bash
npm install --no-audit --no-fund
npx playwright install --with-deps chromium
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

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

The owner confirmed existing cooks are throwaway and migration must not dominate onboarding. Signed-in users land directly on account cooks. Earlier-cook import/backup is optional under Account → Earlier cooks, with no blocking banner. App-update actions also belong in that menu (Menu when accounts are disabled); keep background worker detection mounted and retain save/draft safeguards. No automatic reload during an open cook.

Account saving uses a small status icon beside the Account control (cloud check, saving activity or attention warning), with accessible labels and hover text. Do not restore the separate Saved to account row. Keep actual save failures explicit and actionable.

For account environment setup, follow [dev and feature testing](docs/dev-account-testing.md). The default how-many-beers.pages.dev origin follows main, not dev. Dev and trusted feature previews share the dev Supabase project/data but have separate origin sessions.

## Dynamic feature account previews (October 28, 2026)

The owner requested automatic account access for future feat branches. Preview configuration supports `https://feat-*.how-many-beers.pages.dev` alongside exact dev, only with development auth settings. Supabase redirects use the matching pattern with the fixed `/account/callback/` path. Keep production exact; do not expand to all pages.dev hosts, hash deployments or unrelated branch prefixes. New feature branches must include the updated matcher from dev.
