import type {PlannedTask} from '@/domain/meal';
import type {StepForecast} from '@/domain/cookForecast';
import StepForecastTime from './StepForecastTime';
function time(iso:string){return new Date(iso).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
export default function CookingChecklist({tasks,completed,onSelect,onComplete,forecasts={}}:{tasks:PlannedTask[];forecasts?:Record<string,StepForecast>;completed:Record<string,string>;onSelect:(id:string)=>void;onComplete:(id:string,done:boolean)=>void}){
 return <section className="full-cook-checklist" aria-label="Full cook checklist" id="full-cook-checklist" tabIndex={-1}>
  <h3>Full checklist</h3><p className="muted small">All dishes with live estimates for timed unfinished work. Open a step for instructions, notes and readings.</p>
  <ol className="flat-cook-list">{tasks.map(task=><li key={task.id} className={completed[task.id]?'is-complete':''}>
   <label className="flat-step-check"><input type="checkbox" aria-label={'Complete '+task.title+' for '+task.dishName} checked={!!completed[task.id]} onChange={e=>onComplete(task.id,e.target.checked)}/></label>
   <button type="button" aria-label={'Open step: '+task.title+' for '+task.dishName} onClick={()=>onSelect(task.id)}>
    <span className="flat-step-copy"><strong>{task.title}</strong><span>{task.dishName}{task.isCondition?' · Verify conditions':''}</span>{completed[task.id] && <span className="flat-step-actual">Completed {time(completed[task.id])}</span>}</span>
    <span className="flat-step-time">{forecasts[task.id]?<><StepForecastTime forecast={forecasts[task.id]} part="start"/>{forecasts[task.id].finish&&<><br/><StepForecastTime forecast={forecasts[task.id]} part="finish"/></>}</>:task.scheduledAt && Number.isFinite(Date.parse(task.scheduledAt))?<time dateTime={task.scheduledAt}>{time(task.scheduledAt)}</time>:<span>Untimed</span>}</span><span className="flat-step-chevron" aria-hidden="true">›</span>
   </button>
  </li>)}</ol>
  {!tasks.length && <p className="muted">No steps yet. Edit the plan to add a dish or prep step.</p>}
 </section>;
}
