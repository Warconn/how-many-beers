# User journey regression map

November 9, 2026 release review. These are Playwright tests that interact with the
real rendered app, using its buttons, inputs, navigation and saving paths. Unit
coverage supplements them; passing unit tests alone is not user-journey evidence.

## Whole journeys added for this review

`e2e/cook-journeys.spec.ts` creates plans from an empty Home through the UI,
without preloading cook state or calling domain helpers to complete actions:

- **Overnight brisket:** Sunday serving target → new template → optional trimmed
  weight → edit planned smoker time without changing duration → save/reload →
  prepare → actual Saturday 11:34 PM load → estimate expires without completing
  meat → condition checks → Sunday 8:19 AM hold → reload → stay on unchecked Hold
  through 1 PM → existing Finish → searchable history. Assert planned target,
  durations and append-only actuals remain intact. The 8-hour estimate is guidance,
  and the rest/hold reserve does not become a required countdown.
- **Mixed meal:** template brats plus uploaded Markdown seeds → save/reload → one
  combined checklist → explicit finish → one archived meal with both dishes and
  actuals → Cook Again with independent IDs and cleared progress → reload.

Both run on desktop Chromium, narrow mobile Chromium and iPhone WebKit. Their
60-second per-journey budget accommodates many separate UI actions; ordinary
assertion timeouts stay unchanged. Clocks advance deterministically, without
sleeping through a cook. Screenshots join the existing review artifact.

## Implemented paths and their browser evidence

| User experience / scenario | Browser tests | Setup and scope |
| --- | --- | --- |
| First visit, Home, start/resume and responsive navigation | `auth/upcoming-plans` (fresh Plan a cook / no empty panel / trash inside serving card), `cook-flow`, `home-cleanup`, `branding`, `empty-planner`, `cook-action` | Real Home/template flows plus retained-state resume |
| Serving first, cancel Add, multiple independent dishes | `serving-first`, `recipe-first`, `flat-menu`, `dish-editor` | UI creation/review; complex timing cases also seed exact inputs |
| Templates for brisket, brats, turkey, wings, ribs, chicken, sides | `template-estimates`, `personal-templates` | All seven legacy templates in real cooking UI; new brisket additionally has full UI journey and `post-brisket` |
| Paste recipe text, upload `.txt`/`.md`, extracted/unknown durations | `cook-flow`, `recipe-extraction`, `recipe-first`, `imported-duration-ux`, `imported-timing` | Real chooser/import/review, correction and reload |
| Reorder/add/remove a step or dish, notes and optional settings | `recipe-first`, `step-editing-ux`, `remove-dish`, `focused-cooking`, `flexible-order`, `planning-order` | Actual controls, keyboard/touch interactions, cancellation, actual-data preservation |
| Planned date/time differs from duration | `post-brisket`, `step-timing-cues`, `step-timing`, `auth/account-cooks`, `offline/cook-offline` | Direct focused editor, cancel/reset, account saves, actuals and offline reload |
| Fixed ribs 8:10 AM → 1:40 PM heat finish → 2 PM ready (#117) | `step-timing`, `serving-first` | Literal template fixture, actual UI edits and target preservation |
| Late target, fixed/manual anchors, overnight/DST edits | `serving-first`, `step-timing`, `duration-reflow` | Deterministic exact clocks, invalid/ambiguous date validation |
| Prominent collapsed current/Up Next cues and optional tools | `step-timing-cues`, `cooking-simplicity`, `post-brisket`, `cooking-layout` | Guided cards, flat checklist, cues without opening details |
| Actual cook starts, parallel dishes, overruns and changed estimates | `physical-cooking`, `live-cook-start`, `live-step-estimates`, `remaining-cook` | Seeded physical boundaries plus real actions/corrections/ticks/reload; never auto-doneness |
| New 6-hour / optional 8-hour brisket reserve; saved methods unchanged | `post-brisket`, `cook-journeys`; units `postBrisket`, `brisketEstimate` | UI reserve controls, full new cook; unit snapshot/default compatibility |
| Hold until serving → existing Finish; early/cancelled/complete finish | `cook-journeys`, `cooking-simplicity`, `cooking-layout`, `focused-cooking`, `auth/account-cooks` | New full journey plus targeted hold and finish confirmations, immutable history |
| Name/serving edit immediately after Add → Start → reload/history/repeat (#118) | `auth/account-cooks` | Controlled deferred frame and real keyboard input; existing history/actuals checked |
| Account sign-in, callbacks, sign-out, ownership and account switching | `auth/sign-in`, `auth/preview-origins`, `auth/account-cooks` | Mocked auth HTTP, real forms/session handling, preserved cook/drafts and scoped recovery |
| Account save, fresh-device retrieval, finish and Cook Again | `auth/account-cooks` | Real UI, deterministic RPC backend; acknowledged state and immutable history asserted |
| Future plans while another cook is active; promotion and legacy-plan transfer | `auth/upcoming-plans` | Multiple independent plans, active progress, separate contexts, conflicts/failures and explicit promotion |
| Upcoming Home preparation and serving times (#126) | `auth/upcoming-plans` | Derived preparing time/date compared with the saved plan; active cook/history unchanged |
| Discard an accidental empty or populated upcoming plan before cook day | `auth/upcoming-plans`; units `discardPlans`; SQL `saved-upcoming-plans` | Direct Home/editor action; empty plans need no confirmation, populated plans can be kept; retained records, immutable retry receipt across reload, stale/readonly/offline rejection, active/history isolation |
| Cancel cook, lost response/retry, new cook after acknowledgement | `cancel-cook`, `auth/cancel-account`, `auth/upcoming-plans` | Retained legacy/account records, capabilities, trial non-retention; PostgreSQL validates terminal protection |
| Fresh temporary guest trial, candid limits, import and finish without saving | `auth/account-cooks`, `auth/cancel-account` | Actual guest UI; assert no persistent cook/cancel tracking, account entry points and a clean trial after leaving/reload without any account RPC |
| Legacy browser cooks/history, corrupt/unavailable storage and backup restore | `reliability`, `save-plan`, `history-actions`, `auth/account-cooks` | Real storage failure injection; exact retained bytes/history, explicit recovery and no false success |
| Account disconnection, pending edits, stale device, account isolation | `auth/account-cooks`, `auth/upcoming-plans` | Controlled RPC failures/conflicts, IndexedDB recovery across reload, no cross-owner overwrite |
| Offline installed shell, overnight resume, notes/readings/archive | `offline/cook-offline` | Built static app and real service worker; browser network goes offline |
| App updates never reload an open cook/editor automatically | `offline/cook-offline` | Real worker update, failure and draft protection, retained old shell |

Names in this table refer to `e2e/<name>.spec.ts` unless a subdirectory or unit test
is explicit. Each row can involve several tests; counts are browser-project
executions, not a count of distinct user personas. See the release PR's final SHA
and Actions artifacts for actual results rather than treating this inventory as a
pass report.

## Verification boundaries

- General journeys run on desktop/narrow Chromium. iPhone WebKit explicitly covers
  cooking/timing/recipe/hold flows and the new whole journeys. Auth and account
  suites run on desktop Chromium and iPhone WebKit; offline uses Android Chromium
  and iPhone WebKit against the production build. Do not claim every individual
  legacy desktop test runs in every browser project.
- Browser account tests use mocked authentication and RPC responses for repeatable
  success, stale/retry/failure scenarios. Separate disposable PostgreSQL tests run
  real migrations, ownership/lifecycle checks, seeded upgrades and concurrent races.
  They do not send emails or prove hosted Supabase/production configuration.
- Desktop screenshots and emulated iPhone WebKit are not physical iPhone Safari.
  Before production approval, manually check real iPhone keyboard/date controls,
  immediate rename/start/reload, installed app background/resume and sign-in.
  After an approved release verify production history/saves, cancellation and future
  plans before closing #61/#83/#103.
- No finite suite proves every combination of recipe, clock, browser and network
  failure. This map covers implemented entry points and known cook regressions;
  new concrete bugs should receive deterministic coverage at their failure boundary.
- URL/photo/PDF import, notifications and other deferred features are not
  implemented and are not claimed as tested paths. #114 feature coverage is below.

## Keep coverage current

Playwright `fill()` can write into an `inert` subtree even while real keyboard/
pointer interaction is locked. Observe critical-save acknowledgement and editor
unlocking before synthetic setup fills; assert the exact value/server document,
not a previously saved icon. Keep controlled unlocked-interaction race tests such
as #118 separate from that setup boundary.

For a bug, preserve the real user trigger and assert the saved outcome/history,
not just visible success text. For an experience change, update this map and the
relevant journey alongside focused assertions. Never replace a failing scenario
with sleeps, forgiving retries, weaker assertions or deletion of browser coverage.
Keep real screenshots/traces and review them before declaring release readiness.

## Personal recipes (#114 feature branch)

`e2e/auth/personal-recipes.spec.ts` covers independent explicit Save/Add, saved
methods across fresh signed-in contexts, meal-local edits, library updates/new
copies, retained removal, reload, lost-response replay, unavailable schema, failed
saves, guest sign-in draft preservation, stale-device conflicts, active-cook
protection and meal-specific extraction. Desktop and iPhone projects run under the
account config; local narrow Chromium additionally checks layout. RPC/auth mocks
validate UI state isolation; real isolated PostgreSQL checks validation, ownership,
receipts and save/remove races. Neither substitutes for hosted dev acceptance.

No hosted migration was run by the agent. The feature preview requires the reviewed migrations
in `docs/recipes/rollout.md` before account library writes can work.

The owner-reported template edit regression is covered with multiple titles,
instructions, durations, per-step equipment/food temperatures, ordering, Save
changes, Save as new, reload and Cancel. A separate failing-before regression
covers saving an open step without Save step. These run in both account browser
projects. Dedicated navigation and grouped primary/secondary actions have browser
assertions and screenshots. The real SQL edited-template fixture saves/updates,
creates an independent new recipe and checks read-back JSON equality, while a
client test rehydrates exactly that fixture. The owner's wings example reproduces the conversion rejection after editing and
reordering exposes its implicit rest row. Domain and actual UI tests failed before
the mapping fix and pass afterward, preserving the five-minute allowance. Imported
methods also cover edited steps and independent added/reordered/removed work.

Imported long titles/instructions also have a real UI save regression. Editing
only duration preserves their exact original text; the recipe authoring helper
uses canonical limits and keeps fixed/recorded overrides. This does not change
native planning editor behavior or archived execution.

The latest owner oil-before-check case runs through meal step reordering, direct
method save, reload and reuse with unchanged source data. A separate planned-time
edit/blank optional meal-name case failed through whole-meal conversion and now
saves the selected method independently. Full meal/history compatibility validation
remains unchanged; unknown fields on the selected method are still rejected.
Default action assertions require both method choices visible together, one
visually primary, desktop/mobile spacing and tap targets, no Recipe actions menu,
no meal-date controls during review, and a compact equipment checklist with no
Done/select rows. Escape/focus return, outside close and multiple/custom labels
are exercised alongside the existing save/isolation assertions.

`planning-backward-reflow.spec.ts` also pins wings drying early and extends
preparation: flexible later work meets the unchanged 1 PM target after reload.
Unit checks cover insufficient slack, a constraining second fixed start, other
dishes and active-cook exclusion. It remains a synthetic reproduction of the
reported pathway, not inspection of the owner's particular saved plan.
