'use client';
import {useEffect,useId,useRef,useState,type ButtonHTMLAttributes} from 'react';
import Icon from './Icon';

export function StepGrip({stepId,title,...props}:{stepId:string;title:string}&ButtonHTMLAttributes<HTMLButtonElement>){
 return <button {...props} type="button" className="step-drag-grip" data-step-grip={stepId} aria-label={'Move '+title} title="Drag to reorder · Arrow keys to move"><Icon name="grip"/></button>;
}
export function StepEditButton({title,...props}:{title:string}&ButtonHTMLAttributes<HTMLButtonElement>){
 return <button {...props} type="button" className="step-row-edit" aria-label={'Edit '+title} aria-expanded={false}>Edit</button>;
}
export function StepReorderHelp({id,announcement}:{id:string;announcement:string}){
 return <><p id={id} className="sr-only">Drag a grip to reorder steps within this dish, or focus it and use the up and down arrow keys.</p><p className="sr-only" role="status" aria-live="polite">{announcement}</p></>;
}
export function StepInstructions({text}:{text:string}){
 const id=useId(),paragraph=useRef<HTMLParagraphElement>(null);
 const [expanded,setExpanded]=useState(false),[overflows,setOverflows]=useState(false);
 useEffect(()=>{
  const element=paragraph.current;if(!element)return;
  const measure=()=>setOverflows(element.scrollHeight>parseFloat(getComputedStyle(element).lineHeight)*5+1);
  const observer=new ResizeObserver(measure);observer.observe(element);measure();return()=>observer.disconnect();
 },[text]);
 return <div className="step-row-instructions"><p ref={paragraph} id={id} className={expanded?'':'instructions-preview'}>{text}</p>{overflows&&<button type="button" className="link" aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(v=>!v)}>{expanded?'Show less':'Show more'}</button>}</div>;
}
