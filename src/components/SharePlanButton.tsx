'use client';
import {useState} from 'react';
import type {Meal,PlannedTask} from '@/domain/meal';
import {formatMealPlanForShare} from '@/domain/sharePlan';

export default function SharePlanButton({meal,timeline}:{meal:Meal;timeline:PlannedTask[]}){
 const [notice,setNotice]=useState('');
 const [manual,setManual]=useState(false);
 const text=()=>formatMealPlanForShare(meal,timeline,Date.now());
 const copy=async()=>{
  try {
   if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
   await navigator.clipboard.writeText(text());
   setNotice('Plan copied. Ready to text!');
   setManual(false);
  } catch {
   setManual(true);setNotice('Select and copy your plan below.');
  }
 };
 const share=async()=>{
  if(typeof navigator.share==='function'){
   try{await navigator.share({title:meal.name||'How Many Beers? meal plan',text:text()});setNotice('');return;}
   catch(error){if(error instanceof Error&&error.name==='AbortError')return;}
  }
  await copy();
 };
 return <div className="plan-share" aria-label="Share meal plan">
  <div className="plan-share-actions">
   <button type="button" className="button secondary" onClick={()=>void share()}>Share plan</button>
   <button type="button" className="link" onClick={()=>void copy()}>Copy text</button>
  </div>
  {notice&&<p role="status" className="muted small">{notice}</p>}
  {manual&&<textarea aria-label="Plan text for manual copy" readOnly rows={7} value={text()}/>}
 </div>;
}
