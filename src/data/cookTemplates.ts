/**
 * Curated, independently authored planning steps informed by linked public sources.
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
    {id:"prep",title:"Trim and season the brisket",anchor:"prep",beforeStartMin:75,instructions:"Trim the full packer and season. Refrigerate until ready; an overnight seasoning period is optional."},
    {id:"preheat",title:"Preheat pellet smoker",anchor:"preheat",beforeStartMin:35,instructions:"Prepare the pellet smoker around {pitTempF}°F for the first smoke phase. Meat Church's pellet brisket uses staged heat; adjust to your chosen method."},
    {id:"start",title:"Put brisket on smoker",anchor:"start",instructions:"Place the brisket on a stable cooking grate. Log the actual start time and initial smoker temperature."},
    {id:"check",title:"Check bark and brisket temperature",anchor:"progress",progress:0.55,conditional:true,instructions:"Check the bark, temperature and stall. Meat Church's pellet method raises the pit to about 225°F once internal temperature is near 165°F. This is a checkpoint, not a timer."},
    {id:"wrap",title:"Decide whether to wrap",anchor:"progress",progress:0.75,conditional:true,instructions:"When bark is set, commonly around 175°F internal in Meat Church's pellet method, wrap in butcher paper if desired. Consider raising pit to 250–275°F. Log the actual reading and decision."},
    {id:"finish",title:"Probe the flat for tenderness",anchor:"finish",conditional:true,instructions:"Verify food safety and look for a very tender flat; Meat Church often observes roughly 203°F, but tenderness rather than a fixed number determines barbecue texture."},
    {id:"hold",title:"Begin safe, monitored rest or hold",anchor:"finish",conditional:true,instructions:"Rest briefly or use temperature-controlled hot holding at 140°F or above. Never assume a cooler maintains a safe temperature; use a thermometer and food-safe time limits."},
    {id:"serve",title:"Slice and serve",anchor:"serve",instructions:"Slice across the grain and serve. Record whether bark, tenderness and timing met your goals."}
  ],
  wings: [
    {id:"dry",title:"Optional: air-dry wings ahead of time",anchor:"prep",beforeStartMin:500,instructions:"For extra crisp skin, leave wings on a rack in the refrigerator for about 8 hours. Keep refrigerated; skip this optional step if cooking today."},
    {id:"prep",title:"Season and set out cooking equipment",anchor:"prep",beforeStartMin:55,instructions:"Prepare wing sections and season; use separate utensils for raw and cooked poultry. Check your fryer's instructions."},
    {id:"preheat",title:"Preheat smoker to {pitTempF}°F",anchor:"preheat",beforeStartMin:25,instructions:"Meat Church's smoked-fried wings method starts with a 225°F smoke; adjust for your setup."},
    {id:"start",title:"Start smoking wings",anchor:"start",instructions:"Smoke on grates until a thermometer confirms at least 165°F. Meat Church reports approximately 3 hours for its example, but cook to temperature, not time."},
    {id:"oil",title:"Prepare fryer and heat oil",anchor:"progress",progress:0.8,instructions:"Toward the end of smoking, set up a stable fryer according to its manual and carefully heat oil to about 350°F. Keep water away from hot oil."},
    {id:"check",title:"Confirm wings are cooked through",anchor:"progress",progress:0.9,conditional:true,instructions:"Check thick parts of the wings for at least 165°F before the final crisping fry. If not done, keep cooking and update the plan."},
    {id:"fry",title:"Flash-fry wings for crisp skin",anchor:"progress",progress:0.96,conditional:true,instructions:"Using safe, properly sized batches, carefully fry smoked wings around 350°F for roughly 3 minutes until crisp. Follow manufacturer instructions and avoid overcrowding."},
    {id:"finish",title:"Drain and season or sauce",anchor:"finish",instructions:"Drain fried wings and toss with sauce or a finishing dusting. Use clean cookware for ready-to-eat chicken."},
    {id:"serve",title:"Serve wings",anchor:"serve",instructions:"Serve promptly while crisp and hot."}
  ],
  brats: [
    {id:"prep",title:"Slice onions and make beer bath",anchor:"prep",beforeStartMin:45,instructions:"Prepare beer, onions, and butter in a heat-safe pan or saucepan. The Traeger method simmers onions in beer while grilling the brats."},
    {id:"preheat",title:"Preheat grill to {pitTempF}°F",anchor:"preheat",beforeStartMin:25,instructions:"Traeger's grill-and-beer-bath method calls for about 350°F. Use a suitable pan for the beer bath."},
    {id:"start",title:"Place brats on the grill",anchor:"start",instructions:"Grill raw bratwurst, turning with tongs. Traeger's example starts with roughly 20–25 minutes, then continues in the beer bath."},
    {id:"bath",title:"Transfer brats to simmering beer and onions",anchor:"progress",progress:0.35,instructions:"Transfer brats to the beer pan with tongs and simmer until the onions are tender, often another 45–60 minutes in the source recipe."},
    {id:"finish",title:"Check bratwurst internal temperature",anchor:"finish",conditional:true,instructions:"If made from raw ground pork or beef, verify 160°F in the center. Time and color alone are not enough; other sausage products may have different labeled instructions."},
    {id:"serve",title:"Toast buns and serve",anchor:"serve",instructions:"Toast buns shortly before serving; top brats with onions and condiments."}
  ],
  turkey: [
    {id:"thaw",title:"Check turkey is fully thawed and safely refrigerated",anchor:"prep",beforeStartMin:80,instructions:"Before cooking day, verify the turkey is safely thawed, at 40°F or below while refrigerated. Thawing can take several days, so schedule that separately."},
    {id:"prep",title:"Prepare and season the turkey",anchor:"prep",beforeStartMin:50,instructions:"Use a fully thawed bird. Remove packaging and giblets if present, pat dry, season, and set in a shallow roasting pan. Avoid washing raw poultry."},
    {id:"preheat",title:"Set oven to {pitTempF}°F",anchor:"preheat",beforeStartMin:25,instructions:"USDA recommends roasting whole turkey at an oven temperature no lower than 325°F. This template assumes an unstuffed bird."},
    {id:"start",title:"Begin roasting turkey",anchor:"start",instructions:"Roast in a stable pan/rack. Actual duration depends strongly on turkey weight, stuffing, oven and pan; treat this schedule as an editable starting estimate."},
    {id:"check",title:"Check breast, thigh and wing temperatures",anchor:"progress",progress:0.75,conditional:true,instructions:"Use a food thermometer in the thickest part of the breast, innermost thigh and wing, avoiding bone. Continue cooking until all checked locations reach 165°F."},
    {id:"finish",title:"Verify 165°F in all required locations",anchor:"finish",conditional:true,instructions:"The USDA safe minimum is 165°F in the thickest breast and innermost thigh and wing; stuffing, if any, must independently reach 165°F."},
    {id:"hold",title:"Rest before carving",anchor:"finish",instructions:"A roughly 20-minute stand improves carving. For longer waits, follow safe hot-holding or refrigeration guidance."},
    {id:"serve",title:"Carve and serve turkey",anchor:"serve",instructions:"Carve and serve after verifying safe internal temperature."}
  ]
};
