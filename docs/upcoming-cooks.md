# Multiple upcoming account cooks (#83)

This implementation is proposed for dev, following #61. Production remains release
#100 until separately reviewed and promoted. No new timing engine, concurrent live
cooking, guest persistence, synchronization strategy or paid capability is included.

## User flow

Home separates the current cook from Upcoming cooks. Plan another cook creates a
separate saved draft; each plan has its own name, serving instant, dishes and edits.
Editing a future plan never writes into the live cook. Continue current cook returns
to existing progress and original actual timestamps. A future meal can start only
after the current session is finished or canceled. Starting explicitly promotes
that plan into the one cooking slot; completed cooks still go to normal history.
Cook Again creates a separate upcoming account plan without replacing active work.

Saving uses the existing account status icon. Temporary failures retry automatically
with a bounded backoff and on reconnect; returning Home or continuing the live cook
protects pending plan edits in the background. There are no separate plan recovery,
retry, or Resume draft controls. Conflicting edits remain protected and show the
existing attention status; automatic retries never overwrite a newer device version
or pretend an unconfirmed start succeeded.

The existing planner, guided cooking layout and Beerometer are reused. Guest and
legacy-local behavior stays unchanged. New account controls require the server's
`savedPlans` capability; older schema/fixture builds retain their previous UI.

## Data and recovery

- `saved_cook_plans` contains independently versioned, owner-scoped future documents.
  Normal workspace saves cannot delete them by omission or use their IDs to bypass
  the plans API. Raw writes are revoked and RPCs enforce owner and revision checks.
- One workspace lock serializes promotion/cancellation/legacy transfer. Per-plan
  revisions reject conflicting edits. Immutable operation receipts bind retries to
  their original request, including a retry after another cook has been created.
- A legacy meaningful planning workspace appears once as an Upcoming entry. When
  another plan starts, the original session changes to `planned` and collection
  metadata references that same session. Its original events and received timestamps
  are retained; its payload is never copied to a competing editable document.
- Planning-marked records with actual starts, completion or physical observations
  remain protected as in-progress cooks. Empty legacy placeholders are retained but
  not surfaced as upcoming meals. No automatic clock-based starts or cancellations.
- Each selected plan has an owner/plan-scoped recovery journal and writer lock.
  An owner-scoped creation index makes unconfirmed first-save drafts discoverable
  after reload. Draft recovery must complete locally before returning to an active
  cook when a future-plan cloud save fails; no cloud-saved success is fabricated.
  Cross-account changes and old tabs cannot replay another owner's pending request.

## Internal backup compatibility

Routine Home and Past cooks views intentionally omit backup export/import controls during alpha testing. The underlying recovery and backup formats remain supported, with no database cleanup or data deletion.

- **Current cook and history:** The existing version-one JSON format preserves current and completed cooks, including legacy local cancellation records. Import does not remove separately stored upcoming plans.
- **Upcoming plans:** The versioned `how-many-beers-upcoming-plans` JSON format preserves saved future plan IDs, full meal documents, serving instants, time zones and any meaningful legacy future plan. Import only adds absent plans, treats identical entries as no-ops and rejects divergent IDs atomically without modifying the active cook or history.

Recovery procedures can still use the underlying export/import services. Normal cooking remains focused on planning, current progress and Past cooks, without backup utility controls. Account saving and protected pending edits continue automatically.

## Migration and rollout

Review and apply migrations in order on dev:

1. `202611050001_retained_cancellation.sql` (#61).
2. `202611050002_saved_upcoming_plans.sql` (#83).

Verify the deployed dev schema matches the checked-in foundation before applying
changes. The second migration adds owner-scoped plan storage/receipts and strengthens
v1 saves against replacing real active cooks. The unique one-open index remains.
Legacy transfer is lazy and transactional; install does not rewrite existing plans,
events, actual timestamps or history. `archive_import` is an internal staging state
used only within transactional history imports; it fixes importing an archive while
retaining an existing active cook without altering the active row.

The real PostgreSQL harness covers clean and seeded upgrades, preserved payloads
and timestamps, ownership/RLS/grants, stale writes, terminal guards, backup conflicts
and actual competing promotion/cancellation/save sessions. Browser validation covers
the active Pumpkin Seeds + future Brats journey, multiple independent plans,
second-device retrieval, cancel/start/finish/history, failed creation/reload and
backup import. Inspect actual desktop/mobile/iPhone screenshots before acceptance.

No hosted schema changes are made from this development workspace. Capability
checks hide unsupported UI until the RPCs are installed. Roll back by disabling new
UI; retain additive tables, receipt/terminal guards and transferred legacy records.
Never drop a table/state containing retained user records as a frontend rollback.
