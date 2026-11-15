# Deep-fried turkey: owner review/import (#153)

The [downloadable Markdown method](../../public/recipes/deep-fried-turkey.md) uses
the existing text upload, method review and My recipes save path. It is a custom
personal method, separate from Turkey (oven). It does not seed any hosted account,
create a global preset or change the oven recipe. After dev merge, download it at
https://dev.how-many-beers.pages.dev/recipes/deep-fried-turkey.md .

## Import once, then reuse

1. Sign in to dev and open a meal plan. Set the serving date/time as usual.
2. Add a dish → My recipes → Add your own recipe → upload the `.md` file.
3. Set Recipe title to **Deep-fried turkey** (uploads initially suggest the file
   name), then preview/review the method. Equipment should read **Electric Fryer**. Confirm the
   measured bird weight and the appliance's turkey-capacity/displacement limits.
   Record the verified weight in the preparation instruction if useful.
4. The initial oil warm-up allowance is 60 minutes, editable to 55–60 or your
   measured value. When changing an estimate, keep the step name/instructions
   consistent too (for example, shorten the action name to Begin warming oil).
   Frying duration and the oil setpoint are deliberately unset;
   enter the estimate/setting from the actual model's instructions and bird size.
   Instructions, including temperature cues and method notes, remain editable.
5. Select **Save to My recipes** once. Future use is **My recipes → Deep-fried
   turkey**, alongside Turkey (oven). Update original recipe or Save as copy follows
   the existing source-aware rules. Repeat upload is a separate new method; choose
   the saved recipe for reuse. Retrying the same save uses existing receipts.
6. Add both recipes to the same meal. The dishes have independent IDs, equipment
   and snapshots. Editing the library recipe later does not rewrite that meal,
   earlier cooks or their archived activity.

The source distinguishes starting oil heat, oil-ready verification, lowering the
bird, frying/doneness, removal/draining and rest/carving. Doneness is checked at
165°F internal, never inferred from a timer or rapid checkbox completion. Rest's
20 minutes is an editable planning allowance; normal cooking retains the existing
rest/Finish interaction rather than introducing another serving workflow.

## Owner inputs and limits

As of November 15, both birds are provisionally **19–20 lb**, with **Sunday,
November 22, 2026, 3 PM local time** requested. Neither range is a measured weight
or confirmation that the fryer can accept the bird. Fryer capacity/displacement
remains unknown. **There is no final Thanksgiving frying duration or start time.**
Serving time stays a meal setting, outside the reusable recipe document.

The owner observed approximately **54 minutes** warming about **3 gallons** of oil
at approximately **45°F ambient**. The initial 60-minute allowance provides a small
planning margin for that observation. It is not a universal preheat rule or a
prescribed oil quantity. Ambient temperature is not stored as an oil setpoint.

Before using the method, consult the exact [Masterbuilt model manual](https://www.masterbuilt.com/pages/instruction-manuals)
for bird size, basket/displacement and min/max oil fill, oil temperature, setup
location and operating instructions. No specific XL capacity rating has been
assumed or verified here. The public manufacturer page could not be retrieved in
the implementation environment. Do not infer capacity from the XL name or the
owner's previous oil quantity.

[USDA FSIS Turkey Basics: Safe Cooking](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/poultry/turkey-basics-safe-cooking)
is the supporting reference for full thawing, safe handling and the 165°F minimum.
Check the innermost thigh/wing and thickest breast with a food thermometer. Use
an unstuffed, fully thawed and thoroughly dried bird, and follow the appliance's
approved setup/lowering/draining instructions. These details support the concise
active checklist rather than adding repeated safety prompts.

## Verification

`friedTurkeyRecipe.test.ts` checks source actions, editable estimates, no ambient
setpoint/assumed weight, lossless validated JSON, independent oven snapshots and no
automatic doneness. It keeps the real PostgreSQL RPC fixture identical to the
public Markdown adapter output. `personal-recipe-fried-turkey.sql` saves and reads
that exact document through the existing validator/RPC in clean/upgrade test DBs.

`fried-turkey-import.spec.ts` downloads the actual public asset and uploads/reviews
it alongside oven turkey on desktop/mobile/iPhone. The account recipe journey
saves it, reloads, selects it as a second dish, edits its notes/temperature cue and
verifies existing history, the oven recipe and the meal snapshot remain intact.
Account browser tests use RPC fixtures; they do not assert hosted schema health
or insert a recipe into the owner's real account. #3's parallel scheduler remains
separate; this method does not promise a conflict-free two-turkey timetable.
