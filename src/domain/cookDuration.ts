import type {Meal, PlannedTask} from './meal';
import type {ExtendedMeal} from './cookState';
const stamp=(s:string|null|undefined)=>s && Number.isFinite(Date.parse(s))?Date.parse(s):null;
/** One window, including real advance prep; thaw reminders and explicitly skipped
 * brining do not start it. Hidden tasks are already removed by cookTimeline. */
export function cookDuration(meal:Meal,timeline:PlannedTask[],now:number,finishedAt?:string){
  const eligible=(id:string)=>!meal.dishes.some(d=>d.preset==='turkey' &&
    (id===d.id+':thaw' || (id===d.id+':brine' && d.turkeyPrep?.brineHours===0)));
  const tasks=timeline.filter(t=>eligible(t.id));
  const starts=tasks.map(t=>stamp(t.scheduledAt)).filter((n):n is number=>n!==null);
  const ends=tasks.map(t=>{const at=stamp(t.scheduledAt);return at===null?null:at+Math.max(0,t.durationMinutes??0)*60000;}).filter((n):n is number=>n!==null);
  const planned=starts.length && ends.length?Math.max(0,(Math.max(...ends)-Math.min(...starts))/60000):null;
  const actualStarts=[stamp(meal.startedAt),...((meal as ExtendedMeal).events??[])
    .filter(e=>e.kind==='started' && eligible(e.taskId)).map(e=>stamp(e.occurredAt))].filter((n):n is number=>n!==null);
  const start=actualStarts.length?Math.min(...actualStarts):null;
  const finish=stamp(finishedAt);
  if(finish!==null && start!==null && finish>=start)return {minutes:(finish-start)/60000,label:'Actual cook',elapsed:null};
  if(!finishedAt && meal.mode==='cooking' && start!==null && Number.isFinite(now)){
    const end=Math.max(now,start,...ends);
    return {minutes:(end-start)/60000,label:'Projected cook',elapsed:Math.max(0,(now-start)/60000)};
  }
  return {minutes:planned,label:'Planned cook',elapsed:null};
}
