# How Many Beers: Codex working instructions

These are standing instructions for AI coding agents working in `Warconn/how-many-beers`. Read this file together with `README.md`, `docs/core-cook-experience.md`, and the GitHub issue being implemented. Code and tests are the authority for current behavior; prior chat summaries are historical context, not a substitute for inspecting the implementation.

## Product purpose and guiding experience

How Many Beers is a mobile-first companion for planning and executing a cook involving one or multiple dishes, with a combined chronological schedule/checklist. A good first experience is: **set serving time → add dishes → optionally adjust dish steps/settings → start cooking → leave and resume without lost progress**.

Prioritize usable architecture, intuitive interaction and reliability over complex brisket-specific algorithms, speculative AI features or decorative branding. Start with the simple brisket-and-brats journey. A cook is one session with multiple dishes. Templates initialize dishes; they are not separate cook sessions. Recipe text and .txt/.md import are alternate Add Dish paths. Recipe URL parsing is not yet implemented and must not be presented as working.

Visual direction: calm, polished cooking utility with warm neutrals, restrained burnt-orange accents, readable typography, modest borders and useful whitespace. Avoid generic AI-generated dashboard visuals, excessive cards, loud decorative emoji, long walls of settings and unnecessary modes. Make desktop responsive and phone use practical. Favor the visible action the cook needs next.

## Current state and decisions (October 26, 2026)

Production release [PR #29](https://github.com/Warconn/how-many-beers/pull/29) delivered Home/resume, the Guided Cook Planner, persistent Live Schedule, template/recipe selection in one Add Dish experience, expandable per-dish steps, cooking checklist/history, and Playwright regression tests. User confirmed GitHub Pages production deployment. These features are a functional baseline, **not UX approval of every interaction**.

Current prioritized backlog:
- [#28](https://github.com/Warconn/how-many-beers/issues/28): completed in `dev` through PR #32 after user review. Keep the flattened inline dish menu; do not restore a separate details panel.
- [#30](https://github.com/Warconn/how-many-beers/issues/30): step dates, duration and details from dish and Live Schedule are in review in PR #35. Read its timing rules before extending scheduling; do not silently invent durations or automatic dependency shifting.
- [#31](https://github.com/Warconn/how-many-beers/issues/31): completed in `dev` through user-approved PR #34. Keep one compact Start/Continue action and visible plan warnings.
- [#33](https://github.com/Warconn/how-many-beers/issues/33): low-priority follow-up to make Remove dish visible beside its heading, with confirmation and recorded-history preservation.
- [#3](https://github.com/Warconn/how-many-beers/issues/3): advanced dependency-aware replanning is later, **not** a prerequisite for #30.

For #28, preserve the useful high-level flow and live schedule. Do not combine a broad redesign of Cooking Mode or advanced scheduling into that PR. Ask for product direction only when a genuine irreversible UX choice remains; otherwise implement the smallest coherent change based on acceptance criteria.

## Branches, review and deployment

- `main` is stable production, deployed to GitHub Pages at https://warconn.github.io/how-many-beers/.
- `dev` is the integrated preview branch. Cloudflare Pages uses `dev` as its production branch at https://how-many-beers.pages.dev/.
- Work from an up-to-date `dev` on an isolated `feat/*` branch. Suggested first name: `feat/28-dish-editor`. Codex may use a `codex/*` branch if required by the environment. Point the PR at **`dev`, never `main`**.
- Do not commit work in progress directly to `dev` or `main`. Do not merge a PR or deploy to production without explicit approval.
- GitHub Actions should run on feature PRs, and Cloudflare should update the primary dev URL only when reviewed changes merge to `dev`.
- Cloudflare custom preview branches have been discussed/configured by the user for `feat/*` and potentially `codex/*`; **verify the actual saved branch filters before assuming** any branch is published. A feature preview may be available via a branch-specific Pages URL.
- The user intends to exclude test-only and docs-only commits from Cloudflare builds using Build watch paths (for example `e2e/**`, `.github/**`, `docs/**`, etc.). Treat these as **desired settings, not proven configuration**. Cloudflare settings are external and cannot be assumed changed by editing this repo. Any change containing application code should still deploy when merged to `dev`.
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

This file is the durable working summary of the October 2026 ChatGPT product discussion, not a transcript. For details beyond it, consult the docs and linked issues.

## Duration adjustment follow-up (#41)

The user authorized forwarding duration overruns to following timed recipe/template
steps, superseding #30's display-only duration policy. Keep existing spacing, recipe
order independent of manual checklist order, other dishes independent, and fixed or
recorded steps anchored with explicit conflicts. Do not infer physical durations from
checkpoint gaps or move the serving target. Hours/minutes inputs persist minutes.
First activity captures optional recordedPlanAt planned-position metadata; actual
event timestamps remain immutable. Repeat drops those anchors with actuals. Full
resource/dependency optimization remains #3. See docs/step-timing.md.
