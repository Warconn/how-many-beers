# Step timing and details (#30)

Edit a step in its dish, or select the matching item in Live Schedule. Both entry
points open the same inline editor. General prep steps open in checklist review.
Only one step editor is active; Save & Close applies the draft and Cancel/Escape
leaves the saved cook unchanged. A successful save confirms the change and returns
keyboard focus to Edit.

The editor supports name, instructions, planned date/time, estimated duration,
equipment for that step and an optional target food temperature in °F. Targets
are planning notes, not actual readings, verified doneness or equipment setpoints.
Existing condition-driven safety checks remain visible.

## Timing rules

- Default timing follows the existing dish/template or recipe plan. A general prep
  step's default is the original time entered when it was added, or unscheduled.
- Editing the date/time creates a fixed UTC planned instant. It does not move when
  serving time or the dish's total cook/rest settings change.
- Clear the date/time to leave the step explicitly unscheduled. This remains untimed
  until changed or reset, even if its underlying recipe later gains timing.
- Use plan timing restores the original/derived date and duration without resetting
  edited title, instructions, equipment, target, IDs, notes or recorded events.
- Estimated duration may be unknown (blank), zero (a milestone), or 0–43200 minutes.
  Existing imported-recipe durations are used as defaults. Curated templates do not
  contain independent step durations, so those start unknown rather than inferring
  durations from gaps between checkpoints.
- Duration updates that step's estimated finish. It does **not** move other starts
  or claim dependencies/capacity were resolved. Advanced replanning is #3.
- Live Schedule always sorts by planned time, with untimed steps last. Checklist/dish
  move controls change manual ordering, not planned timestamps.

## Dates and timezones

The form identifies the viewer's browser timezone. Dates include the actual day,
so overnight and multi-day cooks are editable. Fixed planned times save as UTC ISO
instants; their local display follows the viewer's timezone.

A nonexistent spring-forward local time is rejected without losing the draft. A
new ambiguous fall-back time requires choosing its UTC offset/occurrence. An unchanged
existing date retains its original instant, offset and seconds when other fields
are edited. Duration is elapsed minutes, including across a clock change.

The serving-time input retains its existing device-local storage format. This
change does not add cook-level timezone selection or a cross-device timezone migration.

## Preservation and limits

Optional override metadata extends the existing version-1 cook format. Old saved
cooks remain loadable; text-only callers preserve timing overrides. Completion,
start/temperature/equipment events and notes remain separate from planning changes.
Timing-only edits do not invent actual work events. Existing text-edit work-start
semantics during cooking remain in place.

Archives keep frozen planned timelines and actual events. Backups round-trip the
new metadata. Repeating a cook makes new IDs, clears actuals, and shifts fixed planned
times by the change in serving time; the archived original is unchanged.

Step equipment is a planning annotation. Shared-equipment warnings still use dish
settings, not an automatic resource/capacity solver. Changing duration can create
overlapping planned intervals; users must review the combined plan. URL recipe
parsing, automatic dependency shifting, drag-and-drop and timers are not introduced.

## Review checklist

1. Add brisket and brats, then select a schedule entry. Verify the editor opens inside
   the correct dish without another details page.
2. Set an overnight date/time and a 90-minute duration. Save, reopen and reload; verify
   the time, estimated finish, equipment and target persist in the same step.
3. Change serving time. Fixed times should remain fixed; unmodified dish timing should
   follow the plan. Use plan timing to restore the edited step's default.
4. Edit an imported step and a general prep step, try unknown/zero durations, and cancel
   a draft. Neither another dish nor actual history should change.
5. In America/New_York, try March 8, 2026 at 02:30 (missing) and November 1, 2026 at
   01:30 (two occurrences). The form should explain the gap and require an offset.
6. During an active cook, change timing on a completed step and verify completion,
   readings and notes survive. Check desktop and phone native date/time controls.

Unit checks cover calendar/DST conversion, validation, reset/pinning, sorting,
backup/archive/repeat and historical preservation. Playwright covers the shared
entry points, edits, cancellations, persistence and desktop/mobile DST controls.
