# Issue #114 implementation checkpoint

## State

Branch: `feat/114-personal-recipes`, based on current dev `c405b7d`.
Production main is `ae12d36` (PR #132), owner accepted. No open PRs existed at
session start. No production fix is dropped: production and dev application trees
match; main adds the final release-status document. No hosted data was touched.

The full current #114 issue and owner handoff were read. Owner authorizes phased
implementation, not automatic merges or hosted migrations. Save recipe is explicit
and independent; Add to meal stays primary. Retained deletion is mandatory.

## Phase 1 increment completed

- Draft JSON Schema v1, shared RecipeDefinition, typed RecipeDocument/MealDocument.
- Ajv runtime shape validation plus reference/uniqueness/range/zone/payload checks.
- Synthetic brisket and meal examples including unknown checkpoint duration,
  extended hold and a step ending heat while beginning hold.
- 14 focused boundary tests. Typecheck and all **465 tests / 38 files** passed.
- Field-level inventory and migration eligibility in `issue-114-schema.md`.
- Stale release status reconciled in AGENTS, README, core UX, roadmap/work queue
  and release notes. #61/#83/#103/#118 are already closed after owner acceptance.

The schema is a **candidate**, not finalized conversion support. No existing
save/load path imports it; there is no library UI, converter, new RPC or migration.
No browser behavior changed. Browser/screenshots/full integration suites were not
run for this disconnected domain increment; they remain required before review.
No claim that this meets the entire #114 acceptance criteria.

## Phase 2a increment completed

- Added typed native configuration, template positions/stages, checkpoint fractions,
  duration-step references, lead/suppression and separate source/planning order.
- Pure native Dish → canonical RecipeDocument → independent native Dish adapters.
  Whole-review extraction guards prevent dropping meal-level edits/activity.
- All seven built-ins and custom/text methods round-trip in the supported subset.
  Instantiation defaults to fresh dish IDs and preserves recipe-local step keys.
- Reuses cookTimeline/buildPhasePlan. No new engine or runtime save-path wiring.
- Unsupported fields, applied dated forecasts, review overrides/hidden/custom steps,
  notes and execution return skipped with retained originals. This is an intermediate
  safety boundary, not completed product support for edited reviews.
- Stronger JSON/date/reference validation. 42 focused tests pass; typecheck and
  all 493 tests across 39 files pass. Diff checks pass. Browser/screenshot testing
  remains pending integration because no application path imports these adapters.

## Next exact step

Continue Phase 2b: map whole-review taskOverrides, hidden/custom tasks and meal-level
ordering losslessly, separating authored changes from fixed dates and observations.
Start from the existing skipped edited-review cases in `tests/dishAdapter.test.ts`;
turn them into proven eligible conversions only as all fields gain explicit support.
Support canonical edited template steps through the existing engine rather than
silently regenerating defaults. Current instantiateRecipe rejects unrepresentable
canonical changes by recompiling and comparing the complete document.

Then add MealDocument adapters, including applied brisket inputs/estimates (calendar
fields belong to the meal), separate execution/history compatibility envelopes,
versioned/idempotent conversion outcomes and retained-original rollback. Prove
saved-plan/account/guest/history identity, timeline, phase and Beerometer invariants.
No historical migration has run. Local/instant/zone coherence and planning date
validation remain required before wiring documents to persistence/imports.

Only after that: Phase 3 additive saved-recipe storage with isolated PostgreSQL
ownership/race tests; Phase 4 existing-review UI wiring; Phase 5 full browser/auth/
account/offline compatibility, actual desktop/mobile/WebKit screenshot review and
PR to dev. No hosted migration or merge without review.

## Safety and resume

Checkpoint after the first tested adapter increment; do not start persistence
while whole-review/meal compatibility mapping is incomplete. Completed work is committed on the feature branch. Implementation commit:
`591c730a835660d485cd07f7a34ae704f0620eb8`.
Use the latest branch tip and the preceding implementation commit as the recorded
checkpoint (exact SHA is also in the session handoff). No pending tool operation.

Resume Codex: Read AGENTS.md, the entire current issue #114 and
`docs/implementation/issue-114-handoff.md` on `feat/114-personal-recipes`.
Continue Phase 2b from the skipped edited-review cases and mapping gaps in
`issue-114-schema.md` before wiring canonical documents to storage.
Keep Add to meal primary and execution/history separate; no hosted mutations or
automatic merge. Checkpoint tested increments and stop cleanly if budget is tight.
