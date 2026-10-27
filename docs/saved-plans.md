# Save a planned cook for later (#39)

A cook is already autosaved in the current browser as it is edited. The planner now
also offers **Save plan for later**, beside Start cooking. It writes the current plan
to browser storage synchronously and only then returns Home with a confirmation.
It does not enter Cooking Mode, set a start time, complete a step or archive the plan.
No new schema or saved-plan snapshot is introduced: further edits continue autosaving.
Finish or cancel an open dish/checklist step editor or per-dish new-step form before saving the plan, so this action
cannot silently discard its unsaved step draft.

Home shows the planning cook and its first unfinished timed step, plus the first
unfinished built-in cooking-start step if it differs. These come from `cookTimeline`,
so hidden/completed steps and the serving milestone are excluded and fixed overrides, applied brisket timing,
other dishes and actual calendar dates are respected. Manual checklist order does
not change the earliest planned start. Dates include year and local timezone.
Untimed/invalid-date drafts show **No confirmed start time**, rather than an invented
start. Mixed timed/untimed plans show a warning alongside the first timed step.
They remain saveable if they have steps; Start cooking still requires a valid
serving time. General-prep-only plans remain discoverable on Home.

**Resume planning** reopens the same cook; **Start cooking** starts that cook explicitly
and acknowledges the storage write before entering Cooking Mode. In-progress cooks
retain Continue cooking and their original start timestamp, completion and history.
The clock never starts a session automatically and this does not add reminders (#11).

A failed save stays in the planner with a recoverable message and no success claim.
The current in-memory plan remains available to export. Save does not overwrite the
archive library. New cook still requires confirmation before replacing meaningful work.

## Scope and review

This keeps **one active/planning cook per browser**, with existing JSON backup/restore.
It is not a library of multiple future cooks and it does not add cloud sync. Clearing
browser data loses local plans unless backed up. Feature-preview URLs have separate
browser storage; export and restore a backup to move a plan between preview origins.

Acceptance tests cover explicit save, reopening a tab, starting the same cook later,
fixed timing/manual ordering, archive and note preservation, failed writes, retry,
invalid/untimed drafts, general-prep-only plans and existing cooking-session history.
Desktop and phone screenshots are reviewed. The initial Save action tests failed
against the missing action; a separate regression check first reproduced a prep-only
plan not appearing on Home.

Manual journey: add brisket and brats, set serving time, adjust steps, Save plan for
later, close and reopen the same URL/browser, inspect the planned prep and cooking
start dates, then tap Start cooking when ready. Review/adjust still opens the planner.

Planning actions share a 48px height and zero top margin. Start cooking and Save plan
for later align on desktop and stack at equal width on phones with an 8px gap;
Review checklist remains a quieter text action with the same tap height.
