import type {PlannedTask} from './meal';
import {chronologicalTasks} from './stepTiming';

/** Planned clock groups only: no dependency solver or automatic completion. */
export function cookingFocus(tasks:PlannedTask[],completed:Record<string,string>,now:number){
  const groups={now:[] as PlannedTask[],next:[] as PlannedTask[],later:[] as PlannedTask[],untimed:[] as PlannedTask[],completed:[] as PlannedTask[]};
  for(const task of chronologicalTasks(tasks)){
    if(completed[task.id]){groups.completed.push(task);continue;}
    const at=task.scheduledAt?Date.parse(task.scheduledAt):NaN;
    if(!Number.isFinite(at))groups.untimed.push(task);
    else if(at<=now)groups.now.push(task);
    else if(at<=now+30*60_000)groups.next.push(task);
    else groups.later.push(task);
  }
  return groups;
}

/** Selection is view state. Previewing a step never changes completion or events. */
export function guidedCookingSteps(tasks:PlannedTask[],completed:Record<string,string>,selectedId:string|null=null){
  const instant=(task:PlannedTask)=>{const at=task.scheduledAt?Date.parse(task.scheduledAt):NaN;return Number.isFinite(at)?at:Infinity;};
  const ordered=chronologicalTasks(tasks);
  const unfinished=ordered.filter(t=>!completed[t.id]);
  let first=unfinished[0]??null;
  // An imported recipe may have only a serving time. Review its untimed work first.
  if(first?.id.endsWith(':serve'))first=unfinished.find(t=>instant(t)===Infinity)??first;
  const current=ordered.find(t=>t.id===selectedId)??first;
  const index=current?ordered.findIndex(t=>t.id===current.id):-1;
  const candidates=index<0?[]:[...ordered.slice(index+1),...ordered.slice(0,index)];
  const next=candidates.find(t=>!completed[t.id] && t.id!==current?.id)??null;
  return {current,next,ordered,index,remaining:unfinished.length};
}
