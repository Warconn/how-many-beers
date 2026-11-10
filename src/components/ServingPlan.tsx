'use client';
import Icon from './Icon';
import type {Meal} from '@/domain/meal';
export default function ServingPlan({meal,hasSteps,startAt,readyAt,lateMinutes,suggestion,now,onServe,onName,onSuggestion,onDiscard,discardDisabled}:{onDiscard?:()=>void;discardDisabled?:boolean;meal:Meal;hasSteps:boolean;startAt:string|null;readyAt:string|null;lateMinutes:number;suggestion:string|null;now:number;onServe:(value:string)=>void;onName:(value:string)=>void;onSuggestion:()=>void}){
 const formatted=(value:string,showDate=false)=>new Date(value).toLocaleString([],showDate?{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}:new Date(value).toDateString()===new Date(now).toDateString()?{hour:'numeric',minute:'2-digit'}:{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 return <section className="serving-plan panel" aria-label="Serving plan">
  <div className="serving-plan-heading"><h2>What time are we eating?</h2>{onDiscard&&<button type="button" className="plan-trash" aria-label="Discard plan" title="Discard plan" disabled={discardDisabled} onClick={onDiscard}><Icon name="trash"/></button>}</div>
  <div className="serving-plan-fields">
   <div><label htmlFor="serve-at">Serve date and time</label><input id="serve-at" type="datetime-local" value={meal.serveAt} onChange={e=>onServe(e.target.value)}/></div>
   <div><label htmlFor="meal-name">Meal name</label><input id="meal-name" value={meal.name} maxLength={80} onChange={e=>onName(e.target.value)}/></div>
  </div>
  {hasSteps&&<div className="planning-readiness" aria-live="polite"><div className="planning-timing">
   {meal.mode==='cooking'||meal.startedAt?<p>Cooking in progress</p>:<p>{startAt?<><span>Start preparing </span><time aria-label="Estimated start" dateTime={startAt}>{formatted(startAt,true)}</time></>:<span>Timing needed</span>}</p>}
   {lateMinutes>0&&readyAt&&<p><span>Estimated meal ready </span><time aria-label="Estimated meal ready" dateTime={readyAt}>{formatted(readyAt)}</time><small> (+{lateMinutes} min)</small></p>}
  </div>{suggestion&&<button type="button" className="button secondary" onClick={onSuggestion}>Use {formatted(suggestion)}</button>}</div>}

 </section>;
}
