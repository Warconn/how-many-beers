'use client';
import {useState,useId} from 'react';
import type {PlannedTask} from '@/domain/meal';
import type {CookEventKind} from '@/domain/cookState';
import type {LivePhase} from '@/domain/phaseForecast';
import {activityStages,phaseStage} from '@/domain/activities';

export default function ActivityReadingForm({task,activities,onSave,onCancel}:{task:PlannedTask;activities:LivePhase[];onSave:(kind:CookEventKind,value:number|undefined,unit:'°F'|'°C'|undefined,note:string,activityId:string|undefined,noteOnly:boolean)=>void;onCancel:()=>void}){
 const id=useId();
 const active=activities.filter(p=>p.active),choices=active.length?active:activities;
 const [type,setType]=useState<'temperature'|'equipment'|'note'>(choices.length===1&&phaseStage(choices[0])==='preheating'?'equipment':'temperature'),[value,setValue]=useState(''),[unit,setUnit]=useState<'°F'|'°C'>('°F'),[note,setNote]=useState(''),[activity,setActivity]=useState(choices.length===1?choices[0].id:''),[error,setError]=useState('');
 return <form className="reading-form inline-activity-reading" aria-label={'Record reading for '+task.title} onSubmit={e=>{
  e.preventDefault();const n=value.trim()?Number(value):undefined;
  if(type!=='note'&&(type==='temperature'&&n===undefined||n!==undefined&&(!Number.isFinite(n)||n<=0||n>(unit==='°F'?600:300)))){setError('Enter a valid temperature.');return;}
  if((type==='note'||type==='equipment'&&n===undefined)&&!note.trim()){setError('Enter an observation.');return;}
  if(choices.length>1&&!activity){setError('Choose the activity for this reading.');return;}
  try{onSave(type==='note'?'equipment':type,type==='note'?undefined:n,type==='note'||n===undefined?undefined:unit,note,activity||undefined,type==='note');}catch(e){setError(e instanceof Error?e.message:'Could not record this reading.');}
 }}>
  {choices.length>1&&<div><label htmlFor={id+'-activity'}>Activity</label><select id={id+'-activity'} value={activity} onChange={e=>setActivity(e.target.value)}><option value="">Choose activity</option>{choices.map(p=><option key={p.id} value={p.id}>{activityStages[phaseStage(p)??'cooking']} · {p.startTitle??'Activity start'}</option>)}</select></div>}
  <div><label htmlFor={id+'-type'}>Reading type</label><select id={id+'-type'} value={type} onChange={e=>setType(e.target.value as typeof type)}><option value="temperature">Meat / food temperature</option><option value="equipment">Equipment temperature / change</option><option value="note">Observation / note</option></select></div>
  {type!=='note'&&<div className="reading-fields"><label>{type==='equipment'?'Equipment temperature (optional)':'Food temperature'}<input type="number" inputMode="decimal" min="1" max={unit==='°F'?600:300} value={value} onChange={e=>setValue(e.target.value)}/></label><div><label htmlFor={id+'-unit'}>Unit</label><select id={id+'-unit'} value={unit} onChange={e=>setUnit(e.target.value as typeof unit)}><option value="°F">°F</option><option value="°C">°C</option></select></div></div>}
  <label>{type==='note'?'Observation':'Location / details (optional)'}<input maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></label>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="method-review-actions"><button type="submit" className="button primary">Save timestamped reading</button><button type="button" className="button secondary" onClick={onCancel}>Cancel reading</button></div>
 </form>;
}
