import type {Meal,PlannedTask} from './meal';
import {physicalPhase,physicalStartedEvent} from './physicalPhase';
import {latestStartedEvent,type ExtendedMeal} from './cookState';
import {stepMinutes,sessionAnchor,executionConflict} from './executionTimeline';
import {buildDishTimeline} from './schedule';
import type {StepForecast,TemplateTiming} from './cookForecast';
const minute=60000;
const stamp=(s:string|null|undefined)=>s&&Number.isFinite(Date.parse(s))?Date.parse(s):null;
const iso=(n:number|null)=>n!==null&&Number.isFinite(n)&&Math.abs(n)<=8640000000000000?new Date(n).toISOString():null;

/** Templates define a cook phase, rest allowance and checkpoint positions.
 * A checkpoint offset is not a physical step duration or proof of readiness. */
export function templateStepForecasts(meal:Meal,timeline:PlannedTask[],now:number):Record<string,StepForecast>{
 const result:Record<string,StepForecast>={},events=(meal as ExtendedMeal).events??[],visible=new Map(timeline.map(t=>[t.id,t]));
 const actual=(id:string)=>id.endsWith(':start')||id.endsWith(':rest')||(visible.get(id)&&physicalPhase(visible.get(id)!))?stamp(physicalStartedEvent(events,id)?.occurredAt):stamp(latestStartedEvent(events,id)?.occurredAt)??stamp(meal.completed[id]);
 for(const dish of meal.dishes){
  if(dish.preset==='custom')continue;
  // A reference date supplies only offsets if a legacy active cook has no target.
  const source=buildDishTimeline(dish,Number.isFinite(Date.parse(meal.serveAt))?meal.serveAt:'2000-01-02T12:00Z');
  const startId=dish.id+':start',finishId=dish.id+':finish',restId=dish.id+':rest';
  const startIndex=source.findIndex(t=>t.id===startId),sourceStart=stamp(source[startIndex]?.scheduledAt);
  if(startIndex<0||sourceStart===null)continue;
  const start=visible.get(startId),startActual=actual(startId);
  const fixedStart=start?.timingMode==='fixed';
  const prep=source.map(t=>visible.get(t.id)).filter((t):t is PlannedTask=>!!t&&t.templateStage?.kind==='preparation'&&!meal.completed[t.id]);
  const prepEnds=prep.map(t=>{const at=stamp(t.scheduledAt),length=stepMinutes(meal,t);return at!==null&&length!==null?at+length*minute:null;});
  const fallback=prepEnds.some(n=>n===null)?null:Math.max(sessionAnchor(meal,now),stamp(dish.executionAddedAt)??0,...prepEnds as number[],...source.map(t=>stamp(meal.completed[t.id])??0));
  const root=startActual??(start?stamp(start.scheduledAt):fallback);
  const basis:TemplateTiming['basis']=fixedStart&&startActual===null?'fixed':'estimated';
  const cookMinutes=Math.max(15,dish.cookMinutes),restMinutes=Math.max(0,dish.restMinutes)+(dish.preset==='brisket'?dish.brisketPlan?.applied?.inputs.holdBufferMinutes??0:0);
  const offsets=new Map(source.map(t=>[t.id,stamp(t.scheduledAt)]));
  // Explicit finishing stages follow authored durations, not reminder spacing.
  for(const t of source){
   const after=t.templateStage?.after;if(!after)continue;
   const prior=visible.get(dish.id+':'+after),base=offsets.get(dish.id+':'+after);
   if(base!=null)offsets.set(t.id,base+(prior?(stepMinutes(meal,prior)??0):0)*minute);
  }
  const lastStage=source.filter(t=>visible.has(t.id)&&t.templateStage?.after).at(-1);
  const lastAt=lastStage?offsets.get(lastStage.id):null;
  const end=lastStage&&lastAt!=null?lastAt+(visible.get(lastStage.id)?.durationMinutes??lastStage.templateStage!.minutes)*minute:sourceStart+(start?(stepMinutes(meal,start)??cookMinutes):startActual!==null?(source[startIndex].templateStage?.minutes??cookMinutes):0)*minute;
  if(lastStage?.id!==finishId)offsets.set(finishId,end);
  offsets.set(dish.id+':serve',end+restMinutes*minute);
  const point=(id:string):number|null=>{
   const position=offsets.get(id);if(root===null||position==null)return null;
   let at=root+position-sourceStart,anchorPosition=sourceStart;
   for(const phase of source){
    const phaseAt=offsets.get(phase.id),evidence=actual(phase.id);
    if(phase.templateStage?.after&&physicalPhase(phase)&&phaseAt!=null&&phaseAt<=position&&evidence!==null){at=evidence+position-phaseAt;anchorPosition=phaseAt;}
   }
   // Fixed future checkpoints and late recorded progress constrain later points.
   // Early check-offs do not imply that the meat has cooked for that percentage.
   for(const p of source){
    const pAt=offsets.get(p.id),t=visible.get(p.id);
    if(pAt==null||pAt<anchorPosition||pAt>position||!t)continue;
    const limit=actual(t.id)??(t.timingMode==='fixed'&&!meal.completed[t.id]?stamp(t.scheduledAt):null);
    if(limit!==null)at=Math.max(at,limit+position-pAt);
   }
   return at;
  };
  const finishActual=stamp(meal.completed[finishId]);
  const restActual=actual(restId);
  const cookEnd=point(finishId)??(root===null?null:root+cookMinutes*minute);
  const restTask=visible.get(restId);
  const restAt=restActual??(restTask?.timingMode==='unscheduled'?null:restTask?.timingMode==='fixed'?stamp(restTask.scheduledAt):finishActual!==null?finishActual:cookEnd);
  for(const planned of source){
   const t=visible.get(planned.id);if(!t||(meal.completed[t.id]&&!t.templateStage?.startLabel&&!t.templateStage?.after))continue;
   const key=t.id.slice(dish.id.length+1),position=offsets.get(t.id),preparation=position!==null&&position!==undefined&&position<sourceStart;
   const kind:TemplateTiming['kind']=t.templateStage?.kind??(key==='start'?'cook':key==='rest'?'rest':key==='serve'?'serve':preparation?'preparation':'checkpoint');
   // An explicitly entered activity duration retains the ordinary step editor's
   // semantics; do not replace it with the length of the entire cook phase.
   if(t.durationMinutes!=null&&!t.templateStage&&kind!=='checkpoint')continue;
   const evidence=actual(t.id),fixed=t.timingMode==='fixed',unscheduled=t.timingMode==='unscheduled'&&evidence===null;
   const prior=t.templateStage?.after?result[dish.id+':'+t.templateStage.after]:undefined;
   let at:number|null=null,pointBasis:TemplateTiming['basis']=basis;
   if(evidence!==null){at=evidence;pointBasis='actual';}
   else if(unscheduled){pointBasis='planned';}
   else if(fixed){at=stamp(t.scheduledAt);pointBasis='fixed';}
   else if(kind==='preparation'){at=stamp(t.scheduledAt);pointBasis='estimated';}
   else if(kind==='rest'){at=restAt;pointBasis=restActual!==null||finishActual!==null?'estimated':basis;}
   else if(kind==='serve'&&restAt!==null&&(restActual!==null||finishActual!==null)){at=restAt+restMinutes*minute;pointBasis='estimated';}
   else if(t.templateStage?.after&&prior?.finish){at=stamp(prior.finish);pointBasis=prior.template?.basis??basis;}
   else at=point(t.id);
   const phaseMinutes=stepMinutes(meal,t)??(t.templateStage?undefined:kind==='cook'?cookMinutes:kind==='rest'?restMinutes:undefined);
   const phaseComplete=(kind==='activity'||kind==='preparation')&&!!meal.completed[t.id];
   const finish=phaseComplete?meal.completed[t.id]:at!==null&&phaseMinutes!==undefined?iso(at+phaseMinutes*minute):null;
   const checkpoint=kind==='checkpoint';
   const elapsed=(!phaseComplete&&phaseMinutes!==undefined)&&finish!==null&&Date.parse(finish)<=now;
   const expiredCheck=kind==='checkpoint'&&key==='finish'&&startActual!==null&&at!==null&&at<=now;

   const restPrerequisite=kind==='rest'?(finishActual??cookEnd):null;
   const conflict=executionConflict(t)??(fixed&&evidence===null&&((prior&&(stamp(prior.finish)===null||at===null||at<stamp(prior.finish)!))||(kind==='rest'&&(restPrerequisite===null||at===null||at<restPrerequisite)))?'Fixed start conflicts with unfinished cooking.':undefined);
   const blocked=evidence===null&&(!!conflict||!!prior&&(prior.status==='overdue'||prior.status==='blocked'||!prior.finish));
   const reason=blocked?(conflict??'Check the previous cooking phase before continuing.'):elapsed||expiredCheck?'Estimate elapsed; check actual progress before continuing.':unscheduled?'This step is left unscheduled.':checkpoint?'Template timing guide; confirm actual conditions before continuing.':kind==='rest'?'Rest/hold timing depends on verified doneness and safe holding.':kind==='cook'&&pointBasis==='planned'?'Based on the plan; complete preparation and record the actual cooking start.':phaseMinutes!==undefined?'Editable template allowance; confirm your recipe and actual conditions.':undefined;
   result[t.id]={start:iso(at),finish:blocked?null:finish,status:blocked?'blocked':elapsed||expiredCheck?'overdue':unscheduled?'unknown':checkpoint?'condition':pointBasis==='planned'?'planned':pointBasis==='fixed'?'fixed':'estimated',template:{kind,at:iso(at),basis:pointBasis,...(phaseMinutes!==undefined?{minutes:phaseMinutes}:{})},...(reason?{reason}:{})};
  }
 }
 return result;
}
