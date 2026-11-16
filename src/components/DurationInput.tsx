'use client';
import {useState} from 'react';

/** Unit selection changes presentation only. Stored minutes stay exact. */
export default function DurationInput({minutes,onChange,label='Estimated duration',hintMinutes}:{minutes:number|null;onChange:(minutes:number|null)=>void;label?:string;hintMinutes?:number}){
 const initial=minutes??hintMinutes??null;
 const [unit,setUnit]=useState<'minutes'|'hours'>(initial!==null&&initial>=120&&initial%60===0?'hours':'minutes');
 return <div className="duration-controls">
  <label>Duration<input aria-label={`${label} (${unit})`} type="number" min="0" max={unit==='hours'?720:43200} step="any" value={minutes===null?'':Number.isFinite(minutes)?String(minutes/(unit==='hours'?60:1)):''} placeholder={hintMinutes===undefined?'Unknown':String(hintMinutes/(unit==='hours'?60:1))} onChange={e=>onChange(e.target.value===''?null:Number(e.target.value)*(unit==='hours'?60:1))}/></label>
  <label>Unit<select aria-label="Duration unit" value={unit} onChange={e=>setUnit(e.target.value as 'minutes'|'hours')}><option value="minutes">Minutes</option><option value="hours">Hours</option></select></label>
 </div>;
}
