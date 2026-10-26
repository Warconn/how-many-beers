import type { Meal, PlannedTask } from "./meal";
import { buildTimeline } from "./schedule";

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

export type TaskOverride = { title?: string; instructions?: string };
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

export function cookTimeline(meal: Meal): PlannedTask[] {
  const m = migrateMeal(meal);
  const hidden = new Set(m.hiddenTaskIds);
  const combined = [...buildTimeline(m), ...(m.customTasks ?? [])]
    .filter(t => !hidden.has(t.id))
    .map(t => ({ ...t, ...m.taskOverrides?.[t.id] }));
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

export function editStep(meal: Meal, taskId: string, title: string, instructions: string): ExtendedMeal {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 160) throw new Error("Give the task a title (up to 160 characters).");
  if (!cookTimeline(meal).some(t=>t.id===taskId)) throw new Error("Task not found.");
  const m = migrateMeal(meal);
  return {...m, taskOverrides: {...m.taskOverrides, [taskId]: {title: trimmed, instructions: instructions.trim().slice(0,500)}}};
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
  if (!cookTimeline(m).some(t=>t.id===taskId)) throw new Error("Task not found.");
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
  return {...m, completed, events: [...priorEvents,...start,event]};
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
