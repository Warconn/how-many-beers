'use client';
import {useState} from 'react';
import {presets} from '@/domain/meal';
import Icon from './Icon';
const options=[...new Set(Object.values(presets).flatMap(p=>p.equipment.split(' + ')))];
/** Keep the native equipment label lossless, including existing mixed methods. */
export default function EquipmentSelect({value,onChange,label='Equipment',id}:{id?:string;value:string;onChange:(value:string)=>void;label?:string}){
 const selected=value?value.split(' + '):[''];
 const [adding,setAdding]=useState(false),[custom,setCustom]=useState<number|null>(null),[customText,setCustomText]=useState('');
 const update=(index:number,next:string)=>{const values=[...selected];values[index]=next;onChange(values.filter(Boolean).join(' + '));};
 return <div className="equipment-picker">
  {selected.map((item,index)=><div key={index} className="equipment-choice">
   <select id={index===0?id:undefined} aria-label={label+(index?' '+(index+1):'')} value={custom===index?'__other__':item} onChange={e=>{if(e.target.value==='__other__'){setCustom(index);setCustomText(options.includes(item)?'':item);return;}setCustom(null);update(index,e.target.value);}}>
    <option value="">Unspecified</option>
    {item&&!options.includes(item)&&<option value={item}>{item}</option>}
    {options.map(option=><option key={option} value={option}>{option}</option>)}<option value="__other__">Other…</option>
   </select>
   {selected.length>1&&<button type="button" className="plan-trash" aria-label={'Remove equipment '+(index+1)} onClick={()=>{setCustom(null);onChange(selected.filter((_,n)=>n!==index).join(' + '));}}><Icon name="close"/></button>}
   {custom===index&&<label className="equipment-custom">Custom equipment<input autoFocus maxLength={80} value={customText} onChange={e=>{setCustomText(e.target.value);if(e.target.value.trim())update(index,e.target.value);}}/></label>}
  </div>)}
  {adding?<select aria-label="Additional equipment" value="" onChange={e=>{if(e.target.value==='__other__'){setCustom(selected.filter(Boolean).length);setCustomText('');onChange([...selected.filter(Boolean),'Other'].join(' + '));}else onChange([...selected.filter(Boolean),e.target.value].join(' + '));setAdding(false);}}><option value="" disabled>Choose equipment</option>{options.filter(option=>!selected.includes(option)).map(option=><option key={option} value={option}>{option}</option>)}<option value="__other__">Other…</option></select>:<button type="button" className="link" onClick={()=>setAdding(true)}>Add equipment</button>}
 </div>;
}
