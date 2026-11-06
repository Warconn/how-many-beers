import type {Meal} from './meal';
import {cookTimeline,moveStep,type ExtendedMeal} from './cookState';

/** Drop within a dish, using the same planning reflow as an adjacent move. */
export function reorderPlannedStep(meal:Meal,id:string,target:string,after:boolean):ExtendedMeal{
 const timeline=cookTimeline(meal),source=timeline.find(t=>t.id===id),destination=timeline.find(t=>t.id===target);
 if(!source||!destination)throw Error('Choose an existing step to move.');
 if(source.dishId!==destination.dishId)throw Error('Move this step within its dish.');
 let next=meal as ExtendedMeal;
 for(let n=0;n<timeline.length*2+2;n++){
  const tasks=cookTimeline(next).filter(t=>t.dishId===source.dishId),from=tasks.findIndex(t=>t.id===id),to=tasks.findIndex(t=>t.id===target);
  if(id===target||from===(after?to+1:to-1))return next;
  next=moveStep(next,id,from<to?'down':'up',source.dishId,true);
 }
 throw Error('Could not move this step. Your plan is unchanged.');
}
