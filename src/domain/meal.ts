import type { BrisketPlan } from "./brisketEstimate";
export type PresetId = "brisket" | "turkey" | "ribs" | "chicken" | "side" | "wings" | "brats" | "custom";

export type RecipeStep = {
  id: string;
  title: string;
  minutes: number | null; // null: unscheduled until user confirms timing
};

export type Dish = {
  id: string;
  name: string;
  preset: PresetId;
  equipment: string;
  cookMinutes: number;
  restMinutes: number;
  pitTempF?: number;
  weightLb?: number;
  steps?: RecipeStep[];
  brisketPlan?: BrisketPlan;
  turkeyPrep?: {state:"frozen"|"thawing"|"thawed";thawDays:number;brineHours:number;dryHours:number};
};

export type Meal = {
  version: 1;
  id: string;
  name: string;
  serveAt: string; // local datetime string for input and same-browser persistence
  dishes: Dish[];
  completed: Record<string, string>; // ISO completion timestamp keyed by task ID
  notes: Record<string, string>;
  mode?: "planning" | "cooking"; // optional to preserve existing localStorage meals
  startedAt?: string;
};

export type PlannedTask = {
  id: string;
  dishId: string;
  dishName: string;
  title: string;
  instructions: string;
  scheduledAt: string | null;
  isCondition: boolean;
  durationMinutes?: number | null;
  equipment?: string;
  targetTempF?: number | null;
  timingMode?: "plan" | "fixed" | "unscheduled";
  baseScheduledAt?: string | null;
  baseDurationMinutes?: number | null;
  baseEquipment?: string;
  recordedPlanAt?: string | null;
  scheduleAdjustmentMinutes?: number; // Derived, never a fixed-time override.
  recipeOrder?: number; // Derived source order for imported work with incomplete dates.
};

export const presets: Record<Exclude<PresetId, "custom">, { label: string; equipment: string; cookMinutes: number; restMinutes: number; notice: string; pitTempF?: number; cookRangeMinutes?: [number,number]; referenceWeightLb?: number; sources?: {title:string;url:string}[] }> = {
  brisket: {
    label: "Smoked brisket",
    equipment: "Pellet smoker",
    cookMinutes: 780,
    restMinutes: 160,
    pitTempF: 180,
    cookRangeMinutes: [600,1080],
    referenceWeightLb: 16,
    sources: [{title:"Meat Church · Pellet Grill Brisket",url:"https://www.meatchurch.com/blogs/recipes/pellet-grill-brisket"},{title:"USDA · Food safety",url:"https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/steps-keep-food-safe"}],
    notice: "Personal Easter 2021 method: 180 → 225 → 250°F, SPG + Cow Cover and butcher paper. 13 h is a planning allowance; ~18 lb untrimmed is a historical guess, not a measured input. Weight comparisons use separate researched profiles."
  },
  turkey: {
    label: "Turkey (oven)",
    equipment: "Oven",
    cookMinutes: 270,
    restMinutes: 60,
    pitTempF: 350,
    cookRangeMinutes: [240,300],
    referenceWeightLb: 22,
    sources: [{title:"USDA · Turkey roasting",url:"https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/poultry/lets-talk-turkey-roasting"}],
    notice: "Personal brined, unstuffed oven method. 20–22 lb historical birds; 4½ h roast + 1 h rest is an editable planning allowance, not a fit to the graphs. Plan thawing and brining ahead; verify 165°F."
  },
  ribs: {
    label: "Smoked ribs",
    equipment: "Smoker",
    cookMinutes: 330,
    restMinutes: 20,
    notice: "Cut, thickness and smoker conditions change the finish window."
  },
  chicken: {
    label: "Roast chicken",
    equipment: "Oven",
    cookMinutes: 80,
    restMinutes: 15,
    notice: "Use a probe to verify the safe internal temperature, not the clock."
  },
  wings: {
    label: "Smo-fried wings",
    equipment: "Smoker + fryer",
    pitTempF: 225,
    cookRangeMinutes: [180,260],
    cookMinutes: 195,
    restMinutes: 5,
    sources:[{title:"Meat Church · Smoked Fried Wings",url:"https://www.meatchurch.com/blogs/recipes/smoked-fried-wings"},{title:"USDA · Deep frying safety",url:"https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/grilling-and-food-safety"}],
    notice:"Smoke to at least 165°F (Meat Church reports about 3 h), then crisp carefully in ~350°F oil. Timing varies."
  },
  brats: {
    label: "Grilled beer-bath brats",
    equipment: "Grill + Blackstone",
    pitTempF: 250,
    cookRangeMinutes: [120,150],
    cookMinutes: 135,
    restMinutes: 0,
    sources:[{title:"USDA · Safe temperatures",url:"https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart"}],
    notice:"Personal covered-tray method: ~2 h with beer, butter, onions, vegetables and seasoning, then drain and Blackstone-sear. Schedule adds a 15 min adjustable searing allowance; actual searing/holding times are unknown."
  },
  side: {
    label: "Oven side dish",
    equipment: "Oven",
    cookMinutes: 45,
    restMinutes: 5,
    notice: "Edit cook time to match the actual recipe."
  }
};

export function createDish(preset: Exclude<PresetId, "custom">): Dish {
  const p = presets[preset];
  return { id: crypto.randomUUID(), name: p.label, preset, equipment: p.equipment, pitTempF: p.pitTempF, weightLb: preset === "brisket" ? undefined : p.referenceWeightLb, cookMinutes: p.cookMinutes, restMinutes: p.restMinutes };
}

export function localDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function newMeal(): Meal {
  const serve = new Date();
  serve.setDate(serve.getDate() + 1);
  serve.setHours(18, 0, 0, 0);
  return { version: 1, id: crypto.randomUUID(), name: "Next cook", serveAt: localDateTime(serve), dishes: [], completed: {}, notes: {}, mode: "planning" };
}
