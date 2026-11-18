import {actionRecorded} from '@/domain/cookingFocus';
import {timedCookingTasks} from '@/domain/stepTimingCue';
import Icon from './Icon';
import {cookingTitle} from './CookingStepSummary';
import type {PlannedTask} from '@/domain/meal';
import type {StepForecast} from '@/domain/cookForecast';
import StepForecastTime from './StepForecastTime';
import {useState} from 'react';
import type {CookEvent,CookEventKind} from '@/domain/cookState';
import type {LivePhase} from '@/domain/phaseForecast';
import type {PhasePlan} from '@/domain/cookingPhases';
import {activityStatus} from '@/domain/activities';
import ActivityReadingForm from './ActivityReadingForm';
function time(iso:string){return new Date(iso).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
export default function CookingChecklist({tasks,completed,onSelect,onComplete,forecasts={},now=Date.now(),phases=[],plan,events=[],onReading,onReadingChange}:{now?:number;tasks:PlannedTask[];forecasts?:Record<string,StepForecast>;completed:Record<string,string>;onSelect:(id:string)=>void;onComplete:(id:string,done:boolean)=>void;phases?:LivePhase[];plan?:PhasePlan;events?:CookEvent[];onReading?:(id:string,kind:CookEventKind,value:number|undefined,unit:'°F'|'°C'|undefined,note:string,activityId:string|undefined,noteOnly:boolean)=>void;onReadingChange?:(open:boolean)=>void}){
 const [reading,setReading]=useState<string|null>(null);
 const openReading=(id:string|null)=>{setReading(id);onReadingChange?.(id!==null);};
 const linked=(id:string)=>{const a=plan?.actions[id];const ids=new Set([...(a?.starts??[]),...(a?.ends??[]),...(a?.observes??[]),...(a?.checkpoint?[a.checkpoint.phaseId]:[])]);return phases.filter(p=>ids.has(p.id));};
 const canRead=(task:PlannedTask)=>{
  const a=plan?.actions[task.id];
  return events.some(e=>e.taskId===task.id&&(e.kind==='temperature'||e.kind==='equipment'))
   ||!!a?.checkpoint||!!a?.observes?.length||linked(task.id).some(p=>p.startTaskId===task.id&&p.active)
   ||(a?.ends??[]).some(id=>plan?.phases.find(p=>p.id===id)?.stage==='preheating')
   ||task.isCondition&&!a?.starts?.length&&!a?.ends?.length;
 };
 return <section className="full-cook-checklist" aria-label="Full cook checklist" id="full-cook-checklist" tabIndex={-1}>
  <h3>Full checklist</h3><p className="muted small">All dishes with live estimates for timed unfinished work. Open a step for instructions, notes and readings.</p>
  <ol className="flat-cook-list">{timedCookingTasks(tasks,forecasts,now,completed).map(task=><li key={task.id} className={completed[task.id]||actionRecorded(forecasts[task.id])?'is-complete':''}>
   <label className="flat-step-check"><input type="checkbox" disabled={!!reading||actionRecorded(forecasts[task.id])&&!completed[task.id]} aria-label={'Complete '+task.title+' for '+task.dishName} checked={!!completed[task.id]||actionRecorded(forecasts[task.id])} onChange={e=>onComplete(task.id,e.target.checked)}/></label>
   <button type="button" disabled={!!reading} aria-label={'Open step: '+task.title+' for '+task.dishName} onClick={()=>onSelect(task.id)}>
    <span className="flat-step-copy"><strong>{cookingTitle(task.title)}</strong><span>{task.dishName}{task.isCondition?' · Verify conditions':''}</span>{completed[task.id] && <span className="flat-step-actual">Completed {time(completed[task.id])}</span>}{phases.filter(p=>p.startTaskId===task.id&&p.actualStart).map(p=><span className="inline-activity-status" key={p.id}>{activityStatus(p)}</span>)}</span>
    <span className="flat-step-time"><StepForecastTime task={task} completedAt={completed[task.id]} now={now} forecast={forecasts[task.id]} part="start" simple/>{forecasts[task.id]?.finish&&<><br/><StepForecastTime forecast={forecasts[task.id]} part="finish" simple/></>}</span><Icon className="flat-step-chevron" name="chevron-right"/>
   </button>
   {onReading&&canRead(task)&&<div className="flat-step-reading">
    {reading===task.id?<ActivityReadingForm task={task} activities={linked(task.id)} onCancel={()=>openReading(null)} onSave={(kind,value,unit,note,activityId,noteOnly)=>{onReading(task.id,kind,value,unit,note,activityId,noteOnly);openReading(null);}}/>:<button type="button" className="link" disabled={!!reading} onClick={()=>openReading(task.id)}>{events.some(e=>e.taskId===task.id&&(e.kind==='temperature'||e.kind==='equipment'))?'Record another reading':'Record reading'}</button>}
    {events.some(e=>e.taskId===task.id&&(e.kind==='temperature'||e.kind==='equipment'))&&<details className="checkpoint-readings"><summary>Readings ({events.filter(e=>e.taskId===task.id&&(e.kind==='temperature'||e.kind==='equipment')).length})</summary><ul>{events.filter(e=>e.taskId===task.id&&(e.kind==='temperature'||e.kind==='equipment')).map(e=><li key={e.id}><time dateTime={e.occurredAt}>{time(e.occurredAt)}</time>{e.value!==undefined?` · ${e.value}${e.unit??''}`:''}{e.note?' · '+e.note:''}</li>)}</ul></details>}
   </div>}
  </li>)}</ol>
  {!tasks.length && <p className="muted">No steps yet. Edit the plan to add a dish or prep step.</p>}
 </section>;
}
