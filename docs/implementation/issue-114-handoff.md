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

## Next exact step

Complete Phase 2's lossless mapping, starting with a deterministic template/custom
review adapter and round-trip fixtures for brisket, brats, wings and edited custom
steps. First extend the candidate to represent current anchor offsets/checkpoint
fractions, phase lead/suppression and nested configuration without lossy generic
flattening. Test cookTimeline, physical phase and Beerometer equivalence. Preserve
original payloads and skip unsupported shapes; no historical migration yet.

Then add meal planning/execution compatibility separation, stable instance-ID
remapping, and idempotent conversion outcomes. Harden dates, non-JSON inputs and
source handling before wiring a save/import boundary. See schema doc's inventory.
Do not infer phase actions from English or mint actual events from estimates.

Only after that: Phase 3 additive saved-recipe storage with isolated PostgreSQL
ownership/race tests, Phase 4 existing-review UI wiring, Phase 5 full browser/auth/
account/offline compatibility, actual desktop/mobile/WebKit screenshot review and
PR to dev. No hosted migration or merge without review.

## Safety and resume

Stop here at the owner-requested budget boundary rather than beginning the larger
converter/persistence refactor. Completed work is committed on the feature branch.
Use the latest branch tip and the preceding implementation commit as the recorded
checkpoint (exact SHA is also in the session handoff). No pending tool operation.

Resume Codex: Read AGENTS.md, the entire current issue #114 and
`docs/implementation/issue-114-handoff.md` on `feat/114-personal-recipes`.
Continue Phase 2 from the mapping gaps in `issue-114-schema.md`; implement/test
lossless template/custom adapters before wiring canonical documents to storage.
Keep Add to meal primary and execution/history separate; no hosted mutations or
automatic merge. Checkpoint tested increments and stop cleanly if budget is tight.
