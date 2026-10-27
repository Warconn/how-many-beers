## Production release and outstanding UX bugs (October 26, 2026)

Core Cook Experience release [PR #29](https://github.com/Warconn/how-many-beers/pull/29) reached `main` at `3e7868d`; user confirmed the GitHub Pages production site reflects the release. Current capabilities include Home/resume, Guided Planner, unified template/text-import Add Dish, expandable step controls, and CI Playwright. This is a functional baseline, **not a polished finished planner**.

Production bug backlog:
- [#28](https://github.com/Warconn/how-many-beers/issues/28): Overhaul adding/editing dishes and layered step management. Clarify Add vs contextual Edit and reduce scroll/state confusion.
- [#30](https://github.com/Warconn/how-many-beers/issues/30): Make live combined schedule directly selectable/editable, sync dish changes, preserve recorded actual timestamps. Do not confuse with full dependency optimization (#3).
- [#31](https://github.com/Warconn/how-many-beers/issues/31): Remove redundant Ready When You Are card; replace with compact Start/Continue and preserve warnings.

Next delivery cycle: product decisions and acceptance tests here, implementation via Codex and feature branches, run TypeScript, unit, Playwright and build before PR to `dev`, approve green CI then merge to `dev` for Cloudflare preview, and promote reviewed candidates to `main`. Current Cloudflare Git integration still triggers on `dev` pushes; deployment gating is planned, not configured. Tests should cover both browsers and responsive layouts, refresh/resume and history retention.

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
4. **Adjust a dish**: Expand its menu card to work directly with its steps. Keep name and equipment/timing settings in a secondary disclosure within that card. No separate details surface or return navigation.
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


## Issue #28: one menu surface

Review feedback on the first PR iteration found that a menu card plus a separate
Dish details / Edit dish panel still felt layered. The revision uses an inline
accordion within the menu instead, with a single dish heading and no return navigation.

1. Set serving time.
2. Add a template or imported text recipe in the menu. Cancel adding does not mutate
   the cook. After adding, the picker closes and the new dish expands immediately;
   keyboard focus moves to its header.
3. Adjust that dish's steps in place, or select another dish. Clicking the expanded
   header collapses it. Only one dish is expanded at a time.
4. Use Dish settings for name, equipment, durations and optional reference settings.
   Settings stay collapsed by default. Step actions are visible directly in the dish.
   Remove dish is a compact trash icon beside the heading, not hidden in settings;
   it retains a descriptive accessible label/tooltip and a 44px touch target;
   confirmation is required. Cancel does not mutate the cook, and removing one dish
   preserves other dishes, recorded events and the open editor for another dish.
   Focus returns to a remaining dish or Add a dish after removal.
5. Add more dishes or start cooking. The responsive Live Schedule stays derived from
   the same cook; no direct timeline editing (#30) or Ready panel removal (#31).

The step list drops nested cards and repeated dish labels, while keeping instructions,
condition warnings and existing event semantics. Numbers and reorder boundaries are
local to the dish; moving a step swaps it with its own dish's neighbor and preserves
other dishes' relative order and recorded events. Existing global checklist reordering
continues to use the original behavior. No storage schema or ID changes.

Playwright covers creation, import, cancellation, auto-expansion, one-card selection,
settings, back/collapse/resume, and editing/reordering/removing steps in a saved cooking
session without changing completion or temperature events. The inline-menu acceptance
test first failed against the separate-panel UI. Desktop and phone screenshots are
saved under docs/screenshots and attached to test runs. CI uses managed Chromium;
this cloud runner uses system Chromium with optional video disabled.

## Issue #31: compact Start/Continue action

The planner transitions from menu to cooking without a second summary card.
Start cooking is the primary action directly below the menu; Review checklist
opens the existing full checklist only when requested. Serving time and combined
step information remain in their existing header/menu and Live Schedule locations.
The Ready When You Are panel, duplicate metrics, and separate timing-tip card with
Start a fresh plan are removed. Starting a replacement cook remains a Home action,
with the existing confirmation and preservation rules.

Starting requires at least one step and a valid serving time, with a visible disabled
reason otherwise. Existing general-prep steps still count and can be added without
a dish. A cook with mode cooking or an existing start time shows Continue cooking;
continuing does not write a fresh start timestamp or require the plan to pass
starting validation again. For normal active cooks it only changes the UI view;
legacy cooks with a start time and missing lifecycle status normalize to cooking. All completion/event/note data
and legacy saved cooks retain the current storage format.

Plan notes remain visible below the actions: shared-equipment conflicts, untimed
steps, and the reminder that schedules are estimates and thermometers/food-safety
checks are still required. Notices are not hidden inside the checklist disclosure.
An incomplete schedule does not assert readiness or invent timings. The optional
checklist retains step actions and custom-prep entry; it is not a new timeline owner.

Desktop/mobile Playwright checks cover removal of the old summary, compact placement,
empty/invalid start reasons, initial start, real step completion and refresh/resume,
legacy active cooks without a start time, warning visibility and checklist disclosure.
The tests first failed against the previous UI. Screenshot evidence is saved under
docs/screenshots/issue-31-*.png. Direct schedule editing (#30) and removal discovery
(#33) stay separate.

## Issue #30: shared step timing editor

Dish steps and Live Schedule now reach the same inline editor for planned date/time,
estimated duration, name/instructions, step equipment and an optional target food
temperature. General prep opens in checklist review. The flat menu remains intact;
Save/Cancel does not add a separate details page.

Manual times are fixed, plan timing remains derived, and reset restores original timing.
Duration updates estimated finish and adjusts following timed steps in the dish when
needed, preserving other dishes and fixed/recorded anchors. Live Schedule is
chronological; manual checklist order remains distinct. Actual events and completed
history are preserved. See [Step timing](step-timing.md) for the complete rules,
calendar/DST behavior, tests, manual checks and remaining scheduling limitations.

## Following-step duration adjustment (#41)

Enter a duration in minutes or hours. Extending a step beyond the next planned start
pushes following timed recipe steps while preserving their spacing. Shortening or
Use plan timing removes the extra delay. Other dishes, fixed/recorded steps and actual
activity stay intact; conflicts and a serving-target overrun produce warnings. Untimed
stages break links; custom/general prep stays independent. See [step timing rules](step-timing.md).
