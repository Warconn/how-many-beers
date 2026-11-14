# Issue #114 implementation checkpoint

**Current owner direction, November 14:** source-aware saving is implemented on
`feat/114-personal-recipes`, still draft/unmerged in [PR #134](https://github.com/Warconn/how-many-beers/pull/134).
UI source commit `a667839` follows domain checkpoint `edacc33`. The owner-approved
flow uses Choose a template / My recipes, links the first explicit save, and
shows Update original recipe / Save as copy only after reusable changes. Saves
sit below the step list, never at the heading. See the final checkpoint below;
the PR carries current exact-head CI and Cloudflare deployment evidence. Earlier
candidate statuses below are historical. No hosted mutation or automatic merge.

**Owner approved the complete editor reset for implementation November 13.**
The rejection and investigation below are historical; the new implementation
uses visible paired save decisions, a compact flat equipment checklist and
recipe-only authoring. See the final checkpoint section for verification.

**Prior pause: owner product acceptance failed November 13.** Do not merge #134 or
implement another UI patch. Earlier green CI and screenshot notes below are
historical verification, not product approval. The owner rejects Recipe actions
hiding core saves and the equipment editor. Investigation/proposal:
`docs/proposals/114-product-acceptance-review.md`. Only tests/docs/proposal artifacts
changed in this investigation; application and scheduling code remain unchanged.
Owner must review the proposed complete editor before UI implementation.

Latest owner refinement checkpoint (November 13): P0 wings implicit-rest mapping
fixed with failing-before/passing-after domain and actual UI tests. Dedicated
library/header navigation, browser Back, grouped actions, direct method saving and
multiple/custom equipment selection are implemented. Full verification is in
progress; PR #134 remains draft targeting dev. See the final sections for details.

## Initial implementation state (historical)

Storage checkpoint: `886d6d6`; UI checkpoint: `3a44905`; CI portability fixes: `fea8e49`.
Local typecheck and all 530 tests / 42 files pass. Final local Chromium run covered
20 desktop/phone cases, plus focused guest-journal handoff/removal checks. PR #134 targets dev and remains draft. Final CI/WebKit gates remain pending.

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
- Optional guest sign-in preserves a tab-scoped authoring draft across email and
  provider redirect/account selection; no guest
  meal import or automatic recipe save. Disabled account builds hide Save recipe.
- Missing hosted migration reports unavailable; it does not fake a local library.
- Final local system Chromium: all 20 desktop/phone journeys passed.
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

## Final recovery checkpoint notes

Provider redirects protect only an explicitly guest-authored review in session
storage. Account-owned/unverified cached data is never written to that guest slot.
The guest slot is handed off only after an owner-scoped immutable recipe journal
exists, preventing duplicate recovery intents after lost replies. Both email and
the existing provider callback/Back to cook path have actual browser tests.
WebKit caught a missing setup wait in the new active-cook test; it now waits for
Add acknowledgement and editor dismissal before seeding active events, then tests
recipe removal against the unchanged actuals snapshot. Assertions were strengthened.

## November 13 owner persistence report

Production #137 is included by merging main `5a34a3f` into this feature branch;
no protected branch was merged. Applied brisket method extraction retains the
full date-free holding reserve. The applied November 11 migration is unchanged;
new `202611130001_personal_recipe_validation.sql` upgrades its validator additively.
No hosted migration was applied.

The reported multi-step template failure did not reproduce after explicitly
saving each step: a new desktop/phone browser regression covers two edited names,
instructions, durations, equipment and temperatures, Save changes, Save as new,
reload, Cancel and unchanged meal snapshots. A separate confirmed failure was
recipe-level saving while a step remains open: Save changes was disabled and Save
as new disappeared. Both actions now include the open step in the draft before
conversion/persistence. This regression failed on the previous UI and passes on
desktop/phone Chromium. The exact owner-reported failure remains unconfirmed;
do not describe the reproduced UI failure as a proven database root cause.

A real PostgreSQL RPC fixture tests edited template metadata/order and independent
Save as new; the same fixture is parsed/reinstantiated by the client adapter test.
Navigation/action/equipment refinements and full integration verification follow.


## Confirmed P0 root cause after reading full PR acceptance comments

Owner example: **Smo-fried wings**. A saved method with edited/reordered steps
exposes the existing implicit five-minute rest row. `convertRecipeReview` stripped
its planning sequence before compiling the base recipe, then rejected the rest
reference as dangling. The real browser displayed the reported "This method cannot
be saved safely yet" before any RPC. Both the domain regression and actual UI
regression failed before the fix and pass after it on desktop/phone Chromium.

The adapter now compiles that native sequence first, maps the generated rest row,
and keeps its timing/phase relationships. User-added steps remain in the overlay,
not in the native-only compiler input. Unknown/foreign references, physical
activity and lossy conversions are still rejected. Tests include edited/hidden
rest, added work, exact restoration, fresh reuse and real SQL fixture rehydration.
The prior open-step save fix is useful independently; it was not the root cause
of this reported adapter rejection. Earlier unconfirmed notes above are historical.

Owner's full PR feedback also requires header-contained navigation with meaningful
browser Back, direct method saving outside Dish settings, and a small picker for
multiple/custom equipment labels. Those refinements use existing UI and native
storage semantics; no profiles, #135 or planning-mode removal are included.

## Final local text-preservation increment

The recipe review editor now uses the canonical authoring limits (500-character
step names, 16,000-character instructions) instead of silently applying the old
planning editor's shorter limits. Unchanged imported text, including a sliced
source title's trailing whitespace, is preserved exactly when editing duration.
The helper preserves fixed/recorded date overrides and rejects execution input.
A real imported long-text UI regression caught the mismatch before correction.

Latest local checks: fresh locked dependency installation; typecheck; **539 unit
tests / 42 files**; isolated SQL clean/seeded-upgrade/security/race checks, including
exact edited-template/wings RPC fixtures. The 34 desktop/phone recipe cases were
exercised: 32 passed before the final whitespace correction; all eight affected
edit/import/equipment cases then passed on the corrected code. CI runs the full
account matrix again on the final pushed commit, including iPhone WebKit.

`npm run test:full` was attempted locally. Units passed, then browser launch was
blocked because bundled Chromium/WebKit downloads return domain-policy 403s.
System Chromium provided actual local desktop/phone validation. CI supplies the
full auth/account/regression/offline browser matrix; final results/screenshots
and Cloudflare commit confirmation belong to PR #134, not an assumed success.
No hosted SQL, protected-branch merge, production deployment or Browns data access.

## CI integration correction

The full `0001a51` run passed unit/type, auth, offline and SQL security gates.
Broader failures were old equipment tests calling fill() on the new selector;
they now exercise Other/custom entry and keep all ingredient/temperature/reload,
step-count and history assertions. The visible Equipment caption is associated
with the first select and uses the same accessible name across review/planning.
All ten affected local desktop/phone import/dish-edit cases pass.

Account CI passed 129/130 cases. The new wings iPhone assertion compared against
a snapshot taken before Add acknowledgement (its baseline had zero dishes).
It now waits for both editor dismissal and the saved source dish before capturing
the unchanged-meal baseline. Exact whole-workspace equality remains required;
there are no sleeps, relaxed assertions or added retries. Both local desktop/phone
wings cases pass after correction. Full CI must rerun on this checkpoint's commit.
Actual iPhone library/editor screenshots from that run were inspected successfully;
final artifact review remains part of PR #134's verification.


## Latest owner correction: order change and minimal actions

The owner clarified the failing move was **Prepare fryer and heat oil before the
preceding wings check**, not a planned-date edit. Exact unit and actual UI coverage
now tests that order, direct meal-method saving, reload and reuse, preserving the
source meal and five-minute rest. A separate blank optional meal-name + planned
start edit reproduced the same whole-meal extraction error before the fix.

Method saving now extracts only the selected dish's authored inputs, still using
the strict review/schema boundary. It does not convert or rewrite the meal/history
envelope; optional meal metadata and unrelated dishes cannot block recipe saving.
Unsupported selected-method fields still reject. Execution and calendar context
stay on the source, and applied forecast dates stay out of reusable recipes.

The owner rejected the footer bundle and exposed equipment rows. The successor
layout has Back/Cancel at the top, one primary footer action, and one-level Recipe
actions near the header for optional save/copy. Equipment is a summary with Edit;
inside existing settings its selector stays flat. Existing-meal method saving is
one direct contextual action near its heading, without another review/save screen.
No new settings layers, profiles, #135 or protected cooking changes are included.

Before preview update: run all relevant browser/account/auth/offline checks again,
inspect the default desktop/mobile/iPhone layouts and update PR #134's candidate.
The preceding CI notes describe earlier candidates, not this unpushed correction.

Local verification of the latest owner correction: typecheck and **542 tests / 42
files** pass; all **38 personal-recipe desktop/phone cases** pass, plus **38 existing
recipe/dish/cooking compatibility cases**. The final six targeted cases also pass
after adding equipment focus return and the original pending-step export guard.
Default desktop/phone screenshots were inspected: equipment summary/Edit, optional
header recipe operations, top Back and one footer primary. Whole-meal/history
conversion validation and existing account persistence are unchanged. Run full CI
and inspect final iPhone artifacts on the newly pushed checkpoint before review.

## Owner-approved complete editor reset (November 13)

The owner approved the investigation's complete desktop/mobile proposal. The
rejected e91c57f interaction is replaced rather than patched around:

- Name, compact equipment selector, editable step list, separate Add a step and
  coherent paired method footer. Save changes / Save as new are immediately
  visible; new review uses Add to meal / Save to My recipes. No Recipe actions menu.
- Equipment uses a flat multi-choice checklist and contextual custom field. No
  repeated selectors, Add equipment workflow or Done button. Escape returns focus;
  outside click/toggle closes. Unchanged native labels are never normalized.
- Existing/new step fields stay in the recipe draft. Close keeps their edits;
  method-level saving includes open edits/additions. Cancel discards the method
  draft. Validation failures retain fields without a write. Native meal step
  editing keeps its existing Save behavior.
- Recipe authoring temporarily hides meal dates/name, other dishes, Beerometer,
  schedule and cooking controls; Add/Back returns to the unchanged meal.
- Existing JSON/adapters/account persistence/retained deletion/schema remain
  unchanged. No hosted mutation or merge. No #135 implementation.

Independent scheduling correction `65eff4a`: backward planning can translate the
flexible suffix following a fixed early preparation interval, bounded by known
slack and preserving all preceding fixed starts. Unknown/manual-sequence/active
cooking behavior stays unchanged. The synthetic 1 PM wings reproduction now
passes normally (no expected-failure marker); a truly constraining second pin,
limited slack, independent dishes and read-only state have unit coverage. The
owner's exact original saved-plan constraint remains uninspected.

Verification before final push: fresh locked dependencies; typecheck and **547
unit tests / 43 files** pass. All **38 existing recipe desktop/phone cases**, plus
**2 new open-addition/invalid-edit/Cancel cases**, pass locally. Revised acceptance
failed on the old UI and now checks visible saves, 16px responsive action gaps,
44px targets, recipe-only authoring, flat equipment and keyboard dismissal.
Actual desktop default/equipment and phone saved-editor screenshots inspected.
Broader affected general browser checks are running; final full CI, iPhone image
review and Cloudflare commit confirmation must be recorded in PR #134 before
owner re-review. Local bundled browser installation is blocked by CDN policy;
system Chromium supplies local browser evidence, CI supplies WebKit/full suites.
The feature remains draft for owner acceptance; no automatic merge.

Final schedule review found an ignored, explicitly untimed turkey thaw reminder
could be coerced into an epoch-based date when a longer roast triggered backward
translation. A failing-before regression confirms it. Only timed rows are now
eligible for translation; untimed reminders stay null. Typecheck and **548 unit
tests / 43 files** pass with this guard. The owner-approved UI is unchanged.
The affected local general matrix completed 50 cases plus four old-visibility
expectation failures; those four now pass after asserting dates hidden in review
and unchanged after Add, giving 54 verified desktop/phone cases. Final full CI
must run on this final guard commit; earlier candidate gates are not substitutes.

The final mobile review also verifies equal full-width primary/secondary footer
rows, not only gaps. The added width assertion failed before correcting the
shared responsive rule and passes afterward on desktop/phone (four affected
layout/draft cases). The final default phone screenshot was inspected. No
additional controls, design exceptions or data/schema changes were introduced.

## Linked-recipe follow-up: domain checkpoint (owner-authorized)

Latest owner direction supersedes the previous export-only meal save: Add a dish
has Templates / My recipes; the library owns paste/upload. Remember the source
recipe and revision. First save links a dish; later authored edits update that
same original, or explicitly create a differently named copy. Copy names are
editable with _1/_2 suggestions. No save controls at the dish heading. Show saves
only for meaningful reusable changes, not dates/actuals or clean saved methods.
Unchanged starter templates remain available without personal-library entries.

Domain increment implemented and tested: optional native Dish.recipeLink carries
owner, recipe ID/revision/name and SHA-256 of effective authored content. Pending
save intent retains known IDs/revisions across workspace reload and ambiguous
recipe replies; it never authorizes writes. Existing owner-scoped RPC/CAS and
receipts remain authoritative. Whole review/meal/history adapters preserve this
context and project existing canonical MealDocument.sourceRecipe; reusable recipe
JSON is unchanged. Dates, actuals, notes and execution are excluded from content
comparison. Legacy unlinked meals are not matched automatically by name.

Typecheck and all **553 tests / 44 files** pass at this domain checkpoint. Native
and canonical round trips, date/actual exclusion, unchanged editor forms, ordering,
copy-name collisions and pending metadata have deterministic coverage. No hosted
SQL/schema migration or merge. UI integration and expanded actual-browser tests
are still in progress in the working tree; this is not a new review candidate.
The previous accepted-for-testing head was bbbb75c, not this unfinished follow-up.

### November 14 UI integration checkpoint (local verification)

Implements the approved source-aware flow on the existing feature branch:
- Add dish: Choose a template / My recipes. Library contains Add your own recipe
  using the existing text/.txt/.md path; no new extraction or equipment system.
- First explicit save links this dish. Reuse retains source ID/revision/content
  hash, while retaining an independent method snapshot. Template starters remain
  computed and do not become library rows automatically.
- Changed linked methods: Update original recipe / Save as copy, after the step
  list with deliberate separation from Add a step. Library: Save changes / Save
  as copy. Unchanged recipes/templates and date/actual-only edits hide saves.
- Copy replaces the action row with one named-copy form; distinct _1/_2 suggestion,
  case-insensitive duplicate rejection, explicit save and Cancel. Acknowledgement
  relinks/renames only the selected dish. No floating heading action.
- Native planning saves persist a known target intent before recipe RPC, then
  acknowledge the source after verified reply. Recovery uses exact ID/revision/
  content and immutable receipts, never name guesses. Legacy name collisions ask
  for explicit original selection; stale originals cannot be silently overwritten.
- No canonical recipe schema change, hosted mutation or merge. Existing SQL
  accepts native source/pending metadata; the new real PostgreSQL fixture passes
  lossless save/read-back on clean and seeded-upgrade databases, alongside all
  ownership/race suites.

Local checks so far: typecheck, 553 unit tests and all 48 personal-recipe cases on
system Chromium desktop/Pixel pass. Actual desktop and phone equipment/review/
planning screenshots inspected. Additional copy-name and failed source-write
checks, broad browser CI and final iPhone/WebKit review remain required. This is
the local verification snapshot before pushing `a667839`. That UI source is now
pushed and Cloudflare-confirmed at
https://feat-114-personal-recipes.how-many-beers.pages.dev/ . Four additional local
desktop/phone cases pass: duplicate copy names are rejected and an unacknowledged
workspace source-link write creates no recipe. Fresh locked dependencies and
`test:full` pass typecheck/553 units, then hit missing bundled browsers locally.
System Chromium supplies local browser checks (video disabled because ffmpeg is
also absent); unchanged CI runs the complete browser/WebKit/auth/account/offline
matrix. Real isolated PostgreSQL clean/seeded-upgrade and all races pass. See PR
#134 for final CI results, current deployed SHA and owner acceptance checklist.
