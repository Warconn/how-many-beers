import {createDish,newMeal} from '../../src/domain/meal';
import {startCookSession,recordEvent,type ExtendedMeal} from '../../src/domain/cookState';
export const mealTime=(day:number,time:string)=>`2026-11-${day}T${time}:00.000Z`;
export function timedMeal():ExtendedMeal {
 const dishes=[{...createDish('brisket'),id:'brisket'},{...createDish('turkey'),id:'turkey',turkeyPrep:{state:'thawed' as const,thawDays:6,brineHours:22,dryHours:2.25}}];
 return startCookSession({...newMeal(),name:'Brisket and Turkey',serveAt:mealTime(21,'18:00'),dishes},mealTime(20,'12:15'));
}
// Independent on-time actions for a Saturday 1 PM New York meal. Ordinary prep
// is checked at completion; bounded cooking/holding is checked at its start.
export const onTimeActions:readonly (readonly [string,string])[]=[
 ['turkey:thaw',mealTime(20,'12:15')],['turkey:brine',mealTime(20,'12:15')],
 ['brisket:prep',mealTime(20,'22:15')],['brisket:season',mealTime(20,'22:30')],['brisket:preheat',mealTime(20,'22:55')],
 ['brisket:start',mealTime(20,'23:00')],['brisket:check',mealTime(21,'06:09')],['brisket:wrap',mealTime(21,'09:24')],
 ['turkey:dry',mealTime(21,'10:15')],['turkey:preheat',mealTime(21,'11:30')],
 ['brisket:finish',mealTime(21,'12:00')],['brisket:rest',mealTime(21,'12:00')],
 ['turkey:prep',mealTime(21,'12:30')],['turkey:start',mealTime(21,'12:30')],
 ['turkey:check','2026-11-21T14:31:30.000Z'],['turkey:baste',mealTime(21,'14:45')],
 ['turkey:finish',mealTime(21,'17:00')],['turkey:rest',mealTime(21,'17:00')],
 ['brisket:serve',mealTime(21,'18:00')],['turkey:serve',mealTime(21,'18:00')],
];
export function holdingHandoffMeal():ExtendedMeal {
 let meal=timedMeal();
 for(const [id,time] of onTimeActions){
  meal=recordEvent(meal,id,'completed',time);
  if(id==='brisket:finish')break;
 }
 return meal;
}
