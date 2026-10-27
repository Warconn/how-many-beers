import type {PlannedTask} from './meal';
import {formatDuration} from './stepTiming';
const instant=(value:string|null|undefined)=>value && Number.isFinite(Date.parse(value))?Date.parse(value):null;
const duration=(task:PlannedTask)=>task.durationMinutes!=null && Number.isFinite(task.durationMinutes) && task.durationMinutes>=0?task.durationMinutes*60000:null;

/** Preserve original spacing, extending it only where an explicit duration needs
 * more room. Input order is the recipe/template sequence, never checklist order.
 * Fixed and recorded starts are anchors; untimed stages break automatic links. */
export function adjustDishSequence(sequence:PlannedTask[],recorded:ReadonlySet<string>):{tasks:PlannedTask[];warnings:string[]}{
 const tasks:PlannedTask[]=[],warnings:string[]=[];
 let shift=0,previous:PlannedTask|undefined;
 for(const task of sequence){
  const base=instant(task.baseScheduledAt===undefined?task.scheduledAt:task.baseScheduledAt),current=instant(task.scheduledAt);
  if(base===null || current===null){tasks.push({...task});shift=0;previous=undefined;continue;}
  let planned=base+shift;
  const previousStart=previous?instant(previous.scheduledAt):null,previousDuration=previous?duration(previous):null;
  const previousEnd=previousStart!==null && previousDuration!==null?previousStart+previousDuration:null;
  if(previousEnd!==null)planned=Math.max(planned,previousEnd);
  const fixed=task.timingMode==='fixed',locked=fixed||recorded.has(task.id);
  if(locked && previousEnd!==null && previousEnd>current){warnings.push(`${task.dishName}: duration of “${previous!.title}” runs past ${fixed?'fixed':'recorded'} step “${task.title}”. Its planned time was kept. Review the conflict before cooking.`);}
  const next=locked?current:planned;
  if(!Number.isFinite(new Date(next).getTime()) || !Number.isFinite(new Date(planned).getTime())){warnings.push(`${task.dishName}: could not adjust “${task.title}” beyond the supported date range.`);tasks.push({...task});shift=0;previous=undefined;continue;}
  const adjusted:PlannedTask={...task,scheduledAt:new Date(next).toISOString(),baseScheduledAt:new Date(recorded.has(task.id)&&!fixed?current:planned).toISOString(),scheduleAdjustmentMinutes:locked?0:(next-base)/60000};
  // Leave unchanged ISO spelling/seconds intact when no adjustment is needed.
  if(next===current)adjusted.scheduledAt=task.scheduledAt;
  shift=locked?(!fixed && task.recordedPlanAt!==undefined?next-base:0):next-base;tasks.push(adjusted);previous=adjusted;
 }
 return {tasks,warnings};
}
export function servingConflict(tasks:PlannedTask[],serveAt:string):string[]{
 const target=instant(serveAt);if(target===null)return [];
 let latest=target;
 for(const task of tasks){const start=instant(task.scheduledAt);if(start!==null)latest=Math.max(latest,start+(duration(task)??0));}
 return latest>target?[`${tasks[0]?.dishName??'Dish'}: plan runs ${formatDuration((latest-target)/60000)} after the serving target. Move the start earlier or review serving time.`]:[];
}
