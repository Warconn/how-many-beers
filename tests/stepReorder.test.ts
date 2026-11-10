import {it,expect} from 'vitest';
import {newMeal} from '../src/domain/meal';
import {parseRecipeText} from '../src/domain/recipe';
import {cookTimeline,recordEvent,type ExtendedMeal} from '../src/domain/cookState';
import {reorderPlannedStep} from '../src/domain/stepReorder';

it('drops in the second dish without moving the first or changing physical history',()=>{
 const first=parseRecipeText('Seeds','Roast (15 minutes)\nCool (10 minutes)'),second=parseRecipeText('Vegetables','Prepare (5 minutes)\nRoast (20 minutes)\nRest (10 minutes)');
 let meal:ExtendedMeal={...newMeal(),dishes:[first,second]};const tasks=cookTimeline(meal).filter(t=>t.dishId===second.id);
 meal=recordEvent(meal,tasks[1].id,'started','2026-11-05T12:00:00Z');const before=structuredClone(meal),unrelated=cookTimeline(meal).filter(t=>t.dishId===first.id);
 const changed=reorderPlannedStep(meal,tasks[2].id,tasks[0].id,false),ordered=cookTimeline(changed).filter(t=>t.dishId===second.id);
 expect(ordered.map(t=>t.id)).toEqual([tasks[2].id,tasks[0].id,tasks[1].id,cookTimeline(meal).filter(t=>t.dishId===second.id)[3].id]);
 expect(cookTimeline(changed).filter(t=>t.dishId===first.id)).toEqual(unrelated);expect(changed.dishes[0]).toEqual(before.dishes[0]);expect(changed.events).toEqual(before.events);expect(changed.completed).toEqual(before.completed);expect(changed.serveAt).toBe(before.serveAt);expect(meal).toEqual(before);
});

it('never transfers a step to another dish or accepts a disappeared drop target',()=>{
 const meal={...newMeal(),dishes:[parseRecipeText('One','Cook (10 minutes)'),parseRecipeText('Two','Mix (5 minutes)')]},tasks=cookTimeline(meal),before=structuredClone(meal);
 expect(()=>reorderPlannedStep(meal,tasks[0].id,tasks.find(t=>t.dishId!==tasks[0].dishId)!.id,false)).toThrow('within its dish');expect(()=>reorderPlannedStep(meal,tasks[0].id,'missing',true)).toThrow('existing step');expect(meal).toEqual(before);
});
