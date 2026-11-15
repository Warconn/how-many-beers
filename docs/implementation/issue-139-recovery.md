# #139: account plan recovery and first-dish commit

## Root cause and failing regression

The authenticated browser can have an owner-scoped pending-plan index/journal
whose server row was already discarded. `mergePendingPlans` intentionally retains
protected local work even when the remote list is empty. The old discard route
opened/retried the draft, then required `flush(true)`. A missing server revision
caused a conflict, or a retry against a retained tombstone failed. Neither could
acknowledge discard, so the card and warning survived reload. Older Plan a cook
also indexed and saved an empty seed before the first dish, creating these
unnecessary recovery records.

The browser regression seeds a synthetic Next cook at 2026-11-15 18:00 in actual
IndexedDB, with an empty remote list and a retained discarded record. Before the
fix, trash left the card visible. The tests never read, clear, import or modify the
owner's real account/browser records. The fixture now rejects saves to retained
discarded IDs, matching the SQL instead of permitting accidental resurrection.

## Corrected lifecycle

- Explicit discard opens without replaying a save. It waits for in-flight work,
  verifies owner/current server state, and durably journals its decision. A stopped
  background writer retains its lock until requests already sent settle; discard
  cannot inspect an absent row while that worker is still creating it. Confirmed
  Home snapshots stay visible during the discard read; card removal is checked
  only after the actual retained-deletion acknowledgement, including a gated
  server-response regression. Selected writes own their Saving indicator. Home discard uses an independently
  locked command store, preserving the actual current-cook card and editor
  selection throughout the request.
- An absent upcoming record resolves just that local plan/index entry. This does
  not assert whether it was discarded or promoted, and touches neither history
  nor the active workspace. A recovery entry sharing the promoted active cook ID
  is routed to the plan store, never active-cook cancellation. Dirty recovery remains protected until explicit
  discard. Failed remote discards retain authoring data in the recovery journal.
- A server-backed plan requires its known revision (or this operation's exact
  acknowledged next revision), then reuses one immutable discard receipt across
  retries. Newer-device changes, owner changes, locks and storage conflicts block
  unsafe removal. A refreshed Home revision cannot override the base revision of
  protected older edits or authorize deleting an unreviewed newer method. A local terminal marker also survives reload.
- Old empty, absent local drafts are not automatically saved merely to recover
  them. Existing genuine empty saved plans still use normal retained deletion.
- New Plan a cook drafts use owner-scoped session storage in their originating
  tab, not the cloud plan index. Serving/name edits and recipe reviews survive
  reload/sign-out; another owner cannot see them. First Add to meal hands the
  composed meal to existing versioned saving; failures retain its recovery and
  review. Later autosave and Cook Again remain unchanged.
- Header status distinguishes Draft from acknowledged Saved. Resolving an entry
  recomputes status against remaining work. The normal header/account control
  stays mounted during real loading; static placeholders introduce no delay.

## Verification and manual boundary

`tests/discardPlans.test.ts`, `tests/planningDraft.test.ts` and
`e2e/auth/upcoming-plans.spec.ts` cover orphan/local/initial-operation recovery,
normal empty/populated saved plans, failed first saves, confirmation, lost discard
responses, stale revisions, reload, owner switching, tab locks, separate recipe
saving and delayed account reads. Existing active/history and multi-device tests
continue to assert independent records. CI runs desktop Chromium and iPhone
WebKit; local review additionally runs phone Chromium. The disposable PostgreSQL
security suite verifies ownership, receipts, retained deletion, validators and
save/cancel/promotion races. No new migration or hosted cleanup is required.

Owner dev check after deployment:

1. Keep existing browser data. Refresh dev and discard the phantom Next cook.
   Confirm it stays gone after another refresh and the warning clears if no
   other work is unresolved.
2. Open Plan a cook, change the serving time, review/edit a recipe, and save it
   to My recipes. No upcoming meal should exist yet. Reload the same tab and
   verify the draft/review remain available.
3. Add the first dish, save the plan for later, reload, edit it and discard it.
   Expect one plan, proper confirmation for populated work and no resurrection.
4. Check My recipes and Browns Brisket in Past cooks. Continue/reload an existing
   active cook and verify its actual progress remains intact.

Public deployment success and simulated browser RPC tests do not verify the
owner's exact retained IndexedDB UUID or independently sign in to hosted account
data. The owner reported the dev recipe-validator upgrade applied successfully;
this repair does not rerun it. Production remains unchanged.
