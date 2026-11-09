import {planStepSequence,localStepKey} from "./stepSequence";
import type { Meal, PlannedTask,Dish } from "./meal";
import { buildDishTimeline } from "./schedule";
import {adjustDishSequence,servingConflict} from "./stepDependencies";
import {turkeyPreparation} from "./turkeyPrep";
import {physicalPhase} from "./physicalPhase";
import {chronologicalTasks} from "./stepTiming";
import {buildPhasePlan,type PhaseObservation} from './cookingPhases';

export type CookEventKind = "started" | "completed" | "reopened" | "temperature" | "equipment" | "removed";

export type CookEvent = {
  phaseObservations?: PhaseObservation[];
  phaseEstimate?: {phaseId:string;minutes:number};
  id: string;
  taskId: string;
  kind: CookEventKind;
  startSource?: "activity" | "physical";
  occurredAt: string;
  value?: number;
  unit?: "°F" | "°C";
  note?: string;
};

/** Starting/resuming is explicit and backwards compatible. Old sessions never
 * acquire physical events merely because this version opened them. */
export function startCookSession(meal:Meal,occurredAt:string):ExtendedMeal{
 if(meal.startedAt||meal.mode==='cooking'||Object.keys(meal.completed).length||((meal as ExtendedMeal).events??[]).some(e=>e.kind!=='removed'))return {...migrateMeal(meal),mode:'cooking',startedAt:meal.startedAt??occurredAt};
 if(!Number.isFinite(Date.parse(occurredAt)))throw Error('Choose a valid cook start.');
 return {...migrateMeal(meal),mode:'cooking',startedAt:occurredAt,phasePlan:buildPhasePlan(meal,cookTimeline(meal))};
}

/** Adding a dish during execution never starts it and never recompiles existing
 * physical relationships or recorded actuals. */
export function addDishToMeal(meal:Meal,dish:Dish,occurredAt:string):ExtendedMeal{
 const next:ExtendedMeal={...meal,dishes:[...meal.dishes,meal.mode==='cooking'?{...dish,executionAddedAt:occurredAt}:dish]};
 if(meal.phasePlan){
  const added=buildPhasePlan({...next,dishes:next.dishes.filter(d=>d.id===dish.id)},cookTimeline(next));
  next.phasePlan={...meal.phasePlan,phases:[...meal.phasePlan.phases,...added.phases],actions:{...meal.phasePlan.actions,...added.actions},order:{...meal.phasePlan.order,...added.order},suppressed:[...meal.phasePlan.suppressed,...added.suppressed]};
 }
 return next;
}

export type TaskOverride = {
  title?: string; instructions?: string; scheduledAt?: string | null;
  recordedPlanAt?: string | null; // Planned position at first activity, separate from actual timestamps.
  durationMinutes?: number | null; equipment?: string; targetTempF?: number | null;
};
export type StepPlanEdit = {
  plannedTimeOnly?: boolean;
  timingMode: "plan" | "fixed" | "unscheduled";
  scheduledAt: string | null;
  durationMinutes?: number | null; // Omitted for a planned-time-only edit.
  equipment: string;
  targetTempF: number | null;
};
export type ExtendedMeal = Meal & {
  customTasks?: PlannedTask[];
  taskOverrides?: Record<string, TaskOverride>;
  hiddenTaskIds?: string[];
  taskOrder?: string[];
  planningGeneralSequence?: string[];
  events?: CookEvent[];
};

export function migrateMeal(meal: Meal): ExtendedMeal {
  const prev = meal as ExtendedMeal;
  const events: CookEvent[] = Array.isArray(prev.events) ? [...prev.events] : [];
  for (const [taskId, occurredAt] of Object.entries(meal.completed ?? {})) {
    if (!events.some(e => e.taskId === taskId && e.kind === "completed")) {
      // Existing checklist completion times survive migration.
      events.push({ id: "legacy:" + taskId, taskId, kind: "completed", occurredAt });
    }
  }
  return {
    ...meal,
    customTasks: Array.isArray(prev.customTasks) ? prev.customTasks : [],
    taskOverrides: prev.taskOverrides ?? {},
    hiddenTaskIds: Array.isArray(prev.hiddenTaskIds) ? prev.hiddenTaskIds : [],
    taskOrder: Array.isArray(prev.taskOrder) ? prev.taskOrder : [],
    events
  };
}

function derivedSchedule(meal:Meal):{tasks:PlannedTask[];warnings:string[]}{
  const m=migrateMeal(meal),hidden=new Set(m.hiddenTaskIds),warnings:string[]=[];
  const recorded=new Set((m.events??[]).filter(e=>e.kind!=='removed').map(e=>e.taskId));
  const project=(t:PlannedTask):PlannedTask=>{
    const base={...t,durationMinutes:t.durationMinutes??null,equipment:t.equipment??m.dishes.find(d=>d.id===t.dishId)?.equipment??'',targetTempF:t.targetTempF??null};
    const override={...m.taskOverrides?.[t.id]};
    // Old editors copied the importer placeholder into an override even when the
    // user only edited duration. Replace that exact generated sentence, not
    // authored instructions or safety notes.
    if(m.dishes.some(d=>d.id===t.dishId&&d.preset==='custom')&&override.instructions==='Timing needed: edit the recipe before relying on this timeline.')override.instructions=t.instructions;
    const timingMode=override.scheduledAt===undefined?'plan':override.scheduledAt===null?'unscheduled':'fixed';
    return {...base,...override,...(recorded.has(t.id) && override.scheduledAt===undefined && override.recordedPlanAt!==undefined?{scheduledAt:override.recordedPlanAt}:{}),baseScheduledAt:t.baseScheduledAt===undefined?base.scheduledAt:t.baseScheduledAt,baseDurationMinutes:t.baseDurationMinutes===undefined?base.durationMinutes:t.baseDurationMinutes,baseEquipment:base.equipment,timingMode};
  };
  const tasks=m.dishes.flatMap(d=>{
    const sequence=buildDishTimeline(d.planningSequence?{...d,planningStepOrder:undefined}:d,m.serveAt,{overrides:m.taskOverrides,recorded,hidden}).filter(t=>!hidden.has(t.id)).map(project);
    if(d.planningSequence){
      let source=sequence;
      let keys=d.planningSequence;
      if(d.preset==='turkey'){
        const prep=turkeyPreparation(d);
        source=source.map(t=>t.id===d.id+':thaw'?{...t,templateStage:{kind:'preparation' as const,minutes:prep.state==='thawed'?0:prep.thawDays*1440}}:t.id===d.id+':brine'&&!t.templateStage?{...t,templateStage:{kind:'preparation' as const,minutes:prep.brineHours*60}}:t.id===d.id+':dry'&&!t.templateStage?{...t,templateStage:{kind:'preparation' as const,minutes:prep.dryHours*60}}:t);
      }
      if(d.preset==='wings'&&d.restMinutes>0&&!hidden.has(d.id+':rest')){
        source=[...source,project({id:d.id+':rest',dishId:d.id,dishName:d.name,title:'Rest before serving',instructions:'Use the planned rest allowance and verify doneness before serving.',scheduledAt:null,isCondition:true,templateStage:{kind:'rest',minutes:d.restMinutes,startLabel:'Begin rest now'}})];
        if(!keys.includes('rest')){const at=keys.indexOf('serve');keys=[...keys.slice(0,at<0?keys.length:at),'rest',...keys.slice(at<0?keys.length:at)];}
      }
      const added=(m.customTasks??[]).filter(t=>t.dishId===d.id&&!hidden.has(t.id)).map(project);
      const planned=planStepSequence([...source,...added],keys,m.serveAt,recorded,m.taskOverrides);warnings.push(...planned.warnings,...servingConflict(planned.tasks,m.serveAt));return planned.tasks;
    }
    const adjusted=adjustDishSequence(sequence,recorded,m.mode!=="cooking");warnings.push(...adjusted.warnings,...servingConflict(adjusted.tasks,m.serveAt));return adjusted.tasks;
  });
  const general=(m.customTasks??[]).filter(t=>!hidden.has(t.id)&&!m.dishes.some(d=>d.id===t.dishId&&d.planningSequence));
  const independent=general.filter(t=>!m.planningGeneralSequence||t.dishId!=='custom');
  tasks.push(...independent.map(t=>{
    const override=m.taskOverrides?.[t.id];
    const duration=override?.durationMinutes!==undefined?override.durationMinutes:t.durationMinutes;
    const target=Date.parse(m.serveAt);
    const derive=t.scheduledAt===null&&override?.scheduledAt===undefined&&!recorded.has(t.id)&&duration!=null&&Number.isFinite(duration)&&Number.isFinite(target);
    return project(derive?{...t,scheduledAt:new Date(target-duration*60000).toISOString()}:t);
  }));
  if(m.planningGeneralSequence){const planned=planStepSequence(general.filter(t=>t.dishId==='custom').map(project),m.planningGeneralSequence,m.serveAt,recorded,m.taskOverrides);tasks.push(...planned.tasks);warnings.push(...planned.warnings);}
  return {tasks,warnings};
}
export function stepTimingWarnings(meal:Meal):string[]{return derivedSchedule(meal).warnings;}
export function cookTimeline(meal: Meal): PlannedTask[] {
  const m=migrateMeal(meal),combined=chronologicalTasks(derivedSchedule(m).tasks);
  if (!(m.taskOrder?.length)) {
    return combined;
  }
  const positions = new Map(m.taskOrder.map((id, index) => [id,index]));
  const defaults = new Map(combined.map((task,index)=>[task.id,index]));
  return combined.sort((a,b) => {
    const ai = positions.get(a.id) ?? Infinity, bi = positions.get(b.id) ?? Infinity;
    if (ai !== bi) return ai-bi;
    return defaults.get(a.id)!-defaults.get(b.id)!;
  });
}

export function addStep(meal: Meal, title: string, instructions = "", scheduledAt: string | null = null): ExtendedMeal {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 160) throw new Error("Give the task a title (up to 160 characters).");
  if (scheduledAt && Number.isNaN(new Date(scheduledAt).getTime())) throw new Error("Invalid scheduled time.");
  const existing = cookTimeline(meal);
  const m = migrateMeal(meal);
  const id = crypto.randomUUID();
  const task: PlannedTask = {
    id, dishId: "custom", dishName: "General prep", title: trimmed,
    ...(meal.mode==="cooking"?{executionAddedAt:new Date().toISOString()}:{}),
    instructions: instructions.trim().slice(0, 500), scheduledAt, isCondition: false
  };
  return {
    ...m,
    customTasks: [...(m.customTasks ?? []), task],
    ...(meal.mode==='cooking'&&scheduledAt?{taskOverrides:{...m.taskOverrides,[id]:{scheduledAt}}}:{}),
    taskOrder: [...existing.map(t=>t.id), id]
  };
}

export function editStep(meal: Meal, taskId: string, title: string, instructions: string, details?: StepPlanEdit): ExtendedMeal {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 160) throw new Error("Give the task a title (up to 160 characters).");
  const task=cookTimeline(meal).find(t=>t.id===taskId);
  if (!task) throw new Error("Task not found.");
  const m = migrateMeal(meal);
  const override:TaskOverride={...m.taskOverrides?.[taskId], title:trimmed,instructions:instructions.trim().slice(0,500)};
  if(details){
    if(!["plan","fixed","unscheduled"].includes(details.timingMode))throw new Error("Choose a valid timing mode.");
    if(details.timingMode==="fixed" && (!details.scheduledAt || !Number.isFinite(Date.parse(details.scheduledAt))))throw new Error("Choose a valid planned date and time.");
    if(details.durationMinutes!==undefined && details.durationMinutes!==null && (!Number.isFinite(details.durationMinutes) || details.durationMinutes<0 || details.durationMinutes>43200))throw new Error("Duration must be between 0 and 43200 minutes, or blank for unknown.");
    if(details.targetTempF!==null && (!Number.isFinite(details.targetTempF) || details.targetTempF<=0 || details.targetTempF>600))throw new Error("Target food temperature must be between 1 and 600°F, or blank.");
    if(details.equipment.trim().length>80)throw new Error("Keep equipment names under 80 characters.");
    if(details.timingMode==="plan")delete override.scheduledAt;
    else override.scheduledAt=details.timingMode==="unscheduled"?null:new Date(details.scheduledAt!).toISOString();
    if(details.durationMinutes!==undefined){
      if(details.durationMinutes===(task.baseDurationMinutes??null))delete override.durationMinutes;
      else override.durationMinutes=details.durationMinutes;
    }
    if(details.equipment.trim()===task.baseEquipment)delete override.equipment;
    else override.equipment=details.equipment.trim();
    if(details.targetTempF===null)delete override.targetTempF;
    else override.targetTempF=details.targetTempF;
  }
  if(details?.plannedTimeOnly){
    const timeOverride={...m.taskOverrides?.[taskId]};
    if(details.timingMode==='plan')delete timeOverride.scheduledAt;
    else timeOverride.scheduledAt=details.timingMode==='unscheduled'?null:new Date(details.scheduledAt!).toISOString();
    return {...m,taskOverrides:{...m.taskOverrides,[taskId]:timeOverride}};
  }
  return {...m, taskOverrides: {...m.taskOverrides, [taskId]:override}};
}

/** Inline duration edits change only duration, retaining all other overrides. */
export function setStepDuration(meal:Meal,taskId:string,durationMinutes:number|null):ExtendedMeal{
  if(durationMinutes!==null&&(!Number.isFinite(durationMinutes)||durationMinutes<0||durationMinutes>43200))throw new Error("Duration must be between 0 and 43200 minutes, or blank for unknown.");
  const task=cookTimeline(meal).find(t=>t.id===taskId);
  if(!task)throw new Error("Task not found.");
  const m=migrateMeal(meal),override={...m.taskOverrides?.[taskId]};
  if(durationMinutes===(task.baseDurationMinutes??null))delete override.durationMinutes;
  else override.durationMinutes=durationMinutes;
  return {...m,taskOverrides:{...m.taskOverrides,[taskId]:override}};
}

export function removeStep(meal: Meal, taskId: string, occurredAt: string): ExtendedMeal {
  if (!cookTimeline(meal).some(t=>t.id===taskId)) throw new Error("Task not found.");
  const m = migrateMeal(meal);
  return {
    ...m,
    hiddenTaskIds: [...(m.hiddenTaskIds ?? []), taskId],
    events: [...(m.events ?? []), {id: crypto.randomUUID(), taskId, kind:"removed", occurredAt}]
  };
}

export function moveStep(meal: Meal, taskId: string, direction: "up"|"down", dishId?: string, planning?:boolean): ExtendedMeal {
  const m = migrateMeal(meal);
  const timeline = cookTimeline(m);
  const order = timeline.map(t=>t.id);
  const scoped = dishId ? timeline.filter(t=>t.dishId===dishId).map(t=>t.id) : order;
  const i = scoped.indexOf(taskId);
  if (i<0) throw new Error("Task not found.");
  const j = i + (direction==="up" ? -1 : 1);
  if (j<0 || j>=scoped.length) return m;
  // Swap only these slots so other dishes retain their positions and relative order.
  const from=order.indexOf(scoped[i]), to=order.indexOf(scoped[j]);
  [order[from],order[to]]=[order[to],order[from]];
  if(planning??(m.mode!=="cooking"&&!m.startedAt)){
    const a=timeline.find(t=>t.id===scoped[i])!,b=timeline.find(t=>t.id===scoped[j])!;
    if(a.dishId===b.dishId){
      const keys=order.map(id=>timeline.find(t=>t.id===id)!).filter(t=>t.dishId===a.dishId).map(localStepKey);
      const dish=m.dishes.find(d=>d.id===a.dishId);
      if(dish){
        const changed={...m,dishes:m.dishes.map(d=>d.id===dish.id?{...d,planningSequence:keys}:d),taskOrder:order};
        // A chosen sequence can expose an existing implicit allowance (wings
        // rest). Insert its new row in the same place as its planned window.
        const own=derivedSchedule(changed).tasks.filter(t=>t.dishId===dish.id).sort((a,b)=>a.recipeOrder!-b.recipeOrder!);
        for(let k=0;k<own.length;k++)if(!order.includes(own[k].id)){
          const next=own.slice(k+1).find(t=>order.includes(t.id));
          order.splice(next?order.indexOf(next.id):order.length,0,own[k].id);
        }
        return changed;
      }
      if(a.dishId==='custom')return {...m,planningGeneralSequence:keys,taskOrder:order};
    }
  }
  return {...m,taskOrder:order};
}

export function recordEvent(meal: Meal, taskId: string, kind: CookEventKind, occurredAt: string, value?: number, unit?: "°F"|"°C", note?: string): ExtendedMeal {
  const m = migrateMeal(meal);
  const planned=cookTimeline(m).find(t=>t.id===taskId);
  if (!planned) throw new Error("Task not found.");
  if (!Number.isFinite(new Date(occurredAt).getTime())) throw new Error("Invalid event timestamp.");
  if(meal.phasePlan&&kind==='completed'&&meal.completed[taskId])return m;
  if (kind==="temperature" && (!Number.isFinite(value) || value === undefined || value <= 0 || value > (unit==="°C" ? 300 : 600))) {
    throw new Error("Enter a valid food temperature.");
  }
  if (kind==="equipment" && value !== undefined && (!Number.isFinite(value) || value <= 0 || value > (unit==="°C" ? 300 : 600))) {
    throw new Error("Enter a valid equipment temperature.");
  }
  if (kind==="equipment" && value === undefined && !note?.trim()) {
    throw new Error("Describe the equipment setting change.");
  }
  const timestamp=occurredAt;
  const completed = {...m.completed};
  if (kind==="completed") completed[taskId]=timestamp;
  if (kind==="reopened") delete completed[taskId];
  const priorEvents = m.events ?? [];
  // First meaningful action starts the step. Do not create duplicate starts
  // for repeated readings, completion, or reopened attempts.
  const afterReopen = priorEvents.filter(e => e.taskId===taskId);
  const reopenIndex = afterReopen.map(e=>e.kind).lastIndexOf("reopened");
  const attemptEvents = afterReopen.slice(reopenIndex+1);
  const alreadyStarted = attemptEvents.some(e=>e.kind==="started" || e.kind==="completed");
  const start = !meal.phasePlan && !physicalPhase(planned) && !alreadyStarted && (kind==="completed" || kind==="temperature" || kind==="equipment")
    ? [{id:crypto.randomUUID(),taskId,kind:"started" as const,startSource:"activity" as const,occurredAt:timestamp}]
    : [];
  const event: CookEvent = {id:crypto.randomUUID(),taskId,kind,occurredAt:timestamp,...(kind==="started"&&physicalPhase(planned)?{startSource:"physical" as const}:{})};
  const action=meal.phasePlan?.actions[taskId];
  if(action&&(kind==='completed'||kind==='started')){
    const seen=(id:string,boundary:'start'|'end')=>priorEvents.some(e=>e.phaseObservations?.some(o=>o.phaseId===id&&o.boundary===boundary));
    const observations:PhaseObservation[]=[
      ...(action.ends??[]).filter(id=>(kind==='completed'||!(action.starts??[]).some(start=>seen(start,'start')))&&!seen(id,'end')).map(phaseId=>({phaseId,boundary:'end' as const})),
      ...(action.starts??[]).filter(id=>kind==='started'||!seen(id,'start')).map(phaseId=>({phaseId,boundary:'start' as const}))
    ];
    if(observations.length)event.phaseObservations=observations;
    for(const o of observations){
      const opposite=priorEvents.filter(e=>e.phaseObservations?.some(p=>p.phaseId===o.phaseId&&p.boundary===(o.boundary==='start'?'end':'start'))).at(-1);
      if(opposite&&(o.boundary==='start'?Date.parse(timestamp)>Date.parse(opposite.occurredAt):Date.parse(timestamp)<Date.parse(opposite.occurredAt)))throw Error('The actual start must be before the recorded end. Correct the related actual time first.');
    }
  }
  if (value !== undefined) event.value=value;
  if (unit) event.unit=unit;
  if (note?.trim()) event.note=note.trim().slice(0,500);
  const taskOverrides={...m.taskOverrides};
  if(kind!=="removed" && taskOverrides[taskId]?.recordedPlanAt===undefined)taskOverrides[taskId]={...taskOverrides[taskId],recordedPlanAt:planned.scheduledAt};
  return {...m,taskOverrides, completed, events: [...priorEvents,...start,event]};
}

export function latestStartedEvent(events: CookEvent[], taskId: string): CookEvent | undefined {
  const relevant = events.filter(e=>e.taskId===taskId && (e.kind==="started" || e.kind==="completed" || e.kind==="reopened"));
  // If a task was reopened, allow starting the new attempt.
  const lastRestartIndex = relevant.map(e=>e.kind).lastIndexOf("reopened");
  return relevant.slice(lastRestartIndex+1).find(e=>e.kind==="started");
}

/** A text update counts as work begun only while actively cooking.
 * Planning edits never start anything. Empty keystrokes do not start a task. */
export function updateTaskNote(meal: Meal, taskId:string, value:string, occurredAt:string):ExtendedMeal {
  const m=migrateMeal(meal);
  if(!cookTimeline(m).some(t=>t.id===taskId)) throw Error("Task not found.");
  const notes={...m.notes,[taskId]:value.slice(0,500)};
  if(m.phasePlan?.actions[taskId]?.starts?.length || physicalPhase(cookTimeline(m).find(t=>t.id===taskId)!) || m.mode!=="cooking" || !value.trim() || (m.notes[taskId]||"")===value) return {...m,notes};
  const taskEvents=(m.events??[]).filter(e=>e.taskId===taskId);
  const lastReopen=taskEvents.map(e=>e.kind).lastIndexOf("reopened");
  const attempt=taskEvents.slice(lastReopen+1);
  if(attempt.some(e=>e.kind==="started" || e.kind==="completed")) return {...m,notes};
  return recordEvent({...m,notes},taskId,"started",occurredAt);
}
