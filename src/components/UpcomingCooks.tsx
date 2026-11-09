'use client';
import {useState} from 'react';
import type {Meal} from '@/domain/meal';
import {cookTimeline} from '@/domain/cookState';
import {planningReadiness} from '@/domain/planningReadiness';
import type {ExtendedMeal} from '@/domain/cookState';
type Plan={id:string;meal:Meal;revision:number;legacy?:boolean;pending?:boolean};
export default function UpcomingCooks({plans,active,busy,onOpen,onStart,loading,onCreate}:{onCreate:()=>Promise<void>;loading:boolean;plans:Plan[];active:boolean;busy:boolean;onOpen:(id:string)=>Promise<void>;onStart:(id:string)=>Promise<void>}){
 const [error,setError]=useState(''),[working,setWorking]=useState(false);
 const act=async(fn:()=>Promise<void>)=>{setWorking(true);setError('');try{await fn();}catch{setError('Could not update this plan. Please try again.');}finally{setWorking(false);}};
 return <section className="panel upcoming-cooks" aria-label="Upcoming cooks">
  <div className="between"><h3>Upcoming cooks</h3><button type="button" className="button secondary" disabled={busy||working} onClick={()=>void act(onCreate)}>Plan another cook</button></div>
  {loading?<p role="status">Loading upcoming plans…</p>:plans.length===0?<p className="muted">Your saved future meals will appear here.</p>:<ul className="upcoming-cook-list">{plans.map(plan=>{
   const date=new Date(plan.meal.serveAt),when=Number.isFinite(date.getTime())?date.toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Serving time not set';
   const start=planningReadiness(plan.meal,cookTimeline(plan.meal),Date.now())?.startAt;
   return <li key={plan.id} aria-label={plan.meal.name||'Untitled cook'}><h4>{plan.meal.name||'Untitled cook'}</h4>{start&&<p className="small">Start preparing <time dateTime={start}>{new Date(start).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</time></p>}<p className="muted small">Serve <time dateTime={Number.isFinite(date.getTime())?date.toISOString():undefined}>{when}</time></p>
    <div className="upcoming-cook-actions"><button className="button secondary" type="button" disabled={busy||working} onClick={()=>void act(()=>onOpen(plan.id))}>Edit plan</button>{!active&&!plan.pending&&<button className="button primary" type="button" disabled={busy||working||!plan.meal.dishes.length&&!((plan.meal as ExtendedMeal).customTasks?.length)} onClick={()=>void act(()=>onStart(plan.id))}>Start cooking</button>}</div>
   </li>;
  })}</ul>}
  {active&&plans.length>0&&<p className="muted small">You can edit future plans while cooking. Finish or cancel the current cook before starting another.</p>}
  {error&&<p className="form-error" role="alert">{error}</p>}
 </section>;
}
