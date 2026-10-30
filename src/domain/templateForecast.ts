import type {Meal,PlannedTask} from './meal';
import {physicalStartedEvent} from './physicalPhase';
import {latestStartedEvent,type ExtendedMeal} from './cookState';
import {buildDishTimeline} from './schedule';
import type {StepForecast,TemplateTiming} from './cookForecast';
const minute=60000;
const stamp=(s:string|null|undefined)=>s&&Number.isFinite(Date.parse(s))?Date.parse(s):null;
const iso=(n:number|null)=>n!==null&&Number.isFinite(n)&&Math.abs(n)<=8640000000000000?new Date(n).toISOString():null;

/** Templates define a cook phase, rest allowance and checkpoint positions.
 * A checkpoint offset is not a physical step duration or proof of readiness. */
export function templateStepForecasts(meal:Meal,timeline:PlannedTask[],now:number):Record<string,StepForecast>{
 const result:Record<string,StepForecast>={},events=(meal as ExtendedMeal).events??[],visible=new Map(timeline.map(t=>[t.id,t]));
 const actual=(id:string)=>id.endsWith(':start')||id.endsWith(':rest')?stamp(physicalStartedEvent(events,id)?.occurredAt):stamp(latestStartedEvent(events,id)?.occurredAt)??stamp(meal.completed[id]);
 for(const dish of meal.dishes){
  if(dish.preset==='custom')continue;
  // A reference date supplies only offsets if a legacy active cook has no target.
  const source=buildDishTimeline(dish,Number.isFinite(Date.parse(meal.serveAt))?meal.serveAt:'2000-01-02T12:00Z');
  const startId=dish.id+':start',finishId=dish.id+':finish',restId=dish.id+':rest';
  const startIndex=source.findIndex(t=>t.id===startId),sourceStart=stamp(source[startIndex]?.scheduledAt);
  if(startIndex<0||sourceStart===null)continue;
  const start=visible.get(startId),startActual=actual(startId);
  const prepDone=source.slice(0,startIndex).every(t=>!visible.has(t.id)||!!meal.completed[t.id]);
  const fixedStart=start?.timingMode==='fixed';
  const canForecast=start?.timingMode!=='unscheduled'&&prepDone&&!fixedStart;
  const root=startActual??(canForecast?now:stamp(start?.scheduledAt));
  const basis:TemplateTiming['basis']=startActual!==null||canForecast?'estimated':fixedStart?'fixed':'planned';
  const offsets=new Map(source.map(t=>[t.id,stamp(t.scheduledAt)]));
  const cookMinutes=Math.max(15,dish.cookMinutes),restMinutes=Math.max(0,dish.restMinutes)+(dish.preset==='brisket'?dish.brisketPlan?.applied?.inputs.holdBufferMinutes??0:0);
  const point=(id:string):number|null=>{
   const position=offsets.get(id);if(root===null||position==null)return null;
   let at=root+position-sourceStart;
   // Fixed future checkpoints and late recorded progress constrain later points.
   // Early check-offs do not imply that the meat has cooked for that percentage.
   for(const p of source){
    const pAt=offsets.get(p.id),t=visible.get(p.id);
    if(pAt==null||pAt<sourceStart||pAt>position||!t)continue;
    const limit=t.timingMode==='fixed'&&!meal.completed[t.id]?stamp(t.scheduledAt):actual(t.id);
    if(limit!==null)at=Math.max(at,limit+position-pAt);
   }
   return at;
  };
  const finishActual=stamp(meal.completed[finishId]);
  const restActual=actual(restId);
  const cookEnd=point(finishId)??(root===null?null:root+cookMinutes*minute);
  const restTask=visible.get(restId);
  const restAt=restActual??(restTask?.timingMode==='unscheduled'?null:restTask?.timingMode==='fixed'?stamp(restTask.scheduledAt):finishActual!==null?Math.max(now,finishActual):cookEnd);
  for(const planned of source){
   const t=visible.get(planned.id);if(!t||(meal.completed[t.id]&&!t.id.endsWith(':start')&&!t.id.endsWith(':rest')))continue;
   const key=t.id.slice(dish.id.length+1),position=offsets.get(t.id),preparation=position!==null&&position!==undefined&&position<sourceStart;
   const kind:TemplateTiming['kind']=key==='start'?'cook':key==='rest'?'rest':key==='serve'?'serve':preparation?'preparation':'checkpoint';
   // An explicitly entered activity duration retains the ordinary step editor's
   // semantics; do not replace it with the length of the entire cook phase.
   if(t.durationMinutes!=null&&kind!=='checkpoint')continue;
   const evidence=actual(t.id),fixed=t.timingMode==='fixed',unscheduled=t.timingMode==='unscheduled'&&evidence===null;
   let at:number|null=null,pointBasis:TemplateTiming['basis']=basis;
   if(evidence!==null){at=evidence;pointBasis='actual';}
   else if(unscheduled){pointBasis='planned';}
   else if(fixed){at=stamp(t.scheduledAt);pointBasis='fixed';}
   else if(kind==='preparation'){at=stamp(t.scheduledAt);pointBasis='planned';}
   else if(kind==='rest'){at=restAt;pointBasis=restActual!==null||finishActual!==null?'estimated':basis;}
   else if(kind==='serve'&&restAt!==null&&(restActual!==null||finishActual!==null)){at=restAt+restMinutes*minute;pointBasis='estimated';}
   else at=point(t.id);
   const phaseMinutes=kind==='cook'?cookMinutes:kind==='rest'?(t.durationMinutes??restMinutes):undefined;
   const finish=at!==null&&phaseMinutes!==undefined?iso(at+phaseMinutes*minute):null;
   const checkpoint=kind==='checkpoint';
   const elapsed=(kind==='cook'&&startActual!==null||kind==='rest'&&restActual!==null)&&finish!==null&&Date.parse(finish)<=now;
   const expiredCheck=key==='finish'&&startActual!==null&&at!==null&&at<=now;
   const reason=elapsed||expiredCheck?'Estimate elapsed; check actual progress before continuing.':unscheduled?'This step is left unscheduled.':checkpoint?'Template timing guide; confirm actual conditions before continuing.':kind==='rest'?'Rest/hold timing depends on verified doneness and safe holding.':kind==='cook'&&pointBasis==='planned'?'Based on the plan; complete preparation and record the on-smoker start.':undefined;
   result[t.id]={start:iso(at),finish,status:elapsed||expiredCheck?'overdue':unscheduled?'unknown':checkpoint?'condition':pointBasis==='planned'?'planned':pointBasis==='fixed'?'fixed':'estimated',template:{kind,at:iso(at),basis:pointBasis,...(phaseMinutes!==undefined?{minutes:phaseMinutes}:{})},...(reason?{reason}:{})};
  }
 }
 return result;
}
