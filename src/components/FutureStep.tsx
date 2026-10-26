'use client';
import {useState,type ReactNode} from 'react';
import type {PlannedTask} from '@/domain/meal';
export default function FutureStep({task,children,onClose}:{task:PlannedTask;children:ReactNode;onClose:()=>void}){
 const [open,setOpen]=useState(false);
 return <details className="future-step" onToggle={e=>{setOpen(e.currentTarget.open);if(!e.currentTarget.open)onClose();}}>
  <summary><span><strong>{task.title}</strong><span className="muted small">{task.dishName}{task.isCondition?' · Check conditions':''}</span></span><time dateTime={task.scheduledAt??undefined}>{task.scheduledAt?new Date(task.scheduledAt).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'}):'Timing TBD'}</time></summary>
  {open && children}
 </details>;
}
