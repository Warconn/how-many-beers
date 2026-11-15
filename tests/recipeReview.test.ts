import {describe,it,expect} from 'vitest';
import {cookProjection} from '../src/domain/cookProjection';
import {newMeal,createDish} from '../src/domain/meal';
import {cookTimeline,startCookSession,editStep,recordEvent,removeStep,setStepDuration} from '../src/domain/cookState';
import {recipeReview,addReviewedDish} from '../src/domain/recipeReview';
describe('uncommitted recipe review',()=>{
 it('keeps actual progress and serving target while adding independent planning choices',()=>{
  let current={...newMeal(),name:'Existing meal',dishes:[createDish('brisket')],mode:'cooking' as const,startedAt:'2026-11-05T12:00:00Z'};
  const live=recordEvent(current,cookTimeline(current)[0].id,'completed','2026-11-05T12:01:00Z'),before=structuredClone(live);
  let draft=recipeReview(createDish('brats'),'2027-01-01T18:00');const first=cookTimeline(draft)[0];draft=removeStep(draft,first.id,'2026-11-05T12:02:00Z');
  const task=cookTimeline(draft)[0];draft=setStepDuration(editStep(draft,task.id,'My preparation','My method'),task.id,12);
  const next=addReviewedDish(live,draft);
  expect(next.events).toEqual(before.events);expect(next.completed).toEqual(before.completed);expect(next.startedAt).toBe(before.startedAt);expect(next.serveAt).toBe(before.serveAt);expect(next.name).toBe(before.name);expect(next.dishes[0]).toEqual(before.dishes[0]);expect(next.dishes[1].executionAddedAt).toBeTruthy();expect(next.hiddenTaskIds).toContain(first.id);expect(cookTimeline(next).find(t=>t.id===task.id)?.durationMinutes).toBe(12);expect(live).toEqual(before);
 });
 it('clones the chosen method without changing the template or original dish',()=>{
  const source=createDish('brats'),before=structuredClone(source),draft=recipeReview(source,newMeal().serveAt);draft.dishes[0].name='My brats';expect(source).toEqual(before);
 });
 it('rejects an already added dish and any physical cooking activity',()=>{
  const current=newMeal(),draft=recipeReview(createDish('brats'),current.serveAt),added=addReviewedDish(current,draft);
  expect(()=>addReviewedDish(added,draft)).toThrow('already');expect(()=>addReviewedDish(current,{...draft,startedAt:'2026-11-05T12:00:00Z'})).toThrow('unstarted');
 });
 it('keeps unconfirmed text out of a meal and rejects removing the entire method',()=>{
  const current=newMeal(),before=structuredClone(current);let draft=recipeReview(createDish('brats'),current.serveAt);
  for(const task of cookTimeline(draft))draft=removeStep(draft,task.id,'2026-11-05T12:00:00Z');
  expect(()=>addReviewedDish(current,draft)).toThrow('one step');expect(current).toEqual(before);
 });
});
import {reviewDuration} from '../src/domain/recipeReview';
it('shows known template estimates without overriding an explicitly unknown time',()=>{
 const draft=recipeReview(createDish('brats'),newMeal().serveAt),task=cookTimeline(draft).find(t=>t.templateStage?.kind==='cook')!;
 expect(reviewDuration(draft,task)).toBe(120);expect(reviewDuration({...draft,taskOverrides:{[task.id]:{durationMinutes:null}}},task)).toBeNull();
});
it('rejects a review trying to overwrite a different dish override',()=>{
 const current={...newMeal(),dishes:[createDish('brisket')]},draft=recipeReview(createDish('brats'),current.serveAt);
 draft.taskOverrides={[cookTimeline(current)[0].id]:{title:'Corrupted'}};
 expect(()=>addReviewedDish(current,draft)).toThrow('another dish');
});
it('can resubmit an unstarted protected add without duplicates while preserving real activity',()=>{
 const current={...newMeal(),dishes:[createDish('brisket')]};let review=recipeReview(createDish('brats'),current.serveAt);const once=addReviewedDish(current,review);review={...review,dishes:[{...review.dishes[0],name:'Revised brats'}]};const twice=addReviewedDish(once,review,true);expect(twice.dishes).toHaveLength(2);expect(twice.dishes[1].name).toBe('Revised brats');expect(twice.dishes[0]).toEqual(current.dishes[0]);const actual=recordEvent(once,cookTimeline(once).find(t=>t.dishId===review.dishes[0].id)!.id,'completed','2026-11-05T12:00:00Z');expect(()=>addReviewedDish(actual,review,true)).toThrow('activity');
});
it('preserves the first addition timestamp when resubmitting during a live cook',()=>{
 const current={...newMeal(),dishes:[createDish('brisket')],mode:'cooking' as const,startedAt:'2026-11-05T12:00:00Z'},review=recipeReview(createDish('brats'),current.serveAt),once=addReviewedDish(current,review);
 once.dishes[1].executionAddedAt='2026-11-05T12:05:00Z';const again=addReviewedDish(once,review,true);expect(again.dishes[1].executionAddedAt).toBe('2026-11-05T12:05:00Z');expect(again.startedAt).toBe(current.startedAt);
});
import {reorderReviewedStep} from '../src/domain/recipeReview';
import {parseRecipeText} from '../src/domain/recipe';
it('drops steps before and after targets while reflowing known durations',()=>{
 const draft=recipeReview(parseRecipeText('Seeds','Prepare (5 minutes)\nRoast (15 minutes)\nCool (10 minutes)'),newMeal().serveAt),tasks=cookTimeline(draft),before=structuredClone(draft);
 const moved=reorderReviewedStep(draft,tasks[0].id,tasks[2].id,true),order=cookTimeline(moved);
 expect(order.slice(0,3).map(t=>t.id)).toEqual([tasks[1].id,tasks[2].id,tasks[0].id]);
 expect(Date.parse(order[1].scheduledAt!)-Date.parse(order[0].scheduledAt!)).toBe(15*60000);
 expect(moved.serveAt).toBe(draft.serveAt);expect(moved.events??[]).toEqual(draft.events??[]);expect(draft).toEqual(before);
 const back=reorderReviewedStep(moved,tasks[0].id,tasks[1].id,false);expect(cookTimeline(back).slice(0,3).map(t=>t.id)).toEqual(tasks.slice(0,3).map(t=>t.id));
});

it('compiles reviewed new-dish phases without starting them or disturbing a live dish',()=>{
 const live=startCookSession({...newMeal(),dishes:[createDish('side')]},'2026-11-05T12:00:00Z');
 const before=structuredClone(live),draft=recipeReview(createDish('brats'),live.serveAt);
 const heat=cookTimeline(draft).find(t=>t.id.endsWith(':start'))!;
 const next=addReviewedDish(live,setStepDuration(draft,heat.id,90));
 expect(next.phasePlan!.phases.some(p=>p.dishId===draft.dishes[0].id)).toBe(true);
 expect(cookProjection(next,cookTimeline(next),Date.parse('2026-11-05T12:00:00Z')).phases!.find(p=>p.startTaskId===heat.id)?.minutes).toBe(90);
 expect(next.events).toEqual(before.events);expect(next.completed).toEqual(before.completed);
 expect(next.phasePlan!.phases.filter(p=>p.dishId===before.dishes[0].id)).toEqual(before.phasePlan!.phases);
 const retry=addReviewedDish(next,draft,true);
 expect(new Set(retry.phasePlan!.phases.map(p=>p.id)).size).toBe(retry.phasePlan!.phases.length);
 expect(retry.events).toEqual(before.events);
});

it('shorter imported review estimates reflow without a leftover original gap',async()=>{
 const {parseRecipeText}=await import('../src/domain/recipe');const dish=parseRecipeText('Seeds','Roast for 10–15 minutes.\nCool completely.');const source=structuredClone(dish);
 let review=recipeReview(dish,'2026-11-26T00:05');const own=cookTimeline(review).filter(t=>!t.id.endsWith(':serve')).sort((a,b)=>(a.recipeOrder??0)-(b.recipeOrder??0));
 review=setStepDuration(review,own[0].id,12);review=setStepDuration(review,own[1].id,8);
 const steps=cookTimeline(addReviewedDish({...newMeal(),serveAt:review.serveAt},review));const roast=steps.find(t=>t.id===own[0].id)!,cool=steps.find(t=>t.id===own[1].id)!;
 expect(Date.parse(cool.scheduledAt!)-Date.parse(roast.scheduledAt!)).toBe(12*60000);expect(Date.parse(steps.find(t=>t.id.endsWith(':serve'))!.scheduledAt!)-Date.parse(roast.scheduledAt!)).toBe(20*60000);expect(dish).toEqual(source);
});

import {editReviewedStep} from '../src/domain/recipeReview';
it('preserves long imported step text and fixed dates when saving a reviewed duration',()=>{
 const title='A'.repeat(180),instructions='Useful instructions. '.repeat(40);
 const dish=parseRecipeText('Long source',instructions);let review=recipeReview(dish,'2026-11-15T13:00');const task=cookTimeline(review)[0];
 review.taskOverrides={[task.id]:{title,instructions,scheduledAt:'2026-11-15T10:00Z',recordedPlanAt:'2026-11-15T09:00Z'}};
 const next=editReviewedStep(review,task.id,{title,instructions,durationMinutes:13,equipment:task.equipment??'',targetTempF:null});
 expect(next.taskOverrides?.[task.id]).toMatchObject({title,instructions,durationMinutes:13,scheduledAt:'2026-11-15T10:00Z',recordedPlanAt:'2026-11-15T09:00Z'});expect(review.taskOverrides?.[task.id].durationMinutes).toBeUndefined();
});
