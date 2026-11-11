# Work queue

## Now: #114 personal recipes

Release #132 (`ae12d36`) is deployed and owner-accepted. #61/#83/#103/#118 are
closed. Both November 5 production migrations and Browns Brisket import are
complete; do not rerun them. #117/#119/#121/#123–#127 shipped with that release.

The owner authorized phased #114 implementation. Phase 1 established the shared
recipe/meal contract candidate. Phase 2a adds tested native dish adapters for all
built-ins and plain custom/text methods. Phase 2b supports whole-review overrides,
hidden/custom steps and ordering with dates/history in a separate context.
Meal/history conversion remains pending. Follow the
[checkpoint](implementation/issue-114-handoff.md) for exact progress and next step.
No UI/library persistence or migration is delivered yet. No automatic merge or
hosted changes. Add to meal remains primary; saving a recipe is explicit and
independent, deletion retained, and existing cook/history behavior preserved.

## Later

#3 resource optimization, #11 notifications, #2 URL extraction, photo/PDF import,
paid/social features and advanced synchronization remain deferred.
