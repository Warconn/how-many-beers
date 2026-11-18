import type {Meal,PlannedTask} from './meal';
import {buildPhasePlan} from './cookingPhases';
import {detectedActivities,activityStepKey} from './activities';

/** Build a prospective session without recording any actual activity. Shared by
 * planning and deliberate starts; forecastOrigin is a window, never an actual. */
export function plannedSession(meal:Meal,tasks:PlannedTask[],now:string,origin?:string):Meal{
 const prepared={...meal,dishes:meal.dishes.map(d=>d.activities||d.preset!=='custom'?d:{...d,activities:detectedActivities(tasks.filter(t=>t.dishId===d.id).map(t=>({id:activityStepKey(d.id,t.id),title:t.title,instructions:t.instructions,minutes:t.durationMinutes??null})))})};
 // Older brisket snapshots contain idle calendar gaps that their legacy
 // execution path deliberately compacts. Do not apply the new window policy to
 // those methods or reinterpret their reviewed planning cadence.
 const preserveWindow=!meal.dishes.some(d=>d.preset==='brisket'&&d.brisketTemplateVersion!==2);
 return {...prepared,mode:'cooking',startedAt:now,phasePlan:{...buildPhasePlan(prepared,tasks),...(preserveWindow&&origin&&Date.parse(origin)>Date.parse(now)?{forecastOrigin:origin}:{})}};
}
