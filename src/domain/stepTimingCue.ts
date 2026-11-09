import type {PlannedTask} from './meal';
import {physicalPhase} from './physicalPhase';
import type {StepForecast} from './cookForecast';

export type TimingCue={label:string;at?:string;detail?:string};
const valid=(at:string|null|undefined):at is string=>!!at&&Number.isFinite(Date.parse(at));
/** One read-only cue for the card, checklist and Up next. Dates never prove readiness. */
export function conditionCue(task:PlannedTask):string{
 const first=task.instructions.match(/^.*?[.!?](?:\s|$)/)?.[0].trim()??task.instructions.trim();
 if(/^(when|check|review|verify|probe|after|inspect|wrap|keep|if|follow|monitor|no-wrap)\b/i.test(first))return first.length>120?first.slice(0,117).replace(/\s+\S*$/,'')+'…':first;
 if(/wrap/i.test(task.title))return 'When bark is ready for wrapping.';
 if(/tender/i.test(task.title))return 'When probe-tender; verify doneness.';
 return 'Verify the recipe’s condition before continuing.';
}
export function stepTimingCue(task:PlannedTask,forecast:StepForecast|undefined,now:number):TimingCue{
 const checkpoint=forecast?.template?.kind==='checkpoint'||(task.isCondition&&!physicalPhase(task));
 if(checkpoint){
  const detail=conditionCue(task),at=forecast?.template?.at??forecast?.start;
  if(forecast?.template?.basis==='actual'&&valid(at))return {label:'Actual check',at};
  if(forecast?.status==='blocked')return {label:'Review timing',detail:forecast.reason??detail};
  const supported=forecast&&!forecast.lowerBound&&valid(at);
  if(forecast?.status==='overdue'||(supported&&Date.parse(at)<=now)||(forecast?.physicalActive&&forecast.overEstimate))return {label:'Review now',detail:'Estimated check passed. '+detail};
  if(supported)return {label:task.timingMode==='fixed'?'Planned check':'Check around',at,detail};
  return {label:detail};
 }
 if(forecast?.template?.basis==='actual'&&valid(forecast.start))return {label:'Actual start',at:forecast.start,...(forecast.overEstimate||forecast.status==='overdue'?{detail:'Estimate elapsed; review progress.'}:{})};
 if(task.timingMode!=='unscheduled'&&valid(task.scheduledAt)&&(!forecast||task.timingMode==='fixed'||task.recipeOrder===undefined))return {label:'Planned start',at:task.scheduledAt,...(forecast?.status==='blocked'?{detail:'Review timing: '+(forecast.reason??'waiting for previous work.')}: {})};
 if(forecast?.status==='overdue')return {label:'Review now',detail:'Estimate elapsed; check progress.'};
 if(forecast?.status==='blocked')return {label:'Waiting for previous action',detail:forecast.reason};
 if(valid(forecast?.start))return {label:forecast?.status==='planned'?'Planned start':'Estimated start',at:forecast.start};
 return {label:task.id.endsWith(':serve')?'Serve when ready':'Start time not set'};
}
