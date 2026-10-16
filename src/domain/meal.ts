export type PresetId = "brisket" | "turkey" | "ribs" | "chicken" | "side" | "custom";

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
  steps?: RecipeStep[];
};

export type Meal = {
  version: 1;
  id: string;
  name: string;
  serveAt: string; // local datetime string for input and same-browser persistence
  dishes: Dish[];
  completed: Record<string, string>; // ISO completion timestamp keyed by task ID
  notes: Record<string, string>;
};

export type PlannedTask = {
  id: string;
  dishId: string;
  dishName: string;
  title: string;
  instructions: string;
  scheduledAt: string | null;
  isCondition: boolean;
};

export const presets: Record<Exclude<PresetId, "custom">, { label: string; equipment: string; cookMinutes: number; restMinutes: number; notice: string }> = {
  brisket: {
    label: "Smoked brisket",
    equipment: "Pellet smoker",
    cookMinutes: 780,
    restMinutes: 120,
    notice: "Large variability. Stall, wrapping, and tenderness are condition-driven; start with ample buffer."
  },
  turkey: {
    label: "Turkey (oven)",
    equipment: "Oven",
    cookMinutes: 210,
    restMinutes: 30,
    notice: "Duration is illustrative, not a safe-doneness measure. Verify poultry internal temperature with a probe."
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
  return { id: crypto.randomUUID(), name: p.label, preset, equipment: p.equipment, cookMinutes: p.cookMinutes, restMinutes: p.restMinutes };
}

export function localDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function newMeal(): Meal {
  const serve = new Date();
  serve.setDate(serve.getDate() + 1);
  serve.setHours(18, 0, 0, 0);
  return { version: 1, id: crypto.randomUUID(), name: "Next cook", serveAt: localDateTime(serve), dishes: [], completed: {}, notes: {} };
}
