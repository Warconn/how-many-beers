/**
 * Curated planning steps informed by user-supplied cook notes and linked public sources.
 * Durations remain user-editable planning placeholders, not guaranteed endpoints.
 * The references are for the original cooking methods, not a claim of endorsement.
 */
export type TemplateStep = {
  id: string;
  title: string;
  instructions: string;
  anchor: "prep" | "preheat" | "start" | "progress" | "finish" | "serve";
  beforeStartMin?: number;
  progress?: number;
  conditional?: boolean;
};
export const templateSteps: Partial<Record<string,TemplateStep[]>> = {
  brisket: [
    {id:"prep",title:"Trim the brisket",anchor:"prep",beforeStartMin:565,instructions:"Trim excess fat while retaining a protective layer. Easter 2021 notes questioned over-trimming. Large Costco briskets were later guessed at about 18 lb untrimmed; this is not a measured weight."},
    {id:"season",title:"Season with SPG and Cow Cover",anchor:"prep",beforeStartMin:325,instructions:"Apply SPG to both sides and Cow Cover on top. Refrigerate uncovered until cooking; add a little more rub before loading if needed."},
    {id:"preheat",title:"Preheat pellet smoker",anchor:"preheat",beforeStartMin:35,instructions:"Stabilize near {pitTempF}°F for the initial smoke phase. Personal Easter 2021 method: about 180 → 225 → 250°F. These are editable planning checkpoints."},
    {id:"start",title:"Put brisket on smoker",anchor:"start",instructions:"Load the brisket in smoke mode and record the actual time. Fat side up and injecting the flat were ideas for a future cook, not confirmed steps from the logged cook."},
    {id:"raise225",title:"Raise smoker to 225°F",anchor:"progress",progress:0.18,conditional:true,instructions:"The logged cook raised the smoker to 225°F about two hours after loading. Review smoke, bark and progress before changing heat; this is a planning reminder."},
    {id:"spritz",title:"Inspect and spritz if needed",anchor:"progress",progress:0.25,conditional:true,instructions:"Inspect bark and moisture; spritz if needed. Repeat checks as appropriate without keeping the lid open. Record actual temperatures and changes."},
    {id:"check",title:"Check bark and brisket temperature",anchor:"progress",progress:0.55,conditional:true,instructions:"Check the flat in multiple spots. The 2021 cook stalled around 145–147°F; moving the probe later gave 169°F. Record observations without treating one reading as proof of doneness."},
    {id:"wrap",title:"Decide whether to wrap",anchor:"progress",progress:0.8,conditional:true,instructions:"When bark and your method call for it, wrap in butcher paper. The 2021 cook wrapped during the stall and returned to the hot side. The scheduled checkpoint is approximate."},
    {id:"raise250",title:"Review heat after wrapping",anchor:"progress",progress:0.83,conditional:true,instructions:"The personal cook raised the smoker to 250°F shortly after wrapping. Check actual progress and record any setpoint change."},
    {id:"finish",title:"Probe the flat for tenderness",anchor:"finish",conditional:true,instructions:"Probe multiple spots for tenderness and verify food safety. Logged readings ranged from 190 to 210°F; neither one reading nor the clock proves readiness. Around 203°F is a common texture checkpoint, not a guarantee."},
    {id:"rest",title:"Begin safe, monitored rest or hold",anchor:"finish",conditional:true,instructions:"The logged cooler rest was about 2 h 40 min. Plan a monitored rest/hold; use temperature-controlled hot holding at 140°F or above. A cooler alone does not guarantee safe holding."},
    {id:"serve",title:"Slice and serve",anchor:"serve",instructions:"Slice across the grain. Record bark, tenderness, timing and next-cook ideas separately from completed actions."}
  ],
  wings: [
    {id:"dry",title:"Optional: air-dry wings ahead of time",anchor:"prep",beforeStartMin:500,instructions:"For extra crisp skin, leave wings on a rack in the refrigerator for about 8 hours. Keep refrigerated; skip this optional step if cooking today."},
    {id:"prep",title:"Season and set out cooking equipment",anchor:"prep",beforeStartMin:55,instructions:"Prepare wing sections and season; use separate utensils for raw and cooked poultry. Check your fryer's instructions."},
    {id:"preheat",title:"Preheat smoker to {pitTempF}°F",anchor:"preheat",beforeStartMin:25,instructions:"Meat Church's smoked-fried wings method starts with a 225°F smoke; adjust for your setup."},
    {id:"start",title:"Start smoking wings",anchor:"start",instructions:"Smoke on grates until a thermometer confirms at least 165°F. Meat Church reports approximately 3 hours for its example, but cook to temperature, not time."},
    {id:"oil",title:"Prepare fryer and heat oil",anchor:"progress",progress:0.94,instructions:"After verifying the wings have finished smoking, set up a stable fryer according to its manual and carefully heat oil to about 350°F. Keep water away from hot oil."},
    {id:"check",title:"Confirm wings are cooked through",anchor:"progress",progress:0.91,conditional:true,instructions:"Check thick parts of the wings for at least 165°F before the final crisping fry. If not done, keep cooking and update the plan."},
    {id:"fry",title:"Flash-fry wings for crisp skin",anchor:"progress",progress:0.96,conditional:true,instructions:"Using safe, properly sized batches, carefully fry smoked wings around 350°F for roughly 3 minutes until crisp. Follow manufacturer instructions and avoid overcrowding."},
    {id:"finish",title:"Drain and season or sauce",anchor:"finish",instructions:"Drain fried wings and toss with sauce or a finishing dusting. Use clean cookware for ready-to-eat chicken."},
    {id:"serve",title:"Serve wings",anchor:"serve",instructions:"Serve promptly while crisp and hot."}
  ],
  brats: [
    {id:"prep",title:"Build the brat and vegetable tray",anchor:"prep",beforeStartMin:30,instructions:"Place brats, sliced peppers/vegetables and onions in a large grill-safe tray with beer, butter and seasoning. Cover for the initial cook."},
    {id:"preheat",title:"Preheat grill to {pitTempF}°F",anchor:"preheat",beforeStartMin:20,instructions:"Stabilize the grill around {pitTempF}°F. This personal method cooks in a covered tray before searing."},
    {id:"start",title:"Cover and cook the brat tray",anchor:"start",instructions:"Cook covered for about 2 hours until the liquid is bubbling. This is the user's recalled method; bubbling is a process checkpoint, not a doneness test."},
    {id:"check",title:"Check brats and bubbling tray",anchor:"progress",progress:120/135,conditional:true,instructions:"Around two hours, check the tray and the center of several brats. Verify at least 160°F for raw pork/beef brats, or 165°F for poultry sausage. Continue cooking if needed."},
    {id:"bath",title:"Drain and sear on the Blackstone",anchor:"progress",progress:120/135,instructions:"Remove the tray, carefully drain liquid and sear the brats and vegetables on the Blackstone. The final 15 minutes in this schedule is an editable app allowance for draining/searing, not a measured duration."},
    {id:"finish",title:"Verify doneness and return to the tray",anchor:"finish",conditional:true,instructions:"Verify internal doneness with a thermometer, then return the seared brats and vegetables to a clean serving tray. Searing color alone is not a temperature check."},
    {id:"hold",title:"Hold safely until guests are ready",anchor:"finish",conditional:true,instructions:"If serving is delayed, keep the tray actively hot at 140°F or above and monitor it. Holding duration is unspecified; adjust the plan to your guests."},
    {id:"serve",title:"Serve brats and vegetables",anchor:"serve",instructions:"Serve with the seared vegetables and onions when guests are ready."}
  ],
  turkey: [
    {id:"thaw",title:"Start refrigerator thawing",anchor:"prep",conditional:true,instructions:"Allow about 24 hours per 4–5 lb in a refrigerator at 40°F or below. A 20–22 lb bird may need 5–6 days. Confirm it is fully thawed before brining; never thaw on the counter."},
    {id:"brine",title:"Start refrigerated brine",anchor:"prep",instructions:"Follow your Meat Church brine product/recipe directions and label quantities. Personal notes include Bird Bath, peppercorns, poultry bouquet and three small oranges. Keep the bird at 40°F or below; check whether it is already enhanced or salted."},
    {id:"dry",title:"End brine, pat dry and refrigerate uncovered",anchor:"prep",instructions:"Remove from brine, pat dry, season with SPG as appropriate for the brine's salt level, and refrigerate uncovered to air-dry. Avoid washing raw poultry. The 2025 plan brined about 22 hours; confirm the duration for your product."},
    {id:"preheat",title:"Set oven to {pitTempF}°F",anchor:"preheat",beforeStartMin:60,instructions:"Personal oven-roasted, unstuffed method uses 350°F. Keep the oven at least 325°F. Prepare the roasting pan and rack."},
    {id:"prep",title:"Prepare and season the turkey",anchor:"prep",beforeStartMin:15,instructions:"Use a fully thawed, unstuffed bird. Remove giblets, add oil and butter under the skin as desired, season and place in the roasting pan. Keep raw poultry separate from ready-to-eat food."},
    {id:"start",title:"Begin roasting turkey",anchor:"start",instructions:"Roast unstuffed and record the actual start. Historical birds were 20 lb (2023) and 22 lb (2024). The default 4½-hour cook is a conservative editable planning placeholder, not a prediction from the graphs."},
    {id:"check",title:"Check breast, thigh and wing temperatures",anchor:"progress",progress:0.45,conditional:true,instructions:"Begin checking around two hours and continue as needed. The 2025 bird finished earlier than planned with some over-browning. Check the thickest breast and innermost thigh/wing, avoiding bone; shield browned areas if needed."},
    {id:"baste",title:"Optional: baste and check browning",anchor:"progress",progress:0.5,conditional:true,instructions:"If following your butter-basting method, baste periodically and check browning. Keep oven openings brief. Basting times do not determine doneness."},
    {id:"finish",title:"Verify 165°F in all required locations",anchor:"finish",conditional:true,instructions:"Verify at least 165°F in the thickest breast and innermost thigh and wing. Do not rely on a 155–162°F reading plus assumed carryover. Log the actual removal time when ready."},
    {id:"rest",title:"Rest before carving",anchor:"finish",instructions:"Personal plan allows 45–60 minutes before carving; the default reserves 60 minutes. Monitor safe holding for a longer wait at 140°F or above; if done early, revise the hold rather than leaving the bird unattended."},
    {id:"serve",title:"Carve and serve turkey",anchor:"serve",instructions:"Carve after resting and verifying safe doneness. Use drippings for gravy as desired."}
  ]
};
