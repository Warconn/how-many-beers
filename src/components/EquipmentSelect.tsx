'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {presets} from '@/domain/meal';
import Icon from './Icon';
const options=[...new Set(Object.values(presets).flatMap(p=>p.equipment.split(' + ')))];
const display=(value:string)=>value==='fryer'?'Fryer':value;
/** Edit the draft through one flat list. Merely opening it never normalizes
 * existing native labels, including mixed/custom equipment from older recipes. */
export default function EquipmentSelect({value,onChange,label='Equipment',id}:{id?:string;value:string;onChange:(value:string)=>void;label?:string}){
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),panelId=useId(),pointerDown=useRef(false);
 const [open,setOpen]=useState(false);
 const selected=value?value.split(' + '):[];
 const custom=selected.filter(item=>!options.includes(item)).join(' + ');
 useEffect(()=>{
  if(!open)return;
  // Keep the panel in place until an outside click reaches its target. Closing
  // on pointerdown/blur moves actions below it between mouse-down and mouse-up.
  const down=()=>{pointerDown.current=true;};
  const outside=(e:MouseEvent)=>{pointerDown.current=false;if(!root.current?.contains(e.target as Node))setOpen(false);};
  const cancel=()=>{pointerDown.current=false;};
  const escape=(e:KeyboardEvent)=>{pointerDown.current=false;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);trigger.current?.focus({preventScroll:true});}};
  document.addEventListener('pointerdown',down,true);document.addEventListener('click',outside);document.addEventListener('pointercancel',cancel);root.current?.addEventListener('keydown',escape);
  const element=root.current;return()=>{pointerDown.current=false;document.removeEventListener('pointerdown',down,true);document.removeEventListener('click',outside);document.removeEventListener('pointercancel',cancel);element?.removeEventListener('keydown',escape);};
 },[open]);
 return <div className="equipment-select" ref={root} onBlur={e=>{if(!pointerDown.current&&e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
  <button ref={trigger} id={id} type="button" className="equipment-trigger" aria-label={label+': '+(selected.map(display).join(' · ')||'Choose equipment')} aria-expanded={open} aria-controls={panelId} onClick={()=>setOpen(v=>!v)}><span>{selected.map(display).join(' · ')||'Choose equipment'}</span><Icon name="chevron-down"/></button>
  {open&&<div id={panelId} className="equipment-options" role="group" aria-label={label+' choices'}>
   {options.map(option=><label key={option} className="equipment-option"><input type="checkbox" checked={selected.includes(option)} onChange={e=>onChange((e.target.checked?[...selected,option]:selected.filter(item=>item!==option)).join(' + '))}/>{display(option)}</label>)}
   <label className="equipment-other">Other equipment<input maxLength={16000} value={custom} onChange={e=>onChange([...selected.filter(item=>options.includes(item)),...(e.target.value?[e.target.value]:[])].join(' + '))}/></label>
  </div>}
 </div>;
}
