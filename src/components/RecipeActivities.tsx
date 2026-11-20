'use client';
import {useState,useEffect,useId} from 'react';
import {cookTimeline,type ExtendedMeal} from '@/domain/cookState';
import {reviewActivities,setRecipeActivity} from '@/domain/recipeReview';
import {activityStages,activityIssue,activityStepKey,suggestActivities,type RecipeActivity,type ActivityStage} from '@/domain/activities';

export default function RecipeActivities({meal,dishId,onChange,disabled=false,onEditingChange}:{meal:ExtendedMeal;dishId:string;onChange:(meal:ExtendedMeal)=>void;disabled?:boolean;onEditingChange?:(editing:boolean)=>void}){
 const editorId=useId();
 const dish=meal.dishes.find(d=>d.id===dishId)!,tasks=cookTimeline(meal).filter(t=>t.dishId===dishId),metadata=reviewActivities(meal,dishId);
 const [editing,setEditing]=useState<RecipeActivity|null>(null),[stage,setStage]=useState<ActivityStage|'none'>('cooking'),[start,setStart]=useState(''),[end,setEnd]=useState(''),[error,setError]=useState('');
 const suggestions=suggestActivities(tasks.map(t=>({id:activityStepKey(dishId,t.id),title:t.title,instructions:t.instructions,minutes:t.durationMinutes??t.templateStage?.minutes??null})))
  .filter(s=>!metadata.definitions.some(a=>a.startStepId===s.activity.startStepId)&&!metadata.dismissedStartStepIds?.includes(s.activity.startStepId));
 const entries=[...metadata.definitions,...suggestions.map(s=>s.activity)];
 const problem=(a:RecipeActivity)=>activityIssue(dish,tasks,a)??suggestions.find(s=>s.activity.id===a.id)?.issue;
 const issues=entries.filter(a=>problem(a));
 useEffect(()=>{onEditingChange?.(!!editing);return ()=>onEditingChange?.(false);},[editing,onEditingChange]);
 const title=(id:string|null)=>tasks.find(t=>activityStepKey(dishId,t.id)===id)?.title??(id?'Step removed':'Choose end step');
 const open=(a:RecipeActivity)=>{setEditing(a);setStage(a.stage);setStart(a.startStepId);setEnd(a.endStepId??'');setError('');};
 return <details className="activity-review"><summary>Review activities{issues.length?` · ${issues.length} need review`:''}</summary>
  <div className="activity-review-body">
   {entries.length===0&&<p className="muted small">No bounded activity detected. Ordinary steps still work as checkboxes.</p>}
   {entries.map(a=><div key={a.id} className="recipe-activity">
    <div className="activity-summary"><div><strong>{activityStages[a.stage]}</strong><p className="small muted">{title(a.startStepId)} → {title(a.endStepId)}</p>{problem(a)&&<p className="small activity-review-warning">{problem(a)}</p>}</div><button type="button" className="link" disabled={disabled||!!editing} onClick={()=>open(a)}>Review activity</button></div>
   </div>)}
   {!editing&&<button type="button" className="link" disabled={disabled||tasks.length<2} onClick={()=>open({id:'activity-'+crypto.randomUUID(),stage:'cooking',startStepId:activityStepKey(dishId,tasks[0].id),endStepId:activityStepKey(dishId,tasks.at(-1)!.id),checkpointStepIds:[],provenance:'confirmed'})}>Link an activity</button>}
   {editing&&<div className="activity-editor" role="group" aria-label="Edit activity">
    <label htmlFor={editorId+'-stage'}>Activity stage</label><select id={editorId+'-stage'} value={stage} onChange={e=>setStage(e.target.value as ActivityStage|'none')}>{Object.entries(activityStages).map(([id,label])=><option key={id} value={id}>{label}</option>)}<option value="none">No activity</option></select>
    {stage!=='none'&&<><label htmlFor={editorId+'-start'}>Start at</label><select id={editorId+'-start'} value={start} onChange={e=>setStart(e.target.value)}>{tasks.map(t=><option value={activityStepKey(dishId,t.id)} key={t.id}>{t.title}</option>)}</select><label htmlFor={editorId+'-end'}>End at</label><select id={editorId+'-end'} value={end} onChange={e=>setEnd(e.target.value)}><option value="">Choose end step</option>{tasks.map(t=><option value={activityStepKey(dishId,t.id)} key={t.id}>{t.title}</option>)}</select></>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="method-review-actions"><button type="button" className="button primary" onClick={()=>{try{onChange(setRecipeActivity(meal,dishId,editing.id,stage==='none'?null:{...editing,stage,startStepId:start,endStepId:end},editing.startStepId));setEditing(null);setError('');}catch(e){setError(e instanceof Error?e.message:'Review this activity.');}}}>Save activity</button><button type="button" className="button secondary" onClick={()=>{setEditing(null);setError('');}}>Cancel</button></div>
   </div>}
  </div>
 </details>;
}
