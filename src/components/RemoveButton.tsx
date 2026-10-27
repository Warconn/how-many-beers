'use client';
export default function RemoveButton({label,onClick,disabled=false,className=''}:{label:string;onClick:()=>void;disabled?:boolean;className?:string}){
 return <button type="button" className={'icon-remove '+className} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg>
 </button>;
}
