import type {PlannedTask} from '@/domain/meal';
import type {StepForecast} from '@/domain/cookForecast';
import {physicalPhase} from '@/domain/physicalPhase';
import {formatDuration} from '@/domain/stepTiming';
import StepForecastTime from './StepForecastTime';
/** Display-only shortening; the full authored title/instructions remain in details. */
export function cookingTitle(title:string):string{
 const first=title.match(/^.*?[.!?](?:\s|$)/)?.[0].trim()??title;
 return first.replace(/\s*\([^)]*\b(?:minutes?|mins?|hours?|hrs?)\)\.?/ig,'').replace(/\.$/,'');
}
function brief(task:PlannedTask,rest:boolean):string{
 const first=task.title.match(/^.*?[.!?](?:\s|$)/)?.[0].trim()??task.title;
 const instructions=task.instructions===task.title?task.title.slice(first.length).trim():task.instructions.startsWith(task.title)?task.instructions.slice(task.title.length).trim():task.instructions;
 if(!instructions||instructions==='Imported recipe step. Confirm instructions and timing.')return '';
 if(rest){
  const safety=instructions.match(/[^.!?]*(?:140°F|safe holding)[^.!?]*[.!?]?/i)?.[0].trim();
  if(safety)return safety;
 }
 const safety=instructions.match(/[^.!?]*(?:keep refrigerated|140°F|at least 165°F|never thaw|avoid washing|raw poultry separate)[^.!?]*[.!?]?/i)?.[0].trim();
 const excerpt=task.recipeOrder!==undefined?instructions:instructions.match(/^.*?[.!?](?:\s|$)/)?.[0].trim()??instructions;
 const concise=excerpt.length>200?excerpt.slice(0,197).replace(/\s+\S*$/,'')+'…':excerpt;
 return safety&&!concise.includes(safety)?concise+' '+safety:concise;
}
export default function CookingStepSummary({task,forecast}:{task:PlannedTask;forecast?:StepForecast}){
 const phase=forecast?.template?.kind,rest=phase==='rest',condition=task.isCondition&&!physicalPhase(task);
 const minutes=forecast?.template?.minutes??task.durationMinutes;
 const instruction=brief(task,rest);
 return <>
  <div className="between"><strong>{cookingTitle(task.title)}</strong></div>
  <p className="task-dish">{task.dishName}</p>
  {instruction&&<p className="muted small">{instruction}</p>}
  <p className="cooking-step-timing">
   {condition?'Check when ready':<>
    {minutes!=null&&<span>Estimated {formatDuration(minutes)}</span>}
    {forecast?.finish&&forecast.status!=='overdue'?<StepForecastTime forecast={forecast} part="finish" simple/>:forecast?.status==='overdue'?<span>Estimate elapsed. Check progress.</span>:forecast?.status==='blocked'?<span>Waiting for the previous action</span>:minutes==null?<span>{task.id.endsWith(':serve')?'Serve when ready':'Time not estimated'}</span>:<span>Finish time not available</span>}
   </>}
  </p>
 </>;
}
