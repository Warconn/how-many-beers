# Focused Cooking Mode (#26)

Cooking Mode prioritizes a clock-based execution checklist:

- **Now:** unfinished steps due at or before the current instant, in chronological order.
  The earliest one gets the existing next-action emphasis. Being due does not establish
  readiness, especially for bark, tenderness and temperature-dependent steps.
- **Next:** steps scheduled in the next 30 minutes, including the exact boundary.
- **Later:** scheduled steps more than 30 minutes away.
- **Untimed:** steps without a valid scheduled instant. They are never called overdue.
- **Completed:** separate collapsed section with original completion timestamps, readings,
  notes and activity. Reopening continues to use the existing append-only event model.

Future and untimed steps show a compact title, dish and planned time. Expand one for the
same shared editor, completion, readings and notes as a Now step. This is progressive
disclosure, not a new editing route. Edit and temperature logging remain readily available;
move/remove live under **Step options**. Manual ordering affects the planner checklist;
Cooking Mode and Live Schedule remain chronological. Steps are never completed by the clock.

The clock refreshes every 30 seconds and on window focus/tab visibility changes. Regrouping
pauses while a cooking editor or reading form is open or an input/select/textarea has focus,
so partially entered data is not moved out from under the user. Explicitly collapsing a
future step cancels its unsaved editor draft and clears the pause; leaving Cooking Mode
also clears its transient editor state. It catches up on the next
eligible tick. Browser suspension does not require background execution: focus/re-entry
uses current time. This is not a timer/notification service (#11) or dependency replanner (#3).
Date comparisons use elapsed instants, including across midnight and DST transitions.

Home and cook overview links share a compact navigation row and only change UI view.
The brand header is smaller during cooking; Beerometer is available in an optional
Cook duration disclosure. Progress remains visible. Add-step controls move below the
checklist rather than preceding the next action. Shared-equipment warnings remain visible
on phones; safe-temperature/holding reminders stay accessible. Finish/save and the phone
bottom tools continue using the existing archive/backup lifecycle.

No storage schema, task/event ID or actual timestamp changes. Loading or navigating
between Home, overview and Cooking Mode never resets progress. Planning remains the
responsive two-column menu and Live Schedule experience.

## Validation

Acceptance tests first fail against the previous ungrouped checklist. Playwright covers
Now/Next/Later/untimed presentation despite reversed manual order, clock advancement,
no automatic completion, temperature logging, notes, completed disclosure, editor/options,
Home/overview/reload recovery and phone overflow. Screenshots are reviewed on desktop and
phone. Pure grouping tests cover exact thresholds, invalid/unknown dates, completed and
empty lists, immutability and offset transitions.

Manual check: plan brisket and brats, start cooking, log a reading and note on a Now step,
complete it, expand Completed and verify the timestamps. Return Home, view the plan,
continue, reload and confirm identical activity. Expand a future step and adjust it with
the shared timing editor. Try a narrow phone and keyboard controls. Actual iPhone Safari,
Android outdoor and nighttime cooking sessions remain part of #4 real-device alpha QA.
