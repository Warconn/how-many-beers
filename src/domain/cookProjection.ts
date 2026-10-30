import type {Meal,PlannedTask} from './meal';
import {type ExtendedMeal} from './cookState';
import {liveStepForecasts,forecastClock,type StepForecast} from './cookForecast';
import {physicalStartedEvent,physicalPhase} from './physicalPhase';
import {sessionAnchor,stamp,iso,stepMinutes,actualStart} from './executionTimeline';
/** Shared live finish, remaining and projected total. Calendar targets are
 * comparison data, never implicit cooking/holding appointments. */
export type CookProjection={forecasts:Record<string,StepForecast>;finish:string|null;remaining:number|null;projected:number|null;elapsed:number;provisional:boolean;reason:string};
export function cookProjection(meal:Meal,timeline:PlannedTask[],clock:number):CookProjection{
 if(!Number.isFinite(clock))return {forecasts:{},finish:null,remaining:null,projected:null,elapsed:0,provisional:true,reason:'Timing unavailable'};
 const now=forecastClock(meal,clock),anchor=sessionAnchor(meal,now),elapsed=Math.max(0,(now-anchor)/60000),forecasts=liveStepForecasts(meal,timeline,now);
 const remaining=timeline.filter(t=>!meal.completed[t.id]);
 if(!remaining.length)return {forecasts,finish:iso(now),remaining:0,projected:elapsed,elapsed,provisional:false,reason:'All steps checked'};
 const keep=new Set(remaining.map(t=>t.id));
 for(const dish of meal.dishes){
  if(dish.preset==='custom')continue;
  const advanced=timeline.some(t=>t.dishId===dish.id&&t.templateStage?.after&&physicalStartedEvent((meal as ExtendedMeal).events??[],t.id));
  if(!meal.completed[dish.id+':finish']&&!advanced)keep.add(dish.id+':start');
  if(!meal.completed[dish.id+':serve'])keep.add(dish.id+':rest');
 }
 let end=now,reason='',provisional=false;
 for(const t of timeline){
  if(!keep.has(t.id))continue;
  const f=forecasts[t.id];if(!f){reason='Remaining timing needed';break;}
  const dish=meal.dishes.find(d=>d.id===t.dishId),serve=t.id===dish?.id+':serve';
  if(dish?.preset==='turkey'&&(t.id.endsWith(':thaw')&&dish.turkeyPrep?.state==='thawed'||t.id.endsWith(':brine')&&dish.turkeyPrep?.brineHours===0))continue;
  if(stepMinutes(meal,t)===0&&t.timingMode!=='fixed'&&!t.isCondition)continue;
  if(serve&&t.timingMode!=='fixed'){
   // Wings have a defined post-cook rest but no separate rest action.
   if(dish?.preset==='wings'&&dish?.restMinutes&&!timeline.some(p=>p.id===dish.id+':rest'))end=Math.max(end,stamp(f.start)??end);
   continue;
  }
  if(f.status==='overdue'){reason='Review overdue steps';break;}
  if(f.status==='blocked'||f.status==='unknown'){reason=f.reason??'Remaining timing needed';break;}
  if(f.template?.kind==='checkpoint'){
   provisional=true;
   if(t.timingMode==='fixed')end=Math.max(end,stamp(f.start)??end);
   continue;
  }
  if(t.isCondition&&!f.template){reason='Verify actual conditions before estimating the finish.';break;}
  if(f.finish===null){reason='Remaining timing needed';break;}
  end=Math.max(end,stamp(f.finish)??end);
  provisional ||= !!f.template || !!t.isCondition || (!!physicalPhase(t)&&actualStart(meal,t)===null);
 }
 const minutes=reason||!Number.isFinite(clock)?null:Math.max(0,(end-now)/60000);
 return {forecasts,finish:minutes===null?null:iso(end),remaining:minutes,projected:minutes===null?null:elapsed+minutes,elapsed,provisional,reason:reason||'Estimated remaining'};
}
