import type {Meal,PlannedTask} from './meal';
import {cookDuration} from './cookDuration';
import {timedOrder} from './stepTiming';

/** Plain-text meal snapshot designed to read naturally in Messages and email. */
export function formatMealPlanForShare(meal:Meal,timeline:PlannedTask[],now:number=Date.now()):string {
 const valid=(value:string|null|undefined):value is string=>!!value&&Number.isFinite(Date.parse(value));
 const format=(value:string,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat(undefined,options).format(new Date(value));
 const day=(value:string)=>format(value,{weekday:'short',month:'short',day:'numeric'});
 const clock=(value:string)=>format(value,{hour:'numeric',minute:'2-digit'});
 const dishes=meal.dishes.map(d=>d.name.trim()).filter(Boolean);
 const name=meal.name.trim();
 const generic=!name||/^(next cook|new meal|our meal plan)$/i.test(name);
 const heading=generic?(dishes.length===1?dishes[0]:'Dinner plan'):name;
 const estimate=cookDuration(meal,timeline,now);
 const beers=estimate.minutes===null?'Beers TBD':`~${(estimate.minutes/90).toFixed(1)} beers`;
 const lines=[
  '🍻 How Many Beers?',
  heading,
  valid(meal.serveAt)?`🍽️ Dinner: ${day(meal.serveAt)} · ${clock(meal.serveAt)}`:'🍽️ Dinner time TBD',
  `🍺 ${beers}`,
 ];
 // Avoid repeating the only dish immediately under its own name.
 if(dishes.length>1||dishes.length===1&&heading!==dishes[0]){
  lines.push('','On the menu',...dishes.map(dish=>`• ${dish}`));
 }
 lines.push('','🕒 Game plan');
 let previousDay='';
 for(const task of timedOrder(timeline,task=>task.scheduledAt)){
  const known=valid(task.scheduledAt);
  const key=known?new Date(task.scheduledAt).toDateString():'unknown';
  if(key!==previousDay){
   lines.push('',known?day(task.scheduledAt!).toUpperCase():'TIME TBD');
   previousDay=key;
  }
  const label=known?clock(task.scheduledAt!):'Time TBD';
  const dish=dishes.length>1?` · ${task.dishName}`:'';
  lines.push(`• ${label}  ${task.title}${dish}`);
 }
 if(!timeline.length)lines.push('','Add steps to build the plan');
 lines.push('','From First Beer to First Bite.');
 return lines.join('\n');
}
