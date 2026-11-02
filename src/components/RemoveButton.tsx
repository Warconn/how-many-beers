'use client';
import Icon from './Icon';
export default function RemoveButton({label,onClick,disabled=false,className=''}:{label:string;onClick:()=>void;disabled?:boolean;className?:string}){
 return <button type="button" className={'icon-remove '+className} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
  <Icon name="trash"/>
 </button>;
}
