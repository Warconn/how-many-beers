# Post-brisket implementation queue · November 8, 2026

Owner-approved order: #117 scheduling correctness, #123 Cooking Mode simplicity,
#124 timing visibility, #125 direct planned-time editing, #127 brisket template,
then #126 Upcoming Cooks start-preparing cue. One focused PR per issue; approval
is required before starting the next issue. No merge or production authorization.

#117 is implemented on `feat/117-template-checkpoints`, pending review and browser
validation. Fixed template cooking intervals now contain their checkpoints; the
literal ribs case estimates 1:40 PM doneness and 2 PM readiness. Active sessions
retain their existing projection. See step-timing.md for the boundary.

# Current owner-approved queue · November 7, 2026

The owner approved dev integration of #115/#116 and documentation alignment on
November 7. This approval does not authorize production promotion, hosted database
changes, future PR merges or starting another feature cycle.

1. **#117: next production-readiness bug.** Fix the existing manual-template cooking
   start/checkpoint reflow error in a focused PR. Default serving alignment works;
   explicit cooking-start/duration edits still need this correction. Preserve
   #101 actuals, completed history and unrelated dishes. Do not promote production
   while this known correctness issue remains unresolved.
2. **Separate production-readiness validation.** After the reviewed #117 fix, verify
   the integrated dev candidate and obtain owner approval for production promotion.
   Current dev checks/deployment evidence belongs in the integration PRs.

#109 serving-time-first planning is delivered through #116, not new development.
The flow is serving target → dishes → recipe review → combined meal → cook.
Start preparing is the normal summary; estimated readiness appears when the target
cannot be met. See [the planning contract](planning-readiness.md) and
[dev delivery notes](releases/2026-11-07-dev.md).

## Already delivered in dev

- #115: CI baseline repair preserving exceptional recovery and data-integrity tests.
- #109/#116: serving-first planning, recommended preparation start, deterministic
  whole-meal estimates and real brisket/ribs serving/rest coverage.

- #101: physical starts/transitions, concurrent forecasts and checkbox-first cooking.
- #61: retained cancellation, with acknowledged transitions and history preservation.
- #83: multiple saved account plans and one active session, independently editable.
- #71: CI improvements with browser/account/offline/security gates retained.
- #103: recipe review and consistent drag/edit controls at the normal root planner.
  Personal reusable recipe saving remains deferred.
- #113: routine backup UI and redundant success notices removed. Exceptional
  protected recovery remains available; saving uses the existing mechanism.

The owner confirms the two November 5 Supabase migrations are applied and verified
in dev. No reapplication or hosted schema/data changes are part of this queue.
Production remains a separate release; dev delivery does not imply production.

## Deferred

#3 advanced prerequisites/equipment scheduling; timers/notifications; #2 recipe URL
import; reusable recipe library; social login; paid features; #69/#70 advanced sync.
Do not begin these as incidental improvements or create duplicate/manual-QA tickets.
Stale docs PR #106 is superseded by this queue, not a new implementation backlog.

Preserve saved plans, guest behavior, accounts, completed history, actual event
history and backwards compatibility. Work on isolated feature branches targeting
`dev`; report exact test results and verify feature preview deployment.
