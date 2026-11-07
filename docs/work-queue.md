# Current owner-approved queue · November 7, 2026

1. **Repair CI after #113.** PR #115 updates obsolete browser expectations while
   retaining protected recovery, failed-write rollback and cook/history coverage.
2. **#109: serving-time-first planning.** The final planned feature before production.
   Keep the requested target visible before dish selection and through recipe review;
   calculate pre-cook readiness without silently changing the target or actuals.
   See [the planning contract](planning-readiness.md). Fixed-clock domain/browser
   tests cover the issue's concrete scheduling examples.
3. **#117 production-readiness bug.** Real-template investigation exposed an
   existing fixed cooking-start/checkpoint reflow error. Resolve separately before
   production validation of manual template edits. Shared-smoker coordination stays
   #3; do not silently remove preheats or invent resource capacity.
4. **Owner review, dev integration and separate production validation.** No PR merges
   or production deployments are authorized during this implementation session.

## Already delivered in dev

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
