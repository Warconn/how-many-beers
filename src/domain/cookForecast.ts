import type {Meal,PlannedTask} from './meal';
import {latestStartedEvent,type ExtendedMeal} from './cookState';
import {buildDishTimeline} from './schedule';
import {physicalPhase,physicalStartedEvent} from './physicalPhase';
import {executionTimeline,sessionAnchor,reopenedAt} from './executionTimeline';
import {templateStepForecasts} from './templateForecast';

export type TemplateTiming={
 kind:'checkpoint'|'cook'|'rest'|'preparation'|'activity'|'serve';
 at:string|null;
 basis:'planned'|'estimated'|'fixed'|'actual';
 minutes?:number;
};

export type StepForecast={
 start:string|null;finish:string|null;
 status:'estimated'|'fixed'|'planned'|'unknown'|'blocked'|'condition'|'overdue';
 reason?:string;
 template?:TemplateTiming;
};
const stamp=(s:string|null|undefined)=>s&&Number.isFinite(Date.parse(s))?Date.parse(s):null;
const iso=(n:number)=>Number.isFinite(n)&&Math.abs(n)<=8640000000000000?new Date(n).toISOString():null;
const duration=(t:PlannedTask)=>t.durationMinutes!=null&&Number.isFinite(t.durationMinutes)&&t.durationMinutes>=0?t.durationMinutes*60000:null;
/** A just-recorded action may arrive before the display clock's next tick. */
export function forecastClock(meal:Meal,now:number):number{
 const times=[now,stamp(meal.startedAt),...Object.values(meal.completed).map(stamp),...((meal as ExtendedMeal).events??[]).filter(e=>['started','completed','reopened'].includes(e.kind)).map(e=>stamp(e.occurredAt))].filter((n):n is number=>n!==null&&Number.isFinite(n));
 return times.length?Math.max(...times):now;
}

/** Read-only live estimates. Source order is not manual checklist order, and
 * inferred starts are never events. Unknown/safety barriers require real progress. */
export function liveStepForecasts(meal:Meal,timeline:PlannedTask[],clock:number):Record<string,StepForecast>{
 if((meal.mode!=='cooking'&&!meal.startedAt)||!Number.isFinite(clock))return {};
 const now=forecastClock(meal,clock);timeline=executionTimeline(meal,timeline,now);const anchor=sessionAnchor(meal,now),events=(meal as ExtendedMeal).events??[],result:Record<string,StepForecast>={};
 const byId=new Map(timeline.map(t=>[t.id,t]));
 const projected=new Set<string>();
 const estimate=(t:PlannedTask,earliest:number,blocked?:string,milestone=false):StepForecast=>{
  const planned=stamp(t.scheduledAt),actual=stamp((physicalPhase(t)?physicalStartedEvent(events,t.id):latestStartedEvent(events,t.id))?.occurredAt),length=milestone?0:duration(t);
  if(t.isCondition&&!physicalPhase(t))return {start:t.scheduledAt,finish:null,status:'condition',reason:'Verify actual conditions before continuing.'};
  if(actual!==null){
   const finish=length===null?null:actual+length;
   if(finish!==null&&finish<=now&&length!==0)return {start:iso(actual),finish:null,status:'overdue',reason:'Estimate elapsed; check progress before continuing.'};
   return {start:iso(actual),finish:finish===null?null:iso(finish),status:length===null?'unknown':'estimated',...(length===null?{reason:'Duration unknown.'}:{})};
  }
  if(blocked)return {start:t.timingMode==='fixed'?t.scheduledAt:null,finish:null,status:'blocked',reason:'Waiting for '+blocked+'.'};
  if(t.timingMode==='unscheduled')return {start:null,finish:null,status:'unknown',reason:'Left unscheduled; choose a start before estimating.'};
  if(t.timingMode==='fixed'){
   if(planned===null)return {start:null,finish:null,status:'unknown',reason:'Fixed start needs review.'};
   if(earliest>planned)return {start:t.scheduledAt,finish:null,status:'blocked',reason:'Fixed start conflicts with unfinished work; review timing.'};
   if(length!==null&&length>0&&planned+length<=now)return {start:t.scheduledAt,finish:null,status:'overdue',reason:'Estimate elapsed; check progress before continuing.'};
   return {start:t.scheduledAt,finish:length===null?null:iso(planned+length),status:length===null?'unknown':'fixed',...(length===null?{reason:'Duration unknown.'}:{})};
  }
  if(length!==null&&length>0&&earliest+length<=now)return {start:iso(earliest),finish:null,status:'overdue',reason:'Estimate elapsed; check progress before continuing.'};
  return {start:iso(earliest),finish:length===null?null:iso(earliest+length),status:length===null?'unknown':'estimated',...(length===null?{reason:'Duration unknown.'}:{})};
 };
 for(const dish of meal.dishes){
  if(dish.preset!=='custom')continue;
  const sequence=buildDishTimeline(dish,meal.serveAt).map(t=>byId.get(t.id)).filter((t):t is PlannedTask=>!!t);
  const workRemaining=sequence.some(t=>!meal.completed[t.id]&&t.id!==dish.id+':serve');
  let cursor:number|null=Math.max(anchor,stamp(dish.executionAddedAt)??anchor),blocked:string|undefined,previous:PlannedTask|undefined;
  for(const t of sequence){
   projected.add(t.id);
   if(meal.completed[t.id]){
    const done=stamp(meal.completed[t.id]);
    if(!blocked&&done!==null)cursor=Math.max(cursor??done,done);
    previous=t;continue;
   }
   const serve=t.id===dish.id+':serve';
   if(serve&&!workRemaining&&t.timingMode!=='fixed'){result[t.id]={start:iso(now),finish:iso(now),status:'estimated'};continue;}
   const previousStart=previous?stamp(previous.scheduledAt):null,previousLength=previous?duration(previous):null,planned=stamp(t.scheduledAt);
   // Preserve actual waiting gaps; elapsed recipe durations are not inferred
   // from checkpoint spacing. Sequential imports normally have zero gap.
   const gap=previous?.recordedPlanAt===undefined&&previous?.timingMode!=='fixed'&&previousStart!==null&&previousLength!==null&&planned!==null?Math.max(0,planned-previousStart-previousLength):0;
   const earliest=Math.max(anchor,reopenedAt(meal,t.id)??anchor,cursor===null?anchor:cursor+gap);
   const priorBlocked=blocked;const priorCursor:number|null=cursor;
   const f=estimate(t,earliest,blocked,serve);result[t.id]=f;
   const finish=stamp(f.finish);
   cursor=finish===null?null:Math.max(priorCursor??finish,finish);
   blocked=priorBlocked??(cursor===null?t.title:undefined);previous=t;
  }
 }
 // Ad hoc work shares the execution origin but retains explicit fixed starts.
 // Independent dishes/activities are not serialized by checklist display order.
 for(const t of timeline){
  if(projected.has(t.id)||meal.completed[t.id])continue;
  if(duration(t)===null&&!t.isCondition){result[t.id]={start:t.scheduledAt,finish:null,status:'planned'};continue;}
  result[t.id]=estimate(t,Math.max(anchor,stamp(t.scheduledAt)??anchor));
 }
 Object.assign(result,templateStepForecasts(meal,timeline,now));
 return result;
}
