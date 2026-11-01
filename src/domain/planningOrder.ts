import type {Dish,PlannedTask} from './meal';
import type {ImportedTimingContext} from './schedule';
const stamp=(value:string|null|undefined)=>value&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
const iso=(value:number|null)=>value!==null&&Number.isFinite(value)&&Math.abs(value)<=8640000000000000?new Date(value).toISOString():null;
export const stepKey=(dish:Dish,id:string)=>id.startsWith(dish.id+':')?id.slice(dish.id.length+1):id;
/** Optional recipe-local keys opt new planning moves into scheduling. Old
 * taskOrder remains presentation-only and is never interpreted as dependencies. */
export function orderedDishTasks<T extends {id:string}>(dish:Dish,tasks:T[]):T[]{
 if(!dish.planningStepOrder?.length)return tasks;
 const positions=new Map(dish.planningStepOrder.map((key,index)=>[key,index]));
 const sort=(values:T[])=>values.map((task,index)=>({task,index})).sort((a,b)=>(positions.get(stepKey(dish,a.task.id))??Infinity)-(positions.get(stepKey(dish,b.task.id))??Infinity)||a.index-b.index).map(x=>x.task);
 if(dish.preset==='custom')return [...sort(tasks.filter(t=>stepKey(dish,t.id)!=='serve')),...tasks.filter(t=>stepKey(dish,t.id)==='serve')];
 const result=[...tasks];
 for(let i=0;i<result.length;i++){
  if(!movableTemplatePrep(result[i] as unknown as PlannedTask))continue;
  const first=i;while(i+1<result.length&&movableTemplatePrep(result[i+1] as unknown as PlannedTask))i++;
  result.splice(first,i-first+1,...sort(result.slice(first,i+1)));
 }
 return result;
}
/** Templates retain physical-phase/checkpoint dependencies. Only ordinary
 * preparation inside the same phase can be reordered, never refrigerated waits. */
export const movableTemplatePrep=(task:PlannedTask)=>task.templateStage?.kind==='preparation'&&!task.templateStage.startLabel&&!task.isCondition;
export function planTemplatePreparation(dish:Dish,tasks:PlannedTask[],context:ImportedTimingContext={}):PlannedTask[]{
 if(!dish.planningStepOrder?.length)return tasks;
 const result=tasks.map(t=>({...t}));
 for(let i=0;i<result.length;i++){
  if(!movableTemplatePrep(result[i]))continue;
  const first=i;while(i+1<result.length&&movableTemplatePrep(result[i+1]))i++;
  let cursor=stamp(result[i+1]?.scheduledAt);
  for(let j=i;j>=first;j--){
   const t=result[j];if(context.hidden?.has(t.id))continue;
   const override=context.overrides?.[t.id];
   const minutes=override?.durationMinutes===undefined?t.templateStage!.minutes:override.durationMinutes;
   const blocked=override?.scheduledAt===null;
   const next=blocked||cursor===null||minutes===null?null:cursor-minutes*60000;
   t.scheduledAt=iso(next);t.baseScheduledAt=t.scheduledAt;
   t.durationMinutes=minutes;t.baseDurationMinutes=t.templateStage!.minutes;
   // Fixed/recorded evidence is applied by the shared projection. It also
   // anchors earlier preparation without rewriting the stored plan or events.
   cursor=blocked?null:override?.scheduledAt!==undefined?stamp(override.scheduledAt):context.recorded?.has(t.id)&&override?.recordedPlanAt!==undefined?stamp(override.recordedPlanAt):next;
  }
 }
 return result;
}
