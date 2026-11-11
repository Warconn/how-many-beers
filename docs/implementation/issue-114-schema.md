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
