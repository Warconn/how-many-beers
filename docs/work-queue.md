# Work queue

## Current approved queue: #162 then #161

#162 delivered through PR #163 at `385331f`: word quantities require a separator
before units; numeric shorthand and ambiguity protections remain. #161 uses the
existing detail component and one native activity disclosure; its PR records final
CI and screenshot evidence. Stop after that verified dev merge.

Owner authorizes two small, separate, verified dev PRs and merges: word/unit
separation in recipe duration parsing, then a collapsed Recorded activity section
in Past cook details. Preserve ambiguity handling and archived data. No full
production regression, #3/#150, hosted/schema or main changes. Stop after both.
Shared-list #159 is delivered through PR #160 at `82963de`.

## Current owner refinement: shared library cards (#159)

Owner requests matching compact My recipes/Past cooks cards and contextual trash.
Implement on an isolated feature branch and PR to dev for preview/review; no
automatic merge is authorized for this follow-up. Shared list/header presentation
preserves existing confirmation, data and account boundaries. #3/#138/#139/#150
remain on hold. The prior four-item dev queue below is delivered, including #145
through PR #158 at `2db8e93`; #153 still awaits final physical cooking inputs.

## Approved dev queue (November 15, 2026)

Production release #151 is owner-verified stable. Dev contains the same production
code. Implement and merge focused, green PRs to dev in this order:
#152 Past cooks attribution/spacing → #154 step editor → #153 reusable fried turkey
→ #145 Home next action. Production remains unchanged. #3, #138, #139 and #150
are on hold; do not resume them as part of this queue.

#152 delivered through PR #155, merged to dev at `ad8ce83` after all required CI
and desktop/mobile/iPhone screenshot review. Display archived attribution using stable IDs from
that cook's archived timeline only; preserve event sequence, values and timestamps.
Past cooks card actions use a compact 12px gap and retain 44px targets. Verification
passed in the issue PR. No schema or stored history changes.

#154 delivered through PR #156 at `fc9d599`, with all required CI and reviewed
planning/recipe iPhone screenshots. Flat planning step fields with Start time/Duration together,
compact actions, override-only reset and human duration units. Recipe authoring
keeps dish equipment and removes per-step settings. Hidden metadata survives
unrelated edits and validated recipe round trips. No persistence, scheduler or
schema change.

#153 delivered through PR #157 at `9e4cc27`, after required CI, real PostgreSQL
and desktop/mobile/iPhone review. Downloadable, owner-importable Deep-fried turkey
method through the existing upload/review/save path. Separate electric-fryer
equipment, editable 60-minute owner-specific preheat allowance and unknown frying
duration. Real local PostgreSQL validates the exact shared JSON. Owner inputs are
19–20 lb per bird provisionally, November 22 at 3 PM local; model capacity remains
unconfirmed, so no final Thanksgiving schedule. See [review/import instructions](recipes/deep-fried-turkey.md).

#145 implementation: compact read-only Next up in the existing active-cook Home
card, preserving Continue / View / Cancel layout. Canonical guidance/projections
supply ordering and times; conditional/uncertain work stays neutral. Completion,
reopen, edits, resume, simultaneous steps and passive waiting are covered, with
one existing page clock and no additional timer/service or persistence field.
Exact CI/merge evidence is in the issue PR. #3 remains a separately authorized next
phase; #138/#139/#150 remain on hold. Full regression remains the release gate.

## Delivered: rejected personal-recipe save recovery

PR #134 merged into dev at `58119a2` after owner acceptance. The earlier
pre-merge statuses below are historical. Dev subsequently rejected recipe writes
with HTTP 400; the owner has since confirmed the November 13 validator upgrade restored writes.
PR #140 merged the separate library-read recovery into dev at `3e3f35a`.
A confirmed secondary defect let a rejected pending write prevent reading the
recipe library. The feature follow-up reads saved recipes even when replay fails,
retains the exact protected operation, and reports the pending failure. No hosted
changes, schema changes, or automatic merges. Regression coverage includes rejected
write recovery and a synthetic older brisket Cook Again → recipe save journey;
the latter does not substitute for verifying the hosted backend.

## Historical #114 implementation notes (delivered)

Pre-dev acceptance follow-up: remove the header-library Add your own recipe
shortcut, which reused meal planning. Keep the working Add dish text/upload box.
Independent recipe creation from management is deferred; there is no misleading
creation action in the current library. No schema/persistence change or merge.


Owner accepted the recipe editing/choosing/saving behavior and requested one entry
correction: Add dish → My recipes is an inline grid using the template boxes,
including Add your own recipe. Full library management stays in header navigation.
The correction adds no persistence/schema changes. Manual acceptance and automated
coverage are mapped in [recipe regression instructions](recipes/manual-regression.md).
Current exact-head verification and feature URL are tracked in PR #134.


November 14 approved follow-up is implemented for verification on #134: source
identity survives first save/reuse, changed meal methods update the same original
or create a distinctly named copy, and unchanged/date-only methods hide saves.
Controls moved below the step list; Add dish is Choose a template / My recipes,
with existing text/file creation in the library. Legacy links require explicit
selection; lost replies and stale revisions preserve independent snapshots.
No hosted changes or automatic merges. Final exact-head CI and owner review remain
required; see the implementation checkpoint for verification progress.


Release #132 (`ae12d36`) is deployed and owner-accepted. #61/#83/#103/#118 are
closed. Both November 5 production migrations and Browns Brisket import are
complete; do not rerun them. #117/#119/#121/#123–#127 shipped with that release.

The owner authorized phased #114 implementation. Phase 1 established the shared
recipe/meal contract candidate. Phase 2a adds tested native dish adapters for all
built-ins and plain custom/text methods. Phase 2b supports whole-review overrides,
hidden/custom steps and ordering with dates/history in a separate context.
Phase 2c adds in-memory meal/history/saved-plan compatibility adapters, preserving
serving metadata, execution and archived timelines. Follow the
[checkpoint](implementation/issue-114-handoff.md) for exact progress and next step.
Phase 3/4 now implement additive recipe storage and the minimal library UI on the
feature branch. Isolated SQL and focused Chromium checks pass; final full CI and
WebKit review are pending. Hosted saving needs the owner-reviewed development
migrations in [rollout notes](recipes/rollout.md). The agent has applied neither
remotely; the development project may already have November 11 installed.
November 13 adds a validator-only upgrade, without rewriting applied migrations.
Owner refinements include open-step Save changes/new coverage, a dedicated library,
a coherent footer with primary plus visible secondary save decisions, top
Back/Cancel, recipe-only authoring and a compact equipment checklist without Done.
The complete reset proposal was owner-approved after rejecting the earlier
Recipe actions disclosure and stacked-selector implementation. Selected-dish saving is direct; exact oil-before-check
reordering and optional-meal-metadata extraction have regression coverage. The wings conversion failure is reproduced and fixed: native sequence compilation
now retains its implicit rest row when mapping edited/reordered method references.
Failing-before domain/UI regressions cover both save paths. Open-step saving is
also covered independently.
Production #137 backward planning is included on the feature branch. No automatic merge or
hosted changes. Add to meal remains primary; saving a recipe is explicit and
independent, deletion retained, and existing cook/history behavior preserved.

## Later

#3 resource optimization, #11 notifications, #2 URL extraction, photo/PDF import,
paid/social features and advanced synchronization remain deferred.
