'use client';
import {useId} from 'react';
import styles from './RecipeDetails.module.css';
import type {Dish,RecipeTemperature} from '@/domain/meal';
import {temperatureF,reviewRecipeTemperature} from '@/domain/recipe';

/** Shared review/reference editor. Edits never reparse or replace original text. */
export default function RecipeDetails({dish,onChange,includeEquipment=false}:{dish:Dish;onChange:(dish:Dish)=>void;includeEquipment?:boolean}){
 const id=useId();
 const changeTemperature=(stepId:string,index:number,temperature:RecipeTemperature|null)=>{
  const steps=dish.steps?.map(s=>s.id===stepId?reviewRecipeTemperature(s,index,temperature):s);
  const setting=steps?.flatMap(s=>s.recipeTemperatures??[]).find(t=>t.kind==='equipment');
  const hadSetting=dish.steps?.some(s=>s.recipeTemperatures?.some(t=>t.kind==='equipment'));
  onChange({...dish,steps,pitTempF:setting?temperatureF(setting):hadSetting?undefined:dish.pitTempF});
 };
 return <div className={styles.details}>
  {includeEquipment&&<><label htmlFor={id+'equipment'}>Equipment</label><input id={id+'equipment'} value={dish.equipment} maxLength={80} onChange={e=>onChange({...dish,equipment:e.target.value})}/></>}
  {dish.steps?.some(s=>s.recipeTemperatures?.some(t=>t.kind==='equipment'))?<p className="muted small">Starting smoker / oven setting: {dish.pitTempF===undefined?'Unknown':dish.pitTempF+'°F'}. Edit step settings under Recipe temperatures.</p>:<><label htmlFor={id+'setting'}>Starting smoker / oven setting (°F)</label><input id={id+'setting'} type="number" min="1" max="1000" placeholder="Unknown" value={dish.pitTempF??''} onChange={e=>{const value=Number(e.target.value);if(!e.target.value||value>0&&value<=1000)onChange({...dish,pitTempF:e.target.value?value:undefined});}}/></>}
  <details><summary>Ingredients &amp; recipe reference</summary>
   <label htmlFor={id+'ingredients'}>Ingredients (one per line)</label><textarea id={id+'ingredients'} rows={5} value={(dish.recipeIngredients??[]).join('\n')} onChange={e=>onChange({...dish,recipeIngredients:e.target.value.split('\n')})}/>
   <label htmlFor={id+'reference'}>Source / notes</label><textarea id={id+'reference'} rows={3} value={dish.recipeReference??''} onChange={e=>onChange({...dish,recipeReference:e.target.value})}/>
  </details>
  <details><summary>Recipe temperatures</summary>
   <p className="muted small">Keep smoker / oven settings separate from internal food targets. Unclear values need review. Units stay as written; these values do not determine doneness or cooking time.</p>
   {!dish.steps?.some(s=>s.recipeTemperatures?.length)&&<p className="muted small">No explicit temperatures found. Add a value to the relevant step if needed.</p>}
   {dish.steps?.map((s,stepIndex)=><div key={s.id}>
    <p className="small"><strong>Step {stepIndex+1}: {s.title}</strong></p>
    {s.recipeTemperatures?.map((t,index)=><fieldset key={index}>
     <legend>Step {stepIndex+1} temperature {index+1}</legend>
     <label>Temperature<input aria-label={'Step '+(stepIndex+1)+' temperature '+(index+1)} type="number" min="0.1" max={t.unit==='F'?1000:538} step="any" value={t.value} onChange={e=>{const value=Number(e.target.value);if(value>0&&value<=(t.unit==='F'?1000:538))changeTemperature(s.id,index,{...t,value});}}/></label>
     <label>Unit<select aria-label={'Step '+(stepIndex+1)+' temperature unit '+(index+1)} value={t.unit} onChange={e=>{const unit=e.target.value as 'F'|'C',value=Math.round((unit==='F'?t.value*9/5+32:(t.value-32)*5/9)*10)/10;if(value>0&&value<=(unit==='F'?1000:538))changeTemperature(s.id,index,{...t,unit,value});}}><option value="F">°F</option><option value="C">°C</option></select></label>
     <label>Purpose<select aria-label={'Step '+(stepIndex+1)+' temperature purpose '+(index+1)} value={t.kind} onChange={e=>changeTemperature(s.id,index,{...t,kind:e.target.value as RecipeTemperature['kind']})}><option value="unknown">Unclear — review</option><option value="equipment">Smoker / oven setting</option><option value="food">Internal food target</option></select></label>
     <button type="button" className="button secondary" onClick={()=>changeTemperature(s.id,index,null)}>Remove temperature</button>
    </fieldset>)}
    <button type="button" className="button secondary" onClick={()=>onChange({...dish,steps:dish.steps?.map(step=>step.id===s.id?{...step,recipeTemperatures:[...(step.recipeTemperatures??[]),{value:200,unit:'F',kind:'unknown'}]}:step)})}>Add temperature for step {stepIndex+1}</button>
   </div>)}
  </details>
 </div>;
}
