# #101: physical cooking behind the checklist

Implementation follows the owner-approved November 5 design in
[the mobile review](design/101/README.md). This feature branch targets dev; it is
not merged or released. Planning changes in #109 and the accepted #103 prototype
in PR #108 remain separate.

## Cooking interaction

Read the action, do it, check it off. A built-in physical loading action records
its actual start. A checkpoint never ends or restarts that interval. One genuine
transition can end heat and start cooling/rest at the same recorded time.
No extra Start buttons, timestamp prompts or phase-classification screens appear
in normal cooking. Optional actual-start corrections and remaining estimates stay
inside Step details. Other active dishes are quiet context in the current card.

The Beerometer remains beers-first, with full-meal time beneath and one serving
estimate at the bottom. A positive difference from the unchanged target is inline,
e.g. 5:15 PM (+15 min). Projected/session elapsed totals live in Cook details.

Concurrent dish paths overlap. A supported recipe upper allowance can revise an
expired heating estimate; no range or rolling extension is fabricated. With no
usable remainder, show the earliest-serving bound from known following work, with
“+” on the beer/time quantities. Heating stays active until observed removal.
Passive cooling/rest estimates can reach zero without an actual end, safety claim,
Serve checkbox or automatic archive. Finish cook remains a separate deliberate act.

## Persistence and compatibility

- Fresh sessions capture a versioned phasePlan of authored IDs/relationships. Old
  active sessions are not upgraded or reinterpreted. Their forecast path remains.
- Imported instructions get conservative cookingKind suggestions at parsing/review (or once at a fresh start for older reviewed plans),
  not while executing actions. Unclear steps retain ordinary checklist behavior. The
  automatically added planner Serve row is omitted from execution only when the
  final reviewed phase is passive; authored serving/safety actions are retained.
- Compound phaseObservations are metadata on one existing completion event. Optional
  corrections append another event rather than editing an old timestamp. Reopening
  a checkbox never erases physical facts. Duplicate completion is idempotent.
- Optional phaseEstimate metadata records a remaining estimate at its observation
  time; it does not modify actual starts or recipe durations.
- Existing meal/event JSON, owner-scoped save mechanisms and transactional account
  RPCs retain these optional fields. No new event kind or SQL migration is needed.
  Saved-plan promotion stores relationships before the existing atomic server start,
  which retains the authoritative startedAt. No hosted account data is mutated by QA.
- History snapshots/backups retain definitions and original events. Cook Again starts
  a new plan without phasePlan or actuals; a fresh start compiles its new relationships.
- Adding a dish compiles only that dish and never starts it. Existing relationships,
  activity and target remain intact. Invalidly ordered template boundaries fall back
  to ordinary checklist behavior without restricting planning moves.

## Verification

Unit and browser coverage includes concurrent brats/potatoes; +15-minute checkpoints;
45-minute grilling overrun; grounded 65-minute allowance; actual removal/rest at 4:55
and finish at 5:05; start correction from 4:12 to 4:00; no changes to other actuals;
optional remaining estimate; Sunday brisket with rapid check-offs; roast/cool import;
passive zero; replay/backups/history; legacy sessions; arbitrary planning moves;
and adding another dish. Full CI adds account, offline and iPhone/WebKit coverage.

Static concepts are illustrative only. Runtime screenshots/test results are recorded
in the implementation PR. No automatic merge or production release is authorized.
