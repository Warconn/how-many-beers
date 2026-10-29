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
  step's default is the original time entered when it was added. If none was entered, a confirmed duration can derive its start independently from the serving target.
- Editing the date/time creates a fixed UTC planned instant. It does not move when
  serving time or the dish's total cook/rest settings change.
- Clear the date/time to leave the step explicitly unscheduled. This remains untimed
  until changed or reset, even if its underlying recipe later gains timing.
- Use plan timing restores the original/derived date and duration without resetting
  edited title, instructions, equipment, target, IDs, notes or recorded events.
- Estimated duration accepts minutes or hours, including fractional hours. Switching
  units preserves the duration; storage remains minutes. Limits are 0–43200 minutes
  (720 hours), with blank for unknown and zero for a milestone.
  Existing imported-recipe durations are used as defaults. Curated templates do not
  contain independent step durations, so those start unknown rather than inferring
  durations from gaps between checkpoints.
- Duration now constrains following timed template/recipe steps in the same dish (#41).
  The edited start stays put. Existing spacing is retained where the duration fits;
  otherwise the next step starts at the estimated finish, with later spacing carried
  forward. Example: a 14-hour thaw replaces a 30-minute window and moves subsequent
  turkey steps 13.5 hours later. Shortening/resetting removes that extra delay, never
  pulling steps before their original plan. Unknown durations are not inferred from gaps.
- Fixed and recorded steps stop incoming adjustments and report a conflict if a
  preceding duration runs past them. Fixed steps keep their own time. Date-only edits
  to unknown-duration steps remain independent. The serving target stays unchanged;
  a derived serving step may move later, producing a warning in Plan notes/Cooking Mode.
- Recipe order (template chronology or imported line order) determines links, not
  manual checklist order. Hidden steps are excluded. An untimed stage breaks automatic
  links. Added custom/general-prep tasks are independent until explicit dependencies
  are supported; other dishes keep their schedules. Resource planning remains #3.
- Live Schedule always sorts by planned time, with untimed steps last. Checklist/dish
  move controls change manual ordering, not planned timestamps.

## Confirmed imported durations (#78)

A manually entered duration for an imported step is part of the schedule, even
when the original recipe import left its duration unknown. Known durations work
backward from serving time or a fixed/recorded start, and forward from a known
previous finish. Unknown intervals break backward inference: “Cool completely”
stays duration-unknown until the user confirms a value. Explicitly unscheduled
steps stay unscheduled. Existing originally timed recipe cadence and #41 forward
adjustments remain intact; fixed and recorded starts are never silently moved.

Duration and calendar time are separate. A step shows “Start time not set” and
explains whether serving time/an explicit start or missing durations are needed.
A confirmed duration reads “Estimated 5 min”; original importer-only Timing needed
text is not copied forward as a stale warning. Authored instructions, notes,
equipment, event history, IDs and safety notes remain intact. Unknown imported
stages are not automatically treated as condition-driven food-safety checks.

The Beerometer accepts imported-only and independent-prep timelines without fake
start/finish IDs. An incompletely timed window is labeled partial; a lone serving
point with untimed work does not become a false zero-minute cook. Archived actual
duration and recorded timeline snapshots remain unchanged.

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
Timing-only edits do not invent actual work events. First recorded activity stores
an optional `recordedPlanAt` planned-position snapshot, separate from actual timestamps.
This prevents completing a shifted step from snapping its plan back. Existing actual
logs remain untouched; legacy steps without that snapshot use their existing base/fixed
plan as the anchor. New recorded positions remain anchored through serving-time edits.
An explicit fixed-date edit can still adjust planned metadata. Repeating clears these
recorded-position anchors with the actuals; backup/archive retains the original. Existing text-edit work-start
semantics during cooking remain in place.

Archives keep frozen planned timelines and actual events. Backups round-trip the
new metadata. Repeating a cook makes new IDs, clears actuals, and shifts fixed planned
times by the change in serving time; the archived original is unchanged.

Step equipment is a planning annotation. Shared-equipment warnings still use dish
settings, not an automatic resource/capacity solver. Fixed/recorded conflicts and unknown links still need review. Forward adjustment
is not a complete dependency graph, equipment solver, automatic thaw/doneness estimate,
backward start recommendation, actual-progress replanner, drag-and-drop or timer service.

## Review checklist

1. Add brisket and brats, then select a schedule entry. Verify the editor opens inside
   the correct dish without another details page.
2. Set an overnight date/time and a 90-minute duration. Save, reopen and reload; verify
   the time, estimated finish, equipment and target persist in the same step.
3. Change serving time. Fixed times should remain fixed; unmodified dish timing should
   follow the plan. Use plan timing to restore the edited step's default.
4. Edit an imported step and a general prep step, try unknown/zero durations, and cancel
   a draft. Other dishes and actual history stay unchanged. Timed successors in that recipe
   adjust if needed; general prep remains independent.
5. In America/New_York, try March 8, 2026 at 02:30 (missing) and November 1, 2026 at
   01:30 (two occurrences). The form should explain the gap and require an offset.
6. During an active cook, change timing on a completed step and verify completion,
   readings and notes survive. Check desktop and phone native date/time controls.

Unit checks cover calendar/DST conversion, validation, reset/pinning, sorting,
backup/archive/repeat and historical preservation. Playwright covers the shared
entry points, edits, cancellations, persistence and desktop/mobile DST controls.

## Duration review (#41)

1. Add turkey and brats. Edit the thaw/check step, select Hours, enter 14 and save.
   Preparation must start at or after its finish; later turkey steps retain their gaps.
   Review Live Schedule and the late-serving warning. Brats and actual logs stay intact.
2. Reopen: 14 hours converts to 840 minutes. Cancel leaves the saved plan untouched.
   Shorten to one hour, then Use plan timing; extra delays reduce/disappear.
3. Pin preparation to a fixed date. Extend thawing again; preparation stays fixed and
   the conflict is explained. Use plan timing on preparation to rejoin the shifted plan.
4. Record a shifted step, then reload/edit an earlier duration. Its recorded planned
   position and actuals must stay put. Archive/backup and repeat preserve frozen history
   and clear recorded-position anchors for the new cook.

Automated checks cover template/imported chains, gaps, hidden steps, manual order,
unknown boundaries, date-only edits, multiple dishes, invalid durations, unit conversion,
fixed/recorded anchors, overnight/DST elapsed time, archive/backup/repeat and screenshots.
