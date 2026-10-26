import type {Meal,PlannedTask} from '@/domain/meal';
import {chronologicalTasks} from '@/domain/stepTiming';
function dateLabel(iso:string){return new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(iso));}
export default function PlannedCookStart({meal,timeline}:{meal:Meal;timeline:PlannedTask[]}){
 const remaining=timeline.filter(t=>!meal.completed[t.id]);
 const hasUntimed=remaining.some(t=>!t.scheduledAt || !Number.isFinite(Date.parse(t.scheduledAt)));
 const unfinished=chronologicalTasks(remaining.filter(t=>t.scheduledAt && Number.isFinite(Date.parse(t.scheduledAt)) && !meal.dishes.some(d=>t.id===d.id+':serve')));
 const first=unfinished[0];
 const start=unfinished.find(t=>meal.dishes.some(d=>d.preset!=='custom' && t.id===d.id+':start'));
 return <section className="planned-cook-start" aria-label="Planned start">
  {first ? <><p className="eyebrow">{hasUntimed?'FIRST TIMED STEP':'BEGIN WITH'}</p><strong>{first.title}</strong><p className="muted small">{first.dishName}</p><time dateTime={first.scheduledAt!}>{dateLabel(first.scheduledAt!)}</time>
   {start && start.id!==first.id && <p className="planned-cook-on-heat"><span>First cooking step · {start.dishName}</span><strong>{start.title}</strong><time dateTime={start.scheduledAt!}>{dateLabel(start.scheduledAt!)}</time></p>}
   {hasUntimed && <p className="warning">Some steps have no timing. Review them before relying on this start.</p>}
   <p className="muted small">Planned times are estimates. Start when you’re ready; check actual cooking conditions.</p></> : <p className="muted small">No confirmed start time. Review the plan to set timing.</p>}
 </section>;
}
