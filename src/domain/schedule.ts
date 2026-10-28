import type { Dish, Meal, PlannedTask } from "./meal";
import {turkeyPreparation} from "./turkeyPrep";
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
  const brisket=d.preset==="brisket" ? d.brisketPlan?.applied : undefined;
  const buffer=brisket?.inputs.holdBufferMinutes ?? 0;
  const startOffset=cook+rest+buffer;
  const turkey=d.preset==="turkey"?turkeyPreparation(d):undefined;
  return steps.map(step=>{
    let before=step.anchor==="prep" || step.anchor==="preheat"
      ? startOffset+(brisket && (step.id==="prep"||step.id==="preheat") ? step.anchor==="prep" ? brisket.inputs.prepMinutes : brisket.inputs.preheatMinutes : step.beforeStartMin??0)
      : step.anchor==="start" ? startOffset
      : step.anchor==="progress" ? rest+buffer+Math.round(cook*(1-(step.progress??0.5)))
      : step.anchor==="finish" ? rest+buffer : 0;
    const temp=d.pitTempF ?? null;
    let title=step.title, instructions=step.instructions;
    if(turkey){
      if(step.id==='thaw'){
        before=startOffset+(turkey.brineHours+turkey.dryHours)*60+(turkey.state==='thawed'?0:turkey.thawDays*1440);
        if(turkey.state==='thawed')title='Confirm turkey is fully thawed';
        else if(turkey.state==='thawing')title='Continue refrigerator thawing';
      }
      if(step.id==='brine'){before=startOffset+(turkey.brineHours+turkey.dryHours)*60;if(turkey.brineHours===0){title='Brining skipped';instructions='No brining time reserved. Keep the thawed turkey refrigerated before preparation.';}}
      if(step.id==='dry')before=startOffset+turkey.dryHours*60;
    }
    if(brisket){
      const i=brisket.inputs;
      // An explicitly applied researched estimate uses that source's profile,
      // independently of the personal manual template.
      if(step.id==='prep')instructions='Trim and season; keep refrigerated. Use the measured trimmed weight for the researched comparison.';
      if(step.id==='season'){before=startOffset+i.prepMinutes;instructions='Season for your chosen method and keep refrigerated. Adjust preparation times as needed.';}
      if(step.id==='preheat')instructions='Stabilize the smoker at '+i.pitTempF+'°F for the selected researched profile.';
      if(step.id==='raise225'&&i.method==='traeger-225-v1')title='Maintain smoker at 225°F';
      if(step.id==='start')instructions='Load the brisket and record the actual start and initial pit temperature for the selected profile.';
      if(step.id==='finish')instructions='Verify food safety and probe the flat for tenderness. The selected profile is a planning comparison, not proof of doneness.';
      if(step.id==='raise225')instructions=i.method==='traeger-225-v1'?'Maintain the selected 225°F profile; check progress.':'Review raising to 225°F near 165°F internal according to the selected Meat Church method, not elapsed time.';
      if(step.id==='raise250')instructions=i.method==='traeger-225-v1'?'Review heat according to your chosen recipe; the comparison assumes 225°F.':'After wrapping when bark is ready, review raising the pit to 250–275°F for the selected Meat Church profile.';
      if(step.id==='wrap')instructions='Review wrapping when bark is ready according to the selected recipe; no exact time is guaranteed.';
      if(step.id==='check')instructions='Check bark, internal temperature and the stall. The researched profile is a planning comparison, not a fit to the personal cook logs.';
      if(i.cut==='flat' && step.id==='prep')instructions='Trim and season the flat. Keep refrigerated until ready to cook.';
      if(i.method==='traeger-225-v1'){
        if(step.id==='preheat')instructions='Stabilize the smoker at 225°F. This profile uses the Traeger broad planning guide; verify your own recipe and equipment.';
        if(step.id==='check')instructions='Check bark, internal temperature and the stall. Follow your recipe; elapsed time alone does not establish readiness.';
        if(step.id==='wrap')instructions='When bark is set, review wrapping according to your recipe. Record the actual reading and decision; no exact wrap time is guaranteed.';
        if(step.id==='finish')instructions='Verify food safety and probe the flat for tenderness. Timing is only an estimate, not proof of doneness.';
      }
      if(step.id==='wrap')instructions=i.wrap==='none'?'No-wrap plan: monitor bark, moisture and stall. Keep cooking until safe and tender; log any change of strategy.':instructions+' Selected wrap: '+(i.wrap==='foil'?'foil':'butcher paper')+'.';
      if(step.id==='rest')instructions='Rest and, if needed, use the separate hot-hold buffer. Monitor food temperature at 140°F or above during hot holding; do not assume an insulated cooler holds safely.';
    }
    const subst=(s:string)=>s.replaceAll("{pitTempF}",temp===null?"your chosen pit temperature":String(temp));
    return {
      id:d.id+":"+step.id,
      dishId:d.id,
      dishName:d.name,
      title:subst(title),
      instructions:subst(instructions),
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
    durationMinutes: step.minutes,
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
  arr.push({id:d.id+":serve",dishId:d.id,dishName:d.name,title:"Serve",durationMinutes:null,instructions:"Confirm safe doneness and plate.",scheduledAt:at(serveAt,0),isCondition:false});
  return arr;
}

export function buildDishTimeline(d:Dish,serveAt:string):PlannedTask[]{
  if(d.preset==='custom')return importedTasks(d,serveAt);
  return builtinTasks(d,serveAt).sort((a,b)=>Date.parse(a.scheduledAt??'')-Date.parse(b.scheduledAt??''));
}
export function buildTimeline(meal:Meal): PlannedTask[]{
  return meal.dishes.flatMap(d => buildDishTimeline(d,meal.serveAt))
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
