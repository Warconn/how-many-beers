# How Many Beers application design system (#21)

Use the approved [Classic Dial identity](brand-identity.md), existing warm palette
and restrained functional layouts. The app's primary task is reading the next
action and checking it off. This is visual consistency, not a new cooking flow.

## Foundations

`src/app/design-system.css` defines the shared tokens and functional-view rules.
It follows existing `globals.css`; it does not replace the approved brand artwork
or Beerometer rules. Reuse the small `Icon` component for interface iconography.

| Role | Token or value | Use |
| --- | --- | --- |
| Page / surface | `--bg` #F7F5F0 / `--surface` #FFFDF9 | Warm ivory and quiet cards |
| Main / secondary text | `--ink` #22211E / `--text-secondary` #6D675F | Instructions / supporting context |
| Primary action | `--accent` #AF4F27 | Start, Save, Finish; keep clear text |
| Action text / focus | `--accent-dark` #873A1E | Secondary links and keyboard focus |
| Secondary action | `--accent-light` #FBEDE3 | Review, edit, back, cancel a form |
| Success / warning / error | #48613C / #79521B / #963C2D | Always pair color with explicit wording |
| Field boundary | `--field-border` #948779 | Visible form-control boundary |
| Spacing | `--space-1`…`--space-6`: 4, 8, 12, 16, 24, 32 px | Consistent gaps, padding and groups |
| Controls / surfaces | 10 / 16 px radius | Understated, rounded utility |
| Small / body text | 14 / 16 px | Supporting text / instructions and inputs |
| Functional headings | 24 px; cook title 32 desktop / 28 phone | System sans-serif, short line lengths |
| Metadata | 12 px | Dates and secondary dish context only |

Retain the established Arial/Helvetica/system sans-serif interface. The expressive
serif identity remains on Home/header as specified by #45. Do not download another
font or substitute a logo. Body instructions need room and 1.5–1.6 line height;
functional headings use 1.2–1.45. Avoid tiny text to make a busy view fit.

## Controls and information hierarchy

Keep one primary action per decision group. Secondary actions use the warm pale
surface; destructive actions remain separate, plainly labeled and confirmed. A
visual pass must not change event meanings or make Cancel mean Finish. Planning
retains its short editor, duration controls and collapsed advanced options.

Controls and disclosures have at least 44 px targets. Native checkboxes sit inside
44 px labels; do not shrink that target to the visible check square. Inputs use
16 px text to avoid iPhone zoom. All actionable controls show a 3 px dark-orange
focus ring. Disabled controls remain identifiable. On phones stack action groups
where needed, allow names/instructions to wrap and respect the existing safe-area
footer. Never hide a meaningful action just to fit a screenshot.

Use one quiet round-stroke SVG icon family, a 24-unit viewBox with 1.75-unit strokes.
Icons supplement text, retain named buttons and are hidden from assistive technology.
An icon-only control requires its existing specific accessible label. Use the same
family for navigation, step moves/removal, account/save status and Cook History.
Decorative emoji and platform-dependent pictograms do not belong in app chrome.
Recipe/user-authored content and temperature-stage notation are not decorative UI.
No additional illustrations are needed for this pass.

Warnings and recovery states use semantic text and color, without repeating generic
instructions. Empty states explain the next real action and use the same surfaces,
type and buttons as populated states. Preserve actual save failures and safety
instructions. Reduced-motion mode disables cosmetic transitions and animation.

## Protected boundaries

The Beerometer component, metrics, colors, type sizes, artwork and responsive design
remain intact. Functional type selectors explicitly exclude its descendants.
Domain timing, storage schemas, authentication, history, guest behavior and recipe
parsing are unchanged. The #84 layout/progress/finish delivery remains the base.

Visible physical Start/logging controls remain a known interaction gap tracked in
[#97](https://github.com/Warconn/how-many-beers/issues/97). Resolve that in a separate
focused functional PR; hiding controls without defining actual-start semantics
would undo #86. The visual pass does not claim checklist-first behavior is complete.

## Evidence

Run the design-system browser spec on desktop, Android-sized Chromium and iPhone
WebKit. Review real planning, active cooking and history screenshots before/after;
verify focus, target sizes, overflow, text contrast and untouched stored records.
Capture the Beerometer separately to compare the protected design. Run full unit,
browser, account/auth and production/offline checks before declaring the PR ready.

## Reusable step rows and actions (#103 review)

Use this pattern for recipe-method review and meal planning on `/recipe-first/`.
The accepted root planner and Cooking Mode keep their existing behavior until this
experiment is reviewed. Reuse `StepListControls.tsx` and `useStepReorder.ts` for
these views instead of building another action strip.

| Element | Placement | Behavior |
| --- | --- | --- |
| Move grip | Far left, aligned with the step heading | Drag the collapsed row; Up/Down also moves it. Keep a 44 px target. |
| Title and timing | Main heading column | Title first, planned date/estimate below it; allow wrapping. |
| Edit | Upper right beside the heading | Quiet text button, same position in recipe and meal views. |
| Instructions and metadata | Below the heading, aligned with its text | Smaller readable text; expand instructions only when over five rendered lines. Use plain checkpoint text rather than a separate warning-like badge. |
| Save and Cancel | Bottom of the open editor, grouped on the left | Save is primary; Cancel closes the draft and restores focus to Edit. |
| Remove step | Inside the open editor, separated to the right | Plain destructive label; committed removals retain their confirmation and recorded history. |
| Add a step | Below the list | List-level action, never repeated on every row. |

Do not add an Edit/Move/Remove footer to a collapsed step. On phones, keep the
heading actions in place while text wraps; allow the editor footer to wrap rather
than squeezing its controls. Disable movement and other row edits while a form is
open. Do not move an editor when someone is typing.

`data-step-list`, `data-step-id` and `data-step-group` identify one visible list,
one stable task and its owning dish. A drag commits on drop, uses an insertion
marker and edge scrolling, and can be canceled without changing the plan. Scope
focus/targets to the initiating list, especially when a dish and the combined meal
preview are both visible. All steps in a dish remain configurable; this introduces
no template-phase restriction or cross-dish transfer.

Call the existing planning reflow through `reorderPlannedStep`; do not derive a
second schedule in the UI. Keep the serving target, independent dishes, physical
events and existing save mechanism intact. Reordering is an edit, never proof that
a cooking interval elapsed or that a condition is safe.


## Step tools stay optional (#123)

The default cooking card retains its checkbox, short action/instruction and timing
cue. Step details is the single optional layer for contextual tools. Record actual
start opens one timestamp form (prefilled with now); recorded phases offer correction
instead. Notes, activity and supported remaining-estimate adjustments appear only
when selected, with no blank fields or disabled estimate action on opening details.
Activity expands inline rather than behind another nested disclosure. Full checklist
uses the same shortened action titles. Repeated instructions, generic forecast
explanations, duplicate checkpoint/finish timestamps and irrelevant equipment labels
are removed. Remaining authored instructions and concise safety cues stay available.
Closing/reopening details retains typed time/reading/estimate drafts and navigation
protection. Existing actuals, forecasts, Beerometer, saves and Hold → Finish semantics
are unchanged. Timing-cue improvements and template rewrites remain separate issues.

### Owner review: time and action hierarchy (November 9)

Keep Edit and Notes in one compact row with equal visual weight within Cooking
Mode details (#123 review). For the separately queued #124/#125 work, use a
consistent visible Edit position across planning/cooking. Planned start leads
before an action begins, with duration secondary. Tapping the planned time should
open its time editor directly; the full step editor should expose planned time
without More options. Keep actual starts and live estimates distinctly labelled,
and never change duration when editing a planned timestamp. These timing/editor
changes are direction for those separate issues, not implemented by #123.


### Collapsed when/condition cue (#124)

Place the shared planned/actual/check cue below the action heading/dish, before
supporting instructions and duration. Use readable 16px semibold timing, a normal
weight condition, and wrapping date text. Keep the sticky next-step cue readable
on a phone. All views use the same selector/formatter and execution clock. The
Beerometer and its hierarchy remain unchanged. Direct editing remains #125.

### Consolidated owner review

Planned date/time is an actionable, semibold 16px cue with a 44px tap target.
Its focused editor has date/time, Use plan timing and Save/Cancel, without duration
or equipment fields. In the full editor, duration/equipment/temperature are under
More options; planned time remains outside. Dish settings follow the step list
and contain brisket configuration in one layer, collapsed by default. These rules
supersede the earlier separate delivery boundaries for #124/#125.


### Personal recipe refinement (#114 owner review)

Home keeps its existing cook content. Home, My recipes and Past cooks share a
quiet text navigation within the existing header; My recipes is a full screen, never a modal overlay.
Recipe names open the existing review editor, Use recipe opens an independent
meal draft, and contextual trash controls retain records after confirmation.
The method footer groups the two same-scope decisions, with one visually primary
action. Show persistence choices only when reusable content has changed; merely
opening an editor, editing meal dates or recording activity does not expose saves.
Saved recipe editing uses Save changes plus immediately visible Save as copy.
New authored review uses Add to meal plus Save to My recipes; untouched starter
templates need only Add to meal. Linked recipe review uses Update original recipe
plus Save as copy when changed, alongside Add to meal. Do not put these
important actions under Recipe actions or another disclosure. Desktop controls
share a row with 16px separation; phone controls occupy separate rows with 16px
separation and 44px minimum targets. Back/Cancel uses top navigation. Acknowledged
save/error state stays with the method action area. Add a step stays after the
list, separate from persistence actions.

Recipe authoring shows name, equipment, steps, durations and conditions. Hide the
meal date/name form, schedule, other dishes and cooking controls during review;
return to the same meal after Add/Back. Saved recipe editing remains on My recipes.
Step fields edit a draft; Close retains those edits, method saving includes an
open row, and top Cancel discards the method draft. Do not add another Save step
workflow to recipe authoring. Existing meal step editors retain their save rules.

Equipment is one compact summary selector opening a flat checkbox list for
multiple choices and a contextual Other equipment field. Choices edit the draft
immediately. Toggle the summary, tap outside or Escape to close; Escape returns
focus. No Done button, repeated dropdown rows, Add equipment workflow or nested
configuration. Preserve existing mixed/custom labels exactly until explicitly
edited. Optional per-step equipment/temperature remains in one Step settings
section using the same control. No equipment profiles or scheduling-mode changes.



### Action and navigation hierarchy

Keep the current Home typography, ivory surface, Upcoming cooks and Game Plan.
Navigation belongs in the existing header, separate from save/sync status, with
44px targets. It does not precede or interrupt Plan/Resume cook. My recipes uses
full-screen semantics and browser Back; direct selection stays in planning.
Use one visually primary action per decision area. Group same-scope secondary
decisions visibly with it, with deliberate spacing and responsive stacking rather
than hiding them or piling unrelated controls together. Back/Cancel stays in top
navigation. Disclosures are for optional supporting detail, not core save choices.
Keep step edits in the step editor and Add a step directly after the list.
A meal's source reference may appear quietly near the dish heading. Its save
controls belong AFTER the editable step list, with a divider and space from Add a
step. A first save links only this dish; subsequent edits offer Update original
recipe and Save as copy. Do not float a save control at the top. Copy opens one
inline name field with Save copy / Cancel copy, replacing the normal save choices;
suggest a distinct _1/_2 name and require uniqueness. No second review wizard. Add a step stays with the list. Recipe saving never sits beside
Add a step and never hides inside equipment configuration. Retained Remove
is contextual, visually separate and confirmed. Do not broadly change Cooking
Mode or the Beerometer. A future standalone Equipment screen may manage favorites
and settings; profiles/configuration are outside #114. Community #135 is deferred.

Add dish has two entries: Choose a template and My recipes. Both use the same
inline choice-box grid and visual styling. My recipes contains saved recipe
choices plus an Add your own recipe box for the existing paste/.txt/.md path.
Do not navigate to full My recipes management, change the URL/hash, or expose
Edit/Remove/Save controls just to select a dish. Selecting a saved choice opens
the accepted method review; Add to meal remains explicit. Back returns to the
same choices. First and later dishes use the same switching controls. The
header's My recipes remains a separate management screen. It has no creation/
upload shortcut until independent recipe authoring exists; never redirect a
library creation action into a meal plan. Templates
remain immutable computed starters; saving creates a personal recipe. A linked
meal is an independent snapshot, not a live reference. Explicit original updates
never mutate other snapshots. Older unlinked dishes require an explicit original
selection on name collision; never infer identity by title.
