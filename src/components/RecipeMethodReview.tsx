'use client';
import type {ReactNode} from 'react';
import {useEffect,useRef,useState} from 'react';
import type {ExtendedMeal} from '@/domain/cookState';
import {addStep,cookTimeline,editStep,removeStep,setStepDuration} from '@/domain/cookState';
import {formatDuration} from '@/domain/stepTiming';
import {useStepReorder} from './useStepReorder';
import {StepGrip,StepEditButton,StepInstructions,StepReorderHelp} from './StepListControls';
import {reorderPlannedStep} from '@/domain/stepReorder';
import {reviewDuration} from '@/domain/recipeReview';

export default function RecipeMethodReview({meal,onChange,onAdd,onBack,saveAction,busy=false,primaryLabel='Add to meal'}:{busy?:boolean;saveAction?:ReactNode;primaryLabel?:string;meal:ExtendedMeal;onChange:(meal:ExtendedMeal)=>void;onAdd:()=>Promise<void>;onBack:()=>void}){
 const dish=meal.dishes[0],tasks=cookTimeline(meal),heading=useRef<HTMLHeadingElement>(null);
 const [editing,setEditing]=useState<string|null>(null),[title,setTitle]=useState(''),[instructions,setInstructions]=useState(''),[minutes,setMinutes]=useState(''),[error,setError]=useState(''),[adding,setAdding]=useState(false),[committing,setCommitting]=useState(false);
 const reorder=useStepReorder(editing!==null||adding||committing,(id,target,after)=>onChange(reorderPlannedStep(meal,id,target,after)));
 useEffect(()=>{heading.current?.focus();heading.current?.scrollIntoView({block:'start',behavior:'instant'});},[]);
 const change=(fn:()=>ExtendedMeal)=>{try{onChange(fn());setError('');}catch(e){setError(e instanceof Error?e.message:'Review this change.');}};
 return <section className="method-review" aria-label="Review your method" aria-busy={committing||busy}><fieldset disabled={committing||busy} className="method-review-fields">
  <h3 ref={heading} tabIndex={-1}>Review your method</h3><p className="muted small">{primaryLabel==='Add to meal'?'Adjust the steps, then add this dish to your meal.':'Save this method independently of your meals.'}</p>
  <div className="method-review-meta">
  <label>Recipe name<input value={dish.name} maxLength={80} onChange={e=>onChange({...meal,dishes:[{...dish,name:e.target.value}],customTasks:meal.customTasks?.map(t=>({...t,dishName:e.target.value}))})}/></label>
  <label>Equipment<input value={dish.equipment} maxLength={80} onChange={e=>onChange({...meal,dishes:[{...dish,equipment:e.target.value}]})}/></label>
  </div>
  <StepReorderHelp id={reorder.helpId} announcement={reorder.announcement}/>
  <ol className="method-review-steps" data-step-list="method">{tasks.map(task=><li key={task.id} data-step-id={task.id} data-step-group={task.dishId} className={"step-list-row "+(reorder.dragging===task.id?'is-dragging ':'')+(reorder.drop?.id===task.id?(reorder.drop.after?'drop-after':'drop-before'):'')}>
   <div className="step-row-heading"><StepGrip stepId={task.id} title={task.title} {...reorder.grip(task.id)}/><div className="step-row-copy"><strong>{task.title}</strong><span>{task.isCondition?'Check when ready':task.id.endsWith(':serve')?'Serving':reviewDuration(meal,task)!=null?formatDuration(reviewDuration(meal,task)!):'Time unknown'}</span></div>{editing!==task.id&&(<StepEditButton title={task.title} disabled={editing!==null||adding} onClick={()=>{setTitle(task.title);setInstructions(task.instructions??'');setMinutes(reviewDuration(meal,task)==null?'':String(reviewDuration(meal,task)));setEditing(task.id);}}/>)}</div>
   {editing===task.id?<form aria-label="Edit recipe step" onSubmit={e=>{e.preventDefault();try{let next=editStep(meal,task.id,title,instructions);if(!task.isCondition&&!task.id.endsWith(':serve')&&(minutes===''?null:Number(minutes))!==reviewDuration(meal,task))next=setStepDuration(next,task.id,minutes===''?null:Number(minutes));onChange(next);setEditing(null);setError('');}catch(err){setError(err instanceof Error?err.message:'Check this step.');}}}>
    <label>Step name<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>Instructions<textarea maxLength={500} rows={3} value={instructions} onChange={e=>setInstructions(e.target.value)}/></label>
    {!task.isCondition&&!task.id.endsWith(':serve')&&<label>Minutes<input type="number" inputMode="decimal" min={0} max={43200} step="any" placeholder="Unknown" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>}
    <div className="method-review-actions step-editor-actions"><button type="submit" className="button primary">Save step</button><button type="button" className="button secondary" onClick={()=>{setEditing(null);setError('');}}>Cancel edit</button><button type="button" className="link danger step-editor-remove" aria-label={'Remove '+task.title} disabled={tasks.length===1||adding} onClick={()=>{change(()=>removeStep(meal,task.id,new Date().toISOString()));setEditing(null);}}>Remove step</button></div>
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
  {editing===null&&!adding&&saveAction}
  <div className="method-review-actions"><button type="button" className="button primary" disabled={!dish.name.trim()||!tasks.length||editing!==null||adding} onClick={async()=>{setCommitting(true);setError('');try{await onAdd();}catch(e){setError(e instanceof Error&&(primaryLabel!=='Add to meal'||e.message.startsWith('Your meal changed.'))?e.message:'Could not add the recipe yet. Your edits are still here.');}finally{setCommitting(false);}}}>{primaryLabel}</button><button type="button" className="button secondary" onClick={()=>{if((editing!==null||adding)&&!window.confirm('Discard this open step edit?'))return;onBack();}}>{primaryLabel==='Save changes'?'Cancel':'Back to choices'}</button></div>
 </fieldset></section>;
}
