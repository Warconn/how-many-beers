import type {Meal,PlannedTask} from './meal';
import type {ExtendedMeal} from './cookState';
import type {CookProjection} from './cookProjection';
import {guidedCookingSteps} from './cookingFocus';
import {conditionCue} from './stepTimingCue';
import {physicalStartedEvent} from './physicalPhase';

export type HomeNextAction = {kind:'action';task:PlannedTask;cue:string;at?:string;timeLabel?:'Planned start'|'Estimated start'} | {kind:'waiting'|'checked';cue:string};
const valid=(at:string|null|undefined):at is string=>!!at&&Number.isFinite(Date.parse(at));

/** Read-only Home presentation of canonical guidance/forecasts. No scheduling. */
export function homeNextAction(meal:Meal|null,tasks:PlannedTask[],projection:CookProjection|null,now:number):HomeNextAction|null{
 if(!meal||(meal.mode!=='cooking'&&!meal.startedAt)||!Number.isFinite(now))return null;
 const events=(meal as ExtendedMeal).events??[],forecasts=projection?.forecasts??{};
 const remaining=tasks.filter(t=>!meal.completed[t.id]&&!meal.phasePlan?.suppressed.includes(t.id));
 if(!remaining.length)return projection&&(projection.remaining===null||projection.remaining>0||projection.phases?.some(p=>p.active))?{kind:'waiting',cue:'Cooking or holding in progress.'}:{kind:'checked',cue:'All steps checked.'};
 const manual=remaining.filter(t=>{
  const f=forecasts[t.id];
  // A running start action is not a new instruction to start that phase again.
  // Checkpoints inside the same active phase remain eligible.
  const running=f?.physicalActive&&(meal.phasePlan?.actions[t.id]?.starts?.length||physicalStartedEvent(events,t.id));
  return !running;
 });
 const task=guidedCookingSteps(manual,meal.completed,null,meal.phasePlan?forecasts:undefined).current;
 if(!task)return {kind:'waiting',cue:'Waiting for cooking progress.'};
 const f=forecasts[task.id];
 if(task.isCondition||f?.template?.kind==='checkpoint'||f?.status==='condition'){
  const cue=conditionCue(task);
  return {kind:'action',task,cue:cue==='Verify the recipe’s condition before continuing.'?'Check when ready.':cue};
 }
 // An actual observation is not another planned/estimated start.
 if(f?.template?.basis==='actual')return {kind:'action',task,cue:'Review progress.'};
 // Blocked work stays in canonical guidance; uncertainty changes the cue,
 // not the cooking order. Missing/uncertain projections cannot supply a countdown.
 // An explicit unscheduled choice remains untimed even if a lower bound exists.
 if(task.timingMode==='unscheduled'||!f||f.lowerBound||(f.status==='unknown'||f.status==='blocked'))return {kind:'action',task,cue:!valid(task.scheduledAt)||task.timingMode==='unscheduled'?'Time not set.':'Timing needs review.'};
 const at=task.timingMode==='fixed'?task.scheduledAt:f.start;
 if(!valid(at))return {kind:'action',task,cue:'Time not set.'};
 const delta=Date.parse(at)-now;
 const cue=delta>0?`In ${Math.ceil(delta/60000)} min`:delta>-60000?'Now':`${Math.floor(-delta/60000)} min overdue`;
 return {kind:'action',task,at,cue,timeLabel:task.timingMode==='fixed'||f.status==='planned'||f.status==='fixed'?'Planned start':'Estimated start'};
}
