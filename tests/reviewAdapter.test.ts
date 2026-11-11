import {it,expect} from 'vitest';
import {createDish,type PlannedTask} from '../src/domain/meal';
import {recipeReview,addReviewedDish} from '../src/domain/recipeReview';
import {cookTimeline,editStep,removeStep,setStepDuration,startCookSession,recordEvent,type ExtendedMeal} from '../src/domain/cookState';
import {reorderPlannedStep} from '../src/domain/stepReorder';
import {cookProjection} from '../src/domain/cookProjection';
import {parseRecipeText} from '../src/domain/recipe';
import {convertRecipeReview,restoreRecipeReview,instantiateRecipeReview} from '../src/domain/documents/reviewAdapter';
import {parseCookingDocument} from '../src/domain/documents/cookingDocument';
const date='2026-11-15T13:00',nextDate='2026-12-25T13:00';
function conversion(review:ExtendedMeal){const r=convertRecipeReview(review,'saved-recipe');expect(r.status,r.status==='skipped'?r.reason:'').toBe('converted');if(r.status!=='converted')throw Error(r.reason);return r;}
function roundtrip(review:ExtendedMeal){
 const before=structuredClone(review),r=conversion(review),restored=restoreRecipeReview(r);
 expect(restored).toEqual(before);expect(review).toEqual(before);expect(cookTimeline(restored)).toEqual(cookTimeline(review));
 const a=startCookSession(review,'2026-11-14T12:00Z'),b=startCookSession(restored,'2026-11-14T12:00Z');
 expect(b.phasePlan).toEqual(a.phasePlan);
 expect(cookProjection(b,cookTimeline(b),Date.parse('2026-11-14T12:00Z'))).toEqual(cookProjection(a,cookTimeline(a),Date.parse('2026-11-14T12:00Z')));
 return r;
}
it.each(['brisket','brats','wings','turkey','ribs'] as const)('retains %s override settings, null durations and hidden checks',preset=>{
 let review=recipeReview(createDish(preset),date);const tasks=cookTimeline(review),step=tasks[0];
 review=editStep(review,step.id,'My action','My instructions',{timingMode:'plan',scheduledAt:null,durationMinutes:12,equipment:'My smoker',targetTempF:190});
 review=setStepDuration(review,tasks[1].id,null);review=removeStep(review,tasks.at(-2)!.id,'2026-11-14T12:00Z');
 const r=roundtrip(review);expect(r.document.recipe.review?.overrides?.[step.id.split(':')[1]].title).toBe('My action');
 expect(JSON.stringify(r.document)).not.toContain('2026-');expect(r.context.meal.events).toEqual(review.events);
});
it('retains absolute/recorded planned times only in context; new plans recompute dates',()=>{
 let review=recipeReview(createDish('ribs'),date);const start=cookTimeline(review).find(t=>t.id.endsWith(':start'))!;
 review=editStep(review,start.id,start.title,start.instructions,{plannedTimeOnly:true,timingMode:'fixed',scheduledAt:'2026-11-15T08:10:00Z',equipment:'',targetTempF:null});
 review.taskOverrides![start.id].recordedPlanAt='2026-11-15T07:40:00Z';
 const r=roundtrip(review),fresh=instantiateRecipeReview(r.document,nextDate,'fresh-dish');
 expect(JSON.stringify(r.document)).not.toContain('2026-11-15');
 expect(fresh.serveAt).toBe(nextDate);expect(fresh.taskOverrides?.['fresh-dish:start'].scheduledAt).toBeUndefined();
 expect(fresh.taskOverrides?.['fresh-dish:start'].recordedPlanAt).toBeUndefined();
 expect(cookTimeline(fresh).find(t=>t.id==='fresh-dish:start')?.scheduledAt).toContain('2026-12-25');
 expect(Date.parse(cookTimeline(restoreRecipeReview(r)).find(t=>t.id===start.id)!.scheduledAt!)).toBe(Date.parse('2026-11-15T08:10Z'));
});
it('retains an explicit unscheduled override without converting unknown to zero',()=>{
 let review=recipeReview(createDish('brats'),date),task=cookTimeline(review)[0];
 review=editStep(review,task.id,task.title,task.instructions,{plannedTimeOnly:true,timingMode:'unscheduled',scheduledAt:null,equipment:'',targetTempF:null});
 const r=roundtrip(review),fresh=instantiateRecipeReview(r.document,nextDate,'fresh');
 expect(fresh.taskOverrides?.['fresh:'+task.id.split(':')[1]].scheduledAt).toBeNull();
});
function customReview():ExtendedMeal{
 let review=recipeReview(parseRecipeText('My side','Prepare for 5 minutes.\nRoast for 20 minutes.\nCool for 10 minutes.'),date);
 const d=review.dishes[0];
 const added:PlannedTask={id:'custom-extra',dishId:d.id,dishName:d.name,title:'Stir gently',instructions:'Keep it moving.',scheduledAt:'2026-11-15T12:20:00Z',isCondition:true,durationMinutes:0,equipment:'Spoon',targetTempF:null,optionalDetails:'Optional detail'};
 review.customTasks=[added];d.planningSequence=[d.steps![0].id,added.id,...d.steps!.slice(1).map(s=>s.id),'serve'];
 review.taskOrder=cookTimeline(review).map(t=>t.id);return review;
}
it('round-trips added steps, source/planning order and edited custom tasks',()=>{
 let review=customReview(),task=review.customTasks![0];
 review=editStep(review,task.id,'Stir twice','My revised method');
 review=reorderPlannedStep(review,task.id,cookTimeline(review).find(t=>t.id.endsWith(':serve'))!.id,false);
 roundtrip(review);
});
it('reuses added/hidden work with new IDs while preserving the live meal and other dishes',()=>{
 let review=customReview();review=removeStep(review,review.customTasks![0].id,'2026-11-14T12:00Z');
 review.notes={[cookTimeline(review)[0].id]:'Private old note'};
 const r=roundtrip(review),a=instantiateRecipeReview(r.document,nextDate),b=instantiateRecipeReview(r.document,nextDate);
 expect(a.dishes[0].id).not.toBe(b.dishes[0].id);expect(a.customTasks![0].id).not.toBe(b.customTasks![0].id);
 expect(a.customTasks![0].scheduledAt).toBeNull();expect(a.events).toBeUndefined();expect(a.notes).toEqual({});expect(a.completed).toEqual({});
 expect(a.hiddenTaskIds).toContain(a.customTasks![0].id);expect(a.dishes[0].planningSequence).toContain(a.customTasks![0].id.split(':')[1]);
 const live=startCookSession(recipeReview(createDish('side'),date),'2026-11-14T12:00Z'),before=structuredClone(live);
 const combined=addReviewedDish(live,a);expect(combined.dishes).toHaveLength(2);expect(combined.events).toEqual(live.events);expect(combined.dishes[0]).toEqual(live.dishes[0]);expect(live).toEqual(before);
});
it('protects physical activity, foreign references, unknown fields and unrelated general prep',()=>{
 const review=customReview(),task=cookTimeline(review)[0];
 for(const value of [recordEvent(review,task.id,'started','2026-11-14T12:00Z'),{...review,taskOrder:['foreign']},{...review,taskOverrides:{foreign:{title:'Wrong dish'}}},{...review,taskOverrides:{[task.id]:{futureSetting:1}}},{...review,customTasks:[{...review.customTasks![0],dishId:'custom'}]}]){
  const before=structuredClone(value),r=convertRecipeReview(value,'recipe');expect(r.status).toBe('skipped');expect(r.original).toEqual(before);expect(value).toEqual(before);
 }
});
it('rejects duplicate/dangling review references and calendar leakage at the schema boundary',()=>{
 const r=conversion(customReview()),doc=r.document;
 expect(()=>parseCookingDocument({...doc,recipe:{...doc.recipe,review:{hiddenStepIds:['missing']}}})).toThrow();
 expect(()=>parseCookingDocument({...doc,recipe:{...doc.recipe,review:{overrides:{serve:{scheduledAt:'2026-11-15T12:00'}}}}})).toThrow();
 expect(()=>parseCookingDocument({...doc,recipe:{...doc.recipe,review:{addedSteps:[...doc.recipe.review!.addedSteps!,...doc.recipe.review!.addedSteps!]}}})).toThrow();
});
it('keeps recipe-local custom keys stable through repeated reuse and conversion',()=>{
 const r=conversion(customReview());let doc=r.document;
 for(let n=0;n<3;n++){
  const fresh=instantiateRecipeReview(doc,nextDate),round=conversion(fresh);
  expect(round.document).toEqual(doc);doc=round.document;
 }
});
it('accepts explicit authored overlay edits and rejects unsupported added-step semantics',()=>{
 const r=conversion(customReview()),edited=structuredClone(r.document),key=edited.recipe.steps[0].id;
 edited.recipe.review!.overrides={[key]:{title:'A new reviewed title',durationMinutes:7}};
 const fresh=instantiateRecipeReview(edited,nextDate);expect(cookTimeline(fresh).find(t=>t.id.endsWith(':'+key))?.title).toBe('A new reviewed title');
 const unsupported=structuredClone(r.document);unsupported.recipe.review!.addedSteps![0].timing.estimatedMinutes=99;
 expect(()=>instantiateRecipeReview(unsupported,nextDate)).toThrow('cannot round-trip');
});
it('supports hidden imported source steps and zero-duration added steps without phase guessing',()=>{
 let review=customReview();const first=cookTimeline(review)[0];review=removeStep(review,first.id,'2026-11-14T12:00Z');
 const r=roundtrip(review),fresh=instantiateRecipeReview(r.document,nextDate),custom=fresh.customTasks![0];
 expect(custom.durationMinutes).toBe(0);expect(custom.isCondition).toBe(true);
 expect(fresh.hiddenTaskIds).toContain(fresh.dishes[0].id+':'+first.id.split(':')[1]);
 const plan=startCookSession(fresh,'2026-12-24T12:00Z').phasePlan!;
 expect(plan.phases.some(p=>p.startTaskId===custom.id)).toBe(false);
});
import {convertDish} from '../src/domain/documents/dishAdapter';
it('continues to instantiate the earlier plain dish documents with native ordering',()=>{
 const dish=parseRecipeText('Side','Mix for 5 minutes.\nRoast for 10 minutes.');dish.planningSequence=[...dish.steps!.map(s=>s.id),'serve'];
 const doc=convertDish(dish,'saved-recipe');expect(doc.status).toBe('converted');
 if(doc.status==='converted')expect(instantiateRecipeReview(doc.document,nextDate).dishes[0].planningSequence).toEqual(dish.planningSequence);
});
