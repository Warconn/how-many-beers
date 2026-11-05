"use client";

import {useEffect,useState} from "react";
import type {PlannedTask} from "@/domain/meal";
import type {CookEvent, CookEventKind, StepPlanEdit} from "@/domain/cookState";
import {latestStartedEvent} from "@/domain/cookState";
import {physicalPhase,physicalStartedEvent} from "@/domain/physicalPhase";
import CookingStepSummary,{cookingTitle} from "./CookingStepSummary";
import StepEditor from "./StepEditor";
import StepForecastTime from "./StepForecastTime";
import type {StepForecast} from "@/domain/cookForecast";
import Icon from './Icon';
import RemoveButton from "./RemoveButton";
import {estimatedFinish,formatDuration} from "@/domain/stepTiming";
import type {LivePhase} from '@/domain/phaseForecast';

type Props = {
  activePhase?:LivePhase;
  alsoCooking?:string[];
  onRemainingEstimate?:(minutes:number)=>void;
  task: PlannedTask;
  forecast?: StepForecast;
  index: number;
  count: number;
  isNext?: boolean;
  compact?: boolean;
  showTimingDetails?: boolean;
  hasServeTarget?: boolean;
  mode: "planning" | "cooking";
  completedAt?: string;
  events: CookEvent[];
  note: string;
  onNote: (value:string)=>void;
  onReadingChange?: (open:boolean)=>void;
  editing: boolean;
  onEditingChange: (open:boolean)=>void;
  editorId: string;
  onEdit: (title:string, instructions:string, details?:StepPlanEdit)=>void;
  onDurationChange?: (minutes:number|null)=>void;
  durationDisabled?: boolean;
  onMove: (direction:"up"|"down")=>string|void;
  onRemove: ()=>void;
  onEvent: (kind:CookEventKind,value?:number,unit?:"°F"|"°C",note?:string,occurredAt?:string)=>void;
};

function localDateTimeInput(iso:string):string {
  const d=new Date(iso),pad=(n:number)=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatted(iso:string):string {
  const date=new Date(iso);
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
}

export default function TaskRow({
  task,forecast,index,count,isNext=false,compact=false,showTimingDetails=false,hasServeTarget=false,mode,completedAt,events,note,onNote,onEdit,onDurationChange,durationDisabled=false,onMove,onRemove,onEvent,editing,onEditingChange,editorId,onReadingChange,activePhase,alsoCooking=[],onRemainingEstimate
}:Props) {
  const [moveNotice,setMoveNotice]=useState("");
  const [detailsOpen,setDetailsOpen]=useState(false);
  const [logging,setLogging]=useState(false);
  const [startFormOpen,setStartFormOpen]=useState(false);
  const [startTime,setStartTime]=useState("");
  const [startError,setStartError]=useState("");
  const [readingType,setReadingType]=useState<"temperature"|"equipment">("temperature");
  const [reading,setReading]=useState("");
  const [unit,setUnit]=useState<"°F"|"°C">("°F");
  const [readingNote,setReadingNote]=useState("");
  const [error,setError]=useState("");
  const [moveError,setMoveError]=useState("");
  const [durationError,setDurationError]=useState("");
  const [remainingEstimate,setRemainingEstimate]=useState('');

  // Each new checklist action starts with its optional tools collapsed.
  useEffect(()=>{setDetailsOpen(false);setLogging(false);setStartFormOpen(false);setStartError("");setRemainingEstimate('');},[task.id]);
  useEffect(()=>{onReadingChange?.(logging||startFormOpen||!!remainingEstimate.trim());return ()=>onReadingChange?.(false);},[logging,startFormOpen,remainingEstimate,onReadingChange]);

  const done=!!completedAt;
  const phase=activePhase?{label:'Record actual start'}:physicalPhase(task);
  const started=activePhase?.actualStart?{occurredAt:activePhase.actualStart}:phase?physicalStartedEvent(events,task.id):latestStartedEvent(events,task.id);
  const DetailContainer=mode==="cooking"?"details":"div";
  const activity=events.filter(e=>e.taskId===task.id && e.kind!=="removed").slice(-8).reverse();
  const isCooking=mode==="cooking";
  const visibleInstructions=onDurationChange&&task.instructions.startsWith(task.title)?task.instructions.slice(task.title.length).trim():task.instructions;

  const saveActualStart=()=>{
    const when=new Date(startTime);
    if(!startTime||!Number.isFinite(when.getTime())||when.getTime()>Date.now()){
      setStartError("Choose a valid actual time that is not in the future.");return;
    }
    onEvent("started",undefined,undefined,started?"Corrected actual phase start":"Recorded actual phase start",when.toISOString());
    setStartFormOpen(false);setStartError("");
  };

  const handleReading=()=>{
    const hasTemperature=reading.trim().length>0;
    const num=hasTemperature?Number(reading):undefined;
    if((readingType==="temperature" && !hasTemperature) ||
       (hasTemperature && (!Number.isFinite(num) || num===undefined || num<=0 || num>(unit==="°F"?600:300))) ||
       (readingType==="equipment" && !hasTemperature && !readingNote.trim())){
      setError(readingType==="equipment"?"Enter a setpoint or describe the equipment change.":"Enter a valid food temperature.");return;
    }
    onEvent(readingType,num,hasTemperature?unit:undefined,readingNote);
    setReading("");setReadingNote("");setLogging(false);setError("");
  };

  return <article className={"task cook-task "+(done?"done ":"")+(isNext && isCooking ? "first-task":"")+(compact?" compact-task":"")} aria-label={task.title} id={editorId} tabIndex={isCooking?-1:undefined}>
    <div className="task-top">
      {isCooking && <label className="task-check-control"><input aria-label={"Complete "+task.title} type="checkbox" checked={done} disabled={editing||logging||startFormOpen||!!remainingEstimate.trim()}
        onChange={e=>onEvent(e.target.checked?"completed":"reopened")}/></label>}
      {!isCooking && <span className="preview-index" aria-hidden>{index+1}</span>}
      <div className="task-main">
        {isCooking?<CookingStepSummary task={task} forecast={forecast} activePhase={activePhase}/>:<>
        <div className="between"><strong>{task.title}</strong><time dateTime={task.scheduledAt??undefined}>{task.scheduledAt?formatted(task.scheduledAt):"Start time not set"}</time></div>
        {onDurationChange && <div className="inline-step-duration">
          <label htmlFor={editorId+'-duration'}>Estimated duration</label>
          <div><input id={editorId+'-duration'} aria-label="Estimated duration (minutes)" type="number" inputMode="decimal" min="0" max="43200" step="any" placeholder="Unknown" value={task.durationMinutes??''} disabled={editing||durationDisabled} aria-invalid={!!durationError} aria-describedby={durationError?editorId+'-duration-error':undefined} onChange={e=>{
            const value=e.target.value,minutes=value===''?null:Number(value);
            if(e.target.validity.badInput||(minutes!==null&&(!Number.isFinite(minutes)||minutes<0||minutes>43200))){setDurationError('Enter 0–43200 minutes, or clear for unknown.');return;}
            setDurationError('');onDurationChange(minutes);
          }}/><span>min</span></div>
          {durationError && <p id={editorId+'-duration-error'} className="form-error" role="alert">{durationError}</p>}
        </div>}
        {onDurationChange ? (task.timingMode==='fixed'||estimatedFinish(task)) && <p className="planned-step-details">{task.timingMode==='fixed'?'Fixed start · ':''}{estimatedFinish(task)?'Estimated finish '+formatted(estimatedFinish(task)!):'Duration unknown'}</p> : (showTimingDetails || task.durationMinutes != null || !task.scheduledAt || task.timingMode === "fixed") && <p className="planned-step-details">{task.timingMode === "fixed" ? "Fixed time · " : ""}{task.durationMinutes != null ? "Estimated "+formatDuration(task.durationMinutes) : showTimingDetails&&task.id.endsWith(':serve')?"Serving milestone":"Duration unknown"}{estimatedFinish(task) ? " · Estimated finish "+formatted(estimatedFinish(task)!) : ""}</p>}
        {!task.scheduledAt && (!onDurationChange||task.timingMode==='unscheduled') && <p className="muted small">{task.timingMode==='unscheduled'?'Left unscheduled. Choose a planned start when ready.':hasServeTarget?'Confirm missing step durations or set a fixed start.':'Set serving time or a fixed start.'}</p>}
        {(task.equipment !== task.baseEquipment || task.targetTempF != null) && <p className="planned-step-details">{[task.equipment !== task.baseEquipment ? task.equipment || "Equipment unspecified" : "", task.targetTempF != null ? "Target "+task.targetTempF+"°F (planned)" : ""].filter(Boolean).join(" · ")}</p>}
        {!!task.scheduleAdjustmentMinutes && <p className="planned-step-details">Follows adjusted dish timing</p>}
        {!compact && <p className="task-dish">{task.dishName}</p>}
        {visibleInstructions && !(onDurationChange&&visibleInstructions==='Imported recipe step. Confirm instructions and timing.') && <p className="muted small">{visibleInstructions}</p>}
        {task.isCondition && <span className="condition">Verify actual conditions</span>}
        {started && <p className="step-event">Started {formatted(started.occurredAt)}</p>}
        {completedAt && <p className="completed-time"><Icon name="check"/> Completed {formatted(completedAt)}</p>}
        </>}
      </div>
    </div>
    {isCooking&&alsoCooking.length>0&&<p className="also-cooking">Also cooking: {alsoCooking.join(' · ')}</p>}
    <DetailContainer className={isCooking?"cooking-step-details":undefined} {...(isCooking?{open:detailsOpen||editing||logging||startFormOpen,onToggle:(e:React.SyntheticEvent<HTMLElement>)=>setDetailsOpen((e.currentTarget as HTMLDetailsElement).open)}:{})}>
    {isCooking&&<><summary>Step details</summary>
      <div className="step-optional-records" aria-label="Optional step records">
        <p className="muted small">Optional timing and readings. Checking this step does not mean a cooking or resting interval has elapsed.</p>
        <div className="cooking-step-actions">
          {phase&&!started&&<button type="button" className="button secondary" disabled={editing||logging||startFormOpen} onClick={()=>onEvent("started")}>Record actual start now</button>}
          {phase&&<button type="button" className="button secondary" disabled={editing||logging} onClick={()=>{
            setStartFormOpen(v=>!v);
            setStartTime(localDateTimeInput(started?.occurredAt??new Date().toISOString()));
            setStartError("");
          }} aria-expanded={startFormOpen}>{startFormOpen?"Cancel start time edit":started?"Correct actual start time":"Enter actual start time"}</button>}
          <button type="button" className="button secondary" disabled={editing||startFormOpen} onClick={()=>{setLogging(v=>!v);setDetailsOpen(true);setError("");}} aria-expanded={logging}>{logging?"Close logging":"+ Log temperature"}</button>
        </div>
        {startFormOpen&&<div className="reading-form">
          <label htmlFor={editorId+"-actual-start"}>Actual start date and time</label>
          <input id={editorId+"-actual-start"} type="datetime-local" value={startTime} onChange={e=>{setStartTime(e.target.value);setStartError("");}} aria-invalid={!!startError} aria-describedby={startError?editorId+"-start-error":undefined}/>
          {startError&&<p className="form-error" id={editorId+"-start-error"} role="alert">{startError}</p>}
          <button type="button" className="button primary" onClick={saveActualStart}>Save actual start</button>
        </div>}
        {onRemainingEstimate&&<form className="remaining-estimate" onSubmit={e=>{e.preventDefault();const n=Number(remainingEstimate);if(!remainingEstimate||!Number.isFinite(n)||n<0||n>43200){setError('Enter a valid remaining estimate.');return;}onRemainingEstimate(n);setRemainingEstimate('');setError('');}}>
          <label htmlFor={editorId+'-remaining'}>Remaining estimate (minutes, optional)</label><input id={editorId+'-remaining'} type="number" min="0" max="43200" step="any" inputMode="decimal" value={remainingEstimate} onChange={e=>setRemainingEstimate(e.target.value)}/><div className="step-editor-actions"><button className="button primary" type="submit" disabled={!remainingEstimate.trim()}>Update estimate</button>{remainingEstimate.trim()&&<button className="button secondary" type="button" onClick={()=>{setRemainingEstimate('');setError('');}}>Cancel estimate</button>}</div>
        </form>}
      </div>{cookingTitle(task.title)!==task.title&&task.instructions!==task.title&&<p className="small">{task.title}</p>}<p className="small muted">{task.instructions}</p><p className="planned-step-details">{task.scheduledAt?<>Planned start <time aria-label="Planned start" dateTime={task.scheduledAt}>{formatted(task.scheduledAt)}</time></>:"No planned start"}{estimatedFinish(task)?" · Planned finish "+formatted(estimatedFinish(task)!):""}</p>{forecast?.reason&&<p className="small muted">{forecast.reason}</p>}{forecast?.template?.at&&forecast.template.kind==='checkpoint'&&<p className="small muted"><StepForecastTime forecast={forecast} part="start"/></p>}<p className="small muted">{task.equipment}{task.targetTempF!=null?" · Target "+task.targetTempF+"°F (planned)":""}</p>{started&&<p className="step-event">Started {formatted(started.occurredAt)}</p>}{completedAt&&<p className="completed-time">Completed {formatted(completedAt)}</p>}</>}
    <div className="task-actions" aria-label={"Manage "+task.title}>
      {!editing && <button type="button" id={editorId+"-trigger"} disabled={logging||durationDisabled} onClick={() => onEditingChange(true)} aria-expanded={false}>Edit</button>}

      {!isCooking && <div className="step-move-controls" role="group" aria-label="Step order"><span aria-hidden="true">Move</span>
        <button type="button" onClick={()=>{const error=onMove("up");setMoveError(error||"");if(error)return;setMoveNotice(`${task.title} moved to step ${index} of ${count}.`);}} disabled={editing||durationDisabled||index===0} aria-label={"Move "+task.title+" up"} title="Move up"><Icon name="arrow-up"/></button>
        <button type="button" onClick={()=>{const error=onMove("down");setMoveError(error||"");if(error)return;setMoveNotice(`${task.title} moved to step ${index+2} of ${count}.`);}} disabled={editing||durationDisabled||index===count-1} aria-label={"Move "+task.title+" down"} title="Move down"><Icon name="arrow-down"/></button>
      </div>}
      <RemoveButton className="step-remove" label={"Remove step: "+task.title} disabled={editing||logging||durationDisabled} onClick={()=>{
        if(window.confirm("Remove this step from the checklist? Any recorded activity will be retained in the cook history."))onRemove();
      }}/>

    </div>
    {!isCooking && <span className="sr-only" role="status">{moveNotice}</span>}
    {moveError&&<p className="small" role="alert">{moveError}</p>}
    {editing && <StepEditor task={task} onSave={(title,instructions,details)=>{onEdit(title,instructions,details);onEditingChange(false);requestAnimationFrame(()=>document.getElementById(editorId+"-trigger")?.focus({preventScroll:true}));}} onCancel={()=>{onEditingChange(false);requestAnimationFrame(()=>document.getElementById(editorId+"-trigger")?.focus());}}/>}
    {isCooking && <>
      {logging && <div className="reading-form">
        <div>
          <label htmlFor={"reading-kind-"+task.id}>Reading type</label>
          <select id={"reading-kind-"+task.id} value={readingType} onChange={e=>setReadingType(e.target.value as "temperature"|"equipment")}>
            <option value="temperature">Meat / food temperature</option>
            <option value="equipment">Equipment setting / change</option>
          </select>
        </div>
        <div className="reading-fields">
          <div><label htmlFor={"reading-temp-"+task.id}>{readingType==="equipment"?"Setpoint (optional)":"Food temperature"}</label>
          <input type="number" inputMode="decimal" min={1} max={unit==="°F"?600:300} id={"reading-temp-"+task.id} value={reading} onChange={e=>setReading(e.target.value)} placeholder="e.g. 169"/></div>
          <div><label htmlFor={"reading-unit-"+task.id}>Unit</label>
          <select id={"reading-unit-"+task.id} value={unit} onChange={e=>setUnit(e.target.value as "°F"|"°C")}><option value="°F">°F</option><option value="°C">°C</option></select></div>
        </div>
        <label htmlFor={"reading-note-"+task.id}>Location / details (optional)</label>
        <input id={"reading-note-"+task.id} maxLength={500} value={readingNote} onChange={e=>setReadingNote(e.target.value)} placeholder={readingType==="temperature"?"Flat, thickest part...":"Pit set to 250, switched to Smoke mode..."}/>
        <button type="button" className="button primary" onClick={handleReading}>Save timestamped reading</button>
      </div>}
      <label className="note-label" htmlFor={"note-"+task.id}>Quick notes</label>
      <input id={"note-"+task.id} className="task-note" maxLength={500} placeholder="Bark looks good, wrapped in paper..." value={note} onChange={e=>onNote(e.target.value)}/>
      {activity.length>0 && <details className="task-activity"><summary>Activity ({activity.length}{events.filter(e=>e.taskId===task.id&&e.kind!=="removed").length>8?"+":""})</summary>
        <ul>{activity.map(e=><li key={e.id}>
          <time>{formatted(e.occurredAt)}</time> · {e.kind==="temperature"?"Food temp":e.kind==="equipment"?"Equipment setting":e.kind==="reopened"?"Reopened":e.kind==="completed"?"Completed":"Started"}
          {e.value!==undefined?" "+e.value+(e.unit||""):""}{e.note?" · "+e.note:""}
        </li>)}</ul>
      </details>}
    </>}
    </DetailContainer>
    {error && <p className="form-error" role="alert">{error}</p>}
  </article>;
}
