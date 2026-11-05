'use client';
import {useRef,useState} from 'react';
import type {Meal} from '@/domain/meal';
import type {ExtendedMeal} from '@/domain/cookState';
import {MAX_BACKUP_BYTES} from '@/domain/cookHistory';
type Plan={id:string;meal:Meal;revision:number;legacy?:boolean;pending?:boolean};
export default function UpcomingCooks({plans,active,busy,onOpen,onStart,onExport,onImport,loading,onCreate}:{onCreate:()=>Promise<void>;loading:boolean;plans:Plan[];active:boolean;busy:boolean;onOpen:(id:string)=>Promise<void>;onStart:(id:string)=>Promise<void>;onExport:()=>Promise<string>;onImport:(text:string)=>Promise<void>}){
 const upload=useRef<HTMLInputElement>(null),[error,setError]=useState(''),[working,setWorking]=useState(false);
 const act=async(fn:()=>Promise<void>,backup=false)=>{setWorking(true);setError('');try{await fn();}catch{if(backup)setError('The backup could not be completed. Your existing cooks and plans are unchanged.');}finally{setWorking(false);}};
 return <section className="panel upcoming-cooks" aria-label="Upcoming cooks">
  <div className="between"><h3>Upcoming cooks</h3><button type="button" className="button secondary" disabled={busy||working} onClick={()=>void act(onCreate)}>Plan another cook</button></div>
  {loading?<p role="status">Loading upcoming plans…</p>:plans.length===0?<p className="muted">Your saved future meals will appear here.</p>:<ul className="upcoming-cook-list">{plans.map(plan=>{
   const date=new Date(plan.meal.serveAt),when=Number.isFinite(date.getTime())?date.toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Serving time not set';
   return <li key={plan.id} aria-label={plan.meal.name||'Untitled cook'}><h4>{plan.meal.name||'Untitled cook'}</h4><p className="muted small">{when} · {plan.meal.dishes.length} {plan.meal.dishes.length===1?'dish':'dishes'}</p>
    <div className="upcoming-cook-actions"><button className="button secondary" type="button" disabled={busy||working} onClick={()=>void act(()=>onOpen(plan.id))}>Edit plan</button>{!active&&!plan.pending&&<button className="button primary" type="button" disabled={busy||working||!plan.meal.dishes.length&&!((plan.meal as ExtendedMeal).customTasks?.length)} onClick={()=>void act(()=>onStart(plan.id))}>Start cooking</button>}</div>
   </li>;
  })}</ul>}
  {active&&plans.length>0&&<p className="muted small">You can edit future plans while cooking. Finish or cancel the current cook before starting another.</p>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  <details className="upcoming-backups"><summary>Upcoming plan backups</summary><p className="muted small">This backup contains future plans. Current cooks and completed history use their separate backup in Past cooks and backups.</p><div className="upcoming-cook-actions">
   <button type="button" className="button secondary" disabled={busy||working} onClick={()=>void act(async()=>{const text=await onExport(),blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='how-many-beers-upcoming-plans-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);},true)}>Download upcoming plans</button>
   <button type="button" className="button secondary" disabled={busy||working} onClick={()=>upload.current?.click()}>Restore upcoming plans</button>
   <input ref={upload} className="sr-only" type="file" accept=".json,application/json" aria-label="Restore upcoming plans" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;await act(async()=>{if(file.size>MAX_BACKUP_BYTES)throw Error('Backup is too large (32 MB maximum).');if(!window.confirm('Import upcoming plans? Your current cook and completed history will not change. Conflicting plans will not be overwritten.'))return;await onImport(await file.text());},true);}}/>
  </div></details>
 </section>;
}
