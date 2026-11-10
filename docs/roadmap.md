# Roadmap · November 9, 2026

## Now: stabilize and release the accepted experience

Serving time → dishes → adjust plan → cook → hold → finish is implemented in dev.
The post-brisket stories are complete through PR #131; #118 metadata/focus
reliability and complete release verification are the current work. Prepare release
PR #132 for explicit owner approval. Production remains main until that approval.

Preserve accounts, temporary guest trials, legacy sessions, independently saved
future plans, completed history, append-only actual events and offline recovery.
No new features or additional production database changes are authorized here.

## Delivered in dev, awaiting production verification

- #117/#119/#121: template scheduling, preparation-start hierarchy and provisional
  forecasts, through PRs #128/#120/#122.
- #123–#127: optional tools, visible when/condition cues, direct planned-time editing,
  Home preparation time and concise new brisket defaults, through #129/#131.
- #101 physical phases, #109 serving-first planning and #71 full CI remain delivered.
- Keep release trackers **#61 cancellation, #83 upcoming cooks and #103 recipe UI**
  open until the owner verifies them in production. Their feature work is not a
  new implementation queue.

## Next candidate: #114, separate from this release

Free personal saved recipes are the next feature candidate. They are individual
reusable methods, distinct from upcoming meals and whole-meal Cook Again. Do not
start #114 during release readiness; implementation needs its separate review.

## Later

Equipment/resource optimization (#3), notifications (#11), recipe URL import (#2),
photo/PDF import, social login, paid features and advanced sync (#69/#70) stay
deferred. Retain the simple mobile companion rather than adding settings/modes.

The [work queue](work-queue.md) is the operational order; the [release checklist](releases/2026-11-09-readiness.md)
records the branch audit, verification and remaining production gates.
