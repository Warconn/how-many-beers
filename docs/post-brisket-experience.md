# Post-brisket review

One feature preview consolidates #124, #125, #127 and #126, as requested by the
owner after reviewing the separate #123/#124 previews. This supersedes the earlier
one-issue-per-PR delivery rule. #117 and #123 are already integrated into dev.

Planning puts steps first. Each step exposes its planned date/time as the direct
editing target. One tap opens a focused date/time form with Save, Cancel and Use
plan timing. The full editor also exposes planned time without More options.
Duration, equipment and temperature targets remain optional. Dish settings sit
collapsed below the checklist; brisket timing has no second nested disclosure.
Changing only a planned time writes only the timestamp override, including when
reverting to plan timing. It never resets a duration override or corrects an actual.
DST ambiguity uses the existing occurrence/offset selector.

Cooking retains checkbox completion, one current action, a useful when/condition
cue and the same cue in Up Next/full checklist. Actual starts remain distinct from
plans. Approximate checkpoints stay conditional, expired checks ask for review,
and actual corrections update future cues without rewriting events.

New brisket dishes opt into a concise nine-step template using existing phase
relationships and stable local step keys. There is one preheat, no spritz checkbox,
no separate heat-change checkbox and no new completion flow. Hold until serving
has optional monitored-holding guidance, with no step countdown. The existing
Hold → Finish behavior and Beerometer remain intact.

New default post-smoker reserve totals 6 hours including initial rest. Manual
new-dish plans use a single 360-minute rest/hold allowance. Applied weight plans
use 120 minutes rest plus 240 minutes flexible holding, counted once. Set the
existing optional buffer input to 360 for an 8-hour total. With 7 lb trimmed,
8 hours nominal smoke and Sunday 1 PM EST target, these plan Saturday 11 PM or
9 PM loads. Requested serving time never changes. This reserve is planning room,
not a compulsory wait or a food-safety guarantee.

Existing dishes without the new template marker keep the original method and
allowances, including saved, active and completed cooks. No migration changes
old documents; backup/account/offline serialization preserves the marker on new
ones. Cooking again from an old recipe retains that saved recipe.

Upcoming account cards derive Start preparing from the same read-only planning
projection used by the planner and also label Serve. Each saved meal is projected
independently; partial/unknown plans do not receive a fictitious preparation time.

## Real cook evidence and supporting guidance

Browns Brisket, November 7–8, 2026: 12.5 lb raw, approximately 6.9 lb trimmed,
Holy Cow rub, actual load Saturday 11:34 PM EST, initial smoke about 200–210°F,
stall near 165°F with pit raised toward 230°F, later paper wrap and 250°F pit.
Pulled probe-tender at 199°F before 8:19 AM and held until the 1 PM meal. Result
was great overall, slightly dry, helped by leftover tallow. This does not establish
that holding caused dryness. MEATER's late ETA was substantially longer than the
actual remaining time; the app does not derive a new prediction algorithm from it.

Use the measured trimmed weight for planning. Keep raw brisket refrigerated before
cooking, handle raw/cooked food separately, and verify food safety and tenderness
with appropriate checks. For extended hot holding, use temperature-controlled
holding at 140°F or above and monitor food temperature. An insulated cooler alone
cannot guarantee a safe 6–8-hour hold. These instructions belong in optional step
details/supporting recipe documentation, rather than the active checklist.

References: [Meat Church long hold](https://www.meatchurch.com/blogs/recipes/weekday-brisket),
[USDA holding guidance](https://ask.fsis.usda.gov/article/At-what-temperature-should-I-hold-hot-foods).
