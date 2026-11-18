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
