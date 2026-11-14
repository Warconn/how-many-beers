# Cooking documents v1: Phase 1 contract candidate

This is the initial #114 contract, not a deployed storage migration. The checked-in
JSON Schema is `src/domain/documents/cooking-document-v1.schema.json`; TypeScript
contracts and the import boundary are in `cookingDocument.ts`. Fixtures are under
`tests/fixtures/documents`. The schema URL is an identifier, not a published endpoint.

## Contract

`format: how-many-beers`, `schemaVersion: 1`, `type: recipe | meal`, ID and name
identify a document. Both document types embed exactly the same RecipeDefinition.
Meals contain independent dish instance IDs and snapshots, with optional source
recipe ID/revision as provenance only. Local serving time and IANA time zone belong
to the meal; an optional serving instant preserves account metadata.

Steps are ordered arrays with stable recipe-local IDs. Timing distinguishes null
(unknown) from zero, with optional ordered ranges. Conditions require explicit
manual confirmation. Temperatures retain value, F/C and equipment/food/unknown
purpose. Optional ingredients are plain authored strings. Parameters are bounded
scalar values, not executable expressions. Sources retain original text/reference;
references are untrusted text, never automatically fetched or rendered as links.

Phases have local IDs, heating/passive kind and authored duration. Start/end actions
refer to phase IDs; a single step can end heat and start hold. Checkpoint actions
never declare doneness. Declared step dependencies and phase predecessors must
refer to earlier entries, preventing cycles. The first boundary only validates
relationships, it does not execute actions or synthesize observations. Phase action
compilation must target the existing PhasePlan engine, never another scheduler.

Unknown properties are rejected, including execution fields in reusable definitions.
The parser validates JSON Schema plus cross-references, unique IDs, ranges, time
zone and 1 MiB payload limit, returning an independent JSON snapshot. Future schema
versions fail closed. No upcaster is claimed yet: current app Meal `version:1` is
not canonical `schemaVersion:1`; it needs an explicit compatibility adapter.

## Field inventory and adapter obligations

| Existing representation | Canonical destination / preservation obligation |
| --- | --- |
| Dish name/preset/equipment/weight/pit temperature | Definition method, equipment, weight, typed temperatures; retain preset/version and configurable defaults in reviewed adapter metadata |
| Imported RecipeStep array | Ordered step definitions; preserve original instructions, null duration, temperatures and reviewed cookingKind |
| TemplateStep anchors/progress + schedule-generated stages | Explicit relationships and offsets must be represented before enabling template conversion; never flatten to sequential durations |
| BrisketPlan manual/applied inputs, template version, turkey preparation | Preserve version and applied/raw inputs; current scalar parameter map alone cannot represent these nested settings |
| taskOverrides, customTasks, hiddenTaskIds, taskOrder, dish planning sequences | Materialize stable local keys with lossless remapping; keep fixed timestamps in meal planning only; distinguish absent, null and explicit values |
| PhasePlan / action maps / checkpoint fraction / suppression / leadMinutes | Existing authored relationships must round-trip exactly; current candidate needs additional typed fields for checkpoint fraction, lead and suppression before conversion |
| Meal completed/startedAt, CookEvent, observations, recordedPlanAt, executionAddedAt, notes | Separate executed-state compatibility record; never RecipeDefinition |
| SavedPlan document, serveInstant/timeZone, revision/receipts | Preserve owner and operation envelope, snapshot and target; recipe saves cannot write plan/workspace |
| ArchivedCook meal + plannedTimeline + archivedAt + feedback | Retain original snapshot/timeline, ID, dates, events and outcome verbatim; never replan archived history |
| Canceled library and legacy backups | Preserve lifecycle/retained payload and old read path; no auto-library population |

## Migration eligibility and review

Phase 1 converts **zero stored records**. Existing v1 data continues to use its
unchanged read/write paths. Phase 2 should report converted/skipped/failed outcomes
and retain the original payload for every proposed conversion. Until all fields
above round-trip, mark affected records skipped rather than dropping information.

Prefer a non-mutating read adapter first. New plain authored recipes are the first
eligible category; templates require explicit anchor/physical mappings. Upcoming
plans need all ordering/override settings. Historical cooks additionally require
an execution/history sidecar and immutable archived timeline. Unknown fields and
unusual legacy shapes remain readable in their original format.

Browns Brisket's production ID is `a78995d2-1b97-42c2-8f3d-9837a9e381b7` with 16
archived/stored events. No production payload was read or copied here. The example
fixture is synthetic, not a claim to reproduce that cook. Use a safe supplied copy
or an explicitly labeled synthetic invariant fixture for later migration tests.
Do not mutate, duplicate or reimport the production cook.

## Remaining validation work before wiring

Add semantic date/instant coherence checks, source URL handling if links are exposed,
finite/JSON-only parameter enforcement for non-JSON callers, and complete phase and
planning mappings. Add fixtures for brats, wings, text, edited/multi-dish methods and
historical compatibility. Prove schedule/Beerometer/event invariants and ID remapping
with adapters before calling this finalized v1 or using it as persistence input.
SQL must independently validate payloads; the client schema is not an RLS boundary.

No UI, RPC, database migration, hosted change or cooking behavior is introduced in
this phase. Later persistence uses retained active/deleted lifecycle, revisions,
immutable operation receipts and owner isolation, following #61/#83 patterns.

## Phase 2a: native dish adapter (current checkpoint)

`dishAdapter.ts` now provides deterministic `convertDish`, guarded
`convertRecipeReview`, and `instantiateRecipe` for the supported native subset.
These are pure in-memory APIs, not a stored-data migration. The recipe definition
now carries typed optional `configuration` for native preset/cook/rest settings,
manual brisket inputs, turkey preparation and source/planning order. Source step
order is distinct from planning order; neither is lost after reordering.

Steps retain template anchor/progress positions and template stage allowances,
reviewed custom `cookingKind`, and a `generated` marker for runtime/template steps
versus authored imported steps. Phases retain duration-step references, upper/lead
allowances and suppressed step IDs. Checkpoints may explicitly carry phase ID and
fraction together (or neither for a plain manual cue). Start/end arrays use local
phase IDs. The adapter invokes `cookTimeline` and `buildPhasePlan`; it does not
introduce phase interpretation or a new scheduler. Its fixed compilation date is
internal and absent from serialized recipes. Conditional checkpoint positions are
not sequential cooking intervals.

Instantiation creates a fresh dish ID by default, leaving stable recipe-local keys;
existing code constructs independent task/phase IDs from that dish ID. The optional
explicit instance ID supports round-trip verification, not replacing an existing
meal. Template step changes and arbitrary new action semantics are deliberately
rejected if recompilation cannot reproduce the complete canonical document. This
prevents edits from being acknowledged while silently discarded by native code.

Every conversion retains an isolated original and verifies native authored payload
round-trip equality before returning `converted`; unsupported data returns `skipped`
and a reason. Native input validation does not imply conversion eligibility.
Unknown native/nested fields, execution-added markers, template/custom hybrids and
applied/calendar-bearing brisket estimates are skipped. `convertRecipeReview`
examines the entire review and skips overrides, custom/hidden steps, ordering stored
at meal level, notes or execution instead of accidentally saving only the base dish.
These exclusions are not final product limitations: complete their explicit mapping
before exposing Save recipe. Meal/historical conversion remains unimplemented.

Validation additionally rejects non-JSON values (including nonfinite numbers,
undefined, Dates, functions and cycles), excessive nesting, impossible local dates,
invalid serving instants and partial checkpoint references. Local/instant/time-zone
coherence, DST ambiguity, stored step-time validation, and optional link rendering
still need the meal/import boundary work. Source reference strings are untrusted
provenance and are not followed by these APIs.

Tests exercise all seven built-in methods, manual nested brisket parameters,
imported/manual steps, authored duration/order edits, unchanged timeline/physical
projection, combined heat-end/hold-start actions, wing lead, custom suppression,
independent copy identities, source retention, skipped original protection and
repeated deterministic conversion. No Browns Brisket production data is involved.

## Phase 2b: whole-review authored overlay and separate context

`reviewAdapter.ts` supports single unstarted reviews with authored overrides,
hidden steps, dish sequences, dish step order, checklist task order and dish-owned
custom tasks. RecipeDefinition gains an optional `review` overlay. Overrides retain
explicit null duration/temperature and unscheduled intent. Added steps use the same
DocumentStep type; `nativeCustom` holds only native custom-task metadata needed to
round-trip optional fields. Base method steps and typed template configuration stay
intact, so a removed boundary is not replaced by an invented physical transition.
Consumers must apply the overlay through `instantiateRecipeReview`, not render the
base steps as the effective edited method. `instantiateRecipe` (Dish-only) continues
to reject a review it would drop.

`convertRecipeReview` returns the canonical authored document, retained original
and a separate typed ReviewContext. The context keeps meal name/ID/serving target,
notes, removed-event history, original task-ID mappings, original custom-step dates,
and fixed/recorded planned timestamps. Those dates never enter reusable JSON.
Explicit unscheduled intent survives as `unscheduled: true`; it is not a duration.
The source review is not mutated. A conversion is eligible only after reconstructing
and comparing its complete native payload (with JSON optional-field semantics).

`restoreRecipeReview` reconstructs the source review using its context, preserving
calendar spelling, hidden tasks, annotations and removed-event timestamps.
`instantiateRecipeReview` instead takes a new target and mints meal/dish/task IDs,
reuses authored changes/order/removals, resets custom dates for recomputation and
copies no notes/events/completion state. Canonical added-step keys stay stable over
repeated reuse. Both APIs reproject through the native bridge and reject canonical
semantics they cannot preserve, including inconsistent added-step durations.

Current safety boundaries: only dish-owned custom tasks belong to the recipe;
unrelated General prep, cross-dish/dangling references, unknown fields, applied
dated forecasts, physical activity, startedAt and stored phase plans remain skipped
with the original retained. General prep is a meal-level concern for the next adapter.
Removed events are preserved only in context, not treated as physical activity.
No stored historical data has been converted and no saved recipe entry is created.

Tests cover edited brisket/brats/wings/turkey/ribs, native and checklist ordering,
imported/custom steps, hidden source/added steps, zero and unknown durations,
combined phase actions, projection equality, fixed/recorded date isolation,
repeated conversion stability, canonical rejection, plain Phase 2a compatibility
and adding a fresh copy without modifying an existing active dish or events.
The Phase 2a statement that all edited reviews are skipped is superseded here.

## Phase 2c: meals and retained records (in-memory only)

`mealAdapter.ts` converts native Meal v1 into a MealDocument plus a versioned
`how-many-beers-compatibility` envelope, retaining an isolated original. Each dish
uses the existing shared RecipeDefinition/review overlay. General prep uses the
same DocumentStep type with typed native custom metadata; meal-wide ordering and
hidden references identify dish + recipe-local key (or null dish for General prep).
No recipe library entry is created.

A separate MealContext owns native execution state (mode, startedAt, completed,
notes, events and PhasePlan), original task identities, fixed/custom timestamps,
applied brisket forecasts and native insertion markers. Brisket inputs and current
cook/rest allowances remain authored; applied forecast dates are not reusable.
Review contexts restore each independent dish's native authored overrides.
General tasks and meal-wide order are reconstructed from the document and context,
then compared against the retained original. Restore additionally reprojects the
canonical document to reject changed fields the native bridge would silently drop.
This API is an immutable compatibility restore, not a meal editing API.

Serving metadata is supplied explicitly: timeZone and nullable serveInstant. Local
minute values must agree with an explicit instant in the declared zone; conflicts,
impossible local dates and malformed dates skip safely. Both occurrences of a DST
fold retain the supplied instant; a nonexistent local time conflicting with that
instant is rejected. Floating legacy local targets remain floating. If the native
target already carries an explicit offset/Z and external metadata has no instant,
the canonical document retains that native instant, never a guessed browser-zone
conversion. Context preserves the original date spelling and null external metadata.

`retainedRecordAdapter.ts` wraps saved plans, ArchivedCook and CanceledCook without
changing their lifecycle, revisions, write receipts, envelope fields or dates.
Archived `plannedTimeline` is copied verbatim and remains authoritative for history
display, including old titles/times that differ from today's generated projection.
The canonical native-method projection is not a replacement for that archived
snapshot. Do not render/replan finished history from it or auto-extract a library
recipe from it. The compatibility envelope retains both representations explicitly.
No account RPC, cancellation, archive operation or import is called by conversion.

Repeated conversion validates an existing v1 artifact and reports unchanged.
Future versions, dangling references, unsupported native fields and incompatible
serving metadata report skipped with the original retained. Batch dry runs report
converted/unchanged/skipped/failed counts; failed non-JSON inputs are distinct from
unsupported stored shapes. Restore supplies rollback to the original native record.
This is not a migration runner, persistent storage format rollout or resume journal.

Verification includes multi-dish/General prep, edited and hidden work, applied
brisket forecasts, fixed anchors, active observations/phase plans, inserted steps,
legacy completion-only records (without synthesizing stored events), nullable and
DST serving metadata, archive/cancellation lifecycle, saved-plan revisions/receipts,
unknown fields, immutable canonical rejection and batch idempotence. The Browns
Brisket 16-event fixture is synthetic; no production record was accessed/reimported.

Remaining gates: finalize/review the candidate schema and compatibility-envelope
validation/size limits before any persistence/import wiring. More unusual native
constructs may remain skipped on the original read path. There is no new meal
editing/compiler engine or consumer of these envelopes in the active application.
SQL validation, RLS/receipts, retained recipe deletion, UI, cross-device E2E and
actual browser screenshots remain later phases, not delivered by these adapters.
