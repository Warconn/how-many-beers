'use client';
import {useEffect,useRef,useState} from 'react';
import type {Dish} from '@/domain/meal';
import {extractRecipeTiming} from '@/domain/recipe';
import {formatDuration} from '@/domain/stepTiming';

export default function RecipePreview({dish,onChange,onAdd,onBack}:{dish:Dish;onChange:(dish:Dish)=>void;onAdd:()=>void;onBack:()=>void}){
 const heading=useRef<HTMLHeadingElement>(null),[error,setError]=useState('');
 useEffect(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start',behavior:'instant'});},[]);
 const steps=dish.steps??[],unknown=steps.filter(s=>s.minutes===null).length;
 const total=steps.reduce((sum,s)=>sum+(s.minutes??0),0);
 const hasRanges=steps.some(s=>extractRecipeTiming(s.instructions??s.title).range);
 return <section className="recipe-preview" aria-label="Recipe preview">
  <p className="eyebrow">RECIPE PREVIEW</p><h3 ref={heading} tabIndex={-1}>Review your recipe</h3>
  <p className="recipe-preview-summary">{steps.length} steps · {unknown===steps.length?'Timing not yet estimated':(unknown?'At least ':'')+formatDuration(total)+(unknown?' with known timing':'')}</p>
  <p className="muted small">Times found in your recipe are filled in. Adjust only what needs changing.{hasRanges?' Ranges use the longer estimate for planning; you can change it below.':''}</p>
  {unknown>0&&<p className="notice">{unknown} {unknown===1?'step needs':'steps need'} an estimate. You can leave unknown times blank.</p>}
  <button type="button" className="button primary recipe-preview-add" disabled={!dish.name.trim()||!!error} onClick={onAdd}>Add to this cook</button>
  <label htmlFor="preview-recipe-name">Recipe title</label><input id="preview-recipe-name" value={dish.name} onChange={e=>onChange({...dish,name:e.target.value})}/>
  <ol className="recipe-preview-steps">{steps.map((step,index)=>{
   const timing=extractRecipeTiming(step.instructions??step.title);
   return <li key={step.id}>
    <div className="recipe-preview-copy"><strong>{step.title}</strong>{timing.range&&<p className="recipe-time-source">Recipe: {timing.range[1]<60?timing.range[0]+'–'+timing.range[1]+' min':formatDuration(timing.range[0])+'–'+formatDuration(timing.range[1])} · planning with {step.minutes===null?'an unknown duration':formatDuration(step.minutes)}</p>}
     {!timing.range&&timing.minutes!==null&&<p className="recipe-time-source">From recipe: {formatDuration(timing.minutes)}</p>}
     {step.instructions&&step.instructions!==step.title&&<p className="muted small">{step.instructions.startsWith(step.title)?step.instructions.slice(step.title.length).trim():step.instructions}</p>}
    </div>
    <label className="recipe-preview-duration">Estimated duration<div><input aria-label={'Minutes for step '+(index+1)} type="number" inputMode="decimal" min="0" max="43200" step="any" placeholder="Unknown" value={step.minutes??''} onChange={e=>{
      const minutes=e.target.value===''?null:Number(e.target.value);
      if(e.target.validity.badInput||(minutes!==null&&(!Number.isFinite(minutes)||minutes<0||minutes>43200))){setError('Enter 0–43200 minutes, or clear for unknown.');return;}
      setError('');onChange({...dish,steps:steps.map(s=>s.id===step.id?{...s,minutes}:s)});
    }}/><span>min</span></div></label>
   </li>;
  })}</ol>
  {dish.recipeSource&&<details className="recipe-original"><summary>Original recipe</summary><pre>{dish.recipeSource}</pre></details>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="recipe-preview-actions"><button type="button" className="button primary" disabled={!dish.name.trim()||!!error} onClick={onAdd}>Add reviewed recipe</button><button type="button" className="button secondary" onClick={onBack}>Back to recipe text</button></div>
 </section>;
}
