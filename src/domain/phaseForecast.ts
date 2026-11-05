import type {Meal,PlannedTask} from './meal';
import type {ExtendedMeal} from './cookState';
import type {StepForecast} from './cookForecast';
import {phaseObservations,type CookingPhase} from './cookingPhases';

const minute=60000;
const stamp=(s:string|null|undefined)=>s&&Number.isFinite(Date.parse(s))?Date.parse(s):null;
const iso=(n:number)=>new Date(n).toISOString();
export type LivePhase={id:string;dishId:string;kind:CookingPhase['kind'];startTaskId:string;actualStart:string|null;actualEnd:string|null;start:string;finish:string;minutes:number|null;elapsed:number;active:boolean;overrun:boolean;uncertain:boolean};
export type PhaseProjection={forecasts:Record<string,StepForecast>;phases:LivePhase[];finish:string|null;earliestFinish:string;remaining:number|null;minimumRemaining:number;projected:number|null;elapsed:number;provisional:boolean;reason:string};

/** A single read-only projection feeds the meter, current action and upcoming
 * times. Only tagged actual observations anchor physical intervals. */
export function phaseProjection(meal:Meal,timeline:PlannedTask[],now:number):PhaseProjection{
 const plan=meal.phasePlan!,events=(meal as ExtendedMeal).events??[],forecasts:Record<string,StepForecast>={},states=new Map<string,LivePhase>();
 const byId=new Map(timeline.map(t=>[t.id,t]));
 let end=now,uncertain=false;
 const anchor=stamp(meal.startedAt)??now;
 const length=(t:PlannedTask)=>{
  const override=(meal as ExtendedMeal).taskOverrides?.[t.id];
  return override?.durationMinutes!==undefined?override.durationMinutes:t.durationMinutes??t.templateStage?.minutes??(t.isCondition||t.id.endsWith(':serve')?0:null);
 };
 const phaseLength=(p:CookingPhase)=>{
  const task=byId.get(p.durationTaskId),override=(meal as ExtendedMeal).taskOverrides?.[p.durationTaskId];
  if(override?.durationMinutes!==undefined)return override.durationMinutes;
  const d=meal.dishes.find(d=>d.id===p.dishId);
  if(p.id===p.dishId+':rest'&&d?.preset!=='custom')return Math.max(0,d?.restMinutes??0)+(d?.preset==='brisket'?d.brisketPlan?.applied?.inputs.holdBufferMinutes??0:0);
  return task?.durationMinutes??task?.templateStage?.minutes??p.minutes;
 };
 for(const dishId of new Set(timeline.map(t=>t.dishId))){
  const order=plan.order[dishId]??[];
  const own=timeline.filter(t=>t.dishId===dishId);
  const rank=new Map(order.map((id,i)=>[id,i]));
  own.sort((a,b)=>(rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity));
  const dish=meal.dishes.find(d=>d.id===dishId);
  let cursor=Math.max(anchor,stamp(dish?.executionAddedAt)??anchor),unknown=false;
  let previousPrep:{planned:number;start:number;minutes:number}|undefined;
  for(const t of own){
   if(plan.suppressed.includes(t.id))continue;
   const action=plan.actions[t.id],phases=(action?.starts??[]).map(id=>plan.phases.find(p=>p.id===id)).filter((p):p is CookingPhase=>!!p);
   const done=stamp(meal.completed[t.id]);
   const planned=stamp(t.scheduledAt),preparation=t.templateStage?.kind==='preparation';
   const overlap=preparation&&!t.userSequence&&!dish?.planningStepOrder?.length&&previousPrep&&planned!==null?Math.max(0,previousPrep.minutes-(planned-previousPrep.planned)/minute):0;
   const prepStart=previousPrep?previousPrep.start+(previousPrep.minutes-overlap)*minute:cursor;
   if(phases.length){
    for(const p of phases){
     const actual=phaseObservations(meal,p.id),actualStart=stamp(actual.start?.occurredAt),actualEnd=stamp(actual.end?.occurredAt),minutes=phaseLength(p);
     const prior=p.after?states.get(p.after):undefined;
     const earliest=Math.max(now,preparation?prepStart:cursor,prior?Date.parse(prior.finish):anchor);
     const fixed=t.timingMode==='fixed'?stamp(t.scheduledAt):null;
     const start=actualStart??Math.max(earliest,fixed??earliest);
     const nominal=minutes===null?null:start+minutes*minute;
     const estimate=events.filter(e=>e.phaseEstimate?.phaseId===p.id&&stamp(e.occurredAt)!>=start).at(-1);
     const upper=p.upperMinutes!==undefined&&minutes===p.minutes?start+p.upperMinutes*minute:null;
     const predicted=estimate?Date.parse(estimate.occurredAt)+estimate.phaseEstimate!.minutes*minute:nominal!==null&&nominal<=now&&actualStart!==null&&p.kind==='heating'&&upper!==null&&upper>now?upper:nominal;
     const overrun=p.kind==='heating'&&actualStart!==null&&actualEnd===null&&nominal!==null&&nominal<=now;
     const expired=p.kind==='heating'&&actualStart!==null&&actualEnd===null&&(predicted===null||predicted<=now);
     const unscheduled=t.timingMode==='unscheduled'&&actualStart===null;
     const conflict=actualStart===null&&fixed!==null&&fixed<earliest;
     const unresolved:boolean=actualEnd===null&&(expired||minutes===null||unscheduled||conflict||unknown||!!prior?.uncertain);
     const finish=actualEnd??Math.max(start,predicted??start,expired?now:start);
     const state:LivePhase={id:p.id,dishId,kind:p.kind,startTaskId:p.startTaskId,actualStart:actual.start?.occurredAt??null,actualEnd:actual.end?.occurredAt??null,start:iso(start),finish:iso(finish),minutes,elapsed:actualStart===null?0:Math.max(0,((actualEnd??now)-actualStart)/minute),active:actualStart!==null&&actualEnd===null,overrun,uncertain:unresolved};
     states.set(p.id,state);
     forecasts[t.id]={start:state.start,finish:state.finish,status:unresolved?'unknown':'estimated',phaseId:p.id,elapsedMinutes:state.elapsed,physicalActive:state.active,overEstimate:overrun,lowerBound:unresolved,retainDuration:state.active,template:{kind:p.kind==='passive'?'rest':'cook',at:state.start,basis:actualStart===null?'estimated':'actual',...(minutes!==null?{minutes}:{})},...(unresolved?{reason:expired?'Cooking is still active; the finish is an earliest estimate.':conflict?'Fixed start conflicts with unfinished work.':'Some remaining timing is unknown.'}:{})};
     cursor=finish;unknown=unresolved;
     if(preparation&&planned!==null&&minutes!==null)previousPrep={planned,start,minutes};
    }
    continue;
   }
   const checkpoint=action?.checkpoint;
   const ends=(action?.ends??[]).map(id=>states.get(id)).filter((p):p is LivePhase=>!!p);
   if(checkpoint||ends.length){
    const p=checkpoint?states.get(checkpoint.phaseId):ends.at(-1);
    const derived=p?checkpoint?Date.parse(p.start)+(p.minutes??0)*checkpoint.fraction*minute:Date.parse(p.finish):Math.max(cursor,now);
    const at=t.timingMode==='fixed'?stamp(t.scheduledAt)??derived:derived;
    forecasts[t.id]={start:iso(at),finish:null,status:'condition',phaseId:p?.id,elapsedMinutes:p?.elapsed,physicalActive:p?.active,overEstimate:p?.overrun,lowerBound:p?.uncertain,template:{kind:'checkpoint',at:iso(at),basis:t.timingMode==='fixed'?'fixed':'estimated'}};
    // A check never advances an interval. Only a tagged physical-end observation
    // changes the phase; rapid check-offs cannot manufacture cooked minutes.
    continue;
   }
   if(done!==null){cursor=Math.max(cursor,done);if(preparation&&planned!==null)previousPrep={planned,start:done,minutes:0};continue;}
   const minutes=length(t),actual=events.filter(e=>e.taskId===t.id&&e.kind==='started'&&!e.phaseEstimate&&!e.phaseObservations).at(-1);
   const fixed=t.timingMode==='fixed'?stamp(t.scheduledAt):null;
   const start=stamp(actual?.occurredAt)??Math.max(now,preparation?prepStart:cursor,fixed??0);
   const conflict=fixed!==null&&!actual&&fixed<Math.max(now,cursor);
   const unresolved=unknown||minutes===null||t.timingMode==='unscheduled'||conflict;
   const finish=start+Math.max(0,minutes??0)*minute;
   forecasts[t.id]={start:iso(start),finish:iso(finish),status:unresolved?'unknown':t.isCondition?'condition':'estimated',lowerBound:unresolved,...(minutes!==null?{}:{reason:'Duration unknown; showing earliest timing from known work.'})};
   cursor=Math.max(cursor,finish);unknown=unresolved;
   if(preparation&&planned!==null&&minutes!==null)previousPrep={planned,start,minutes};
  }
  end=Math.max(end,cursor);uncertain ||= unknown;
 }
 // Hidden/removed start rows must not make an already active phase disappear.
 for(const p of plan.phases){
  if(states.has(p.id)||!meal.dishes.some(d=>d.id===p.dishId))continue;
  const actual=phaseObservations(meal,p.id);
  if(actual.start&&!actual.end){uncertain=true;end=Math.max(end,now);}
 }
 const minimumRemaining=Math.max(0,(end-now)/minute),remaining=uncertain?null:minimumRemaining,elapsed=Math.max(0,(now-anchor)/minute);
 return {forecasts,phases:[...states.values()],finish:uncertain?null:iso(end),earliestFinish:iso(end),remaining,minimumRemaining,projected:remaining===null?null:elapsed+remaining,elapsed,provisional:true,reason:uncertain?'Earliest estimate':'Estimated remaining'};
}
