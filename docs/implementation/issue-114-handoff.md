# Issue #114 implementation checkpoint

## State

Storage checkpoint: `886d6d6`; UI checkpoint: `3a44905`.
Local typecheck and all 526 tests / 42 files pass. Local Chromium covered 18
desktop/phone cases across the final runs. Full CI/WebKit gates remain pending.

Phase 2c implementation commit: `c3351f1d2c64ab77981d4f7883628765bd0b84d6`.
The following docs-only commit records this tested checkpoint.

Phase 2b implementation commit: `54b57c9015ab9ea27986cdabc11e06d708105c6f`.
The following docs-only commit records this tested checkpoint.

Phase 2a implementation commit: `b98283a4388f04713d014d187b64014352e4cfaa`.
The following docs-only checkpoint commit records this SHA.

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

## Phase 2b increment completed

- Whole-review overrides, hidden/custom steps and ordering map to an authored
  RecipeDefinition.review overlay using the shared DocumentStep type.
- Fixed/recorded dates, custom-step dates, notes and removal-event history stay in
  a separate typed ReviewContext. Exact native restoration is proven before
  conversion is marked eligible; no original is rewritten.
- New reuse remints IDs, preserves authored edits/order/removals and recomputes
  against the supplied target, without old notes/events/calendar timestamps.
- Restore/reuse reproject and reject unrepresentable canonical fields. Earlier
  plain Phase 2a documents still work. All supported paths remain unconnected
  to runtime persistence/UI.
- Started/physical reviews, unrelated General prep, dangling/cross-dish refs,
  unknown fields and applied forecasts still skip safely with retained originals.

- Verification: typecheck, all **508 tests / 40 files**, and diff checks pass.
  The three focused document/adapter suites contain 57 passing tests. No browser
  or screenshot run for this disconnected domain change; required at integration.

## Phase 2c increment completed

- Added immutable MealDocument/MealContext conversion and exact native restoration.
  Independent dish snapshots reuse the review adapter. General prep, global order,
  fixed timestamps, applied forecasts and execution state preserve their ownership.
- Explicit time-zone/instant handling, conflict checks, nullable legacy targets and
  DST-fold tests; original date spelling remains in compatibility context.
- SavedPlan, ArchivedCook and CanceledCook envelopes round-trip with lifecycle,
  revisions, receipts and archived plannedTimeline intact. Archived timelines remain
  authoritative; never display/replan finished history from today's projection.
- Versioned artifacts support unchanged/idempotent results and batch dry-run counts.
  Unsupported data keeps originals; no runtime read/write path was modified.
- Synthetic 16-event Browns Brisket test, not production data or a reimport.
- Typecheck, all **521 tests / 41 files** and diff checks pass. Four document/adapter
  suites total 70 tests. Browser/E2E/screenshots not run for this disconnected domain
  increment; required when integrating the feature.

## Phase 3 storage checkpoint

- Additive `202611110001_personal_recipes.sql`: owner-scoped active/deleted records,
  retained document/deletion timestamp, revision CAS, immutable hashed operation
  receipts, per-owner serialization and no direct client mutation grants.
- Server embeds the canonical JSON Schema; a unit test pins it to the source.
  SQL also validates relationship uniqueness, ranges and references.
- Isolated PostgreSQL clean/seeded-upgrade harness passes, including an actual
  concurrent save-versus-remove race. No hosted migration was applied.
- Client API verifies owner scope and receipts. Immutable operations are journaled
  before RPC, replay after lost replies, and never silently replace changed drafts.
  Explicit conflict resolution retains a protected copy before using saved data.
- Development/production review prerequisites: `docs/recipes/rollout.md`.

## Phase 4 UI checkpoint (implementation, integration checks pending)

- Existing method review keeps Add to meal primary with independent Save recipe
  above it on phones; acknowledged inline Saved state only.
- My recipes has quiet Home/chooser entries, compact list, existing editor reuse,
  Save changes, Save as new, Cancel and confirmed retained removal.
- Library selection creates independent unstarted copies. Dish settings can extract
  a customized meal/active-cook method as a new recipe, excluding events/dates.
- Optional guest sign-in preserves the review across account selection; no guest
  meal import or automatic recipe save. Disabled account builds hide Save recipe.
- Missing hosted migration reports unavailable; it does not fake a local library.
- Local system Chromium: 16 desktop/phone journeys passed plus 2 meal-copy cases.
  Screenshots reviewed for list management. Final full CI/WebKit still required.
- Storage unit tests pass. Final full-suite counts belong to the PR handoff.

## Next exact step

Run/inspect final feature CI (full browser/auth/account/offline/build/security),
review actual iPhone screenshots, fix failures and verify Cloudflare deployment.
Keep the feature PR draft until those gates are green. The owner must review/apply
`202611110001_personal_recipes.sql` to development Supabase before hosted library
saving can work; no hosted migration or automatic merge is authorized. Migration
has only run in disposable PostgreSQL. Do not claim hosted saving was verified.

## Safety and resume

Checkpoint after the first tested adapter increment; do not start persistence
while whole-review/meal compatibility mapping is incomplete. Completed work is committed on the feature branch. Implementation commit:
`591c730a835660d485cd07f7a34ae704f0620eb8`.
Use the latest branch tip and the preceding implementation commit as the recorded
checkpoint (exact SHA is also in the session handoff). No pending tool operation.

Resume Codex: Read AGENTS.md, the entire current issue #114 and
`docs/implementation/issue-114-handoff.md` on `feat/114-personal-recipes`.
Read this checkpoint and the feature PR. Complete final CI/screenshots/preview
verification, preserving the dev-migration approval gate. No hosted changes or
automatic merges.
Keep Add to meal primary and execution/history separate; no hosted mutations or
automatic merge. Checkpoint tested increments and stop cleanly if budget is tight.
