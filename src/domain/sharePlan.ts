import type {Meal,PlannedTask} from './meal';
import {cookDuration} from './cookDuration';
import {timedOrder} from './stepTiming';

/** A concise plain-text snapshot that pastes cleanly into Messages and email. */
export function formatMealPlanForShare(meal:Meal,timeline:PlannedTask[],now:number=Date.now()):string {
 const valid=(value:string|null|undefined):value is string=>!!value&&Number.isFinite(Date.parse(value));
 const date=(value:string,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat(undefined,options).format(new Date(value));
 const day=(value:string)=>date(value,{weekday:'short',month:'short',day:'numeric'});
 const clock=(value:string)=>date(value,{hour:'numeric',minute:'2-digit'});
 const tidy=(value:string)=>value.replace(/\s+/g,' ').trim();
 const dishes=meal.dishes.map(d=>tidy(d.name)).filter(Boolean);
 const name=tidy(meal.name);
 const heading=!name||/^(next cook|new meal|our meal plan)$/i.test(name)?(dishes.length===1?dishes[0]:'Dinner plan'):name;
 const estimate=cookDuration(meal,timeline,now);
 const beers=estimate.minutes===null?'Estimate TBD':`~${(estimate.minutes/90).toFixed(1)} beers estimated`;
 const lines=[
  '🍻 HOW MANY BEERS?',
  heading,
  valid(meal.serveAt)?`Dinner: ${day(meal.serveAt)} at ${clock(meal.serveAt)}`:'Dinner time TBD',
  '',
  '🍽️ ON THE MENU',
  ...(dishes.length?dishes.map(dish=>`• ${dish}`):['• Menu to be confirmed']),
  '',
  '🍺 THE BEEROMETER',
  beers,
  '',
  '🗓️ THE GAME PLAN',
 ];
 let previousDay='';
 for(const task of timedOrder(timeline,task=>task.scheduledAt)){
  const known=valid(task.scheduledAt);
  const key=known?new Date(task.scheduledAt).toDateString():'unknown';
  if(key!==previousDay){
   lines.push('',known?day(task.scheduledAt!).toUpperCase():'TIME TBD');
   previousDay=key;
  }
  const time=known?clock(task.scheduledAt!):'Time TBD';
  const dish=dishes.length>1?` · ${tidy(task.dishName)}`:'';
  lines.push(`• ${time}  ${tidy(task.title)}${dish}`);
 }
 if(!timeline.length)lines.push('','• Steps to be confirmed');
 lines.push('','────────────','From First Beer to First Bite.');
 return lines.join('\n');
}
