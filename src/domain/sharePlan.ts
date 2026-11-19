import type {Meal,PlannedTask} from './meal';
import {cookDuration} from './cookDuration';
import {timedOrder} from './stepTiming';

/** A self-contained, read-only plan snapshot suitable for Messages or Markdown. */
export function formatMealPlanForShare(meal:Meal,timeline:PlannedTask[],now:number=Date.now()):string {
 const date=(value:string|null|undefined)=>{
  if(!value||!Number.isFinite(Date.parse(value)))return 'Time to be confirmed';
  return new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
 };
 const estimate=cookDuration(meal,timeline,now);
 const beers=estimate.minutes===null?'Timing TBD':`~${(estimate.minutes/90).toFixed(1)} beers`;
 const menu=meal.dishes.map(d=>d.name.trim()).filter(Boolean).map(name=>`- ${name}`);
 const schedule=timedOrder(timeline,task=>task.scheduledAt).map(task=>
  `- ${date(task.scheduledAt)}: ${task.title} (${task.dishName})`);
 return [
  '🍻 How Many Beers?',
  'From First Beer to First Bite.',
  '',
  meal.name.trim()||'Our meal plan',
  `Dinner: ${date(meal.serveAt)}`,
  '',
  'MENU',
  ...(menu.length?menu:['- Add a dish']),
  '',
  `THE BEEROMETER: ${beers}`,
  '',
  'THE GAME PLAN',
  ...(schedule.length?schedule:['- Add steps to build the plan']),
 ].join('\n');
}
