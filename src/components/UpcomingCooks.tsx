'use client';
import {useState} from 'react';
import Icon from './Icon';
import type {Meal} from '@/domain/meal';
import {cookTimeline} from '@/domain/cookState';
import {planningReadiness} from '@/domain/planningReadiness';
import type {ExtendedMeal} from '@/domain/cookState';
type Plan={id:string;meal:Meal;revision:number;legacy?:boolean;pending?:boolean};
export default function UpcomingCooks({plans,active,busy,onOpen,onStart,onDiscard,loading,onCreate}:{onDiscard:(id:string)=>Promise<void>;onCreate:()=>Promise<void>;loading:boolean;plans:Plan[];active:boolean;busy:boolean;onOpen:(id:string)=>Promise<void>;onStart:(id:string)=>Promise<void>}){
 const [failedPlan,setFailedPlan]=useState<string|null>(null),[error,setError]=useState(''),[working,setWorking]=useState(false);
 const act=async(fn:()=>Promise<void>,id:string|null=null)=>{setFailedPlan(id);setWorking(true);setError('');try{await fn();}catch{setError('Could not update this plan. Please try again.');}finally{setWorking(false);}};
 const create=<button type="button" className={plans.length?'button secondary':'button primary'} disabled={busy||working} onClick={()=>void act(onCreate)}>Plan a cook</button>;
 if(!loading&&!plans.length)return <section className="home-new" aria-label="Plan a cook">{create}{error&&!failedPlan&&<p className="form-error" role="alert">{error}</p>}</section>;
 return <section className="panel upcoming-cooks" aria-label="Upcoming cooks">
  <div className="between"><h3>Upcoming cooks</h3>{create}</div>
  {loading?<p role="status">Loading upcoming plans…</p>:<ul className="upcoming-cook-list">{plans.map(plan=>{
   const date=new Date(plan.meal.serveAt),when=Number.isFinite(date.getTime())?date.toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Serving time not set';
   const start=planningReadiness(plan.meal,cookTimeline(plan.meal),Date.now())?.startAt;
   return <li key={plan.id} aria-label={plan.meal.name||'Untitled cook'}><div className="upcoming-plan-heading"><h4>{plan.meal.name||'Untitled cook'}</h4><button type="button" className="plan-trash" aria-label="Discard plan" title="Discard plan" disabled={busy||working} onClick={()=>void act(()=>onDiscard(plan.id),plan.id)}><Icon name="trash"/></button></div>{start&&<p className="small">Start preparing <time dateTime={start}>{new Date(start).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</time></p>}<p className="muted small">Serve <time dateTime={Number.isFinite(date.getTime())?date.toISOString():undefined}>{when}</time></p>
    <div className="upcoming-cook-actions"><button className="button secondary" type="button" disabled={busy||working} onClick={()=>void act(()=>onOpen(plan.id))}>Edit plan</button>{!active&&!plan.pending&&<button className="button primary" type="button" disabled={busy||working||!plan.meal.dishes.length&&!((plan.meal as ExtendedMeal).customTasks?.length)} onClick={()=>void act(()=>onStart(plan.id))}>Start cooking</button>}</div>
   </li>;
  })}</ul>}
  {active&&plans.length>0&&<p className="muted small">You can edit future plans while cooking. Finish or cancel the current cook before starting another.</p>}
  {error&&(!failedPlan||plans.some(plan=>plan.id===failedPlan))&&<p className="form-error" role="alert">{error}</p>}
 </section>;
}
