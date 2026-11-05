'use client';
import {useEffect,useRef,useState,type PointerEvent,type KeyboardEvent} from 'react';
import type {ExtendedMeal} from '@/domain/cookState';
import {cookTimeline,moveStep} from '@/domain/cookState';
import {reorderReviewedStep} from '@/domain/recipeReview';

type Drop={id:string;after:boolean};
/** Pointer capture keeps touch and mouse dragging on the grip; the page scrolls normally elsewhere. */
export function useRecipeReorder(meal:ExtendedMeal,onChange:(meal:ExtendedMeal)=>void,blocked:boolean){
 const [dragging,setDragging]=useState<string|null>(null),[drop,setDrop]=useState<Drop|null>(null),[announcement,setAnnouncement]=useState('');
 const active=useRef<{id:string;x:number;y:number;startY:number;moved:boolean;drop:Drop|null}|null>(null);
 const latest=useRef({meal,onChange,blocked});latest.current={meal,onChange,blocked};
 const target=()=>{
  const a=active.current;if(!a)return;
  const row=document.elementFromPoint(a.x,a.y)?.closest<HTMLElement>('[data-review-step]');
  const next=row?.dataset.reviewStep&&row.dataset.reviewStep!==a.id?{id:row.dataset.reviewStep,after:a.y>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2}:null;
  a.drop=next;setDrop(previous=>previous?.id===next?.id&&previous?.after===next?.after?previous:next);
 };
 useEffect(()=>{
  if(!dragging)return;let frame=0;
  const scroll=()=>{const a=active.current;if(!a)return;const dy=a.y<70?-9:a.y>innerHeight-70?9:0;if(dy&&a.moved){window.scrollBy(0,dy);target();}frame=requestAnimationFrame(scroll);};
  frame=requestAnimationFrame(scroll);return()=>cancelAnimationFrame(frame);
 },[dragging]);
 const stop=()=>{active.current=null;setDragging(null);setDrop(null);};
 useEffect(()=>{if(blocked)stop();},[blocked]);
 const announce=(next:ExtendedMeal,id:string)=>{const list=cookTimeline(next),index=list.findIndex(t=>t.id===id);setAnnouncement(`${list[index]?.title??'Step'} moved to position ${index+1} of ${list.length}.`);};
 return {dragging,drop,announcement,grip:(id:string)=>({
  onPointerDown:(e:PointerEvent<HTMLButtonElement>)=>{if(latest.current.blocked||e.button!==0||!e.isPrimary)return;e.preventDefault();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);active.current={id,x:e.clientX,y:e.clientY,startY:e.clientY,moved:false,drop:null};},
  onPointerMove:(e:PointerEvent<HTMLButtonElement>)=>{const a=active.current;if(!a||a.id!==id)return;a.x=e.clientX;a.y=e.clientY;if(!a.moved&&Math.abs(a.y-a.startY)<6)return;a.moved=true;setDragging(id);target();},
  onPointerUp:(e:PointerEvent<HTMLButtonElement>)=>{const a=active.current;if(!a)return;const {meal,onChange,blocked}=latest.current;if(a.moved&&a.drop&&!blocked){const next=reorderReviewedStep(meal,id,a.drop.id,a.drop.after);onChange(next);announce(next,id);}if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);stop();},
  onPointerCancel:stop,
  onLostPointerCapture:stop,
  onKeyDown:(e:KeyboardEvent<HTMLButtonElement>)=>{if(latest.current.blocked||!['ArrowUp','ArrowDown','Escape'].includes(e.key))return;e.preventDefault();if(e.key==='Escape'){stop();return;}const {meal,onChange}=latest.current;const tasks=cookTimeline(meal),i=tasks.findIndex(t=>t.id===id);if(e.key==='ArrowUp'&&i===0||e.key==='ArrowDown'&&i===tasks.length-1)return;const next=moveStep(meal,id,e.key==='ArrowUp'?'up':'down',meal.dishes[0].id,true);onChange(next);announce(next,id);requestAnimationFrame(()=>{const grip=document.querySelector<HTMLElement>(`[data-review-grip="${CSS.escape(id)}"]`);grip?.focus({preventScroll:true});grip?.scrollIntoView({block:'nearest'});});}
 })};
}
