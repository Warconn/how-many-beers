# Personal cooking templates

Updated from the user's cook notes and MEATER screenshots supplied October 28, 2026. These are editable personal planning methods. Historical notes, guesses and app allowances are identified separately; they do not calibrate the weight estimator or create completed cook records.

## Brisket

- Easter 2021: trim around 3 pm, SPG both sides and Cow Cover on top around 7 pm, refrigerate uncovered, preheat around 11:50 pm and load around 12:25 am. Later notes suggest large Costco briskets may have been about **18 lb untrimmed**, a retrospective guess only.
- Start near 180°F, raise to 225°F roughly two hours in, inspect/spritz, monitor bark and stall, wrap in butcher paper when appropriate, then review raising to 250°F. Checkpoints remain approximate and condition-driven.
- Observed on-smoker duration was about 11 h 54 min, assuming the load was after midnight. Pull at 12:19 pm, eat at 3 pm: about 2 h 41 min cooler rest/hold. The template retains a conservative editable 13 h cook allowance and rounds the rest allowance to 2 h 40 min. Use monitored, food-safe holding.
- Probe readings varied, including a change after moving the probe. Fat-side-up and injecting the flat are future experiments, not recorded completed steps.
- Two unlabelled brisket graphs are supporting observations only. Their dates and weights are unconfirmed. No measured weight is seeded from the 18 lb guess. Explicitly applying a researched brisket estimate switches stage guidance to that selected profile; its coefficients are unchanged.

## Turkey

The user confirmed oven-roasted, unstuffed birds brined following Meat Church guidelines. Known weights: 2023 **20 lb**, 2024 **22 lb**. The separate 2025 notes contain both intended steps and actual deviations; the pasted duplicate is counted once. Do not assign the unlabelled turkey graph to a year or a cooking method beyond the user's confirmation.

- The new preparation control asks whether the bird is frozen, already thawing or fully thawed. Refrigerator thawing uses a conservative editable allowance of one day per 4 lb (six days at the default 22 lb reference). Already-thawing birds need the remaining days entered; fully thawed birds use a confirmation checkpoint before brining.
- Preparation is scheduled backward from roasting: thaw → refrigerated brine → remove from brine/pat dry/SPG/refrigerated air-dry → oven preparation. The supplied Friday 10 am to Saturday 8 am brine gives the default **22 h**; the detailed 8:15 am to 10:30 am dry-to-roast interval gives **2¼ h**. These are planning defaults; product instructions take precedence. Enter zero brine hours to skip brining.
- Use the user's 350°F oven setting, with the USDA minimum oven temperature of 325°F retained. The default **4½ h roast + 1 h rest** is an app planning allowance for the 20–22 lb reference, not a prediction fitted to screenshots. Early temperature/browning checks reflect the 2025 early finish and over-browning.
- The 2025 plan's 2:45 pm removal plus 45–60 min rest conflicted with 3:15 pm carving. The template reserves the entire rest before serving. Actual 1 pm removal and 1:30 pm return-to-oven are historical deviations, not recurring tasks.
- Verify 165°F in required locations; do not turn lower historical readings or assumed carryover into a safe endpoint. No fried-turkey template is added from these notes because its actual outcomes/equipment details are unconfirmed.

## Brats

This replaces the earlier grill-first Traeger sequence with the user's covered-tray method:

1. Brats, sliced vegetables/peppers, onions, beer, butter and seasoning in a covered grill-safe tray.
2. Grill around 250°F for approximately **2 h**, until bubbling. The two-hour clarification supersedes the earlier one-hour recollection. Bubbling is a process observation; verify internal temperature separately.
3. Drain carefully and sear the brats and vegetables on the Blackstone.
4. Return to a clean serving tray and hold safely if needed before guests eat.

The default 135-minute cook contains the recalled 120-minute covered stage and an explicitly labeled **15-minute app allowance** for draining/searing. Actual searing and holding durations are unknown. Holding has no fabricated duration. Pork/beef brats need 160°F; poultry sausage needs 165°F. Monitor hot holding at 140°F or above.

## Regression coverage

Unit tests cover default stage intervals, prep status/remaining days, brining and drying edits, the complete rest interval, backup round trips and malformed prep data, and separation from researched brisket profiles. Desktop/mobile journeys add all three dishes, edit turkey status, reload saved settings and inspect screenshots. Existing duration-reflow scenarios now use a prepared turkey's preheat stage instead of assuming thawing lasts 30 minutes; fixed/recorded anchors, other-dish isolation and immutable actuals remain asserted.
