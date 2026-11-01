import type {Meal, PlannedTask} from './meal';
import {cookProjection} from './cookProjection';
import type {ExtendedMeal} from './cookState';
const stamp=(s:string|null|undefined)=>s && Number.isFinite(Date.parse(s))?Date.parse(s):null;
function eligibleTasks(meal:Meal,timeline:PlannedTask[]){
  return timeline.filter(t=>!meal.dishes.some(d=>d.preset==='turkey' &&
    (t.id===d.id+':thaw' || (t.id===d.id+':brine' && d.turkeyPrep?.brineHours===0))));
}
function unknownDuration(meal:Meal,t:PlannedTask){
  return t.durationMinutes==null && (t.dishId==='custom'||meal.dishes.some(d=>d.id===t.dishId&&d.preset==='custom'&&t.id!==d.id+':serve'));
}
/** Estimated window of unfinished work, not a percentage of checklist items.
 * Overlapping steps count once; overdue/untimed work cannot promise zero time. */
export function remainingCook(meal:Meal,timeline:PlannedTask[],now:number,finishedAt?:string){
  if(finishedAt)return {minutes:0,label:'Cook complete'};
  if(meal.mode==='cooking'||meal.startedAt){const p=cookProjection(meal,timeline,now);return {minutes:p.remaining,label:p.reason};}
  const tasks=eligibleTasks(meal,timeline);
  const remaining=tasks.filter(t=>!meal.completed[t.id]);
  if(tasks.length && !remaining.length)return {minutes:0,label:'All steps checked'};
  if(!remaining.length || !Number.isFinite(now) || remaining.some(t=>stamp(t.scheduledAt)===null||unknownDuration(meal,t)))return {minutes:null,label:'Remaining timing needed'};
  const from=Math.max(now,Math.min(...remaining.map(t=>stamp(t.scheduledAt)!)));
  const to=Math.max(...remaining.map(t=>stamp(t.scheduledAt)!+Math.max(0,t.durationMinutes??0)*60000));
  if(to<=from)return now<to?{minutes:(to-now)/60000,label:'Estimated remaining'}:{minutes:null,label:'Review overdue steps'};
  return {minutes:(to-from)/60000,label:'Estimated remaining'};
}
/** One window, including real advance prep; thaw reminders and explicitly skipped
 * brining do not start it. Hidden tasks are already removed by cookTimeline. */
export function cookDuration(meal:Meal,timeline:PlannedTask[],now:number,finishedAt?:string){
  const eligible=(id:string)=>!meal.dishes.some(d=>d.preset==='turkey' &&
    (id===d.id+':thaw' || (id===d.id+':brine' && d.turkeyPrep?.brineHours===0)));
  const tasks=timeline.filter(t=>eligible(t.id));
  const starts=tasks.map(t=>stamp(t.scheduledAt)).filter((n):n is number=>n!==null);
  const ends=tasks.map(t=>{const at=stamp(t.scheduledAt);return at===null?null:at+Math.max(0,t.durationMinutes??0)*60000;}).filter((n):n is number=>n!==null);
  const partial=tasks.some(t=>stamp(t.scheduledAt)===null || unknownDuration(meal,t));
  const window=starts.length && ends.length?Math.max(0,(Math.max(...ends)-Math.min(...starts))/60000):null;
  const planned=partial&&window===0?null:window;
  const actualStarts=[stamp(meal.startedAt),...((meal as ExtendedMeal).events??[])
    .filter(e=>e.kind==='started' && eligible(e.taskId)).map(e=>stamp(e.occurredAt))].filter((n):n is number=>n!==null);
  const start=actualStarts.length?Math.min(...actualStarts):null;
  const finish=stamp(finishedAt);
  if(finish!==null && start!==null && finish>=start)return {minutes:(finish-start)/60000,label:'Actual cook',elapsed:null};
  if(!finishedAt && (meal.mode==='cooking'||!!meal.startedAt) && Number.isFinite(now)){
    const p=cookProjection(meal,timeline,now);
    return {minutes:p.projected,label:p.projected===null?'Partial projected window':'Projected cook',elapsed:p.elapsed};
  }
  return {minutes:planned,label:partial?'Partial planned window':'Planned cook',elapsed:null};
}
