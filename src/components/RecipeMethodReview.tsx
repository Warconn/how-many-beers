'use client';
import {useEffect,useRef,useState} from 'react';
import type {ExtendedMeal} from '@/domain/cookState';
import {addStep,cookTimeline,editStep,moveStep,removeStep,setStepDuration} from '@/domain/cookState';
import {presets} from '@/domain/meal';
import {formatDuration} from '@/domain/stepTiming';
import Icon from './Icon';
import {reviewDuration} from '@/domain/recipeReview';

export default function RecipeMethodReview({meal,onChange,onAdd,onBack}:{meal:ExtendedMeal;onChange:(meal:ExtendedMeal)=>void;onAdd:()=>Promise<void>;onBack:()=>void}){
 const dish=meal.dishes[0],tasks=cookTimeline(meal),heading=useRef<HTMLHeadingElement>(null);
 const [editing,setEditing]=useState<string|null>(null),[title,setTitle]=useState(''),[instructions,setInstructions]=useState(''),[minutes,setMinutes]=useState(''),[error,setError]=useState(''),[adding,setAdding]=useState(false),[committing,setCommitting]=useState(false);
 useEffect(()=>{heading.current?.focus();heading.current?.scrollIntoView({block:'start',behavior:'instant'});},[]);
 const change=(fn:()=>ExtendedMeal)=>{try{onChange(fn());setError('');}catch(e){setError(e instanceof Error?e.message:'Review this change.');}};
 return <section className="method-review" aria-label="Review your method" aria-busy={committing}><fieldset disabled={committing} className="method-review-fields">
  <p className="eyebrow">MAKE IT YOURS</p><h3 ref={heading} tabIndex={-1}>Review your method</h3><p className="muted small">Keep the steps you actually use. You can adjust them again in your meal.</p>
  <label>Recipe name<input value={dish.name} maxLength={80} onChange={e=>onChange({...meal,dishes:[{...dish,name:e.target.value}],customTasks:meal.customTasks?.map(t=>({...t,dishName:e.target.value}))})}/></label>
  <label>Equipment<input value={dish.equipment} maxLength={80} onChange={e=>onChange({...meal,dishes:[{...dish,equipment:e.target.value}]})}/></label>
  <ol className="method-review-steps">{tasks.map((task,index)=><li key={task.id}>
   <div className="method-review-heading"><strong>{task.title}</strong><span className="small">{task.isCondition?'Check when ready':task.id.endsWith(':serve')?'Serving':reviewDuration(meal,task)!=null?formatDuration(reviewDuration(meal,task)!):'Time unknown'}</span></div>
   {editing===task.id?<form aria-label="Edit recipe step" onSubmit={e=>{e.preventDefault();try{let next=editStep(meal,task.id,title,instructions);if(!task.isCondition&&!task.id.endsWith(':serve')&&(minutes===''?null:Number(minutes))!==reviewDuration(meal,task))next=setStepDuration(next,task.id,minutes===''?null:Number(minutes));onChange(next);setEditing(null);setError('');}catch(err){setError(err instanceof Error?err.message:'Check this step.');}}}>
    <label>Step name<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>Instructions<textarea maxLength={500} rows={3} value={instructions} onChange={e=>setInstructions(e.target.value)}/></label>
    {!task.isCondition&&!task.id.endsWith(':serve')&&<label>Minutes<input type="number" inputMode="decimal" min={0} max={43200} step="any" placeholder="Unknown" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>}
    <div className="method-review-actions">     <button type="button" className="button secondary icon-button" aria-label={'Move '+task.title+' up'} disabled={index===0||adding} onClick={()=>change(()=>moveStep(meal,task.id,'up',dish.id,true))}><Icon name="arrow-up"/></button>
     <button type="button" className="button secondary icon-button" aria-label={'Move '+task.title+' down'} disabled={index===tasks.length-1||adding} onClick={()=>change(()=>moveStep(meal,task.id,'down',dish.id,true))}><Icon name="arrow-down"/></button>
     <button type="button" className="button secondary icon-button" aria-label={'Remove '+task.title} disabled={tasks.length===1||adding} onClick={()=>{change(()=>removeStep(meal,task.id,new Date().toISOString()));setEditing(null);}}><Icon name="trash"/></button><button type="submit" className="button primary">Save step</button><button type="button" className="button secondary" onClick={()=>{setEditing(null);setError('');}}>Cancel edit</button></div>
   </form>:<>
    {task.instructions&&task.instructions!==task.title&&(task.isCondition?<p className="muted small">{task.instructions}</p>:<details><summary>Instructions</summary><p className="muted small">{task.instructions}</p></details>)}
    <div className="method-review-actions"><button type="button" className="button secondary" disabled={editing!==null||adding} aria-label={'Edit '+task.title} onClick={()=>{setTitle(task.title);setInstructions(task.instructions??'');setMinutes(reviewDuration(meal,task)==null?'':String(reviewDuration(meal,task)));setEditing(task.id);}}>Edit</button>

    </div>
   </>}
  </li>)}</ol>
  {adding?<form aria-label="Add recipe step" onSubmit={e=>{e.preventDefault();try{let next=addStep(meal,title,instructions);const id=next.customTasks!.at(-1)!.id;next={...next,customTasks:next.customTasks?.map(t=>t.id===id?{...t,dishId:dish.id,dishName:dish.name}:t)};next=setStepDuration(next,id,minutes===''?null:Number(minutes));onChange(next);setAdding(false);setError('');}catch(err){setError(err instanceof Error?err.message:'Check this step.');}}}>
   <label>Step name<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Instructions<textarea rows={3} maxLength={500} value={instructions} onChange={e=>setInstructions(e.target.value)}/></label><label>Minutes<input type="number" min={0} max={43200} step="any" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>
   <div className="method-review-actions"><button className="button primary" type="submit">Save step</button><button className="button secondary" type="button" onClick={()=>{setAdding(false);setError('');}}>Cancel step</button></div>
  </form>:<button type="button" className="button secondary" disabled={editing!==null} onClick={()=>{setTitle('');setInstructions('');setMinutes('');setAdding(true);}}>Add a step</button>}
  {dish.preset!=='custom'&&<details><summary>Method reference</summary><p className="muted small">{presets[dish.preset].notice}</p>{presets[dish.preset].sources?.map(source=><p key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></p>)}</details>}
  {dish.recipeSource&&<details><summary>Original recipe</summary><pre>{dish.recipeSource}</pre></details>}
  <p className="muted small">Times are estimates. Use a thermometer and follow the recipe’s doneness guidance.</p>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="method-review-actions"><button type="button" className="button primary" disabled={!dish.name.trim()||!tasks.length||editing!==null||adding} onClick={async()=>{setCommitting(true);setError('');try{await onAdd();}catch(e){setError(e instanceof Error&&e.message.startsWith('Your meal changed.')?e.message:'Could not add the recipe yet. Your edits are still here.');}finally{setCommitting(false);}}}>Add to meal</button><button type="button" className="button secondary" onClick={()=>{if((editing!==null||adding)&&!window.confirm('Discard this open step edit?'))return;onBack();}}>Back to choices</button></div>
 </fieldset></section>;
}
