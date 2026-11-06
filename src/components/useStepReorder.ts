'use client';
import {useEffect,useId,useRef,useState,type PointerEvent,type KeyboardEvent} from 'react';

type Drop={id:string;after:boolean};
type Active={id:string;group:string;root:HTMLElement;scroll:HTMLElement|null;x:number;y:number;startY:number;moved:boolean;drop:Drop|null};
/** Shared pointer/keyboard behavior; callers retain their own timing and persistence. */
export function useStepReorder(blocked:boolean,onReorder:(id:string,target:string,after:boolean)=>void){
 const helpId=useId(),[list,setList]=useState<string|null>(null),[dragging,setDragging]=useState<string|null>(null),[drop,setDrop]=useState<Drop|null>(null),[announcement,setAnnouncement]=useState('');
 const active=useRef<Active|null>(null),latest=useRef({blocked,onReorder});latest.current={blocked,onReorder};
 const stop=()=>{active.current=null;setDragging(null);setDrop(null);setList(null);};
 const target=()=>{
  const a=active.current;if(!a)return;
  const row=document.elementFromPoint(a.x,a.y)?.closest<HTMLElement>('[data-step-id]');
  const next=row?.dataset.stepId&&row.dataset.stepId!==a.id&&row.dataset.stepGroup===a.group&&row.closest('[data-step-list]')===a.root?{id:row.dataset.stepId,after:a.y>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2}:null;
  a.drop=next;setDrop(previous=>previous?.id===next?.id&&previous?.after===next?.after?previous:next);
 };
 useEffect(()=>{
  if(!dragging)return;let frame=0;
  const scroll=()=>{const a=active.current;if(!a)return;const bounds=a.scroll?.getBoundingClientRect(),top=Math.max(0,bounds?.top??0),bottom=Math.min(innerHeight,bounds?.bottom??innerHeight),dy=a.y<top+70?-9:a.y>bottom-70?9:0;if(dy&&a.moved){if(a.scroll)a.scroll.scrollBy(0,dy);else window.scrollBy(0,dy);target();}frame=requestAnimationFrame(scroll);};
  frame=requestAnimationFrame(scroll);return()=>cancelAnimationFrame(frame);
 },[dragging]);
 useEffect(()=>{if(blocked)stop();},[blocked]);
 const commit=(a:Pick<Active,'id'|'group'|'root'>,destination:Drop,keyboard=false)=>{
  if(latest.current.blocked||!a.root.isConnected)return;
  try{latest.current.onReorder(a.id,destination.id,destination.after);requestAnimationFrame(()=>{
   const grip=a.root.querySelector<HTMLElement>(`[data-step-grip="${CSS.escape(a.id)}"]`);grip?.focus({preventScroll:true});if(keyboard)grip?.scrollIntoView({block:'nearest'});
   const rows=Array.from(a.root.querySelectorAll<HTMLElement>('[data-step-id]')).filter(row=>row.dataset.stepGroup===a.group),index=rows.findIndex(row=>row.dataset.stepId===a.id);
   setAnnouncement(`${grip?.getAttribute('aria-label')?.replace(/^Move /,'')??'Step'} moved to position ${index+1} of ${rows.length}.`);
  });}catch(error){setAnnouncement(error instanceof Error?error.message:'Could not move this step.');}
 };
 return {helpId,list,dragging,drop,announcement,grip:(id:string)=>({
  disabled:blocked,'aria-describedby':helpId,
  onPointerDown:(e:PointerEvent<HTMLButtonElement>)=>{if(latest.current.blocked||e.button!==0||!e.isPrimary)return;const root=e.currentTarget.closest<HTMLElement>('[data-step-list]'),row=e.currentTarget.closest<HTMLElement>('[data-step-id]');if(!root||!row)return;e.preventDefault();setList(root.dataset.stepList??'');e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);let scroll:HTMLElement|null=root;while(scroll&&scroll!==document.body&&!(scroll.scrollHeight>scroll.clientHeight+1&&/auto|scroll/.test(getComputedStyle(scroll).overflowY)))scroll=scroll.parentElement;active.current={id,root,group:row.dataset.stepGroup??'',scroll:scroll===document.body?null:scroll,x:e.clientX,y:e.clientY,startY:e.clientY,moved:false,drop:null};},
  onPointerMove:(e:PointerEvent<HTMLButtonElement>)=>{const a=active.current;if(!a||a.id!==id)return;a.x=e.clientX;a.y=e.clientY;if(!a.moved&&Math.abs(a.y-a.startY)<6)return;a.moved=true;setDragging(id);target();},
  onPointerUp:(e:PointerEvent<HTMLButtonElement>)=>{const a=active.current;if(a?.moved&&a.drop)commit(a,a.drop);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);stop();},
  onPointerCancel:stop,onLostPointerCapture:stop,
  onKeyDown:(e:KeyboardEvent<HTMLButtonElement>)=>{if(latest.current.blocked||!['ArrowUp','ArrowDown','Escape'].includes(e.key))return;e.preventDefault();if(e.key==='Escape'){stop();return;}const root=e.currentTarget.closest<HTMLElement>('[data-step-list]'),row=e.currentTarget.closest<HTMLElement>('[data-step-id]');if(!root||!row)return;const group=row.dataset.stepGroup??'',rows=Array.from(root.querySelectorAll<HTMLElement>('[data-step-id]')).filter(el=>el.dataset.stepGroup===group),i=rows.findIndex(el=>el.dataset.stepId===id),next=rows[i+(e.key==='ArrowUp'?-1:1)];if(next?.dataset.stepId)commit({id,root,group},{id:next.dataset.stepId,after:e.key==='ArrowDown'},true);}
 })};
}
