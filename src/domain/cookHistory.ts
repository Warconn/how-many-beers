import {cookTimeline, migrateMeal} from "./cookState";
import type {ExtendedMeal} from "./cookState";
import {newMeal} from "./meal";
import type {Meal, PlannedTask} from "./meal";

export const HISTORY_KEY = "how-many-beers:history:v1";
export const ACTIVE_KEY = "how-many-beers:meal:v1";
export const BACKUP_FORMAT = "how-many-beers-backup";

export type ArchivedCook = {
  id: string;
  archivedAt: string;
  meal: ExtendedMeal;
  plannedTimeline: PlannedTask[];
  feedback: string;
};

export type HistoryLibrary = {version:1; cooks:ArchivedCook[]};
export type CookBackup = {
  format: typeof BACKUP_FORMAT;
  version:1;
  exportedAt:string;
  active:ExtendedMeal;
  history:HistoryLibrary;
};

export const emptyHistory = ():HistoryLibrary=>({version:1,cooks:[]});

export function isMeal(value:unknown): value is Meal {
  if(!value || typeof value!=="object")return false;
  const o=value as Partial<Meal>;
  return o.version===1 && typeof o.id==="string" && !!o.id && typeof o.serveAt==="string"
    && Array.isArray(o.dishes) && o.dishes.every(d=>d && typeof d.id==="string" && typeof d.name==="string" && typeof d.preset==="string")
    && !!o.notes && typeof o.notes==="object" && !Array.isArray(o.notes)
    && !!o.completed && typeof o.completed==="object" && !Array.isArray(o.completed);
}

export function readHistory(value:unknown):HistoryLibrary {
  if(!value || typeof value!=="object")throw new Error("Invalid cook archive.");
  const v=value as Partial<HistoryLibrary>;
  if(v.version!==1 || !Array.isArray(v.cooks))throw new Error("Unsupported cook history format.");
  if(!v.cooks.every(c=>c && typeof c.id==="string" && typeof c.archivedAt==="string" &&
    isMeal(c.meal) && Array.isArray(c.plannedTimeline) && typeof c.feedback==="string")) {
    throw new Error("Cook history contains an incomplete entry.");
  }
  return v as HistoryLibrary;
}

export function archiveCook(meal: Meal, history:HistoryLibrary, feedback:string, archivedAt:string):HistoryLibrary {
  if(!isMeal(meal))throw new Error("No valid cook to save.");
  if(meal.dishes.length===0 && cookTimeline(meal).length===0)throw new Error("Add a dish or task before saving.");
  if(!Number.isFinite(new Date(archivedAt).getTime()))throw new Error("Invalid finish time.");
  // The snapshot includes the exact displayed timeline, since future template updates
  // must not silently rewrite the plan that the cook originally followed.
  const snapshot=JSON.parse(JSON.stringify(migrateMeal(meal))) as ExtendedMeal;
  const entry:ArchivedCook={
    id:meal.id,archivedAt,meal:snapshot,
    plannedTimeline:JSON.parse(JSON.stringify(cookTimeline(meal))) as PlannedTask[],
    feedback:feedback.trim().slice(0,2000)
  };
  return {version:1,cooks:[entry,...history.cooks.filter(c=>c.id!==entry.id)]};
}

export type StorageWriter = Pick<Storage, "setItem">;

/** Archive before rotating the active cook. A failure writing the next active
 * meal leaves the original active key untouched and the archive available.
 * Retrying is idempotent because archive IDs are the original meal IDs. */
export function commitCompletedCook(
  active:Meal,history:HistoryLibrary,feedback:string,at:string,storage:StorageWriter
):{history:HistoryLibrary;next:ExtendedMeal}{
  const saved=archiveCook(active,history,feedback,at);
  const next=migrateMeal(newMeal());
  storage.setItem(HISTORY_KEY,JSON.stringify(saved));
  storage.setItem(ACTIVE_KEY,JSON.stringify(next));
  return {history:saved,next};
}

export function removeArchivedCook(history:HistoryLibrary,id:string):HistoryLibrary {
  return {version:1,cooks:history.cooks.filter(c=>c.id!==id)};
}

export function repeatArchivedCook(entry:ArchivedCook): ExtendedMeal {
  const previous=migrateMeal(entry.meal);
  const dishIds=new Map(previous.dishes.map(d=>[d.id,crypto.randomUUID()]));
  const customTaskIds=new Map((previous.customTasks??[]).map(t=>[t.id,crypto.randomUUID()]));
  const translate=(old:string)=>{
    if(customTaskIds.has(old))return customTaskIds.get(old)!;
    for(const [dishId,nextId] of dishIds)if(old.startsWith(dishId+":"))return nextId+old.slice(dishId.length);
    return old;
  };
  const base=newMeal();
  const delta=Date.parse(base.serveAt)-Date.parse(previous.serveAt);
  const shiftTime=(value:string|null|undefined)=>value && Number.isFinite(Date.parse(value)) && Number.isFinite(delta)
    ? new Date(Date.parse(value)+delta).toISOString() : value;
  const oldOverrides=previous.taskOverrides??{};
  const overrides=Object.fromEntries(Object.entries(oldOverrides).map(([id,value])=>{
    const settings={...value};delete settings.recordedPlanAt;
    return [translate(id),{...settings,...(value.scheduledAt?{scheduledAt:shiftTime(value.scheduledAt)}:{})}];
  }));
  return {
    ...base,
    name:entry.meal.name,
    dishes:previous.dishes.map(d=>({...d,id:dishIds.get(d.id)!})),
    customTasks:(previous.customTasks??[]).map(t=>({...t,scheduledAt:shiftTime(t.scheduledAt)??null,id:translate(t.id),dishId:dishIds.get(t.dishId)??t.dishId})),
    taskOverrides:overrides,
    hiddenTaskIds:(previous.hiddenTaskIds??[]).map(translate),
    taskOrder:(previous.taskOrder??[]).map(translate),
    events:[],completed:{},notes:{},
    startedAt:undefined,mode:"planning"
  };
}

export function exportBackup(active:Meal,history:HistoryLibrary,exportedAt:string):string {
  const result:CookBackup={format:BACKUP_FORMAT,version:1,exportedAt,active:migrateMeal(active),history};
  return JSON.stringify(result,null,2);
}

export function validateBackup(text:string):{active:ExtendedMeal;history:HistoryLibrary} {
  if(text.length>4_000_000)throw new Error("Backup file is too large.");
  const parsed:unknown=JSON.parse(text);
  if(!parsed || typeof parsed!=="object")throw new Error("Invalid backup.");
  const b=parsed as Partial<CookBackup>;
  if(b.format!==BACKUP_FORMAT || b.version!==1 || !isMeal(b.active)){
    throw new Error("This is not a supported How Many Beers backup.");
  }
  return {active:migrateMeal(b.active),history:readHistory(b.history)};
}
