import type {Meal,PlannedTask} from './meal';
import {latestStartedEvent,type ExtendedMeal} from './cookState';
import {physicalPhase,physicalStartedEvent} from './physicalPhase';
import {buildDishTimeline} from './schedule';
import {turkeyPreparation} from './turkeyPrep';
export type ExecutionTask=PlannedTask&{executionConflict?:string};
export const executionConflict=(t:PlannedTask)=>(t as ExecutionTask).executionConflict;
export const stamp=(s:string|null|undefined)=>s&&Number.isFinite(Date.parse(s))?Date.parse(s):null;
export const iso=(n:number|null)=>n!==null&&Number.isFinite(n)&&Math.abs(n)<=8640000000000000?new Date(n).toISOString():null;
export function sessionAnchor(meal:Meal,now:number):number{
 const events=(meal as ExtendedMeal).events??[];
 return stamp(meal.startedAt)??events.filter(e=>e.kind==='started').reduce((v,e)=>Math.min(v,stamp(e.occurredAt)??v),now);
}
export function stepMinutes(meal:Meal,t:PlannedTask):number|null{
 const override=(meal as ExtendedMeal).taskOverrides?.[t.id];
 if(override&&Object.prototype.hasOwnProperty.call(override,'durationMinutes'))return override.durationMinutes??null;
 const minutes=t.durationMinutes??t.templateStage?.minutes;
 return minutes!=null&&Number.isFinite(minutes)&&minutes>=0?minutes:null;
}
export function actualStart(meal:Meal,t:PlannedTask):number|null{
 const events=(meal as ExtendedMeal).events??[];
 return stamp((physicalPhase(t)?physicalStartedEvent(events,t.id):latestStartedEvent(events,t.id))?.occurredAt);
}
export function reopenedAt(meal:Meal,id:string):number|null{
 const e=((meal as ExtendedMeal).events??[]).filter(e=>e.taskId===id&&e.kind==='reopened').at(-1);
 return stamp(e?.occurredAt);
}
/** Ephemeral execution positions. The target-based timeline remains untouched.
 * Compact idle planning gaps, retain explicit waits/overlap, and never write a
 * hypothetical phase start into the activity log. */
export function executionTimeline(meal:Meal,timeline:PlannedTask[],now:number):ExecutionTask[]{
 const byId=new Map<string,ExecutionTask>(timeline.map(t=>[t.id,{...t}])),anchor=sessionAnchor(meal,now);
 for(const dish of meal.dishes){
  if(dish.preset==='custom')continue;
  const source=buildDishTimeline(dish,meal.serveAt).filter(t=>byId.has(t.id));
  if(dish.preset==='turkey'){
   const prep=turkeyPreparation(dish),thaw=byId.get(dish.id+':thaw');
   if(thaw)thaw.templateStage={kind:'preparation',minutes:prep.state==='thawed'?0:prep.thawDays*1440};
   for(const [key,minutes] of [['brine',prep.brineHours*60],['dry',prep.dryHours*60]] as const){
    const t=byId.get(dish.id+':'+key);if(t&&!t.templateStage)t.templateStage={kind:'preparation',minutes};
   }
  }
  let cursor:number|null=Math.max(anchor,stamp(dish.executionAddedAt)??anchor),previous:{original:number|null;start:number;length:number}|undefined;
  for(const planned of source){
   const t=byId.get(planned.id)!;if(t.templateStage?.kind!=='preparation')continue;
   if(meal.completed[t.id]){const done=stamp(meal.completed[t.id])??anchor;if(cursor!==null)cursor=Math.max(cursor,done);previous=cursor===null?undefined:{original:stamp(planned.scheduledAt),start:done,length:0};continue;}
   const length=stepMinutes(meal,t),real=actualStart(meal,t),fixed=t.timingMode==='fixed',unknown=t.timingMode==='unscheduled'||length===null;
   if(unknown&&real===null){t.scheduledAt=null;cursor=null;previous=undefined;continue;}
   const original=stamp(planned.scheduledAt),overlap=previous&&original!==null&&previous.original!==null?Math.max(0,previous.length-(original-previous.original)/60000):0;
   const earliest=cursor===null?null:Math.max(anchor,stamp(dish.executionAddedAt)??anchor,reopenedAt(meal,t.id)??anchor,previous?previous.start+(previous.length-overlap)*60000:cursor);
   const start=real??(fixed?stamp(t.scheduledAt):earliest);
   if(fixed&&real===null&&(earliest===null||start===null||start<earliest)){t.executionConflict='Fixed start conflicts with unfinished preparation.';cursor=null;previous=undefined;continue;}
   t.scheduledAt=iso(start);
   if(start!==null&&length!==null){cursor=Math.max(cursor??start,start+length*60000);previous={original,start,length};}else{cursor=null;previous=undefined;}
  }
  const cook=byId.get(dish.id+':start');
  if(cook&&cook.timingMode==='fixed'&&actualStart(meal,cook)===null&&(cursor===null||stamp(cook.scheduledAt)===null||stamp(cook.scheduledAt)!<cursor))cook.executionConflict='Fixed cooking start conflicts with unfinished preparation.';
  if(cook&&cook.timingMode!=='fixed'&&cook.timingMode!=='unscheduled'&&actualStart(meal,cook)===null)cook.scheduledAt=iso(cursor===null?null:Math.max(cursor,reopenedAt(meal,cook.id)??anchor));
 }
 const canonical=new Set(meal.dishes.flatMap(d=>buildDishTimeline(d,meal.serveAt).map(t=>t.id)));
 const general=[...byId.values()].filter(t=>!canonical.has(t.id));
 const positions=general.filter(t=>!meal.completed[t.id]&&t.timingMode!=='fixed').map(t=>stamp(t.scheduledAt)).filter((n):n is number=>n!==null);
 const first=positions.length?Math.min(...positions):anchor;
 const progress=Math.max(anchor,...general.map(t=>stamp(meal.completed[t.id])??anchor));
 for(const t of general){
  if(meal.completed[t.id]||t.timingMode==='fixed'||t.timingMode==='unscheduled'||actualStart(meal,t)!==null)continue;
  const original=stamp(t.scheduledAt);
  const created=stamp(t.executionAddedAt);
  t.scheduledAt=iso(created!==null?Math.max(anchor,created,reopenedAt(meal,t.id)??anchor):Math.max(progress,reopenedAt(meal,t.id)??anchor)+(original===null?0:Math.max(0,original-first)));
 }
 return timeline.map(t=>byId.get(t.id)!);
}
