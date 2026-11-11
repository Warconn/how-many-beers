import {describe,it,expect} from 'vitest';
import {createDish,newMeal,type Dish} from '../src/domain/meal';
import {parseRecipeText} from '../src/domain/recipe';
import {convertDish,instantiateRecipe} from '../src/domain/documents/dishAdapter';
import {buildDishTimeline} from '../src/domain/schedule';
import {cookTimeline,startCookSession} from '../src/domain/cookState';
import {cookProjection} from '../src/domain/cookProjection';
import {applyBrisketTiming,brisketDefaults} from '../src/domain/brisketEstimate';
const serve='2026-11-15T13:00';
const serial=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
function convert(d:Dish){const result=convertDish(d,'recipe-one');expect(result.status,result.status==='skipped'?result.reason:'').toBe('converted');if(result.status!=='converted')throw Error(result.reason);return result;}
function assertRoundTrip(d:Dish){
 const before=serial(d),r=convert(d),restored=instantiateRecipe(r.document,d.id);
 expect(restored).toEqual(before);expect(serial(d)).toEqual(before);
 expect(buildDishTimeline(restored,serve)).toEqual(buildDishTimeline(d,serve));
 const source={...newMeal(),id:'same-meal',serveAt:serve,dishes:[d]},restoredMeal={...source,dishes:[restored]};
 const a=startCookSession(source,'2026-11-14T12:00Z'),b=startCookSession(restoredMeal,'2026-11-14T12:00Z');
 expect(b.phasePlan).toEqual(a.phasePlan);
 expect(cookProjection(b,cookTimeline(b),Date.parse('2026-11-14T12:00Z'))).toEqual(cookProjection(a,cookTimeline(a),Date.parse('2026-11-14T12:00Z')));
 return r;
}
describe('non-mutating native recipe adapters',()=>{
 it.each(['brisket','brats','wings','ribs','turkey','side','chicken'] as const)('round-trips %s without changing schedule or physical projection',preset=>{assertRoundTrip(createDish(preset));});
 it('preserves source text, instructions, temperatures, reviewed hints, unknown and zero durations',()=>{
  const d=parseRecipeText('Seeds','Roast at 180°C for 10–15 minutes.\nCool completely.');
  d.steps!.push({id:'manual-zero',title:'Check seasoning',minutes:0});
  const r=assertRoundTrip(d);expect(r.document.recipe.source.originalText).toBe(d.recipeSource);
  expect(r.document.recipe.steps.some(s=>s.timing.estimatedMinutes===null)).toBe(true);
 });
 it('retains local step ordering after authored reordering and duration edits',()=>{
  const d=parseRecipeText('Manual','Mix for 5 minutes.\nBake for 20 minutes.\nCool for 10 minutes.');
  d.steps![1].minutes=25;d.planningStepOrder=d.steps!.map(s=>s.id).reverse();
  assertRoundTrip(d);
 });
 it('stores phase end and start on one brats transition and does not serialize calendar dates',()=>{
  const {document}=assertRoundTrip(createDish('brats'));
  const transition=document.recipe.steps.find(s=>s.id==='bath')!;
  expect(transition.actions.map(a=>a.type)).toEqual(['end_phase','start_phase']);
  expect(JSON.stringify(document)).not.toContain('2030-');
  expect(document.recipe.steps.find(s=>s.id==='start')!.templateStage?.minutes).toBe(120);
 });
 it('retains wing lead and passive suppression without starting anything',()=>{
  const wings=convert(createDish('wings')).document;
  expect(wings.recipe.phases.find(p=>p.id==='rest')?.leadMinutes).toBe(2);
  const custom=convert(parseRecipeText('Bread','Bake for 10 minutes.\nCool for 5 minutes.')).document;
  expect(custom.recipe.suppressedStepIds).toEqual(['serve']);
 });
 it('preserves manual brisket inputs without double counting rest/hold',()=>{
  const d=createDish('brisket');d.weightLb=7;d.cookMinutes=480;
  d.brisketPlan={mode:'manual',inputs:{...brisketDefaults,weightLb:7,holdBufferMinutes:360}};
  const r=assertRoundTrip(d);expect(r.document.recipe.configuration?.brisketInputs?.holdBufferMinutes).toBe(360);
 });
 it('mints isolated task instance IDs for multiple copies and retains recipe-local keys',()=>{
  const d=parseRecipeText('Soup','Simmer for 10 minutes.\nCool for 5 minutes.'),{document}=convert(d);
  const a=instantiateRecipe(document),b=instantiateRecipe(document);
  expect(a.id).not.toBe(b.id);expect(a.steps?.map(s=>s.id)).toEqual(d.steps?.map(s=>s.id));
  const meal={...newMeal(),serveAt:serve,dishes:[a,b]},tasks=cookTimeline(meal);
  expect(new Set(tasks.map(t=>t.id)).size).toBe(tasks.length);
  a.steps![0].title='Changed only here';expect(b.steps![0].title).toBe(d.steps![0].title);
  expect(document.recipe.steps[0].title).toBe(d.steps![0].title);
 });
 it('skips dated applied forecasts and unknown/actual fields while preserving originals',()=>{
  const d=applyBrisketTiming({...createDish('brisket'),brisketPlan:{mode:'manual',inputs:{...brisketDefaults,weightLb:7}}},serve);
  for(const original of [d,{...createDish('side'),executionAddedAt:'2026-11-14T12:00Z'},{...createDish('side'),futureSetting:3}]){
   const result=convertDish(original,'recipe');expect(result.status).toBe('skipped');expect(result.original).toEqual(original);
  }
 });
 it('rejects canonical edits that native configuration cannot represent',()=>{
  const {document}=convert(createDish('brisket'));document.recipe.steps[0].title='New step title';
  expect(()=>instantiateRecipe(document)).toThrow('newer compatibility adapter');
 });
});

import {recipeReview} from '../src/domain/recipeReview';
import {convertRecipeReview,restoreRecipeReview} from '../src/domain/documents/dishAdapter';
import {editStep,recordEvent,setStepDuration,removeStep} from '../src/domain/cookState';
it('extracts an unstarted review without importing its serving date or meal identity',()=>{
 const review=recipeReview(createDish('brisket'),serve),before=structuredClone(review);
 const result=convertRecipeReview(review,'library-id');expect(result.status).toBe('converted');
 if(result.status==='converted'){
  expect(result.document.id).toBe('library-id');expect(JSON.stringify(result.document)).not.toContain(serve);
  expect(result.original).toEqual(before);
 }
 expect(review).toEqual(before);
});
it('round-trips reviewed edits and removal history while rejecting physical execution',()=>{
 const review=recipeReview(createDish('brisket'),serve),task=cookTimeline(review)[0];
 for(const value of [editStep(review,task.id,'Changed title','Changed instructions'),setStepDuration(review,task.id,null),removeStep(review,task.id,'2026-11-14T12:00Z'),{...review,notes:{[task.id]:'Keep my observation'}}]){
  const before=structuredClone(value),r=convertRecipeReview(value,'recipe');expect(r.status).toBe('converted');
  if(r.status==='converted')expect(restoreRecipeReview(r)).toEqual(before);
  expect(r.original).toEqual(before);expect(value).toEqual(before);
 }
 const actual=recordEvent(review,task.id,'completed','2026-11-14T12:00Z');
 const skipped=convertRecipeReview(actual,'recipe');expect(skipped.status).toBe('skipped');expect(skipped.original).toEqual(actual);
});
it('skips unknown nested settings rather than dropping them and returns isolated originals',()=>{
 const d={...createDish('brisket'),brisketPlan:{mode:'manual' as const,inputs:{...brisketDefaults,futureFlag:true}}};
 const result=convertDish(d,'recipe');expect(result.status).toBe('skipped');expect(result.original).toEqual(d);
 (result.original as Dish).name='Different';expect(d.name).not.toBe('Different');
});
it('repeated conversion produces the same document, with no input mutation',()=>{
 const d=createDish('wings');expect(convertDish(d,'recipe')).toEqual(convertDish(d,'recipe'));
});
