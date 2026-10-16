"use client";

import {useState} from "react";

export default function AddStepForm({
  onAdd,
  compact=false
}:{
  onAdd:(title:string,instructions:string,scheduledAt:string|null)=>void;
  compact?:boolean;
}){
  const [open,setOpen]=useState(false);
  const [title,setTitle]=useState("");
  const [instructions,setInstructions]=useState("");
  const [localTime,setLocalTime]=useState("");
  const [error,setError]=useState("");

  return <section className={"add-step-block "+(compact?"compact":"")}>
    <button type="button" className="add-step-trigger" aria-expanded={open} onClick={()=>{setOpen(v=>!v);setError("");}}>
      <span>+ Add a checklist step</span><span aria-hidden>{open?"−":"+"}</span>
    </button>
    {open && <form className="add-step-form" onSubmit={e=>{
      e.preventDefault();
      if(!title.trim() || title.trim().length>160){setError("Enter a step title up to 160 characters.");return;}
      if(localTime && Number.isNaN(new Date(localTime).getTime())){setError("Choose a valid scheduled time.");return;}
      onAdd(title,instructions,localTime ? new Date(localTime).toISOString() : null);
      setTitle("");setInstructions("");setLocalTime("");setError("");setOpen(false);
    }}>
      <label htmlFor={compact?"cook-new-title":"plan-new-title"}>Step title</label>
      <input id={compact?"cook-new-title":"plan-new-title"} required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Make the sauce"/>
      <label htmlFor={compact?"cook-new-detail":"plan-new-detail"}>Instructions (optional)</label>
      <textarea id={compact?"cook-new-detail":"plan-new-detail"} maxLength={500} rows={2} value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="What needs to happen?"/>
      <label htmlFor={compact?"cook-new-time":"plan-new-time"}>Planned time (optional)</label>
      <input type="datetime-local" id={compact?"cook-new-time":"plan-new-time"} value={localTime} onChange={e=>setLocalTime(e.target.value)}/>
      <p className="muted small">Leave timing blank for an unscheduled step. You can reorder it afterward.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button type="submit" className="button primary">Add step</button>
    </form>}
  </section>;
}
