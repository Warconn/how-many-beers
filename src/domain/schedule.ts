import type { Dish, Meal, PlannedTask } from "./meal";
import { templateSteps } from "../data/cookTemplates";

const minute = 60_000;

function at(serveAt: string, beforeMinutes: number): string | null {
  const time = new Date(serveAt).getTime();
  return Number.isNaN(time) ? null : new Date(time - beforeMinutes * minute).toISOString();
}

function curatedTasks(d: Dish, serveAt: string): PlannedTask[] | null {
  const steps=templateSteps[d.preset];
  if(!steps)return null;
  const cook=Math.max(15,d.cookMinutes);
  const rest=Math.max(0,d.restMinutes);
  const startOffset=cook+rest;
  return steps.map(step=>{
    const before=step.anchor==="prep" || step.anchor==="preheat"
      ? startOffset+(step.beforeStartMin??0)
      : step.anchor==="start" ? startOffset
      : step.anchor==="progress" ? rest+Math.round(cook*(1-(step.progress??0.5)))
      : step.anchor==="finish" ? rest : 0;
    const temp=d.pitTempF ?? null;
    const subst=(s:string)=>s.replaceAll("{pitTempF}",temp===null?"your chosen pit temperature":String(temp));
    return {
      id:d.id+":"+step.id,
      dishId:d.id,
      dishName:d.name,
      title:subst(step.title),
      instructions:subst(step.instructions),
      scheduledAt:at(serveAt,before),
      isCondition:!!step.conditional
    };
  });
}

function builtinTasks(d: Dish, serveAt: string): PlannedTask[] {
  const curated=curatedTasks(d,serveAt);
  if(curated)return curated;
  const cook = Math.max(15, d.cookMinutes);
  const rest = Math.max(0, d.restMinutes);
  const isSlow = d.preset === "brisket" || d.preset === "ribs";
  const entries: { key: string; title: string; instructions: string; before: number; conditional?: boolean }[] = [
    { key: "prep", title: "Prepare and season", instructions: "Follow your recipe. Verify safe storage/handling.", before: cook + rest + 65 },
    { key: "preheat", title: "Preheat " + d.equipment, instructions: "Set the temperature specified in your recipe and allow equipment to stabilize.", before: cook + rest + 30 },
    { key: "start", title: "Start cooking", instructions: "Log when the food actually goes in.", before: cook + rest },
    { key: "check", title: "Check progress", instructions: isSlow ? "Measure internal temperature and check bark/texture. The expected milestone is approximate." : "Check food with an appropriate thermometer; revise timing if needed.", before: rest + Math.round(cook * 0.55), conditional: true }
  ];
  if (isSlow) {
    entries.push({ key: "wrap", title: "Review wrapping decision", instructions: "Wrap only if your recipe and bark/temperature call for it. The stall has no guaranteed end.", before: rest + Math.round(cook * 0.35), conditional: true });
  }
  entries.push(
    { key: "finish", title: "Verify doneness", instructions: "Use safe internal temperature and/or appropriate tenderness criteria. Time alone is not proof of doneness.", before: rest, conditional: true },
    { key: "rest", title: rest ? "Begin monitored rest/hold" : "Prepare to plate", instructions: rest ? "Follow food-safe resting/holding guidance and monitor food temperature." : "Confirm doneness before serving.", before: rest, conditional: true },
    { key: "serve", title: "Serve", instructions: "Plate and enjoy.", before: 0 }
  );
  return entries.map(e=>({ id: d.id + ":" + e.key, dishId:d.id, dishName:d.name, title:e.title, instructions:e.instructions, scheduledAt:at(serveAt,e.before), isCondition:!!e.conditional }));
}

function importedTasks(d: Dish, serveAt: string): PlannedTask[] {
  let offset = 0;
  const arr = (d.steps ?? []).map((step) => ({
    id: d.id + ":" + step.id, dishId:d.id, dishName:d.name, title:step.title,
    instructions: step.minutes === null ? "Timing needed: edit the recipe before relying on this timeline." : "Imported recipe step. Confirm instructions and timing.",
    scheduledAt:null as string|null, isCondition:step.minutes === null
  }));
  for(let i=arr.length-1; i>=0; i--){
    const value=d.steps?.[i]?.minutes;
    if(value !== null && value !== undefined && value > 0){
      offset += value;
      arr[i].scheduledAt=at(serveAt,offset);
    }
  }
  arr.push({id:d.id+":serve",dishId:d.id,dishName:d.name,title:"Serve",instructions:"Confirm safe doneness and plate.",scheduledAt:at(serveAt,0),isCondition:false});
  return arr;
}

export function buildTimeline(meal:Meal): PlannedTask[]{
  return meal.dishes.flatMap(d => d.preset === "custom" ? importedTasks(d,meal.serveAt) : builtinTasks(d,meal.serveAt))
    .sort((a,b)=> (a.scheduledAt === null ? Infinity : new Date(a.scheduledAt).getTime())-
                  (b.scheduledAt === null ? Infinity : new Date(b.scheduledAt).getTime()));
}

export function equipmentWarnings(meal:Meal): string[] {
  const byEquipment=new Map<string,string[]>();
  for(const dish of meal.dishes){
    const key=dish.equipment.trim().toLowerCase();
    if(!key)continue;
    byEquipment.set(key,[...(byEquipment.get(key)||[]),dish.name]);
  }
  return [...byEquipment].filter(([,d])=>d.length>1).map(([eq,d])=>`Shared equipment (${eq}): ${d.join(", ")}. Check capacity and temperature conflicts manually.`);
}
