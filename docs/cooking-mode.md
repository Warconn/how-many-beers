# Guided Cooking Mode (#26)

Cooking Mode opens one step with its instructions, planned timing, notes and actual
readings. The guide chooses the earliest unfinished step in chronological order,
independent of manual planner checklist order. If an imported recipe has only a serving
milestone and untimed work, the guide starts with its untimed work rather than suggesting
that dinner is the first cooking action. Condition-driven steps require actual checks.

## Moving through a cook

- Check off the current step to record completion and advance to the next unchecked step.
  Reopening retains prior activity and records the existing reopen event.
- The fixed **Up next** footer shows the following step, dish and planned time on desktop
  and phone. Tap to preview it; previewing does not check off the current step. Other
  unchecked work stays discoverable in the full checklist.
- **Full checklist** shows every dish’s steps as one flat chronological list, including
  completed and untimed items. Checkboxes operate directly; open a row for the same
  detailed step, including its actual readings and notes. **Back to step** returns to
  the selected step. This navigation does not change cook mode or start timestamps.
- **Edit plan** opens the existing dish/menu planner for setup adjustments. It is separate
  from the whole-cook execution checklist. Home and reload resume the next unfinished step.
- The active step remains selected when its planned date/time is edited, even if that
  changes chronological position. Completion resumes guidance from unfinished work.

The shared step editor still supports dates, duration, equipment and planning targets;
actual events remain separate. The current-step card uses a neutral surface, a clear title
and subdued planned time/dish metadata. Instructions, action controls and notes share
one content edge. Edit, Log temperature and Step options use matching compact controls
with 44px tap targets, in the same visual and keyboard order.
An open editor or reading form blocks switching steps, Home, Edit plan and finishing,
with a visible explanation, until saved/cancelled. The completion checkbox also waits
for those drafts. Clock refreshes do not discard or complete a step. Step removal stays under secondary Step options; manual reordering remains in planning
and does not override chronological execution.

## Saving and finishing

Progress continues autosaving in the current browser. There is no ambiguous Save Cook
shortcut in the footer. **Finish cook** is a separate header action, and is offered after
all steps are checked. It opens optional outcome notes and the unchecked-step count.
Only **Save finished cook** archives the session using the existing frozen history
snapshot and rotates to an empty plan. **Keep cooking** dismisses it without mutation.
A failed archive retains the active cook through the existing recovery path.
Planning’s Save plan for later (#39) remains a separate action; it does not finish a cook.

Menu/equipment warnings, thermometer/holding reminders, optional Beerometer and adding a
custom step remain secondary. The responsive planner and Live Schedule are preserved.
Cancel adding is now a quiet **× Cancel** text control beside the menu heading, with a
44px hit area and a descriptive accessible name. It closes the picker without mutation.

## Timing and data guarantees

The clock refreshes every 30 seconds and on tab/window re-entry; refresh pauses while
editing/reading or focusing an input. Labels describe planned timing. No clock action
starts/completes food, shifts dependencies or interprets doneness. Untimed means untimed.
The footer is navigation, not a countdown or notification service (#11).

No storage schema, task/event ID or actual timestamp changes. Existing notes, readings,
completion, custom tasks, overrides, manual order and archived snapshots survive navigation,
reloading, editing and explicitly finishing. Advanced replanning remains #3. Current
browser storage/backup and one active cook per browser remain unchanged.

## Verification and manual review

Acceptance tests first failed on the old grouped interface and wide Cancel button.
Desktop/phone Playwright covers the single current card, fixed next-step footer, flat
whole-cook list, preview without mutation, dates and selected-step continuity, protected
editor/reading drafts, temperature/notes/completion, actual history, Home/plan/reload,
all-checked finishing, archive confirmation/cancel, compact Cancel and narrow layouts.
Card acceptance first failed on the staggered instruction/note edges; it now checks
alignment, consistent action heights and a single action row down to 375px.
Unit checks cover selection, chronological/offset order, untimed recipes, removed steps,
completed activity, wraparound preview and immutable plans/events.

Try brisket and brats: start, inspect the next step at the bottom, preview it, open Full
checklist and return to an earlier unchecked step. Log a reading, add a note, complete the
step and verify advancement. Change a planned date and confirm the editor stays on that
step. Review completed actuals, leave Home, reload and resume. Finish only when ready.
Actual iPhone Safari/outdoor/nighttime sessions remain #4 alpha QA; automated phone
coverage uses an emulated Chromium viewport.
