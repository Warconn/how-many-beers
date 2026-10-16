"use client";

import {useEffect, useState} from "react";
import type {PlannedTask} from "@/domain/meal";
import type {CookEvent, CookEventKind} from "@/domain/cookState";
import {latestStartedEvent} from "@/domain/cookState";

type Props = {
  task: PlannedTask;
  index: number;
  count: number;
  isNext?: boolean;
  mode: "planning" | "cooking";
  completedAt?: string;
  events: CookEvent[];
  note: string;
  onNote: (value:string)=>void;
  onEdit: (title:string, instructions:string)=>void;
  onMove: (direction:"up"|"down")=>void;
  onRemove: ()=>void;
  onEvent: (kind:CookEventKind,value?:number,unit?:"°F"|"°C",note?:string)=>void;
};

function formatted(iso:string):string {
  const date=new Date(iso);
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
}

export default function TaskRow({
  task,index,count,isNext=false,mode,completedAt,events,note,onNote,onEdit,onMove,onRemove,onEvent
}:Props) {
  const [editing,setEditing]=useState(false);
  const [title,setTitle]=useState(task.title);
  const [instructions,setInstructions]=useState(task.instructions);
  const [logging,setLogging]=useState(false);
  const [readingType,setReadingType]=useState<"temperature"|"equipment">("temperature");
  const [reading,setReading]=useState("");
  const [unit,setUnit]=useState<"°F"|"°C">("°F");
  const [readingNote,setReadingNote]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{if(!editing){setTitle(task.title);setInstructions(task.instructions);}},[task.title,task.instructions,editing]);

  const done=!!completedAt;
  const started=latestStartedEvent(events,task.id);
  const activity=events.filter(e=>e.taskId===task.id && e.kind!=="removed").slice(-8).reverse();
  const isCooking=mode==="cooking";

  const handleSave=()=>{
    if(!title.trim()){setError("Please enter a task title.");return;}
    if(title.trim().length>160){setError("Keep titles under 160 characters.");return;}
    onEdit(title,instructions);setEditing(false);setError("");
  };
  const handleReading=()=>{
    const num=Number(reading);
    if(!reading.trim() || !Number.isFinite(num) || num<=0 || num>(unit==="°F"?600:300)){
      setError("Enter a valid temperature before saving.");return;
    }
    onEvent(readingType,num,unit,readingNote);
    setReading("");setReadingNote("");setLogging(false);setError("");
  };

  return <article className={"task cook-task "+(done?"done ":"")+(isNext && isCooking ? "first-task":"")} aria-label={task.title}>
    <div className="task-top">
      {isCooking && <input aria-label={"Complete "+task.title} type="checkbox" checked={done}
        onChange={e=>onEvent(e.target.checked?"completed":"reopened")}/>}
      {!isCooking && <span className="preview-index" aria-hidden>{index+1}</span>}
      <div className="task-main">
        {isNext && isCooking && <p className="eyebrow next-label">DO THIS NEXT</p>}
        <div className="between"><strong>{task.title}</strong><time>{task.scheduledAt ? formatted(task.scheduledAt) : "Timing TBD"}</time></div>
        <p className="task-dish">{task.dishName}</p>
        {task.instructions && <p className="muted small">{task.instructions}</p>}
        {task.isCondition && <span className="condition">Verify actual conditions</span>}
        {started && <p className="step-event">Started {formatted(started.occurredAt)}</p>}
        {completedAt && <p className="completed-time">✓ Completed {formatted(completedAt)}</p>}
      </div>
    </div>
    <div className="task-actions" aria-label={"Manage "+task.title}>
      <button type="button" onClick={()=>{setEditing(v=>!v);setError("");}} aria-expanded={editing}>{editing?"Cancel edit":"Edit"}</button>
      <button type="button" onClick={()=>onMove("up")} disabled={index===0} aria-label={"Move "+task.title+" up"} title="Move up">↑</button>
      <button type="button" onClick={()=>onMove("down")} disabled={index===count-1} aria-label={"Move "+task.title+" down"} title="Move down">↓</button>
      <button type="button" className="danger" onClick={()=>{
        if(window.confirm("Remove this step from the checklist? Any recorded activity will be retained in the cook history."))onRemove();
      }}>Remove</button>
    </div>
    {editing && <div className="task-editor">
      <label htmlFor={"edit-title-"+task.id}>Task name</label>
      <input id={"edit-title-"+task.id} value={title} maxLength={160} onChange={e=>setTitle(e.target.value)}/>
      <label htmlFor={"edit-instructions-"+task.id}>Instructions</label>
      <textarea id={"edit-instructions-"+task.id} value={instructions} maxLength={500} rows={3} onChange={e=>setInstructions(e.target.value)}/>
      <button type="button" className="button secondary" onClick={handleSave}>Save changes</button>
    </div>}
    {isCooking && <>
      <div className="task-actions task-logging-actions">
        {!done && !started && <button type="button" onClick={()=>onEvent("started")}>▶ Start step</button>}
        <button type="button" onClick={()=>{setLogging(v=>!v);setError("");}} aria-expanded={logging}>
          {logging?"Cancel reading":"+ Log temperature"}
        </button>
      </div>
      {logging && <div className="reading-form">
        <div>
          <label htmlFor={"reading-kind-"+task.id}>Reading type</label>
          <select id={"reading-kind-"+task.id} value={readingType} onChange={e=>setReadingType(e.target.value as "temperature"|"equipment")}>
            <option value="temperature">Meat / food temperature</option>
            <option value="equipment">Smoker / oven setting</option>
          </select>
        </div>
        <div className="reading-fields">
          <div><label htmlFor={"reading-temp-"+task.id}>Temperature</label>
          <input type="number" inputMode="decimal" min={1} max={unit==="°F"?600:300} id={"reading-temp-"+task.id} value={reading} onChange={e=>setReading(e.target.value)} placeholder="e.g. 169"/></div>
          <div><label htmlFor={"reading-unit-"+task.id}>Unit</label>
          <select id={"reading-unit-"+task.id} value={unit} onChange={e=>setUnit(e.target.value as "°F"|"°C")}><option value="°F">°F</option><option value="°C">°C</option></select></div>
        </div>
        <label htmlFor={"reading-note-"+task.id}>Location / details (optional)</label>
        <input id={"reading-note-"+task.id} maxLength={500} value={readingNote} onChange={e=>setReadingNote(e.target.value)} placeholder={readingType==="temperature"?"Flat, thickest part...":"Pit set to 250..."}/>
        <button type="button" className="button primary" onClick={handleReading}>Save timestamped reading</button>
      </div>}
      <label className="note-label" htmlFor={"note-"+task.id}>Quick notes</label>
      <input id={"note-"+task.id} className="task-note" maxLength={500} placeholder="Bark looks good, wrapped in paper..." value={note} onChange={e=>onNote(e.target.value)}/>
      {activity.length>0 && <details className="task-activity"><summary>Activity ({activity.length}{events.filter(e=>e.taskId===task.id&&e.kind!=="removed").length>8?"+":""})</summary>
        <ul>{activity.map(e=><li key={e.id}>
          <time>{formatted(e.occurredAt)}</time> · {e.kind==="temperature"?"Food temp":e.kind==="equipment"?"Equipment temp":e.kind==="reopened"?"Reopened":e.kind==="completed"?"Completed":"Started"}
          {e.value!==undefined?" "+e.value+(e.unit||""):""}{e.note?" · "+e.note:""}
        </li>)}</ul>
      </details>}
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </article>;
}
