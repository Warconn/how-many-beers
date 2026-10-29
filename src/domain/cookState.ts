import type { Meal, PlannedTask } from "./meal";
import { buildDishTimeline } from "./schedule";
import {adjustDishSequence,servingConflict} from "./stepDependencies";

export type CookEventKind = "started" | "completed" | "reopened" | "temperature" | "equipment" | "removed";

export type CookEvent = {
  id: string;
  taskId: string;
  kind: CookEventKind;
  occurredAt: string;
  value?: number;
  unit?: "°F" | "°C";
  note?: string;
};

export type TaskOverride = {
  title?: string; instructions?: string; scheduledAt?: string | null;
  recordedPlanAt?: string | null; // Planned position at first activity, separate from actual timestamps.
  durationMinutes?: number | null; equipment?: string; targetTempF?: number | null;
};
export type StepPlanEdit = {
  timingMode: "plan" | "fixed" | "unscheduled";
  scheduledAt: string | null;
  durationMinutes: number | null;
  equipment: string;
  targetTempF: number | null;
};
export type ExtendedMeal = Meal & {
  customTasks?: PlannedTask[];
  taskOverrides?: Record<string, TaskOverride>;
  hiddenTaskIds?: string[];
  taskOrder?: string[];
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
    const sequence=buildDishTimeline(d,m.serveAt,{overrides:m.taskOverrides,recorded,hidden}).filter(t=>!hidden.has(t.id)).map(project);
    const adjusted=adjustDishSequence(sequence,recorded);warnings.push(...adjusted.warnings,...servingConflict(adjusted.tasks,m.serveAt));return adjusted.tasks;
  });
  tasks.push(...(m.customTasks??[]).filter(t=>!hidden.has(t.id)).map(t=>{
    const override=m.taskOverrides?.[t.id];
    const duration=override?.durationMinutes!==undefined?override.durationMinutes:t.durationMinutes;
    const target=Date.parse(m.serveAt);
    const derive=t.scheduledAt===null&&override?.scheduledAt===undefined&&!recorded.has(t.id)&&duration!=null&&Number.isFinite(duration)&&Number.isFinite(target);
    return project(derive?{...t,scheduledAt:new Date(target-duration*60000).toISOString()}:t);
  }));
  return {tasks,warnings};
}
export function stepTimingWarnings(meal:Meal):string[]{return derivedSchedule(meal).warnings;}
export function cookTimeline(meal: Meal): PlannedTask[] {
  const m=migrateMeal(meal),combined=derivedSchedule(m).tasks;
  if (!(m.taskOrder?.length)) {
    // First load shows the plan in scheduled order. Unscheduled steps come last.
    return combined.sort((a,b) => {
      const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
      const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
      return aTime - bTime;
    });
  }
  const positions = new Map(m.taskOrder.map((id, index) => [id,index]));
  return combined.sort((a,b) => {
    const ai = positions.get(a.id) ?? Infinity, bi = positions.get(b.id) ?? Infinity;
    if (ai !== bi) return ai-bi;
    const at = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
    const bt = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
    return at-bt;
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
    instructions: instructions.trim().slice(0, 500), scheduledAt, isCondition: false
  };
  return {
    ...m,
    customTasks: [...(m.customTasks ?? []), task],
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
    if(details.durationMinutes!==null && (!Number.isFinite(details.durationMinutes) || details.durationMinutes<0 || details.durationMinutes>43200))throw new Error("Duration must be between 0 and 43200 minutes, or blank for unknown.");
    if(details.targetTempF!==null && (!Number.isFinite(details.targetTempF) || details.targetTempF<=0 || details.targetTempF>600))throw new Error("Target food temperature must be between 1 and 600°F, or blank.");
    if(details.equipment.trim().length>80)throw new Error("Keep equipment names under 80 characters.");
    if(details.timingMode==="plan")delete override.scheduledAt;
    else override.scheduledAt=details.timingMode==="unscheduled"?null:new Date(details.scheduledAt!).toISOString();
    if(details.durationMinutes===(task.baseDurationMinutes??null))delete override.durationMinutes;
    else override.durationMinutes=details.durationMinutes;
    if(details.equipment.trim()===task.baseEquipment)delete override.equipment;
    else override.equipment=details.equipment.trim();
    if(details.targetTempF===null)delete override.targetTempF;
    else override.targetTempF=details.targetTempF;
  }
  return {...m, taskOverrides: {...m.taskOverrides, [taskId]:override}};
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

export function moveStep(meal: Meal, taskId: string, direction: "up"|"down", dishId?: string): ExtendedMeal {
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
  return {...m, taskOrder: order};
}

export function recordEvent(meal: Meal, taskId: string, kind: CookEventKind, occurredAt: string, value?: number, unit?: "°F"|"°C", note?: string): ExtendedMeal {
  const m = migrateMeal(meal);
  const planned=cookTimeline(m).find(t=>t.id===taskId);
  if (!planned) throw new Error("Task not found.");
  if (!Number.isFinite(new Date(occurredAt).getTime())) throw new Error("Invalid event timestamp.");
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
  const start = !alreadyStarted && (kind==="completed" || kind==="temperature" || kind==="equipment")
    ? [{id:crypto.randomUUID(),taskId,kind:"started" as const,occurredAt:timestamp}]
    : [];
  const event: CookEvent = {id:crypto.randomUUID(),taskId,kind,occurredAt:timestamp};
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
  if(m.mode!=="cooking" || !value.trim() || (m.notes[taskId]||"")===value) return {...m,notes};
  const taskEvents=(m.events??[]).filter(e=>e.taskId===taskId);
  const lastReopen=taskEvents.map(e=>e.kind).lastIndexOf("reopened");
  const attempt=taskEvents.slice(lastReopen+1);
  if(attempt.some(e=>e.kind==="started" || e.kind==="completed")) return {...m,notes};
  return recordEvent({...m,notes},taskId,"started",occurredAt);
}
