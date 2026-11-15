# #114 product acceptance investigation and proposed reset

**Subsequent owner decision: approved for implementation.** The report below
records the rejected e91c57f candidate and the approved proposal. Current
implementation/verification belongs to `../implementation/issue-114-handoff.md`.

November 13, 2026. Application candidate inspected: `e91c57f`.
PR #134 remains draft, unmerged, targeting dev. **Product acceptance failed.**
This document is a proposal, not a new accepted design standard. No application,
scheduling, adapter, persistence or schema code changed in this investigation.

## Why green tests did not establish acceptable UX

The prior implementation overcorrected “too many bundled buttons” into “only one
footer button,” then placed important same-scope decisions behind a disclosure.
That contradicts the PR's earlier instruction to group secondary decisions with
the primary when they share scope. AGENTS/design-system additions repeated the
implementation choice and made the acceptance tests circular. The latest owner
direction supersedes those additions; do not use them as authority to preserve
this rejected interaction or add more exceptions around it.

Specific current tests in `e2e/auth/personal-recipes.spec.ts`:

- `quiet navigation opens a dedicated recipe screen and equipment selection
  preserves configuration` (line 126): line 129 asserts no default equipment
  combobox, opens Edit, changes a select, explicitly clicks **Done editing
  equipment**, checks focus return, asserts **exactly one footer button**, asserts
  **Save to My recipes hidden**, and checks no nested details. Line 130 adds a
  second selector/custom label and checks serialized equipment values. Those are
  direct requirements for the rejected interaction, not just missing assertions.
- Shared `recipeAction` helper (line 31) automatically opens Recipe actions when a
  save button is hidden. Consequently most save tests bypass the very
  discoverability problem the owner experiences.
- `multiple edited steps persist through Save changes, Save as new, reload and
  Cancel` (line 103) verifies text, durations, equipment, temperatures, order,
  revision/copy behavior and Cancel. It proves correctness after locating actions,
  not that those actions are coherent or immediately accessible.
- The exact oil-before-check test (line 154) proves conversion, save/reload/reuse
  order and unchanged source meal. It never asserts final readiness or tests an
  early fixed first step together with an interval overrun.
- Screenshots are attachments, not approved visual comparison goldens. Neither the
  equipment test nor the general design-system test asserts the relationship of
  Done to the selectors, number/width of open equipment rows, spacing between
  method actions, or absence of meal dates while reviewing a method.

I reviewed those screenshots and missed the interaction problems. The correct
response is to change the acceptance model after owner review, not add CSS until
these same tests pass again. Functional persistence tests remain useful and stay.

## Independent scheduling investigation

`planningReadiness.ts:48` returns the original whole template path if **any** task
has `timingMode === 'fixed'` (also for explicit user sequences). Thus one early
fixed drying reminder disables backward correction for every flexible step in
that dish. It does not disable all scheduling: forward dependency adjustment,
manual-sequence scheduling and clock-floor feasibility still run.

`stepDependencies.ts` preserves the original base cadence and extends following
steps when an explicit duration exceeds its slot. Moving an earlier fixed step
back does not pull those later base times back: `max(base + shift, previousEnd)`
retains the later original cadence. Fixed steps reset shift. Together these rules
can leave a flexible suffix late even though a fixed first step finishes hours
earlier than necessary.

This is a deliberate conservative guard in #136's implementation, but the
established timing contract protects **fixed/recorded instants**, not an entire
otherwise-flexible dish. The guard is too broad for an early, nonblocking anchor.
Existing `respects a deliberate fixed-time override` covers a fixed **oil** step
that genuinely prevents backward movement. It must continue to report lateness.
A safe remedy must identify feasible flexible portions around anchors, respect
physical overlaps/checkpoints and unknown intervals, and leave cooking/history
projections alone. Do not simply delete the fixed-step guard and translate the
whole path, which would move the pinned step.

Reproduction added in `tests/wingsPinnedInvestigation.test.ts` and actual UI in
`e2e/planning-backward-reflow.spec.ts`:

- Target: November 14 at **1 PM America/New_York** (`18:00Z`).
- Optional first drying step pinned to November 13 at **7 AM** (`12:00Z`), with
  its 8-hour allowance. Plenty of time remains before the next day's preparation.
- Synthetic explicit change: preparation is **40 minutes**, with an original
  **30-minute** slot, 8:45–9:15 AM on cook day.
- Preparation now ends 9:25 AM. Preheat and later flexible steps shift ten minutes.
  Serving becomes **1:10 PM**. There is no fixed-step conflict and the test clock
  is a day earlier, so neither a late current clock nor the early drying interval
  is the binding constraint. The retained preparation base start and global
  backward-adjustment guard cause the overrun.
- Removing only the early fixed pin allows the same durations to meet **1 PM**.
  With the early pin but default durations, the dish also meets **1 PM**.
- Reload preserves both the wrong result and the pinned timestamp. No actuals or
  serving target are changed.

**Evidence limit:** these are synthetic inputs matching the reported pathway and
exact ten-minute symptom, not a copy of the owner's saved plan. The actual saved
plan's durations/hidden steps/order/other fixed anchors have not been inspected.
An early pin alone does not reproduce ten minutes, so claiming the owner's exact
binding interval is known would be false. The exported affected plan would allow
identifying that last detail without hosted access or data mutations.

The new test uses `it.fails` for the desired 1 PM result. This is an explicit known
failure, not passing acceptance: a later fix must remove that marker and change
the UI characterization from expecting 1:10 to expecting 1:00. The new browser
case is included in the iPhone project match for future CI runs.

## Minimal editor proposal, awaiting owner review

Open `114-editor-reset.html` for a standalone visual demonstration. The state
selector outside the proposed card switches saved/new views; it is a review tool,
not a proposed app setting. The file has no account/API/storage connections and
must not be shipped as a second editor. Illustrative text is not a template rewrite.

Retain existing logo/header/nav, ivory background, typography, borders, spacing
and controls. One existing method-review panel contains, in order:

1. Back/Cancel in the current navigation style.
2. Edit recipe / Review your method heading and simple recipe-name field.
3. Compact Equipment summary selector, e.g. **Smoker · Fryer ▾**.
4. Existing editable/reorderable step list, useful duration/condition cues and
   instructions. Row Edit stays beside its step; optional equipment/temperature
   detail stays scoped to that step. No calendar inputs in reusable authoring.
   Step fields edit the recipe draft directly; there is no extra Save step button.
   Close/reopen keeps draft changes. Method-level Save commits them; top Cancel
   discards the recipe draft. Remove/Add likewise affect the draft only.
5. Quiet **Add a step**, directly after the list.
6. One coherent footer with two visible same-scope decisions, no overflow menu.

| Context | Primary | Visible quieter secondary | Escape |
| --- | --- | --- | --- |
| Edit saved recipe | Save changes | Save as new recipe | Top Cancel |
| Review new method | Add to meal | Save to My recipes | Top Back to meal/choices |

Desktop: footer buttons share a row with 16px separation. Mobile: primary followed
by secondary, separate 44px-minimum rows with 16px separation. Both remain visible
without another tap; no floating/sticky action area and no third footer action.
Use existing primary and outlined secondary styles. Acknowledged save state/error
belongs beside this decision area. Save as new retains the original recipe.

Equipment: one summary control opens a **single flat checkbox list**, with
multiple selection and one Other equipment field for custom labels. No repeated
full-width dropdowns, Add equipment workflow, remove-X rows or Done button.
Choices update the current draft immediately. Tap the summary again, tap outside
or Escape to close; keyboard focus stays usable/returns to the trigger as needed.
No nested disclosure. Existing custom/mixed labels must round-trip unchanged;
visible wording does not authorize normalization of saved data. Choosing equipment
does not persist anything until the method-level save. Step equipment uses the
same compact control. No profiles/favorites or equipment-management subsystem.

Saved recipe editing remains in My recipes with no meal dates or planner behind
it. Within Add dish, method review occupies the workspace; temporarily hide the
meal-name/serving-date form and schedule while authoring. Return to the unchanged
meal after adding/back. This is view composition over current state/components,
not a new meal lifecycle, schema or scheduling engine. Keep direct selected-dish
save from planning; no second review wizard or implicit library update.

Proposed acceptance before implementing: review full saved/new desktop/mobile
screens and equipment-open state, then verify visible same-scope save actions,
flat equipment interaction, keyboard escape, lack of planner date controls and
preserved cook-first navigation. Replace the tests requiring hidden saves/Done,
not the data-integrity assertions. No design-system exceptions are proposed.

## Preserved foundation and scope

Unchanged: shared versioned JSON contract; strict/lossless conversion and validation;
RPC schema validation, owner isolation, revisions/CAS, durable operation receipts,
retry/recovery/conflict behavior; independent recipe/meal snapshots; template
immutability; retained deletion; exact existing labels/text and ordering; fixed
calendar context separate from reusable recipes; actual event timestamps, history
and archived timelines; one active cook/multiple future plans; guest/auth/offline
recovery; cooking, Hold → Finish, Cook Again and Beerometer physical model.

UI work is a small composition/control change after approval. The scheduling bug
is a separate domain defect with its own red regression and eventual review. No
hosted migrations, rewrite, production changes, #135 work or automatic merges.

## Verification of this investigation

- 19 focused unit results: **18 ordinary passes and 1 expected failure** (`it.fails`)
  documenting the unfixed scheduling requirement.
- Four desktop/mobile Chromium browser cases pass: existing all-flexible case plus
  new early-pin characterization on both viewports, including actual edits/reload.
  These reproduce current wrong behavior; they do not certify a scheduling fix.
- Standalone proposal rendered/reviewed at 1280px and 390px, saved/new and equipment
  open. These are design mockups, not screenshots of implemented changes.
- No full suite or WebKit rerun for this tests/docs-only investigation. Prior green
  CI belongs to `e91c57f` and does not satisfy current product acceptance.
