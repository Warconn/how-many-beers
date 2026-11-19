# #3 Parallel Cooking: implementation and owner review

Feature branch: `feat/3-parallel-cooking`, based on dev `e1b21f0`.
The owner approved implementation after the architecture/reproduction checkpoint.
This feature requires product review before merging into dev. No hosted SQL,
production deployment, real account fixture export or mutation of the owner's
active/completed cooks was performed during development.

## Root causes and reused architecture

The imported-phase compiler recognized only timed heating/passive instructions,
linked each to the next recognized interval and dropped unbounded heating. It
missed the fryer warm-up/readiness pair and the lower/remove frying pair when
frying duration was unknown. Wings had no independent oil interval. Step tools
also chose the first active phase in a dish, which could address the wrong timer.

This extends the existing `CookingPhase`, `PhaseAction`, append-only CookEvent,
projection, recipe adapters, CookingChecklist and optional TaskRow tools. Stable
task/dish IDs and existing account RPCs remain the identity/persistence boundary.

## Implemented behavior

- Stage, lifecycle and action are separate. Stages are Preparing, Preheating,
  Cooking and Holding; lifecycle comes from explicit actual boundary events.
- Checking an explicitly linked loading/removal row confirms that physical action
  now. Ordinary check-offs and old completion events do not invent activity time.
  Reopening appends checklist evidence without erasing physical observations.
- Activities have distinct IDs and authored start/end/checkpoint links. Multiple
  instances can run within one dish and across dishes. A compound transition
  appends both boundaries on one event. Repeated completion is idempotent.
- Repeated food/equipment readings and note observations append distinct actual
  timestamps with task and activity references. A checked checkpoint stays checked.
  Recording oil temperature never confirms the oil-ready gate or ends preheating.
- Inline start-row feedback shows elapsed time or observed actual duration.
  Record another reading remains directly available on that row, with every
  reading accessible in its disclosure. Existing details remain available.
- The footer chooses the meal-wide manual action independently of the selected
  row and uses the same completion handler as the checklist. Navigation is view
  state. Readings/edits retain existing navigation protection.
- Automatic detection runs during authoring/fresh-start migration, not execution.
  It matches explicit loading/removal, heating/readiness and brining boundaries;
  durations can be unknown. Multiple plausible methods/foods or absent boundaries
  remain ordinary with a Review activity suggestion. Oil and food checkpoints are
  associated separately. Lid/probe removal and ordinary temperature checks are
  never terminal gates. Confirmed corrections and No activity rejections persist.
- New wings opt into versioned template boundaries for oil-ready, smoker removal
  and frying. Existing saved wings retain their original template and facts.
- Actual start corrections and optional end corrections append evidence without
  changing old events or checklist timestamps. Reopen never resets an activity.
  Explicit Finish records the generated endpoint of a suppressed new Holding
  interval; elapsed estimates alone never finish or archive it.
- Recorded start/end steps cannot be deleted out from under their physical
  observations. Unstarted broken links remain ordinary, retain their definitions
  and get a specific review warning instead of creating an unfinishable timer.
- Independent intervals share the existing whole-meal projection. Parallel work
  is not summed. Unknown work retains lower-bound/uncertain timing and the serving
  target remains unchanged. This is not a resource/dependency optimizer.

## Format, compatibility and rollback

Native dishes optionally retain `activities: {version:1, definitions, ...}` with
recipe-local step IDs, stages, provenance and dismissed start suggestions. A meal's
phase plan captures those relationships before execution. Recipe copies retain
local keys and get independent dish/task instance IDs.

The shared recipe v1 format already supports scalar extension parameters. The
reserved `recipe.parameters.hmbActivitiesV1` string contains strictly validated,
versioned JSON metadata. Existing phase/action fields still describe supported
native relationships; the extension retains corrections, rejected suggestions
and links to added steps. Native adapters prove lossless round trips. Unknown
extension versions are rejected safely. The existing PostgreSQL validator accepts
this format, verified through real local recipe/workspace RPCs.

**No database migration or manual hosted database action is required.** No auth,
RLS, server capability or production environment setting was changed.

`upgradeActivityLinks` upgrades an old active phase plan once upon Cooking Mode
entry. `activityVersion:1` marks completion; `originalPlan` retains the prior plan.
Actual/reading/estimate-referenced relationships remain intact. Missing clear links
are added without annotating old completion events with fabricated observations.
Removed-dish/cross-dish links are excluded from live execution, guidance and timing.
Home/archive reads remain read-only; sessions without phase plans stay legacy.

`rollbackActivityLinks` restores the original plan exactly while retaining all
events. It rejects rollback after new-model activity has been recorded so new
facts cannot become orphaned. Backups retain both plans and the original events.
This is a client snapshot migration, not a bulk database/history rewrite.

## Acceptance fixtures and checks

All fixture data is synthetic and isolated. The turkey target is November 22,
2026 at 3 PM America/New_York (20:00 UTC). The baseline reproduces exactly two
dishes, five oven phases plus a stale old-dish phase, and eight checklist events
with no physical observations. No owner UUIDs or private historical notes/events
were exported. The scenarios demonstrate behavior, not exact replay of private
historical records.

| Scenario | Acceptance assertions |
| --- | --- |
| Thanksgiving Turkey | Oven cooking plus fryer preheating; separate oil-ready/lower/remove boundaries; stale dish excluded; eight original events and reload retained. |
| Browns Brisket | Same checked checkpoint accepts 145/162/181 readings across reload, with notes, distinct timestamps and unchanged cooking start; wrapping/checks leave cooking active. |
| Smo-fried Wings | Smoking and oil heat overlap; reading does not confirm oil-ready; oil-ready ends only preheat; removal ends smoking; frying has a separate observed start/end. |
| Brats | 130/150/165 readings on one checked start task across resume, same activity ID, one physical start. |

Unit coverage includes model compatibility, saved original/copy snapshots, added
step links, No activity, broken boundaries, compound transitions, invalid actual
corrections, overlapping meal bounds, idempotent migration and rollback.
Browser coverage includes desktop/mobile real interactions plus iPhone WebKit in
the repository config. Account tests cover saving/reloading corrected metadata
without changing the active meal or history. PostgreSQL covers clean/seeded-upgrade
ownership and races, exact new recipe JSON and new physical/reading/note payloads.

Local browser runs use installed system Chromium because the managed Chromium and
WebKit downloads returned HTTP 403 from the available network. Temporary local
configs retain screenshots/traces and disable video because managed ffmpeg was
also unavailable. Repository browser projects and CI checks remain intact.
Do not count mobile Chromium emulation as iPhone WebKit coverage. Final local/CI
counts and any remaining limitation are recorded in the PR.

Architecture/UI checkpoint: typecheck, 632 unit checks and all 12 new desktop/mobile
acceptance journeys passed. The isolated PostgreSQL harness passed clean-install,
seeded-upgrade, ownership, immutable-event and concurrency tests, including new
activity/observation round trips. Later UI refinement additionally limits direct
reading controls to relevant checkpoints, readiness gates, active starts and rows
with existing observations, keeping ordinary rows quiet.

## Final local verification

Typecheck and all 636 unit checks pass. All 12 desktop/mobile Chromium acceptance
executions pass, followed by three focused browser journeys after tightening the
terminal-gate detector. The 84 existing guidance, import, history, physical cooking, minimal-tools and
fixed-timing browser cases pass across the targeted runs and repaired timing
regression rerun. A final 20-execution desktop/mobile run covers all six acceptance
journeys and the four live cook-start journeys. All 18 built-shell Android Chromium offline
checks pass across the suite and the final explicit-Holding-end rerun. The account
recipe correction/save/reload/isolation journey passes. All 13 desktop auth cases pass, including warm callback reruns after cold
compilation delays. The production export and local PostgreSQL clean/seeded-upgrade security harness pass.

The detector now excludes lid/probe/thermometer/foil removal, ordinary oil
temperature checks and food readiness from an equipment-ready boundary. A linked
sequential interval projects from the preceding activity's finish, rather than
adding an obsolete frozen planned offset. Initial ordinary preparation remains
part of the estimate: 5-minute prep + 15-minute roast + 10-minute cooling gives
30 minutes, then reforecasts to 25 after prep is checked without inventing a
physical start. Keyboard/native scroll targets reserve
space for the fixed meter and guide. These refinements have focused regressions.

Required CI additionally runs desktop/iPhone account, auth, offline and changed UI
projects using pinned browsers. Final CI outcomes and the exact successful feature
preview URL are recorded in PR #167. Local system Chromium cannot substitute for
that WebKit coverage.

## Screenshots and product review

November 17 serving synchronization follow-up: planning correctly gave 75-minute
potatoes a 4:45 start and 45-minute brats a 5:15 start for 6 PM. Cooking Mode used
the session origin separately for both dishes, showing a 5:30 brat finish while
the overall Beerometer still showed 6 PM. Transition/reload unit regressions and
a real browser test reproduced that gap before the fix.

The projection now compares nominal execution budgets at the fixed session
origin and delays eligible unstarted dishes to the common estimated meal finish.
Known progress can extend that finish; recorded physical boundaries and fixed
paths remain authoritative. Unknown work is never assigned an invented duration.
Newly added dishes retain their creation anchor, and the existing single-dish
early-start behavior is preserved. This is a pure view projection, with no JSON
format change, migration, account write or historical rewrite.

All 649 unit tests pass, including 13 synchronization cases. The new browser
journey verifies the individual start/finish times before and after entering
Cooking Mode and reload, with unchanged actual events. Final desktop/mobile
checks, pinned-browser CI and the deployed commit are recorded in PR #167.

Before screenshots come from an isolated checkout of dev `e1b21f0`; after screenshots
come from the feature code. Both use synthetic cooks, desktop and phone sizes.
Cooking and recipe-correction images are included in the feature PR.

Owner review: start two activities from the flat checklist; record several readings
without unchecking; confirm oil-ready; remove food and observe only the intended
activity end; reload; then correct a recipe's stage/end or choose No activity and
reuse it. Confirm the Beerometer, footer, instructions and phone layout still feel
familiar. Physical estimates are never doneness or safety guarantees.

Limitations: conservative English-language detection, no equipment-conflict
optimizer or advanced dependency scheduling, and relationship editing before
cooking rather than silently relinking recorded activity. Ambiguous old sessions
may need explicit actual-time entry; their historical completions remain facts of
the checklist only. Next phase should refine detection from reviewed examples and
then separately design dependency/resource scheduling if the owner wants it.

## Chronological display correction (November 18)

The owner found the planning checklist still grouped by saved dish order: a
November 21 brisket serving action appeared before November 14 turkey thawing.
Planning's combined checklist, dish step editor and schedule now sort by full
planned instants. Cooking's full checklist follows its primary actual/estimated
start cues as forecasts change. Past-cook steps use their displayed completion
with planned fallback, and recorded activity sorts by observation timestamp.
Equal times retain their existing relative order; unknown times follow timed work.
Recipe authoring retains its source sequence where no meal dates are displayed.

This is a read-only presentation change. Recipe dependencies, stored task order,
IDs, physical observations, original plans and archive bytes are preserved. Manual
planning moves still edit sequence/timing through the existing domain helpers;
they cannot make a later dated row display above an earlier one.

`tests/timedOrder.test.ts` covers multi-day/dish ordering, unknown/invalid times,
time-zone offsets, ties, actual/fixed/estimated cues and immutable archive fallback.
`e2e/timed-order.spec.ts` reproduces saved dish grouping, verifies immediate date
edits, dish/combined lists, Cooking Mode, completion/reload and archive read-only
ordering on desktop/mobile Chromium and CI iPhone WebKit. The original application
failed the new planning order assertion before the fix.

The compatibility run also exposed a pre-existing browser-selector error on the
previous feature head: after Record actual start advanced guidance, the test
clicked the new current step's checkbox instead of completing the intended cooking
row. It now targets that named row in Full checklist, retaining the original
12:05 actual, 14:25 forecast and immutable-events-after-reload assertions.

Local verification passes typechecking and all **653 unit tests**. The focused
compatibility run exercised **54 distinct desktop/mobile Chromium cases** across
planning order, flexible sequencing, serving alignment, parallel activities and
history. The corrected selectors and all new ordering cases passed a clean
10-case rerun; the final planning screenshot run passed both device projects.
Reviewed screenshots are `desktop-chronological-plan-after.png` and
`mobile-chronological-plan-after.png` in `docs/screenshots/3/`.

CI on `d959ec6` passed 129 changed-UI cases, including the new chronological
journeys on desktop/mobile Chromium and iPhone WebKit. One older imported-duration
scenario still expected untimed source steps ahead of the sole dated Serve row.
Its assertions now explicitly cover timed-first display both before estimates
are supplied and after one is cleared, while retaining every duration, editor,
reload and safe guided-preparation assertion. The corrected scenario passes both
local Chromium device projects, with typechecking and all 653 units rerun.

### Preparation progress and stable test actions

The broader compatibility check reproduced another serving-sync defect on the
previous feature head: after brisket preparation was completed, the shorter dish
kept the original, larger work allowance and held the whole-meal estimate back.
The read-only budget probe now excludes completed ordinary work, and the common
finish follows current known dish estimates. Missing starts can move that finish
later; completed preparation can move it earlier. Physical observations and fixed
paths remain anchored, and no stored completion/event timestamp is rebased.

Four additional synchronization regressions fail before this correction and pass
after it: missed starts in both dishes, completed long-dish prep, both preps
completed later through reload, and an actual cooking start with the other dish's
prep already completed. All 657 unit tests pass, including the 17 synchronization
cases. The existing Beerometer journey retains its precise remaining-time checks.

Browser test actions now retain accessible step identities instead of positional
locators as live dates move rows. Account saves still preserve manual order,
metadata and actuals, while the pinned dated row displays chronologically. Whole
cook tests additionally assert every checkbox was completed. Archive validation
keeps every pre-Finish event byte-for-byte and checks the single generated holding
end recorded by explicit Finish; elapsed clock time still appends nothing.

Legacy Cooking cues needed the same correction: flexible template rows previously
kept their original calendar starts while their checkpoints displayed live dates.
An early-start cook could therefore display Serve before Begin rest. Flexible
Cooking rows now use the shared live Estimated start cue, while actual and fixed
starts retain their existing precedence. Planning still shows planned dates and
Step details retains the original plan. The new legacy rest/serve unit fails on
the old selector; the cue test also preserves fixed and planning behavior.

Final local checks pass typechecking, **659 units**, **74 distinct desktop/mobile
Chromium cooking/planning cases**, and **four account checks** on desktop/phone
Chromium. The account checks cover retained manual order plus chronological dated
rows, hidden metadata, cancel/promote/finish, history and physical boundaries.
The 74-case run passed 72 before an older footer test compared two different
actions; after comparing the same global action and separately asserting spritz's
corrected timestamp, its two device cases passed a clean rerun. The final fast
run repeats typechecking and all units. Current desktop/mobile screenshots were
reviewed. CI retains real iPhone WebKit, full accounts/auth/offline/security and
the aggregate gate. Local WebKit download remains blocked by the environment's
browser-download endpoint; Chromium mobile checks do not claim WebKit coverage.

## Brisket/turkey guided-order regression (November 18)

Completing an ordinary built-in prep step early carried its actual completion
time into the next prep calculation, discarding the later cursor assigned to
that dish for the shared serving window. The next brisket prep actions jumped
to now while turkey's 22-hour brine stayed correctly in the future. The reported
29h45 meal estimate and next-day brine endpoint reproduce with synthetic native
brisket/turkey templates.

The completed-prep transition now carries the current forecast cursor forward.
Actual completion/event times, recorded physical intervals, fixed times and the
original plan are unchanged. This is a single read-only projection correction,
not a new scheduler or a data migration. An actually early cooking start still
wins over a later estimate; recorded brisket completions are never undone.

Six native-template regressions cover early prep/season/preheat completion,
shared finish/reload, chronological meal guidance, preserved early actuals, and
six days of recorded thawing before brining. The old code fails the intermediate
prep window assertions. Browser regressions reproduce early Trim completion
followed by the correct later Season date across reload, and follow the actual
meal-wide guide with the clock advanced to its displayed action times. Turkey
brine end and roasting occur before brisket serving.

Verification passes typechecking and all **665 units**, plus **40 distinct local
desktop/mobile Chromium browser cases** across the guided native meal, parallel
activities, serving alignment and Beerometer countdown. The new browser fixture's
clock setup and action selectors were corrected, then its four desktop/mobile
cases passed a clean rerun. Reviewed screenshots are
`desktop-brine-aligned-guidance.png` and `mobile-brine-aligned-guidance.png`.
Existing early actuals remain facts: a clean order walkthrough uses a fresh meal
and advances to the displayed estimates, rather than recording future work now.

## Confirmed doneness to holding handoff (November 18)

The on-time acceptance example exposed a real live-cook defect. At the nominal
smoking endpoint, the supported upper cooking allowance extended the heat
forecast even after the cook explicitly checked the terminal doneness condition.
That postponed the separate holding action and could push a 1 PM meal to 6 PM.

A confirmed source-linked terminal checkpoint now makes its following passive
handoff due. Recognition uses the frozen phase/action relationships: a condition
at fraction 1 immediately before the action that ends heating and starts a
passive interval. It requires an actual heating start and a current completion
at or after that start. Ordinary readings, elapsed time and intermediate checks
do not qualify. No stored schema or inferred physical observation is added.

The heat interval stays physically active until the cook checks the separate
remove/rest/holding action. An explicit remaining estimate recorded after readiness
supersedes that readiness for forecasting; a later confirmed check supersedes an
older estimate. Reopening the terminal checkpoint restores conservative estimates.
Fixed starts and already-recorded physical boundaries keep their existing meaning.

`timedMealSchedule.ts` supplies twenty independently written action IDs/times for
a Saturday 1 PM native brisket/turkey meal. `timedSequenceExamples.test.ts` checks
every expected next action, both rest starts and both serving endpoints, alongside
late starts, readings, reopen, estimate precedence, fixed holding and reload.
`holding-handoff.spec.ts` exercises the same fixed schedule in the real UI and
verifies the on-time handoff appends exactly its manual heat-end/hold-start event.
The former on-time handoff test fails before the correction.

The partial-handoff browser case also exposed a fifteen-minute prep drift. After
turkey preheating was checked, the completed-prep path charged ordinary prep
again after the drying allowance, instead of retaining its authored overlap.
Completed ordinary prep now retains the dish's assigned start floor while allowing
the next unsequenced prep allowance to overlap that earlier window. Explicit
manual sequences and physical intervals keep their existing serial constraints.
The independent example requires turkey prep at 7:15 AM, loading at 7:30 AM and
the meal estimate at 1 PM even before the remaining actions have been checked.

Final local `test:fast` verification passes typechecking, **676 unit tests across
54 files**, and **84 desktop/mobile Chromium browser cases** covering holding,
native meal order, physical boundaries, serving alignment and existing timing
cues. The new handoff and full twenty-action cases pass on both local devices.
Reviewed screenshots are `desktop-holding-handoff.png` and
`mobile-holding-handoff.png`. Required CI retains real iPhone WebKit and the full
account/auth/offline/security gates; local mobile Chromium is not WebKit coverage.

## Independent QA corrections (November 18)

The review reproduced two gaps in the tested paths: default frozen turkey versus
an explicitly thawed fixture, and actual starts recorded through details without
checking the start instruction. New units failed on the old behavior. Browser
regressions create native meals through controls and exercise both supported paths.

Frozen turkey thawing is now an explicit preparation allowance in planning and
the Beerometer, not an excluded reminder. Current flexible built-in templates use
the same phase projection before/after starting. The reviewed 5:04 PM Wednesday
example reports 173h45 and Wednesday November 25 at 10:49 PM in both modes; Fully
thawed reports 29h45 and Thursday at 10:49 PM. The original Thursday 6 PM target
remains unchanged. Zero brining/drying allowances stay known zero values. Legacy
authored planning gaps, fixed anchors and manual recipe sequences retain their
existing planning calculation; this does not reinterpret saved actuals or archives.

Future planning windows persist as optional `phasePlan.forecastOrigin` in the
existing JSON payload. The actual session `startedAt` remains the time the cook
opened Cooking. Planning and deliberate starts share `plannedSession`; account
atomic promotion uses that same payload preparation without changing the RPC.
Old phase plans without the optional field remain valid. A recorded physical start
supersedes the opening window, including when it was deliberately early. Reusable
recipe methods do not acquire meal-specific timing metadata.

`actionRecorded` derives satisfaction of a start instruction from its actual
forecast basis whether the interval is active or ended. Guide, footer, visible
checkbox and progress agree. Recorded-only starts show checked/disabled without
appending a synthetic completion. Other unfinished prep stays explicit. Completed
checks show their recorded completion; explicit reopen restores review. Planning
uses the latest effective phase correction while Activity preserves all events.
Schedule/target labels include month/day. Two adjacent compiler corrections keep
brat holding after searing and wings frying after the independent oil allowance.

CI browser jobs use the official Playwright 1.64.1 Noble image, matched to the
lockfile and checked for both browsers. This avoids the observed slow apt mirrors.
Existing required jobs, aggregate behavior, accounts/auth/offline and WebKit coverage
remain enabled. The new QA, holding and native-guide specs are explicitly included
in the iPhone project. Verification results and deployment identity are recorded in
PR #167; local Chromium viewport testing does not certify WebKit or hosted accounts.

Owner verification after Update app, using fresh synthetic meals:

1. Add brisket plus default frozen turkey with a serving target tomorrow. Confirm
   thawing precedes brining by the remaining thaw days, dates include month/day,
   and the infeasible-target warning/estimated readiness appears before starting.
2. Start Cooking immediately. Estimated serving and the Beerometer should agree
   with planning; reload and confirm they remain stable. Do not check future work
   now just to move through this timing example.
3. In another meal choose Fully thawed. The six-day thaw allowance disappears;
   brine/dry/cook/rest allowances remain. Opening Cooking early retains its future
   preparation window until actual progress is explicitly recorded.
4. For fast action testing use Smo-fried wings, recording smoking and oil starts
   through Step details. Confirm oil readiness, doneness, smoker removal, frying
   start and drain/season. Neither guide nor footer should return to ended starts.
   Earlier prep deliberately left unchecked remains available for review.
5. View a completed checkpoint and log another reading. It should show completion
   rather than an overdue prompt. Correct smoking start, reload, and compare its
   effective time in Cooking and Edit plan. Activity must retain the original event.

Final local fast checks pass typechecking, **685 units / 55 files**, and **20 real
desktop/mobile Chromium browser cases** (eight new QA cases plus twelve legacy
cooking/control cases). Completed-checkpoint display sorting has a separate
before/after regression. The initial broader run exposed derived status applying
to legacy cooks without a phase plan; limiting it to explicit phase relationships
preserves their existing controls. No browser assertion was weakened. Two unit
fixtures now specify their intended near-term serving target instead of inheriting
an unrelated future default. The explicit early-opening expectation now retains
the planned meal finish. Reviewed screenshots are `desktop/mobile-frozen-plan.png`
and `desktop/mobile-ended-activity.png`. Required CI supplies full changed UI,
WebKit, account, auth, offline/export and SQL security results.

The first container CI run reached the static-export tests and exposed a cleared
serving-target regression: native projection could create timed rows without a
valid target. Native planning now requires that target, keeping dates/readiness and
the Beerometer unknown when it is cleared. The existing Android/iPhone assertion
was retained, with a new domain regression. The follow-up passes **686 units**, six
affected desktop/mobile timing checks, a static production export and all **18
local Android Chromium offline/reliability/Beerometer cases**. The prior twenty-case
Cooking/QA run remains applicable to the unchanged recorded-activity controls.
Container changed-UI selection explicitly trusts and addresses only the runner's
checkout directory for Git comparison; it still fails closed and runs every
selected spec. Final CI status is tracked at the PR's current head.

The complete changed-UI run then exercised 179 browser cases and exposed a legacy
window compatibility regression. Older brisket methods have large idle planning
gaps which their established execution path compacts. `plannedSession` now leaves
those methods on that existing path instead of attaching the new future-window
metadata; a before/after unit and the unchanged Thursday/Sunday browser scenario
verify the original finish, target and empty event history. Current methods retain
the approved early-opening policy.

The short preparation/roast/cooling fixture sets its serving target when work is
actually due, retaining all exact actual-transition assertions. The added-dish
example retains a future serving target and checks both the original meal window
and the new dish's creation anchor. The current native brisket/ribs
planning expectation uses the shared activity budget: 70 minutes of overlapping
brisket prep, 13 hours cooking and six hours holding, yielding 20h10 / a 4:50 PM
preparation start. Its old target-derived planner reserved an extra five idle
minutes. Ribs retain their full 20-minute preheat at 6:50 AM rather than including
ten idle minutes before loading. Cooking, holding and both 1 PM serving endpoints
remain exact assertions; no physical duration or actual was shortened to pass.

The final focused fast run passes typechecking, **687 units**, and **40 desktop/mobile
browser cases** covering every failed scenario plus the QA and serving regressions.
The application changes are limited to the explicit legacy compatibility guard;
the current-template timing changes above are reconciled test expectations.

The future opening window applies only to original dishes. New dishes added
after the session began retain their recorded creation anchor, even before any
physical activity is recorded. A failing-before unit and the strengthened browser
example verify the new side's exact preparation/finish times, the original meal's
future finish, ticks, reload and unchanged empty event history. This final follow-up
passes **688 units** and **16 affected desktop/mobile browser cases**; the preceding
40-case timing/QA run covers the unchanged remaining-work and serving behavior.
