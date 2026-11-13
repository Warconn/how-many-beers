# Roadmap

## Now: personal recipes (#114)

Implement explicit Save recipe, My recipes, independent reusable method snapshots,
shared versioned cooking documents and retained deletion. Storage and UI are implemented on the feature branch, with final integration
checks and development migration approval pending; see [implementation checkpoint](implementation/issue-114-handoff.md).
The agent has run no hosted conversion or migration. November 13's validator
upgrade is additive for projects with the original recipe migration installed.
Production #137 backward scheduling is included in the candidate. The owner approved the complete editor reset on November 13: visible paired save
actions, compact equipment checklist and recipe-only authoring. The early fixed
preparation reflow correction is independent. Full CI and owner acceptance remain
required for the updated implementation. Review the contract and
actual screenshots before dev integration; hosted migration and production release
require separate approval.

## Released

PR #132 at `ae12d36` is deployed and owner-accepted. Post-brisket scheduling,
planning/cooking simplification, direct times, rest/hold defaults, meal-name
reliability, retained discard, cancellation and multiple upcoming plans are live.
#61/#83/#103/#118 are closed after production acceptance.

## Later

Resource scheduling (#3), notifications (#11), URL/photo/PDF extraction, paid/social
features and advanced synchronization remain outside #114.
