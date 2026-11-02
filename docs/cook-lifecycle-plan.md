# #61 and #83 technical investigation

Investigation only, against dev `4577b015bc0e3c4241065a834760171a115e3d76`, whose tree matches production release #96 (`925cbacd348afd43640d69b2db1c173352c95fd1`). No schema, application, hosted data or issue changes were made. This is an implementation recommendation, not a claim that the features are delivered. The owner has explicitly chosen #21 first, #61 next, then #83; no manual-QA tickets are proposed.

## Verified current behavior and hazards

| Evidence | Consequence |
| --- | --- |
| `supabase/migrations/202610280001_account_foundation.sql:8` permits only `planning`, `active`, `completed`; lines 20–24 require completed snapshot/finished_at and define `one_open_cook_per_owner` over planning/active. | Canceled is a real additive server lifecycle change. Retained canceled rows can be excluded from the existing unique index without weakening one-open enforcement. #83 cannot merely remove the index. |
| Foundation trigger at lines 47–54 freezes only completed cooks; policy at 68–69 permits events for any non-completed cook. | Add terminal canceled protection to lifecycle/event paths too. Raw writes are currently revoked, but policy and helper hardening must agree with RPC invariants. |
| Foundation FK at lines 25–34 cascades cook-session deletion to events; original owner-delete policy exists, but migration 002 revokes raw insert/update/delete at lines 15–16. | App writes must stay RPC-only. Deleting omitted rows currently deletes associated actual records; do not implement cancellation by replacing the snapshot with a new cook. |
| `202610280002_account_cook_workspace.sql:103–107` reads one scalar active row using `state <> 'completed'`. | Merely adding canceled rows causes them to appear active; adding a subsequent cook can produce a scalar multi-row error. Explicitly select `state IN ('planning','active')`. |
| Workspace save lines 164–166 delete every omitted completed row and every omitted non-completed row; lines 167–190 turn arbitrary submitted history/active IDs into sessions and reject only completed existing IDs. | Canceled rows must be excluded from reconciliation deletion, and rejected as targets of active upserts and history completion. Otherwise an old/new normal save can erase or resurrect a canceled record. Completed history deletion is an existing separate explicit feature; do not conflate its semantics with cancellation. |
| Workspace lock/revision/write-ID at lines 143–148 serializes one account workspace; `append_account_events` at 111–126 preserves payload identity and occurred_at. | Reuse the lock and monotonic revision for authoritative cancellation/promotion; preserve all existing plan/events and server metadata. Lost responses need operation-specific idempotency, not optimistic UI success. |
| `src/account/workspace.ts:11–20,71–107` is one `active` snapshot plus completed history; encode always writes an active meal. | A nullable remote active is already supported on read, but client decode synthesizes an empty meal. A canceled record should stay outside the ordinary active/history response. #83 needs an explicit selected-plan storage route, not a second active draft in page state. |
| `src/account/AccountCookStore.ts:21–34,195–252,290–412` journals an immutable in-flight snapshot request, detects stale revisions, serializes critical saves and waits for acknowledgement before replacing the visible cook. | A cancellation must be its own typed critical operation in recovery, with the same auth/owner/write lock protections. It must not be encoded as an ordinary `save({active:newMeal()})`, which is destructive today. |
| `src/account/useCookWorkspace.ts:140–166` separates signed-in, legacy local and fresh in-memory trial modes. | “Guest” is two different retention contracts. Fresh trials are deliberately not durable; legacy guest cooks are durable and recoverable. Do not accidentally add persistent guest tracking under #83. |
| `src/domain/localPersistence.ts:7–11,65–86` journals only the active/history pair; `cookHistory.ts:21–27,114–127` exports only that pair in v1 backups. | A retained local canceled collection requires transactional storage and backup/recovery changes. A third unjournaled localStorage key plus clearing active is not sufficient. |
| `src/domain/meal.ts:34–43` and storage validator allow Meal.mode only planning/cooking. | Keep UI workspace mode separate from authoritative cook lifecycle. Prefer a canceled-record envelope containing the unchanged meal rather than rewriting old Meal.mode, task events or actual timestamps. |
| `src/app/page.tsx:243–266` routes new/repeat/finish/history deletion through save; history UI reads `HistoryLibrary.cooks`. | Cancel needs a dedicated action and transition. It must never call archiveCook, show as finished, increment completed counts, or permit a new cook before successful persistence. |

Only repository migrations were inspected. Hosted Supabase schema/grants and deployed function versions were not read; confirm they match before any actual schema rollout. Current local/CI Postgres harness never connects to a hosted project.

## #61 recommended focused implementation

### Data and lifecycle

1. Add a new migration after the two existing migrations. Extend state to `canceled`, add server-owned `canceled_at` and a stable cancellation operation ID (or an equivalent private operation receipt). Require canceled metadata exactly for canceled state, and keep `finished_at` / completed_snapshot null for it. Keep the original meal JSON, immutable event rows, identity, started_at and actual occurred_at values unchanged.
2. Keep the current partial unique index over planning/active. It already releases the open slot when state becomes canceled. Do not relax it for #61.
3. Treat completed and canceled as terminal to ordinary update, event append and workspace save. A canceled cook cannot be put back into active or history by a stale client, import, forged payload or normal save. Preserve current completed-history behavior separately. No canceled restoration UI is required.
4. Replace the broad non-completed active/read/delete predicates with explicit planning/active predicates. Ordinary save must leave every canceled record untouched. Add terminal-state guards in both history and active upsert branches. Continue revoking raw writes from authenticated/anon; grant execute only on reviewed owner-checked entry points, set empty search_path and schema-qualify tables.

### Cancellation API and failure safety

Prefer a dedicated `cancel_cook(expected_owner, expected_workspace_revision, target_cook_id, write_id)` RPC. Derive owner from auth.uid, reject forged owner, lock the owner workspace row, verify the exact target is its current planning/active cook, then transition that row and increment workspace revision in the same transaction. Return the regular active/history workspace plus an unambiguous receipt for the canceled ID. No history array is accepted for cancellation, so a stale client cannot rewrite completed cooks as part of the action.

Use a retained operation receipt keyed by owner+write_id, or canceled row metadata containing that request ID and target. A retry of an already acknowledged cancellation must remain safe even after a new cook has started: it should acknowledge the original canceled target and return current workspace, never cancel whichever cook is now active. Checking only `cook_workspaces.last_write_id` is insufficient once a later request has changed that value. A different stale request must fail revision/target checks, preserve a recoverable draft and offer reload. Existing v1 API clients should still load and save ordinary cooks, but cannot mutate or delete terminal canceled rows.

The client flushes pending ordinary edits before requesting cancellation. Recoverable request metadata must distinguish operation kinds (save/cancel), retain immutable owner/cook/request IDs and expected revision, and survive lost response/reload. Existing critical-operation semantics keep the old active cook visible on network or permission failure. Reset to an empty/new cook and enable Plan a new cook only after the server acknowledges the intended cancellation. Failures retain progress and offer retry/export; do not silently queue an apparently successful cancellation while offline.

### Local/guest handling

Legacy guest: retain a separate typed canceled collection, excluded from `HistoryLibrary.cooks` and resume selectors. Cancel and reset active must commit together through an upgraded journal; recovery must support existing v1 journals and snapshots, quota failure, crashes and old-tab conflicts. Preserve the completed history byte-for-byte where possible. Include canceled retention in a versioned backup/recovery format or another explicit lossless compatibility path; continue accepting old v1 exports. Do not silently discard retained records when archiving/removing completed cooks or resetting the active slot.

Fresh guest policy is the one unresolved product boundary before #61 implementation: current fresh guests use ephemeral in-memory trials, so the original ticket's identical guest start→reload→cancel persistence test cannot pass without deliberately changing that contract. Recommended default is to preserve trial semantics: the cancel action works immediately and retains the canceled trial in the trial session, without creating tracked completed history or permanent account-like guest storage. Durable retained cancellation applies to legacy local cooks and accounts. If reload recovery is intended for fresh trials, explicitly define tab-session-only versus durable retention and align disclosure/tests before coding. This choice does not block #21.

### UX and tests in the #61 PR

Place Cancel cook in secondary cook tools with a discoverable Home/resume path. Confirmation names the cook, explains removal from active view and retention, defaults focus to Keep cooking, and has a distinct Cancel cook action. Keep it separate from Finish cook and unrelated editor Cancel buttons. No canceled-history or restore screen.

Extend `supabase/tests/account-workspace.sql` (or a focused additional SQL test called by the harness) to prove owner isolation, missing/forged identity rejection, all valid/invalid lifecycle transitions, terminal event immutability, canceled exclusion from scalar active/history, a new cook after cancellation, stale old-client save after cancellation, normal save retaining canceled rows, and a canceled ID rejected in both history and active imports. Test cancel/finish/new-cook races under the workspace lock; confirm history/actuals/received metadata are unchanged. Test lost-response retry after a later new cook and operation-ID payload substitution. Update `scripts/test-account-security.sh` to exercise migrations on both clean DB and seeded existing data. Use separate database sessions for real race tests rather than only sequential mock requests.

Unit/browser coverage: dismiss versus confirm, successful account and legacy cancellation followed by a new cook, network failures and retry, reload/recovery, stale tab/account switch, completed history untouched, and trial behavior matching the selected policy. Run existing full unit, browser/auth/account/offline and real iPhone/WebKit suites, plus Postgres security tests. Inspect confirmation and post-cancel Home on desktop/phone. These are implementation checks inside the PR, not new manual-QA tickets.

Deploy migration first to dev Supabase, keep cancellation control gated until the server capability is available, then review frontend on dev. A frontend rollback must leave the additive migration and terminal guards in place. Do not restore the old broad workspace functions or drop canceled columns/state once records exist. Prefer roll forward; if disabling the feature, stop new cancellation requests while retaining all data.

## #83 model recommendation and required design checkpoint

Prefer the issue's separate account-owned saved-plan collection for normal upcoming plan saves. It isolates future drafts from v1 workspace full-snapshot replacement, permits independent plan revisions, and lets the live workspace remain one current cooking session. A collection row should carry stable meal/plan identity, owner, schema version, full draft JSON, explicit serve instant/timezone, server timestamps and revision. Active/editable payload must have exactly one owner: a saved draft is edited through the plans API, a promoted cook through the current workspace API. No auto-start, shared timers/events, concurrent active cooks or guest multi-plan behavior.

Compare before implementation:

| Design | Benefit | Main cost |
| --- | --- | --- |
| Separate saved-plans collection | Normal plan writes cannot be removed by v1 workspace reconciliation; per-plan revision and low coupling to current active/history client are natural. | Needs atomic promotion, selected-plan client context, coherent backup/export and a careful transfer path for the existing planning row. |
| Multiple planning cook_sessions rows, unique only active | One lifecycle table, stable original rows/events, fewer transfer copies. | Must redesign every scalar active selector and v1 full-replacement RPC, scope legacy writes, add current selection/pointer and per-plan revisions; merely changing the index creates immediate data loss/ambiguity. |

The separate collection does **not** make legacy migration trivial. The existing planning row may contain notes, removed-step events and original metadata. Deleting it after copying draft JSON cascades cook_events; labeling it canceled falsely records a user action. Do not implement either casually.

A safe candidate to settle in #83's design checkpoint is an explicit retained `saved`/transferred state or private linkage for **legacy planning rows only**: atomically preserve its original session/events as an immutable transfer snapshot, insert one authoritative editable saved draft using stable identity, remove it from the open-workspace selector/index, and bump the workspace revision. Normal saved plans need no cook_sessions row until promotion. Promotion of a transferred draft may reuse the retained session identity under the atomic RPC, preserving event rows and rejecting any canceled/completed ID. The retained old payload is historical migration evidence, never a second editable draft. This is an additional reviewed #83 lifecycle change, not something to prebuild into #61 or #21.

Alternatively, begin with no eager migration: present the existing meaningful planning slot as one logical Upcoming entry, with new drafts in the collection, and perform the lossless transfer only when a user starts/switches to another plan. This delays data movement but does not remove the need to specify that transaction. Empty Next cook placeholders must not become saved upcoming meals. Any planning-marked record with startedAt/physical actuals must be protected as an in-progress cook, never silently transferred as a future draft.

### Promotion, isolation and compatibility

Atomic Start saved plan must take expected owner, stable plan ID, its revision, expected workspace revision and operation ID; use a consistent workspace→plan lock order. Verify no actual active cook exists server-side, deal losslessly with a legacy planning occupant, preserve meal/dish/task IDs and serve target, create/activate exactly one session, move/mark the plan promoted, and increment revisions in one commit. A failed or conflicting start leaves the future plan intact. A retry after successful start must return the same original promoted cook even if the workspace later changes, not restart it. Two-device simultaneous promotions must have one winner and leave the other plan saved. #61 cancel and plan promotion must serialize through the same workspace lock.

The plans API needs owner-only RLS and RPC grants, payload/size validation, server-controlled ownership/timestamps/revisions, stale-write protection, deterministic ordering/pagination, and an honest discard policy. v1 save must not delete planned drafts, transfer snapshots or canceled records, even after an old client reconnects. Keep existing event guards when promoting legacy snapshots. A plan already promoted is not an editable second source of truth.

The client needs an explicit selected document context: current live cook versus saved plan ID/revision. The existing `useCookWorkspace.save/patch` always routes to the single active meal; reusing those functions unchanged will overwrite the cook. Flush/acknowledge or protect drafts before plan navigation. Recovery keys and pending operations must be scoped by owner plus document identity, not one shared draft for all plans. Preserve pending writes across account switches; no activity/timer bleed into another plan. Starting a plan or finishing/canceling a cook is a server-acknowledged critical transition.

Version backup/export/restore so plans (and retained cancellation data where applicable) cannot disappear through the current active/history-only v1 format. Continue accepting old backups without fabricating duplicate plans. Restoring a legacy backup must not wipe account plans by omission. Preserve timezone/instant data through DST and cross-device loads; no automatic scheduled starts.

## Recommended delivery sequence and risks

1. Finish/review #21 visual-only PR. Keep lifecycle implementation out.
2. Implement #61 in its own PR: review retained-state migration, update v1 RPC safety and owner/revision idempotent cancel operation, add local/trial handling and confirmation. Settle fresh trial retention before coding its persistence path. Verify additive rollout/old-client compatibility and SQL races.
3. Prepare #83 design checkpoint from #61's reviewed integration base: choose the saved-plan model, lossless legacy transfer, backup format, operation receipt and selected-document boundaries. Do not start its database migration until those choices are concrete.
4. Deliver #83 backend/storage and frontend as focused reviewable PRs if useful, keeping incomplete capability hidden. Gate UI on installed schema/API capability. Preserve #61 canceled terminals and one active cook throughout. No automatic dev merges or production releases.

Highest risks are existing full-snapshot deletion semantics, stale-client resurrection, cancellation/promotion lost-response retries, legacy planning transfer, and cross-plan client writes. The main UX risk is exposing storage complexity as extra cooking actions; Home can show one current cook and a concise upcoming list while Cooking Mode remains the approved checklist.

## Suggested guest interpretation for the design review

Keep the existing retention contract as the default: an in-memory trial can retain
its canceled envelope for that runtime, while legacy local sessions and account
cooks retain canceled records durably in their respective stores. Cancellation
must never erase existing completed guest history. Do not add durable fresh-guest
tracking simply to satisfy a reload example intended for a retained session.
If durable retention for new trials is desired, approve that policy explicitly
before implementing it. This is a #61 design point, not a blocker or schema change
in #21. Coordinate #97's focused execution simplification with visual review before
adding #61/#83 capabilities; it remains a separate recommendation for owner review.
