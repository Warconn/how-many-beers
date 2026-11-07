'use client';
import type {Meal} from '@/domain/meal';
export default function ServingPlan({meal,hasSteps,readyAt,lateMinutes,suggestion,now,onServe,onName,onSuggestion}:{meal:Meal;hasSteps:boolean;readyAt:string|null;lateMinutes:number;suggestion:string|null;now:number;onServe:(value:string)=>void;onName:(value:string)=>void;onSuggestion:()=>void}){
 const formatted=(value:string)=>new Date(value).toLocaleString([],new Date(value).toDateString()===new Date(now).toDateString()?{hour:'numeric',minute:'2-digit'}:{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 return <section className="serving-plan panel" aria-label="Serving plan">
  <h2>What time are we eating?</h2>
  <div className="serving-plan-fields">
   <div><label htmlFor="serve-at">Serve date and time</label><input id="serve-at" type="datetime-local" value={meal.serveAt} onChange={e=>onServe(e.target.value)}/></div>
   <div><label htmlFor="meal-name">Meal name</label><input id="meal-name" value={meal.name} maxLength={80} onChange={e=>onName(e.target.value)}/></div>
  </div>
  {hasSteps&&<div className="planning-readiness" aria-live="polite"><div><span>Estimated meal ready </span>{readyAt?<><time aria-label="Estimated meal ready" dateTime={readyAt}>{formatted(readyAt)}</time>{lateMinutes>0&&<small> (+{lateMinutes} min)</small>}</>:<span>Timing needed</span>}</div>
   {suggestion&&<button type="button" className="button secondary" onClick={onSuggestion}>Use {formatted(suggestion)}</button>}
  </div>}
 </section>;
}
