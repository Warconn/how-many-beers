import type {CookEvent} from './cookState';
import type {PlannedTask} from './meal';

/** Display-only attribution. Never consult a live recipe or modify the archive. */
export function archivedActivity(event:CookEvent,timeline:readonly PlannedTask[]){
  const names={started:'Started',completed:'Completed',reopened:'Reopened',temperature:'Food temperature',equipment:'Equipment changed',removed:'Removed'};
  const matches=event.taskId ? timeline.filter(step=>step.id===event.taskId) : [];
  const step=matches.length===1 ? matches[0] : undefined;
  return {
    action:(event.observationType==='note'?'Observation':names[event.kind])+(event.value===undefined?'':` ${event.value}${event.unit??''}`),
    context:step ? [step.dishName,step.title].filter(Boolean).join(' · ') : event.taskId ? 'Archived step unavailable' : 'No step recorded',
  };
}
