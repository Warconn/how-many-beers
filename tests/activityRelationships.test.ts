import {describe,it,expect} from 'vitest';
import {parseRecipeText} from '../src/domain/recipe';
import {newMeal,createDish} from '../src/domain/meal';
import {cookTimeline,startCookSession,recordEvent,correctActivityBoundary,finishSuppressedHolding,addStep,removeStep} from '../src/domain/cookState';
import {phaseObservations,buildPhasePlan,effectivePhasePlan} from '../src/domain/cookingPhases';
import {detectedActivities,activityIssue,suggestActivities,ACTIVITY_PARAMETER} from '../src/domain/activities';
import {recipeReview,setRecipeActivity} from '../src/domain/recipeReview';
import {convertRecipeReview,instantiateRecipeReview,restoreRecipeReview} from '../src/domain/documents/reviewAdapter';
import {parseCookingDocument} from '../src/domain/documents/cookingDocument';
import {upgradeActivityLinks,rollbackActivityLinks} from '../src/domain/activityMigration';
import {recordedTurkeyBaseline,turkeyTime as at} from './fixtures/parallelCooking';
import {cookProjection} from '../src/domain/cookProjection';
import {exportBackup,validateBackup,emptyHistory} from '../src/domain/cookHistory';

describe('authored activity boundaries and compatibility',()=>{
 it('recognizes brining as Preparing, unknown-duration cooking and separate oil readiness',()=>{
  const d=parseRecipeText('Dinner','Start refrigerated brine\nEnd brine and pat dry\nPreheat fryer\nVerify oil is ready\nLower turkey slowly into oil\nFry turkey until 165°F\nLift turkey to drain');
  expect(d.activities!.definitions.map(a=>[a.stage,a.startStepId,a.endStepId])).toEqual([
   ['preparing','step-1','step-2'],['preheating','step-3','step-4'],['cooking','step-5','step-7']]);
  expect(d.activities!.definitions[2].checkpointStepIds).toEqual(['step-6']);
 });
 it('leaves an unpaired activity ordinary and surfaces a review suggestion',()=>{
  const d=parseRecipeText('Uncertain','Smoke turkey (90 minutes)\nRemove potatoes');
  expect(d.activities!.definitions).toEqual([]);
  expect(suggestActivities(d.steps!)).toHaveLength(1);
  expect(suggestActivities(d.steps!)[0].issue).toContain('end step');
 });
 it('does not guess a shared removal for distinct cooking methods or distinct foods',()=>{
  for(const source of ['Smoke wings (60 minutes)\nFry wings (3 minutes)\nRemove wings','Smoke wings (60 minutes)\nSmoke brisket (600 minutes)\nRemove food from smoker']){
   expect(parseRecipeText('Ambiguous',source).activities!.definitions).toEqual([]);
  }
 });
 it('keeps imported oil checks separate from the simultaneous food checkpoint',()=>{
  const dish=parseRecipeText('Wings','Start smoking wings\nStart heating fryer oil\nCheck wing temperature\nVerify oil is ready\nRemove wings from smoker');
  expect(dish.activities!.definitions.find(a=>a.stage==='preheating')!.checkpointStepIds).toEqual([]);
  expect(dish.activities!.definitions.find(a=>a.stage==='cooking')!.checkpointStepIds).toEqual(['step-3']);
 });
 it('does not use utensil removal or food-temperature checks as physical end gates',()=>{
  for(const check of ['Remove smoker lid','Remove wing thermometer','Take wing temperature']){
   const dish=parseRecipeText('Wings','Start smoking wings\n'+check+'\nRemove wings from smoker');
   expect(dish.activities!.definitions.find(a=>a.stage==='cooking')?.endStepId).toBe('step-3');
  }
  for(const check of ['Check turkey temperature','Check oil temperature','Check turkey is ready']){
   const fryer=parseRecipeText('Fryer','Preheat fryer\n'+check+'\nVerify oil is ready');
   expect(fryer.activities!.definitions.find(a=>a.stage==='preheating')?.endStepId).toBe('step-3');
  }
 });
 it('keeps both wings activities, attributes observations, and does not confuse a reading with readiness',()=>{
  const d={...createDish('wings'),id:'wings'};let m=startCookSession({...newMeal(),serveAt:at('20:00'),dishes:[d]},at('12:00'));
  m=recordEvent(m,'wings:start','completed',at('12:10'));
  m=recordEvent(m,'wings:oil','completed',at('12:20'));
  m=recordEvent(m,'wings:check','completed',at('12:30'));
  m=recordEvent(m,'wings:check','temperature',at('12:31'),145,'°F');
  m=recordEvent(m,'wings:oil-ready','equipment',at('12:32'),300,'°F');
  m=recordEvent(m,'wings:check','equipment',at('12:33'),undefined,undefined,'Checking bark',{type:'note'});
  expect(m.events!.slice(-3).map(e=>e.activityId)).toEqual(['wings:heat','wings:oil','wings:heat']);
  expect(m.completed['wings:oil-ready']).toBeUndefined();
  expect(phaseObservations(m,'wings:oil').end).toBeUndefined();
  expect(()=>recordEvent(m,'wings:check','temperature',at('12:34'),150,'°F',undefined,{activityId:'wings:oil'})).toThrow('linked to this step');
  m=recordEvent(m,'wings:oil-ready','completed',at('12:40'));
  expect(phaseObservations(m,'wings:oil').end!.occurredAt).toBe(at('12:40'));
  expect(phaseObservations(m,'wings:heat').end).toBeUndefined();
  m=recordEvent(m,'wings:smoke-end','completed',at('15:10'));
  m=recordEvent(m,'wings:fry','completed',at('15:11'));
  expect(phaseObservations(m,'wings:fry').start!.occurredAt).toBe(at('15:11'));
  expect(phaseObservations(m,'wings:heat').end!.occurredAt).toBe(at('15:10'));
  const round=validateBackup(exportBackup(m,emptyHistory(),at('15:12'))).active;
  expect(round.events).toEqual(m.events);expect(round.phasePlan).toEqual(m.phasePlan);
 });
 it('stores one compound boundary event, retries idempotently, and corrects only an explicit actual',()=>{
  const d={...createDish('brats'),id:'brats'};
  let m=startCookSession({...newMeal(),serveAt:at('20:00'),dishes:[d]},at('12:00'));
  m=recordEvent(m,'brats:start','completed',at('12:10'));
  m=recordEvent(m,'brats:bath','completed',at('14:10'));
  expect(m.events!.at(-1)!.phaseObservations).toEqual([{phaseId:'brats:heat',boundary:'end'},{phaseId:'brats:sear',boundary:'start'}]);
  expect(recordEvent(m,'brats:bath','completed',at('14:11')).events).toEqual(m.events);
  const before=structuredClone(m),corrected=correctActivityBoundary(m,'brats:heat','end',at('14:09'));
  expect(corrected.events!.slice(0,before.events!.length)).toEqual(before.events);
  expect(corrected.completed).toEqual(before.completed);
  expect(phaseObservations(corrected,'brats:sear').start!.occurredAt).toBe(at('14:10'));
  expect(()=>correctActivityBoundary(m,'brats:heat','end',at('12:00'))).toThrow('before');
 });
 it('counts overlapping same-dish intervals once in the whole-meal lower bound',()=>{
  const d={...parseRecipeText('Parallel wings','Smoke wings (60 minutes)\nStart heating fryer oil (20 minutes)\nVerify oil is ready\nRemove wings from smoker\nServe wings'),id:'parallel'};
  let meal=startCookSession({...newMeal(),serveAt:at('20:00'),dishes:[d]},at('12:00'));
  meal=recordEvent(meal,'parallel:step-1','completed',at('12:00'));meal=recordEvent(meal,'parallel:step-2','completed',at('12:10'));
  const projected=cookProjection(meal,cookTimeline(meal),Date.parse(at('12:20')));
  expect(projected.phases!.filter(p=>p.active)).toHaveLength(2);
  expect(projected.minimumRemaining).toBe(40);
  expect(projected.phases!.find(p=>p.stage==='preheating')!.finish).toBe('2026-11-22T12:30:00.000Z');
 });
 it('includes ordinary preparation before the first independent physical activity',()=>{
  const dish=parseRecipeText('Seeds','Prepare (5 minutes)\nRoast (15 minutes)\nCool (10 minutes)');
  let meal=startCookSession({...newMeal(),serveAt:at('20:00'),dishes:[dish]},at('12:00'));
  expect(cookProjection(meal,cookTimeline(meal),Date.parse(at('12:00'))).minimumRemaining).toBe(30);
  meal=recordEvent(meal,dish.id+':step-1','completed',at('12:01'));
  expect(cookProjection(meal,cookTimeline(meal),Date.parse(at('12:01'))).minimumRemaining).toBe(25);
 });
 it('projects sequential Holding from cooking finish despite an older frozen planned position',()=>{
  const dish={...parseRecipeText('Seeds','Roast seeds (15 minutes)\nRemove seeds and leave to cool (10 minutes)'),id:'seeds'};
  let meal=startCookSession({...newMeal(),serveAt:at('13:00'),dishes:[dish]},at('12:00'));
  meal=recordEvent(meal,'seeds:step-1','completed',at('12:00'));
  meal={...meal,taskOverrides:{...meal.taskOverrides,'seeds:step-1':{...meal.taskOverrides?.['seeds:step-1'],recordedPlanAt:at('07:35')}}};
  const projected=cookProjection(meal,cookTimeline(meal),Date.parse(at('12:05')));
  expect(projected.phases!.find(p=>p.stage==='holding')!.finish).toBe(new Date(at('12:25')).toISOString());
  expect(projected.minimumRemaining).toBe(20);
 });
 it('keeps No activity and stage/boundary corrections through original/copy/save/reuse',()=>{
  let review=recipeReview(parseRecipeText('Brine','Start refrigerated brine\nEnd brine and pat dry\nRoast turkey (60 minutes)\nRemove turkey'),at('20:00'));
  const d=review.dishes[0],first=d.activities!.definitions[0];
  const order=d.activities!.definitions.map(a=>a.id);
  review=setRecipeActivity(review,d.id,first.id,{...first,stage:'preparing'});
  expect(review.dishes[0].activities!.definitions.map(a=>a.id)).toEqual(order);
  const cooking=review.dishes[0].activities!.definitions.find(a=>a.stage==='cooking')!;
  review=setRecipeActivity(review,d.id,cooking.id,null);
  const result=convertRecipeReview(review,'brine');if(result.status!=='converted')throw Error(result.reason);
  expect(restoreRecipeReview(result)).toEqual(review);
  const fresh=instantiateRecipeReview(result.document,at('21:00'),'new-dish');
  expect(fresh.dishes[0].activities).toEqual(review.dishes[0].activities);
  expect(buildPhasePlan(fresh,cookTimeline(fresh)).phases).toHaveLength(1);
  expect(result.document.recipe.parameters?.[ACTIVITY_PARAMETER]).toBeTypeOf('string');
  expect(fresh.events).toBeUndefined();
  const bad=structuredClone(result.document);bad.recipe.parameters![ACTIVITY_PARAMETER]='{"version":2,"definitions":[]}';
  expect(()=>parseCookingDocument(bad)).toThrow();
 });
 it('flags a removed boundary without rewriting the saved definition',()=>{
  const review=recipeReview(parseRecipeText('Roast','Roast turkey (60 minutes)\nRemove turkey'),at('20:00'));
  const d=review.dishes[0],a=d.activities!.definitions[0];
  const hidden={...review,hiddenTaskIds:[d.id+':'+a.endStepId]};
  expect(activityIssue(d,cookTimeline(hidden),a)).toContain('end step');
  expect(d.activities!.definitions[0]).toEqual(a);
 });
 it('protects recorded boundaries and leaves a broken unstarted relationship ordinary',()=>{
  const dish={...parseRecipeText('Roast','Roast turkey (60 minutes)\nRemove turkey from oven'),id:'roast'};
  const fresh=startCookSession({...newMeal(),serveAt:at('20:00'),dishes:[dish]},at('12:00'));
  const hidden=removeStep(fresh,'roast:step-2',at('12:01'));
  expect(effectivePhasePlan(hidden,cookTimeline(hidden))!.phases).toEqual([]);
  expect(recordEvent(hidden,'roast:step-1','completed',at('12:10')).events!.at(-1)!.phaseObservations).toBeUndefined();
  const active=recordEvent(fresh,'roast:step-1','completed',at('12:10')),before=structuredClone(active);
  expect(()=>removeStep(active,'roast:step-2',at('12:20'))).toThrow('bounds recorded activity');
  expect(active).toEqual(before);
 });
 it('keeps an activity linked to an added step across independent recipe reuse',()=>{
  let review=recipeReview(parseRecipeText('Manual','Start refrigerated brine\nSeason turkey'),at('20:00'));
  review=addStep(review,'Remove turkey from brine','Drain and pat dry.');
  const added=review.customTasks!.at(-1)!,dish=review.dishes[0];
  review={...review,customTasks:review.customTasks!.map(t=>({...t,dishId:dish.id,dishName:dish.name}))};
  review=setRecipeActivity(review,dish.id,'brine',{id:'brine',stage:'preparing',startStepId:'step-1',endStepId:added.id,checkpointStepIds:[],provenance:'confirmed'});
  const converted=convertRecipeReview(review,'custom-activity');if(converted.status!=='converted')throw Error(converted.reason);
  expect(restoreRecipeReview(converted)).toEqual(review);
  const reused=instantiateRecipeReview(converted.document,at('21:00'),'fresh');
  const plan=buildPhasePlan(reused,cookTimeline(reused));
  expect(plan.phases.find(p=>p.id==='fresh:brine')?.endTaskIds).toEqual([reused.customTasks![0].id]);
 });
 it('migrates the six-phase turkey defect once, retains originals and all eight events, and rolls back exactly',()=>{
  const original=recordedTurkeyBaseline(),before=structuredClone(original),upgraded=upgradeActivityLinks(original);
  expect(original).toEqual(before);expect(upgraded.events).toEqual(before.events);
  expect(upgraded.phasePlan!.phases.some(p=>p.dishId==='replaced-fryer')).toBe(false);
  expect(upgraded.phasePlan!.phases.filter(p=>p.dishId==='fryer').map(p=>p.stage)).toContain('preheating');
  expect(upgraded.phasePlan!.originalPlan).toEqual(before.phasePlan);
  expect(upgradeActivityLinks(upgraded)).toBe(upgraded);
  expect(upgraded.events!.flatMap(e=>e.phaseObservations??[])).toEqual([]);
  expect(rollbackActivityLinks(upgraded)).toEqual(before);
  expect(validateBackup(exportBackup(upgraded,emptyHistory(),at('13:00'))).active.phasePlan).toEqual(upgraded.phasePlan);
  const recorded=recordEvent(upgraded,'fryer:step-5','started',at('13:00'));
  expect(()=>rollbackActivityLinks(recorded)).toThrow('New activity');
 });
 it('preserves original observed relationships while adding missing independent links during migration',()=>{
  let original=recordedTurkeyBaseline();original=recordEvent(original,'oven:start','started',at('12:10'));
  const upgraded=upgradeActivityLinks(original);
  expect(phaseObservations(upgraded,'oven:heat').start).toEqual(phaseObservations(original,'oven:heat').start);
  expect(upgraded.events).toEqual(original.events);
  expect(effectivePhasePlan(upgraded,cookTimeline(upgraded))!.phases.find(p=>p.id==='oven:heat')).toEqual(original.phasePlan!.phases.find(p=>p.id==='oven:heat'));
 });
 it('finishing explicitly ends a suppressed holding boundary while preserving actual cooking',()=>{
  const d={...parseRecipeText('Seeds','Roast seeds (15 minutes)\nRemove seeds and leave to cool (10 minutes)'),id:'seeds'};
  let m=startCookSession({...newMeal(),serveAt:at('20:00'),dishes:[d]},at('12:00'));
  m=recordEvent(m,'seeds:step-1','completed',at('12:10'));m=recordEvent(m,'seeds:step-2','completed',at('12:25'));
  const before=structuredClone(m.events),done=finishSuppressedHolding(m,at('12:40'));
  expect(done.events!.slice(0,before!.length)).toEqual(before);
  expect(phaseObservations(done,d.id+':activity-step-2').end!.occurredAt).toBe(at('12:40'));
  expect(phaseObservations(done,d.id+':activity-step-1').end!.occurredAt).toBe(at('12:25'));
 });
});
