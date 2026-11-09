# Post-brisket queue · November 8, 2026

The owner now authorizes one consolidated post-brisket feature PR covering
#124, #125, #127 and #126 plus the agreed planning configuration cleanup.
This supersedes the earlier one-issue-at-a-time queue. Use
`feat/post-brisket-experience`, consolidate the unmerged #130 work, and provide
one feature URL for owner feedback. Do not merge to dev or release production
before owner review. Preserve existing saved cooks, actuals and Hold → Finish.

Every handoff must include the exact feature URL from Cloudflare's successful
check/comment plus a short owner test plan. Do not construct the URL from the
branch name: Cloudflare can shorten the alias.

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

## Consolidated review status

The consolidated feature includes #124 timing cues, #125 direct time editing,
#127 new brisket template/reserve and #126 upcoming preparation time, along with
the owner's agreed hidden-configuration hierarchy. PR #130's unmerged work is
included in this branch; the combined PR supersedes that preview. #117/#123 remain
integrated. Owner feedback on one feature preview is the next gate; no dev merge,
production release, hosted database changes or new predictive algorithm.
