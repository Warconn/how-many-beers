'use client';
import {useEffect,useId,useRef,useState} from 'react';
import type {ExtendedMeal} from '@/domain/cookState';
import {addStep,cookTimeline,editStep,removeStep,setStepDuration} from '@/domain/cookState';
import {formatDuration} from '@/domain/stepTiming';
import Icon from './Icon';
import {useRecipeReorder} from './useRecipeReorder';
import {reviewDuration} from '@/domain/recipeReview';

function StepInstructions({text}:{text:string}){
 const id=useId(),paragraph=useRef<HTMLParagraphElement>(null);
 const [expanded,setExpanded]=useState(false),[overflows,setOverflows]=useState(false);
 useEffect(()=>{
  const element=paragraph.current;if(!element)return;
  const measure=()=>setOverflows(element.scrollHeight>parseFloat(getComputedStyle(element).lineHeight)*5+1);
  const observer=new ResizeObserver(measure);observer.observe(element);measure();
  return()=>observer.disconnect();
 },[text]);
 return <div className="method-review-instructions"><p ref={paragraph} id={id} className={expanded?'':'instructions-preview'}>{text}</p>{overflows&&<button type="button" className="link" aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(v=>!v)}>{expanded?'Show less':'Show more'}</button>}</div>;
}

export default function RecipeMethodReview({meal,onChange,onAdd,onBack}:{meal:ExtendedMeal;onChange:(meal:ExtendedMeal)=>void;onAdd:()=>Promise<void>;onBack:()=>void}){
 const dish=meal.dishes[0],tasks=cookTimeline(meal),heading=useRef<HTMLHeadingElement>(null);
 const [editing,setEditing]=useState<string|null>(null),[title,setTitle]=useState(''),[instructions,setInstructions]=useState(''),[minutes,setMinutes]=useState(''),[error,setError]=useState(''),[adding,setAdding]=useState(false),[committing,setCommitting]=useState(false);
 const reorder=useRecipeReorder(meal,onChange,editing!==null||adding||committing);
 useEffect(()=>{heading.current?.focus();heading.current?.scrollIntoView({block:'start',behavior:'instant'});},[]);
 const change=(fn:()=>ExtendedMeal)=>{try{onChange(fn());setError('');}catch(e){setError(e instanceof Error?e.message:'Review this change.');}};
 return <section className="method-review" aria-label="Review your method" aria-busy={committing}><fieldset disabled={committing} className="method-review-fields">
  <h3 ref={heading} tabIndex={-1}>Review your method</h3><p className="muted small">Adjust the steps, then add this dish to your meal.</p>
  <div className="method-review-meta">
  <label>Recipe name<input value={dish.name} maxLength={80} onChange={e=>onChange({...meal,dishes:[{...dish,name:e.target.value}],customTasks:meal.customTasks?.map(t=>({...t,dishName:e.target.value}))})}/></label>
  <label>Equipment<input value={dish.equipment} maxLength={80} onChange={e=>onChange({...meal,dishes:[{...dish,equipment:e.target.value}]})}/></label>
  </div>
  <p id="recipe-reorder-help" className="sr-only">Drag a step by its grip, or focus the grip and use the up and down arrow keys.</p><p className="sr-only" role="status" aria-live="polite">{reorder.announcement}</p>
  <ol className="method-review-steps">{tasks.map(task=><li key={task.id} data-review-step={task.id} className={(reorder.dragging===task.id?'is-dragging ':'')+(reorder.drop?.id===task.id?(reorder.drop.after?'drop-after':'drop-before'):'')}>
   <div className="method-review-heading"><button type="button" className="step-drag-grip" data-review-grip={task.id} aria-label={'Move '+task.title} aria-describedby="recipe-reorder-help" title="Drag to reorder · Arrow keys to move" disabled={editing!==null||adding||committing} {...reorder.grip(task.id)}><Icon name="grip"/></button><div className="method-review-step-copy"><strong>{task.title}</strong><span>{task.isCondition?'Check when ready':task.id.endsWith(':serve')?'Serving':reviewDuration(meal,task)!=null?formatDuration(reviewDuration(meal,task)!):'Time unknown'}</span></div>{editing!==task.id&&(<button type="button" className="button secondary collapsed-step-edit" disabled={editing!==null||adding} aria-label={'Edit '+task.title} onClick={()=>{setTitle(task.title);setInstructions(task.instructions??'');setMinutes(reviewDuration(meal,task)==null?'':String(reviewDuration(meal,task)));setEditing(task.id);}}>Edit</button>)}</div>
   {editing===task.id?<form aria-label="Edit recipe step" onSubmit={e=>{e.preventDefault();try{let next=editStep(meal,task.id,title,instructions);if(!task.isCondition&&!task.id.endsWith(':serve')&&(minutes===''?null:Number(minutes))!==reviewDuration(meal,task))next=setStepDuration(next,task.id,minutes===''?null:Number(minutes));onChange(next);setEditing(null);setError('');}catch(err){setError(err instanceof Error?err.message:'Check this step.');}}}>
    <label>Step name<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>Instructions<textarea maxLength={500} rows={3} value={instructions} onChange={e=>setInstructions(e.target.value)}/></label>
    {!task.isCondition&&!task.id.endsWith(':serve')&&<label>Minutes<input type="number" inputMode="decimal" min={0} max={43200} step="any" placeholder="Unknown" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>}
    <div className="method-review-actions">     <button type="button" className="button secondary icon-button" aria-label={'Remove '+task.title} disabled={tasks.length===1||adding} onClick={()=>{change(()=>removeStep(meal,task.id,new Date().toISOString()));setEditing(null);}}><Icon name="trash"/></button><button type="submit" className="button primary">Save step</button><button type="button" className="button secondary" onClick={()=>{setEditing(null);setError('');}}>Cancel edit</button></div>
   </form>:<>
    {task.instructions&&task.instructions!==task.title&&<StepInstructions text={task.instructions}/>}

   </>}
  </li>)}</ol>
  {adding?<form aria-label="Add recipe step" onSubmit={e=>{e.preventDefault();try{let next=addStep(meal,title,instructions);const id=next.customTasks!.at(-1)!.id;next={...next,customTasks:next.customTasks?.map(t=>t.id===id?{...t,dishId:dish.id,dishName:dish.name}:t)};next=setStepDuration(next,id,minutes===''?null:Number(minutes));onChange(next);setAdding(false);setError('');}catch(err){setError(err instanceof Error?err.message:'Check this step.');}}}>
   <label>Step name<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Instructions<textarea rows={3} maxLength={500} value={instructions} onChange={e=>setInstructions(e.target.value)}/></label><label>Minutes<input type="number" min={0} max={43200} step="any" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>
   <div className="method-review-actions"><button className="button primary" type="submit">Save step</button><button className="button secondary" type="button" onClick={()=>{setAdding(false);setError('');}}>Cancel step</button></div>
  </form>:<button type="button" className="button secondary" disabled={editing!==null} onClick={()=>{setTitle('');setInstructions('');setMinutes('');setAdding(true);}}>Add a step</button>}
  {dish.recipeSource&&<details><summary>Original recipe</summary><pre>{dish.recipeSource}</pre></details>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="method-review-actions"><button type="button" className="button primary" disabled={!dish.name.trim()||!tasks.length||editing!==null||adding} onClick={async()=>{setCommitting(true);setError('');try{await onAdd();}catch(e){setError(e instanceof Error&&e.message.startsWith('Your meal changed.')?e.message:'Could not add the recipe yet. Your edits are still here.');}finally{setCommitting(false);}}}>Add to meal</button><button type="button" className="button secondary" onClick={()=>{if((editing!==null||adding)&&!window.confirm('Discard this open step edit?'))return;onBack();}}>Back to choices</button></div>
 </fieldset></section>;
}
