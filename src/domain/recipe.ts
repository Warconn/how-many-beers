import type { Dish, RecipeStep } from "./meal";

// Intentionally conservative importer. No durations are inferred from vague free text.
// A user must review/import timings before relying on the generated schedule.
export function parseRecipeText(name: string, text: string): Dish {
  const lines = text.split(/\r?\n/).map(line=>line.trim())
    .filter(line=>line.length>2)
    .filter(line=> !/^(ingredients?|instructions?|directions?|method):?$/i.test(line))
    .slice(0,24);
  const steps:RecipeStep[] = lines.map((line,i)=>({
    id:"step-"+(i+1),
    title:line.replace(/^([\d]+[.)]|[-*•])\s*/, "").slice(0,180),
    minutes:null
  }));
  return {
    id:crypto.randomUUID(), name:name.trim()||"Imported recipe", preset:"custom",
    equipment:"Kitchen", cookMinutes:0, restMinutes:0,steps
  };
}
