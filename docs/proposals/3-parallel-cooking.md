# #3: architecture and reproduction checkpoint

The owner's implementation brief supersedes the issue's earlier design-only hold.
This checkpoint contains synthetic regression fixtures and this proposal, with no
application refactor, hosted database changes, production deployment or merge.
Base: current `dev`, `e1b21f0`. The consolidated issue description remains the
product contract; historical comments proposing tabs/dashboards are superseded.

## Findings from the current code

- `cookingPhases.ts` already stores stable phase IDs and start/end actions;
  `cookState.ts` appends actual boundary observations to events. Reuse that model.
- Imported phase compilation chains a recognized timed heating/passive instruction
  to the next such instruction. Preheating is not recognized, explicit removal
  often is not recognized, and heating without an end is discarded. This loses
  fryer warm-up and unknown-duration frying relationships.
- The wings template has smoking/frying intervals but no independent oil interval.
  Its oil instructions currently place oil setup after smoking. New template
  definitions need explicit readiness/removal boundaries and consistent wording;
  do not rewrite previously saved cooks to insert those new steps.
- Repeated temperature events already persist for a checked task. There is no
  explicit observation-to-activity attribution for concurrent activities, and
  repeating a reading requires reopening optional tools on the selected step.
- `page.tsx` selects the first active phase belonging to a dish for step tools.
  With two active phases in one dish this can target an unrelated phase for start
  correction or a remaining estimate. Resolve by authored task/activity links.
- `phaseForecast.ts` has one serial cursor per dish. Independent same-dish work
  needs separate interval projections; chronology alone must not imply dependency.
- Dish removal currently leaves its phase plan entries behind. The projection
  already excludes an orphan whose dish is absent in the synthetic baseline, but
  this is not complete validation of stale actions, order or suppressed rows.
- Recipe documents already contain phases and per-step start/end/checkpoint
  actions. Native adapters rebuild those relationships, and JSON/SQL validators
  restrict the shape. Saved corrections must round-trip through all adapters,
  ownership checks and independent meal snapshots rather than disappear on reuse.

## Proposed behavior

An activity definition has its own stable ID, owning dish, stage, start step,
end step, checkpoint links and provenance. Estimates are optional. Lifecycle is
derived solely from explicit recorded boundaries, separately from stage and
checklist completion. Four shared display labels: Preparing, Preheating, Cooking,
Holding. Existing heating/passive fields remain compatible internal forecast
information; passive preparation must not blindly become Holding.

Checking a **new authored start action** records that start at the user's action
time; checking an ordinary step records only the milestone. Checks and readings
never stop an interval. Only the authored end action records its end. A deliberate
compound transition appends both observations atomically to one event. Repeated
completion is idempotent. Legacy completion events never acquire physical
observations merely because new code opens or migrates their meal.

A checkpoint remains checked after its first completion. **Record another
reading** stays available on that row and opens the existing reading form. Each
observation carries its original task, timestamp and explicit activity reference.
When more than one activity is plausible, require an explicit choice in the
reading form rather than guessing the first active phase. Note-only observations
must also retain separate timestamps rather than overwrite one mutable note.

A readiness gate is different: an oil temperature reading does not check **Verify
oil is ready**. The user confirms that condition separately to end Preheating.
Unknown duration never prevents a confidently authored start/end pair from being
used, nor supplies a fabricated frying allowance.

Running feedback appears directly beneath the start step: **Cooking · 4h 20m
elapsed**. Once ended it shows actual duration when both observed boundaries
exist. Keep the Beerometer, flat list, familiar details and meal-wide sticky guide.
The guide gains a checkbox that calls the same action handler as the row. Its
selection is independent of the row being inspected: rank manual actions by
known due time with stable checklist-order ties; unknown conditions remain honest
and accessible. Do not introduce a second guidance engine for Home.

## Recipe review and detection

Detect once at import/creation/review, using explicit verb/object/equipment pairs
and unambiguous boundaries. Do not infer an end from the next cooking instruction
or require a duration to recognize a physical activity. Check, wrap and adjust
remain interventions unless a transition is explicitly authored.

Auto-accept only clear pairs. Show a small **Review activity** affordance for
uncertain suggestions; leave them ordinary until corrected. A compact inline
editor offers stage/No activity, Start at and End at. Persist explicit rejection
so inference cannot recreate an activity the user removed. Reuse existing method
draft, Close/Cancel, save-original/copy and Add to meal behavior.

Renaming keeps stable links. Boundary deletion/replacement or invalid reordering
flags the specific relationship for review. An active definition with observations
is not silently relinked; recorded boundaries remain associated with its original
definition. Checkbox reopen changes the milestone only. Physical corrections use
an explicit append-only correction, preserving the original event and validating
its relation to the other boundary; an ordinary checkbox is not a timer reset.

## Projections, compatibility and persistence

Project independent activities independently, joining only at authored boundaries
needed for following work. Meal remaining time uses the latest required branch,
not the sum of concurrent durations. Preserve the requested serving target,
unknown-duration/lower-bound behavior and existing Beerometer presentation.
This is a limited projection repair, not equipment allocation or an optimizer.

Add versioned activity metadata and a repeatable, lossless compatibility adapter
with retained originals. Saved recipe definitions and each meal's execution plan
remain separate snapshots. Validate all phase/action/task references against their
owning dish before live guidance, attribution or timing uses them. Preserve orphan
history for archival reading; exclude it from live state. Existing ambiguous
sessions can retain their legacy execution path rather than invent actuals.

Check recipe JSON and server validator compatibility before enabling writes of new
metadata. Prepare and test any necessary additive validator migration and rollback
locally; supply it for later review, never run hosted SQL in this work. Avoid
claiming that no database action is needed before those round-trip tests pass.

## Regression evidence and next checkpoints

Fixtures are newly synthesized from the issue's published action descriptions.
The turkey target is Nov 22, 2026 at 3 PM America/New_York (20:00 UTC). Eight
synthetic completions reproduce the reported no-physical-observation baseline,
including a stale former-dish phase. These are not exports of private records or
claims of exact replay of the owner's original event history.

- New domain suite: three intended failures (fryer pairing, parallel turkeys,
  independent wings oil heat); three passing preservation checks (brisket, brats,
  stale-dish exclusion with unchanged events/backup).
- Existing cooking phases, fried-turkey recipe and history activity: 41 tests pass.
- Typecheck passes. New browser acceptance tests reproduce missing inline elapsed
  feedback and the missing checked-checkpoint reading action on desktop/mobile
  (four intended assertion failures). Actual desktop/mobile screenshots reviewed.
  The managed browser download returned HTTP 403; the local run used system
  Chromium through a temporary config with screenshots/traces and video disabled
  because the managed ffmpeg binary was unavailable. Repository browser settings
  and suites are unchanged; this is not pinned-browser or WebKit acceptance.

Checkpoint 2 implements the domain/event model with reload, corrections and local
compatibility tests. Checkpoint 3 adds detection/correction and Cooking Mode changes
with actual desktop/mobile screenshot review. Checkpoint 4 runs all four scenarios,
affected account/offline/browser suites and opens a reviewed feature PR into `dev`.
The owner reserves product review before merge; no production deployment is part
of this implementation.
