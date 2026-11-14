# Work queue

## Now: #114 personal recipes

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
