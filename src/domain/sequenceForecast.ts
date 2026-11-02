import type {Meal,PlannedTask} from './meal';
import type {StepForecast,TemplateTiming} from './cookForecast';
import {actualStart,sessionAnchor,stamp,iso,reopenedAt} from './executionTimeline';
import {physicalPhase,physicalStartedEvent} from './physicalPhase';
import type {ExtendedMeal} from './cookState';
import {sequenceCheckpoint,sequenceMinutes} from './stepSequence';
/** User-configured recipes share one cursor in the chosen order. An unfinished
 * check remains a condition, never a timer proving food is safe or ready. */
export function sequenceForecasts(meal:Meal,timeline:PlannedTask[],now:number):Record<string,StepForecast>{
 const result:Record<string,StepForecast>={},anchor=sessionAnchor(meal,now),events=(meal as ExtendedMeal).events??[];
 const groups=new Map<string,PlannedTask[]>();
 for(const t of timeline.filter(t=>t.userSequence)){const list=groups.get(t.dishId)??[];list.push(t);groups.set(t.dishId,list);}
 for(const [dishId,list] of groups){
  const dish=meal.dishes.find(d=>d.id===dishId),tasks=list.sort((a,b)=>a.recipeOrder!-b.recipeOrder!);
  let cursor:number|null=Math.max(anchor,stamp(dish?.executionAddedAt)??anchor),blockedBy:string|undefined;
  const phaseKind=(t:PlannedTask):TemplateTiming['kind']|undefined=>t.templateStage?.kind??(physicalPhase(t)?/^(cool|rest|hold)\b/i.test(t.title)?'rest':'cook':undefined);
  const endEvidence=(t:PlannedTask,index:number):number|null=>{
   const kind=phaseKind(t);if(!physicalPhase(t))return null;
   const floor=Math.max(anchor,actualStart(meal,t)??anchor,reopenedAt(meal,t.id)??anchor);
   const endKey=kind==='cook'?':finish':':serve';
   const observations=tasks.slice(index+1).flatMap(next=>{
    const completion=next.id.endsWith(endKey)?stamp(meal.completed[next.id]):null;
    const physical=stamp(physicalStartedEvent(events,next.id)?.occurredAt);
    return [completion,physical].filter((n):n is number=>n!==null&&n>=floor);
   });return observations.length?Math.min(...observations):null;
  };
  for(let i=0;i<tasks.length;i++){
   const t=tasks[i],checkpoint=sequenceCheckpoint(t),length=sequenceMinutes(t),evidence=checkpoint?null:actualStart(meal,t),done=stamp(meal.completed[t.id]);
   const phase=!!physicalPhase(t),ended=endEvidence(t,i),retain=done!==null&&phase&&ended===null;
   if(done!==null&&!retain){cursor=Math.max(cursor??anchor,phase&&ended!==null?ended:done);continue;}
   const earliest:number|null=cursor===null?null:Math.max(cursor,reopenedAt(meal,t.id)??anchor,stamp(t.executionAddedAt)??anchor),fixed=t.timingMode==='fixed',planned=stamp(t.scheduledAt);
   const start:number|null=evidence??(fixed?planned:earliest);
   const kind:TemplateTiming['kind']|undefined=phaseKind(t)??(checkpoint?'checkpoint':t.id.endsWith(':serve')&&length===0?'serve':undefined);
   const template=kind?{kind,at:iso(start),basis:evidence!==null?'actual' as const:fixed?'fixed' as const:'estimated' as const,...(length!==null&&(!checkpoint||t.durationMinutes!==null)?{minutes:length}:{})}:undefined;
   const finish:number|null=start===null||length===null?null:start+length*60000;
   const conflict=evidence===null&&(blockedBy!==undefined||earliest===null||fixed&&(start===null||start<earliest));
   const reason=conflict?fixed?`${t.title} has a fixed start that conflicts with unfinished ${blockedBy??tasks[i-1]?.title??'work'}.`:`Waiting for ${blockedBy??'a time estimate for the previous step'}.`:t.timingMode==='unscheduled'&&evidence===null?'Choose a start time or use estimated timing.':length===null?`${t.title} needs a time estimate.`:!checkpoint&&finish!==null&&length>0&&finish<=now?'Estimate elapsed; check progress before continuing.':undefined;
   const status=conflict?'blocked':t.timingMode==='unscheduled'&&evidence===null?'unknown':length===null?'unknown':checkpoint?'condition':finish!==null&&length>0&&finish<=now?'overdue':fixed&&evidence===null?'fixed':'estimated';
   result[t.id]={start:iso(start),finish:conflict||status==='unknown'||status==='overdue'||checkpoint&&t.durationMinutes===null?null:iso(finish),status,...(template?{template}:{}),...(reason?{reason}:{}),...(retain?{retainDuration:true}:{})};
   if(status==='blocked'||status==='unknown'||status==='overdue'){cursor=null;blockedBy=t.title;}
   else{cursor=finish;blockedBy=undefined;}
  }
 }
 return result;
}
