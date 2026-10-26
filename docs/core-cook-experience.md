## Production baseline and next UX backlog (October 26, 2026)

**Released:** [PR #29](https://github.com/Warconn/how-many-beers/pull/29) merged `dev` to `main` at commit `3e7868d`. The production site is [How Many Beers on GitHub Pages](https://warconn.github.io/how-many-beers/); [Cloudflare Pages](https://how-many-beers.pages.dev/) follows `dev`. The user verified that the release appeared in production. The release includes Home/resume, Guided Cook Planner, unified template/pasted-recipe Add Dish source selection, expandable per-dish task controls and browser regression testing. The existing UI is functional but **not the final approved UX**.

### Confirmed production UX bugs, next sprint

- **[#28](https://github.com/Warconn/how-many-beers/issues/28): Add/Edit dishes and layered step management are unintuitive.** Too many UI layers to choose templates, edit a dish and adjust its steps. Separate Add from contextual dish editing, make menu navigation obvious, and avoid persistent long forms.
- **[#30](https://github.com/Warconn/how-many-beers/issues/30): Live Schedule is not directly editable.** Make schedule steps selectable and adjustable, keeping dish and combined-schedule views in sync while retaining historical events. This is simpler than future intelligent dependency scheduling in #3.
- **[#31](https://github.com/Warconn/how-many-beers/issues/31): Ready When You Are is redundant.** Remove oversized summary and duplicate schedule metrics; replace with a compact Start/Continue Cooking action without hiding essential warnings or food-safety reminders.

These are **open follow-up bugs**, not fixed by the production release. Existing issue #24/#25 describes the original capabilities; #28/#30/#31 track the remaining actual friction.

### Engineering and release process

Move away from direct work-in-progress commits to `dev`. Use ChatGPT for UX direction and acceptance criteria; implement on `feature/*` branches (preferably via Codex with the repo installed locally), run TypeScript + Vitest + Playwright + static build before committing, and have GitHub Actions validate a PR targeting `dev`. Merge only a reviewed, passing feature into `dev`, which triggers the Cloudflare preview. Promote `dev` to `main` through a release PR after green CI and product review. Cloudflare's current Git-connected configuration may still deploy on every `dev` push until workflow settings are adjusted; do not claim gated deployments have been implemented.

### Next sprint acceptance priorities

1. Fix #28 as the main editing/adding journey, with Playwright verification and preserved cook/event data.
2. Introduce direct schedule adjustments in #30 without introducing speculative duration inference.
3. Remove redundant Ready panel in #31, verifying Start/Continue and warnings.
4. Review full plan-to-cook-to-resume behavior on desktop/mobile and establish screenshot baselines before the next production promotion.

## Inline dish step planning (October 26, 2026)

The Guided Cook Planner now treats planning as editable by default. Each menu dish has an expandable list of its own steps, rendered using the existing task editor. Users can edit/remove/reorder those steps and create a custom unscheduled step attached to that dish; the shared Live Schedule continues to be derived from the combined cook state. Templates and recipe imports remain accessible through Add a dish. The former Edit/Done Editing menu toggle is no longer used for step adjustments; advanced equipment and duration settings remain available on demand.

### Test-first acceptance criteria
- Expand brisket steps without opening or mutating brat details.
- Add a custom step to brisket; it remains attached to brisket and survives refresh.
- Task edits preserve existing IDs and recorded completion events.
- The Live Schedule reflects changes to the combined timeline, with unscheduled steps identified as such.
- Verify desktop and mobile flows in Playwright before release.

The compact Start Cooking and complete cooking-mode redesign are separate follow-up work. Only promote `dev` to `main` after green CI and visual review.

## Add Dish consolidation (October 26, 2026)

The Add Dish editor now has two choices inside one surface: **Start from template** (existing starter methods) or **Import a recipe** (paste instructions or upload a .txt/.md file). Selecting an existing dish remains an Edit action on the menu card. The separate full-page Import a Recipe section has been removed to keep the Guided Planner focused. URL import is not yet implemented and must not be presented as a working feature.

Acceptance checks: switch methods without affecting the meal, import a named set of steps, add a template alongside it, verify both dish cards and one schedule, and preserve the cook on reload. Remaining polish is tracked in issue #28.

# Core Cook Experience v1

Status: Product direction approved, UX specification proposed for implementation
Updated: October 25, 2026

## Product direction
**How Many Beers is a cook management companion, not primarily a brisket calculator or recipe browser.**
Tell us what you're cooking and when you're eating. We'll organize the game plan, help execute it, and remember what happened.

The next release prioritizes comprehensible session navigation, adding multiple dishes to the same meal, an editable combined timeline, and focused cooking execution. Existing brisket, brats, wings and turkey templates are adequate starting content. Weight-optimized estimates, advanced replanning, recipe ingestion, AI, and probe integrations follow once the foundational journey is clear.

## The mental model
- **Cook session:** One occasion with a name, serving time, status, dishes, and recorded activity.
- **Dish:** An item within a cook, initially seeded from a template or created manually.
- **Template:** A reusable method and default sequence of steps, copied into a dish on add. Later edits do not change the original template or past cooks.
- **Step:** An editable, ordered action assigned to exactly one dish, with planned time, optional dependencies/conditions, and completion state.
- **Event:** An append-only observation or actual action (completion, reopening, temperature, note, start, finish) that must not be rewritten by replanning.
- **Timeline:** A derived combined view of all dish steps, not a separate data owner.

Allow one active/planning cook per user or device, with many completed archived cooks. If the user resumes a cooking session, visiting its workspace must not reset its status.

## Core information architecture

1. **Home**: Resume the existing cook prominently (name, planned serving time, dish count, status, meaningful next action). Start new cook, browse history/repeat and access templates indirectly. No full planner or giant form on entry.
2. **Cook workspace**: The primary planning and overview surface for a particular cook. Name/serving time, menu of dishes, one combined timeline and unambiguous transition to Cooking Mode. A session in progress can also be viewed here without changing its state.
3. **Add dish**: Pick a starter template (Brisket, Brats, Wings, Turkey) or start blank. Preview and optionally adjust defaults before adding. Return to the same cook.
4. **Dish details**: Edit name, settings, and its ordered steps, with ownership visible. Provide a clear return to the shared cook view.
5. **Cooking Mode**: Execution-only, emphasizing Now / Next / Later and completion/logging. No competing setup. Easily return to overview and Home. Retain existing event semantics.
6. **History**: Accessed from Home; previous cooks are immutable until explicitly repeated into a new cook.

## UX rules
- A landing visit must immediately answer: Do I have an active cook? How do I resume it? How do I start another?
- A cook is the top-level working object; never present dishes as separate active sessions.
- A template is a way to add a dish, not a top-level mode.
- Default to progressive disclosure: first choose a session; next its dishes; only then detailed steps/settings.
- The workspace shows menu and a merged timeline with clear per-dish labels. Edit dish steps within the dish, not inside a crowded global setup.
- In cooking mode, focus on action; maintain easy access to completed items and actual readings.
- Show the difference between planned schedule and actual observations. Never auto-complete a food-safety check based on elapsed time.
- Single-device persistence should be preserved, with candid warning and export for risks. Cloud auth remains optional and later.
- Mobile-first, usable one-handed near a grill, no obligatory "Start Step" ceremony.

## First UX change: Home and session entry (P0)
**Objective:** Replace the current immediate planner/form landing with a distinct Home state that routes into the existing workspace or cooking view.

### Proposed home states
- **First visit / empty**: "What's cooking?" and clear "Plan a new cook". Optionally small entry to previous cooks when available.
- **Existing planning session**: Prominent Resume card with planned dinner time and dish summary, plus secondary "New cook".
- **Existing in-progress session**: Prominent "Continue cooking" route to Cooking Mode and a secondary "View cook" route to workspace.
- **Completed sessions, no current cook**: New cook call-to-action plus recent cooked sessions and Repeat.

### Critical action rules
- New cook must not silently erase a populated planning or in-progress session. When replacing, provide explicit confirmation and safe preservation/backup option; prefer preserving through archive or future drafts, but do not falsely mark an unfinished cook as completed.
- Going Home or viewing workspace must never alter cook status or event timestamps.
- Refresh and browser return should resolve the saved session without flashing or overwriting an empty default.
- History and backup recovery must remain discoverable.
- No automatic login, cloud sync, PWA or recipe engine introduced in this change.

### Acceptance criteria
- [ ] The initial route opens a clean Home rather than the entire planner.
- [ ] Home reflects empty, planning, in-progress and history-only states accurately.
- [ ] Resume returns to the existing cook with its dishes, timeline, notes and event history intact.
- [ ] In-progress cook offers a direct return to Cooking Mode and a non-destructive workspace view.
- [ ] New cook follows safe replacement confirmation if prior unsaved work exists.
- [ ] Phone navigation is intuitive: Home -> Workspace -> Add Dish -> Workspace -> Cooking -> Home -> Resume.
- [ ] Existing historical cooks, export/import, task completion, temperature events and static deployment continue working.
- [ ] Automated tests cover cold load, refresh, existing planning/cooking sessions, mode preservation, cancel new cook and completed-history navigation.
- [ ] No schema-breaking localStorage migration without tests and recovery.

### Implementation plan
1. Extract reusable components for Home, cook header, action summary and session navigation; avoid a wholesale rewrite of domain logic.
2. Add explicit UI navigation state distinct from persisted cook status (planning/cooking/completed). Choose whether Home is a route or view, ensuring refresh and back behavior are clear.
3. Provide one safe session-entry action that understands existing persisted state. Preserve existing `how-many-beers:meal:v1` and history keys initially.
4. Move existing planner behind Cook Workspace without changing the schedule engine.
5. Retain current Cooking Mode, saved history and recovery controls; add direct links from Home.
6. Add targeted tests and real-device QA, then proceed to Cook Workspace/menu refactor.

### Out of scope
Brisket-specific weight calculations (#5), reliable dependency replanning (#3), new template variants (#18), accounts/sync (#19/#20), imported recipes, monetization or art redesign.

## Proposed delivery order
- **P0.1** Home/session entry and resume.
- **P0.2** Cook workspace: dish menu and a clear combined timeline.
- **P0.3** Add dish/template picker and dish-level step editor.
- **P0.4** Cooking Mode navigation and Now / Next / Later emphasis.
- **P1** Stabilize domain/component boundaries, local reliability (#10), and validate the flow with phone testing (#4).
- **P2** Optional account/cloud synchronization (#19/#20), then weight-aware timing (#5), dependency planning (#3), import (#2), history personalization (#6).

## Architectural guardrails
Reuse the existing Next.js/React/TypeScript domain modules and static GitHub Pages deployment. Separate UI routes/views from cook session lifecycle and template defaults from mutable dish-instance steps. Maintain stable IDs, immutable recorded event timestamps, archive-first save behavior and backward compatible browser data. Favor deterministic scheduling and progressive disclosure. Avoid premature database/auth introduction for this UX refactor.

## Validation scenario
An existing user opens the app, sees Saturday Cookout, resumes a cook containing brisket and brats, reviews one timeline, adds wings from a template, edits only the wings steps, enters Cooking Mode, checks off a step and logs a reading, leaves to Home, and returns to exactly the same activity without resetting the cook. A new user can plan a first cook without seeing unrelated history or detailed controls.

## Delivery methodology: test-first

New UX behavior is defined by user-journey Playwright acceptance tests before implementation. Run tests to establish a failing expectation, build the feature, then require unit/browser checks and review screenshots before accepting the change. Avoid encoding brittle CSS implementation details except where protecting a known layout regression. GitHub CI is the verification source; a committed change does not imply a green build.

### Increment: template picker and focused dish editing

The workspace begins with the menu and combined timeline. The Add or Edit action reveals template choices (brisket and brats first, with existing starter variants available). Adding dishes stays within the same cook, and an Edit button on a menu card narrows the settings form to a single selected dish. Returning to the workspace must not change cooking status. This is a progressive UX refactor, not yet a dedicated route or fully isolated editable step experience.


## Guided Cook Planner increment (October 26, 2026)

The workspace now prioritizes planning actions over a full-width timeline. At desktop sizes it provides a **planning column** (meal name and serving time, dish menu, selected dish editing, readiness and checklist review) alongside a **sticky Live Schedule** companion. The schedule shows four upcoming chronological planned steps by default, with a Show full schedule control. At smaller widths, the columns stack to keep planning controls first.

This release reuses existing cook/session persistence, templates, step actions and cooking mode. The schedule is derived from the same timeline data, not separately persisted. Playwright now covers sidebar placement, responsive stacking and expand/collapse behavior. Follow-up refinements: collapse the detailed checklist preview by default, strengthen per-dish step editing and validate the flow on real devices. Promotion to `main` requires a green CI run, review of visual screenshots and acceptance of the full plan-to-cook journey.

