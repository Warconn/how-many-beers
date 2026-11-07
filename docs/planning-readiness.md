# #109: serving target and pre-cook readiness

Delivered to dev through #116 after owner approval on November 7. See
[dev delivery notes](releases/2026-11-07-dev.md). #117 remains a separate correctness
follow-up before production; this document does not claim a production release.

The meal's requested serving date/time is the first planning control, before any
dish. It stays editable while choosing/reviewing recipes and after combining dishes.
Recipe review and drag/edit actions retain the accepted #103 design. The primary planning summary is **Start preparing**, the earliest relevant meal
step. Estimated meal-ready time appears only when the requested target cannot be
met, alongside an inline positive difference. A suggested target is an explicit
action, never an automatic change. There is no new setup wizard.

## Calculation boundary

`planningReadiness` is a pure display projection over the existing `cookTimeline`,
step durations and explicit recipe order. Independent dish paths overlap. A fully
specified sequential recipe starts no earlier than now and each preceding end.
Fixed anchors remain displayed at the user's time, with a named conflict if work
cannot reach them. Flexible starts reflow through existing scheduling helpers.
Authored template overlaps/spacing are retained, rather than serializing every
checkpoint. Unknown required durations/unscheduled work do not produce a guaranteed
finish. No calculation writes an inferred start, completion or target to storage.

The planning task display, combined preview, live schedule and planned Beerometer
consume the same projection. Planned duration uses the shared `stepMinutes` helper
to include known template intervals even when later rows have been removed. Those
inherited allowances are never copied into an explicit editable override by the
projection. The Beerometer component and its live calculation are
unchanged. Existing active sessions/recorded activity bypass the projection entirely;
#101 continues owning physical starts/ends and running forecasts. Existing storage,
accounts, upcoming-plan promotion and completed snapshots are unchanged.

## Deterministic acceptance examples (November 8, UTC)

| Scenario | Expected result |
| --- | --- |
| At 16:00, potatoes75 + brats45, target18:00 | Starts16:45/17:15; ready18:00; window75min |
| Same meal at17:15 | Ready18:30; +30min; target18:00 until explicitly accepted |
| Turkey30prep+120roast+30rest at16:00 | Ready19:00; +60min; no past/fake actuals |
| Add independent sauce15 | Starts17:45; ready18:00 unchanged |
| Target moves18:00→18:45 | Flexible starts17:30/18:00; durations/fixed anchors retained |
| Preheat15 fixed17:20 + grill35 + rest10 | Starts17:20/17:35/18:10; ready18:20 |
| Preheat extends15→25 | Flexible starts16:50, ready18:00; fixed17:00, ready18:10 |
| Potato prep10→20, roast65 | Starts16:35/16:55; brats unchanged; ready18:00 |

Tests assert concrete ISO timestamps and visible values, not just component presence.
Additional coverage exercises reordering, insert/remove, reload, actual preservation,
account future plans without overwriting an active cook and meter coherence.

## Explicit limits deferred to #3

These illustrative recipes have known durations and independent available resources.
This does not discover cross-dish prerequisites, queue equipment, model shared cook
capacity/temperature compatibility, calibrate food doneness or optimize arbitrary
parallel steps. Existing equipment/timing warnings remain. A manually ordered recipe
is the user's order; the app does not infer that it is a safe dependency graph.
Unknown durations remain unknown. Actual food checks are still required.

No new Supabase migration. Both November 5 migrations are owner-confirmed verified
in dev. PR #106's older queue is superseded, not merged. The owner approved #115/#116 dev integration and documentation alignment on
November 7. Production promotion and future PR merges remain separately authorized.

## Reviewed application screenshots

| Initial planner | Late meal |
| --- | --- |
| ![Desktop target-first planner](screenshots/109/serving-first-desktop.png) | ![Desktop late meal estimate](screenshots/109/late-meal-desktop.png) |
| ![Mobile target-first planner](screenshots/109/serving-first-mobile.png) | ![Mobile late meal estimate](screenshots/109/late-meal-mobile.png) |

Captured from the running application with a fixed clock. The target stays ahead
of the dish choices; lateness is inline, and the existing meter remains beers-first.
WebKit screenshots are also produced by the full CI run in the review artifact.

## Owner follow-up: real brisket and ribs

Real-template tests use Sunday November 8 at **1 PM America/New_York**, planned
on Saturday at 9 AM. Default brisket preparation begins **Saturday 11:55 AM**;
loading is Saturday 9:20 PM. It leaves the smoker **Sunday 10:20 AM**, rests 160 min
and serves 1 PM. Ribs load **7:10 AM**, leave **12:40 PM**, rest 20 min and serve 1 PM.
Both serving endpoints align; their heating endpoints differ intentionally.
Changing brisket rest to 220 min moves its heating finish to 9:20 AM, preserving
both 1 PM serving endpoints and all rib timing.

The ribs' separate 6:40 AM preheat while brisket is still heating reproduces the
owner's concern. Generic `Smoker`/`Pellet smoker` labels are not proof of one
physical resource. Current exact-name warnings only flag an explicitly shared
equipment name; automatic shared preheat/capacity/temperature coordination remains
[#3](https://github.com/Warconn/how-many-beers/issues/3). No steps are silently
removed and no new shared-resource optimizer is claimed. Alarms/reminders stay #11.

A separate existing manual-template-start bug was also reproduced in raw
`cookTimeline`: moving ribs to 8:10 AM with an explicit 330-minute allowance can
incorrectly push serving to 5:02 PM instead of 2 PM by serializing in-phase
checkpoints. Tracked in [#117](https://github.com/Warconn/how-many-beers/issues/117),
medium severity and recommended for resolution before production validation of
manual template phase edits. It does not affect the default serving alignment or
change stored actuals. The focused #109 PR does not claim to resolve that bug.

| Actual templates, desktop | Actual templates, mobile |
| --- | --- |
| ![Brisket and ribs: recommended start and shared serving target](screenshots/109/brisket-ribs-desktop.png) | ![Mobile recommended preparation start with its day and date](screenshots/109/brisket-ribs-mobile.png) |
