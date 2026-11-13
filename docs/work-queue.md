# Work queue

## Now: #114 personal recipes

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
