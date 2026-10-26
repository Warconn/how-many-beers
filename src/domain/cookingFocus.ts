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
