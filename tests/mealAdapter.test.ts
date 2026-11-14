import {it,expect} from 'vitest';
import {createDish,newMeal} from '../src/domain/meal';
import {cookTimeline,startCookSession,recordEvent,addStep,editStep,removeStep,type ExtendedMeal} from '../src/domain/cookState';
import {cookProjection} from '../src/domain/cookProjection';
import {applyBrisketTiming,brisketDefaults} from '../src/domain/brisketEstimate';
import {archiveCook,emptyHistory} from '../src/domain/cookHistory';
import {convertMeal,restoreMeal,type MealConversion} from '../src/domain/documents/mealAdapter';
import {convertRetainedRecord,restoreRetainedRecord,convertRecordBatch} from '../src/domain/documents/retainedRecordAdapter';
const serving={timeZone:'America/New_York',serveInstant:'2026-11-15T18:00:00Z'};
function fixture():ExtendedMeal{
 let m:ExtendedMeal={...newMeal(),serveAt:'2026-11-15T13:00',name:'Sunday dinner',dishes:[createDish('brisket'),createDish('brats')]};
 m.dishes[0]=applyBrisketTiming({...m.dishes[0],brisketPlan:{mode:'manual',inputs:{...brisketDefaults,weightLb:7}}},m.serveAt);
 m=addStep(m,'Set the table','Keep plates warm.','2026-11-15T12:30:00-05:00');m=editStep(m,m.customTasks![0].id,'Warm plates','Edited',{timingMode:'fixed',scheduledAt:'2026-11-15T12:35:00-05:00',equipment:'Counter',targetTempF:null,durationMinutes:10});
 const tasks=cookTimeline(m);m=removeStep(m,tasks.find(t=>t.dishId===m.dishes[1].id)!.id,'2026-11-14T12:00Z');
 m.planningGeneralSequence=m.customTasks!.map(t=>t.id);return m;
}
function roundtrip(m:ExtendedMeal){
 const before=structuredClone(m),r=convertMeal(m,serving);expect(r.status,r.status==='skipped'?r.reason:'').toBe('converted');if(r.status==='skipped')throw Error(r.reason);
 const restored=restoreMeal(r.conversion);expect(restored).toEqual(before);expect(m).toEqual(before);
 expect(cookTimeline(restored)).toEqual(cookTimeline(m));
 expect(cookProjection(restored,cookTimeline(restored),Date.parse('2026-11-15T12:00Z'))).toEqual(cookProjection(m,cookTimeline(m),Date.parse('2026-11-15T12:00Z')));
 return r.conversion;
}
it('preserves multi-dish plan, general prep, applied forecast, fixed anchors and explicit serving metadata',()=>{
 const m=fixture(),r=roundtrip(m);expect(r.document.dishes).toHaveLength(2);expect(r.document.generalSteps).toHaveLength(1);expect(r.document.serving).toEqual({local:m.serveAt,timeZone:serving.timeZone,instant:serving.serveInstant});
 expect(r.document.dishes[0].recipe.configuration?.brisketInputs?.weightLb).toBe(7);expect(JSON.stringify(r.document.dishes[0].recipe)).not.toContain('2026-');
 expect(r.context.dishes[m.dishes[0].id].brisketPlan).toEqual(m.dishes[0].brisketPlan);
});
it('preserves physical execution, observations, notes and started state independently of authored JSON',()=>{
 let m=startCookSession(fixture(),'2026-11-14T22:00Z');const heat=cookTimeline(m).find(t=>t.id.endsWith(':start'))!;
 m=recordEvent(m,heat.id,'started','2026-11-14T23:34:00-05:00');m=recordEvent(m,heat.id,'temperature','2026-11-15T07:00:00Z',165,'°F');
 m.notes={[heat.id]:'The bark is ready.'};m.dishes[1].executionAddedAt='2026-11-15T00:00:00Z';
 const r=roundtrip(m);expect(r.context.envelope.events).toEqual(m.events);expect(r.context.envelope.phasePlan).toEqual(m.phasePlan);expect(JSON.stringify(r.document)).not.toContain('occurredAt');expect(JSON.stringify(r.document)).not.toContain('The bark is ready');
});
it('preserves custom task insertion markers without treating them as authored activity',()=>{
 let m=startCookSession(fixture(),'2026-11-14T22:00Z');m=addStep(m,'Set out utensils');const r=roundtrip(m);expect(r.context.generalRuntime[m.customTasks!.at(-1)!.id].executionAddedAt).toBeDefined();
});
it('preserves empty legacy local plans, optional fields and floating serving time without guessing an instant',()=>{
 const m={...newMeal(),serveAt:'2026-11-15T13:00'};delete m.mode;const r=convertMeal(m,{timeZone:'America/New_York',serveInstant:null});expect(r.status).toBe('converted');if(r.status==='skipped')return;
 expect(restoreMeal(r.conversion)).toEqual(m);expect(r.conversion.document.serving.instant).toBeUndefined();
});
it('rejects serving conflicts, malformed drafts, dangling refs and future fields without altering originals',()=>{
 const m=fixture();for(const value of [{...m,serveAt:'2026-11-15T14:00'},{...m,serveAt:'bad draft'},{...m,taskOrder:['missing']},{...m,futureField:3}]){const before=structuredClone(value),r=convertMeal(value,serving);expect(r.status).toBe('skipped');if(r.status==='skipped')expect(r.original).toEqual(before);expect(value).toEqual(before);}
});
it('is idempotent and rejects changed canonical data in immutable compatibility artifacts',()=>{
 const r=roundtrip(fixture());const next=convertMeal(r,serving);expect(next.status).toBe('unchanged');if(next.status!=='skipped')expect(next.conversion).toEqual(r);
 const changed=structuredClone(r);changed.document.generalSteps![0].timing.estimatedMinutes=99;expect(()=>restoreMeal(changed)).toThrow();
 const future={...r,schemaVersion:2};expect(convertMeal(future,serving).status).toBe('skipped');
});
it('preserves archived timeline snapshots without replanning them, plus retained cancellation lifecycle',()=>{
 let m=startCookSession(fixture(),'2026-11-14T22:00Z');m=recordEvent(m,cookTimeline(m)[0].id,'completed','2026-11-15T01:00Z');
 const archived=archiveCook(m,emptyHistory(),'Great cook','2026-11-15T19:00Z').cooks[0];archived.plannedTimeline[0].scheduledAt='2020-01-01T12:00Z';archived.plannedTimeline[0].title='Historical title';
 const a=convertRetainedRecord('archived',archived,serving);expect(a.status,a.status==='skipped'?a.reason:'').toBe('converted');if(a.status!=='skipped'){expect(restoreRetainedRecord(a.conversion)).toEqual(archived);expect(a.conversion.fields.plannedTimeline).toEqual(archived.plannedTimeline);}
 const canceled={state:'canceled' as const,canceledAt:'2026-11-15T19:00Z',meal:m};const c=convertRetainedRecord('canceled',canceled,serving);expect(c.status).toBe('converted');if(c.status!=='skipped')expect(restoreRetainedRecord(c.conversion)).toEqual(canceled);
});
it('preserves saved-plan revision, target, receipt and source document across a batch dry run',()=>{
 const m=fixture(),plan={id:m.id,meal:m,serveInstant:serving.serveInstant,timeZone:serving.timeZone,revision:4,writeId:'write-one',createdAt:'2026-11-13T12:00Z',updatedAt:'2026-11-14T12:00Z',writeReceipt:{operationId:'write-one',planId:m.id}};
 const first=convertRetainedRecord('savedPlan',plan,serving);expect(first.status,first.status==='skipped'?first.reason:'').toBe('converted');if(first.status==='skipped')return;expect(restoreRetainedRecord(first.conversion)).toEqual(plan);
 const batch=convertRecordBatch('savedPlan',[{value:plan,serving},{value:first.conversion,serving},{value:{...plan,revision:0},serving},{value:()=>0,serving}]);expect(batch.counts).toEqual({converted:1,unchanged:1,skipped:1,failed:1});
});
it('honors explicit instants through a DST fold and rejects impossible local/instant pairs',()=>{
 const m={...newMeal(),serveAt:'2026-11-01T01:30'};
 for(const instant of ['2026-11-01T05:30:00Z','2026-11-01T06:30:00Z']){
  const r=convertMeal(m,{timeZone:'America/New_York',serveInstant:instant});expect(r.status).toBe('converted');if(r.status!=='skipped'){expect(r.conversion.document.serving.instant).toBe(instant);expect(restoreMeal(r.conversion)).toEqual(m);}
 }
 expect(convertMeal({...m,serveAt:'2026-03-08T02:30'},{timeZone:'America/New_York',serveInstant:'2026-03-08T07:30:00Z'}).status).toBe('skipped');
 expect(convertMeal({...m,serveAt:'2026-02-30T13:00'},{timeZone:'UTC',serveInstant:null}).status).toBe('skipped');
 const iso={...m,serveAt:'2026-11-15T13:00:00-05:00'},r=convertMeal(iso,{timeZone:'America/New_York',serveInstant:null});expect(r.status).toBe('converted');if(r.status!=='skipped'){expect(r.conversion.document.serving.instant).toBe(iso.serveAt);expect(restoreMeal(r.conversion)).toEqual(iso);}
});
it('preserves a synthetic Browns Brisket archive with 16 events without touching a hosted cook',()=>{
 // Synthetic fixture, not a copy/import of the production cook.
 let m=startCookSession({...newMeal(),id:'synthetic-browns',name:'Browns Brisket',serveAt:'2026-11-15T13:00',dishes:[createDish('brisket')]},'2026-11-14T23:34:00-05:00');
 const task=cookTimeline(m).find(t=>t.id.endsWith(':start'))!,phase=m.phasePlan!.phases[0];
 m=recordEvent(m,task.id,'completed','2026-11-14T23:34:00-05:00');
 m.events![0].phaseObservations=[{phaseId:phase.id,boundary:'start'}];
 for(let i=1;i<16;i++)m=recordEvent(m,task.id,'temperature',new Date(Date.parse('2026-11-15T05:00Z')+i*60000).toISOString(),150+i,'°F');
 const archive=archiveCook(m,emptyHistory(),'Great overall, slightly dry.','2026-11-15T18:00Z').cooks[0],before=structuredClone(archive);
 expect(archive.meal.events).toHaveLength(16);
 const result=convertRetainedRecord('archived',archive,serving);expect(result.status).toBe('converted');if(result.status!=='skipped'){const restored=restoreRetainedRecord(result.conversion);expect(restored).toEqual(before);expect(restored.meal.events).toHaveLength(16);expect(restored.plannedTimeline).toEqual(before.plannedTimeline);}
 expect(archive).toEqual(before);
});
it('protects unknown dish fields and canonical reference corruption',()=>{
 const m=fixture(),before=structuredClone(m);const unknown=structuredClone(m);Object.assign(unknown.dishes[0],{futureModel:1});const skipped=convertMeal(unknown,serving);expect(skipped.status).toBe('skipped');if(skipped.status==='skipped')expect(skipped.original).toEqual(unknown);
 const converted=roundtrip(m);const changed=structuredClone(converted);changed.document.ordering!.taskOrder=[{dishId:'missing',stepId:'start'}];expect(()=>restoreMeal(changed)).toThrow();expect(m).toEqual(before);
});
it('keeps legacy completion-only history without synthesizing stored events',()=>{
 const m=fixture(),id=cookTimeline(m)[0].id;m.completed={[id]:'2026-11-15T01:02:03Z'};delete m.events;delete m.mode;
 const result=roundtrip(m);const restored=restoreMeal(result);expect(Object.hasOwn(restored,'events')).toBe(false);expect(restored.completed).toEqual(m.completed);
});
it('retains account archive envelope fields as supplied without fetching or changing account data',()=>{
 const m=fixture(),archive={...archiveCook(m,emptyHistory(),'Account snapshot','2026-11-15T18:30Z').cooks[0],serveInstant:serving.serveInstant,sourceOwner:'fixture-owner'};
 const r=convertRetainedRecord('archived',archive,serving);expect(r.status).toBe('converted');if(r.status!=='skipped')expect(restoreRetainedRecord(r.conversion)).toEqual(archive);
});
import {instantiateRecipeReview} from '../src/domain/documents/reviewAdapter';
it('saving an applied brisket method preserves its full rest/hold reserve and planned timing without old dates',()=>{
 const m=fixture(),converted=roundtrip(m),snapshot=converted.document.dishes[0];
 const fresh=instantiateRecipeReview({format:'how-many-beers',schemaVersion:1,type:'recipe',id:'saved-brisket',name:snapshot.name,recipe:snapshot.recipe},m.serveAt,'new-dish');
 const authored:ExtendedMeal={...m,dishes:[m.dishes[0]],customTasks:[],taskOverrides:{},hiddenTaskIds:[],taskOrder:[],planningGeneralSequence:[]};const original=cookTimeline(authored),next=cookTimeline(fresh);
 const first=original.find(t=>t.id.endsWith(':rest'))!,copy=next.find(t=>t.id.endsWith(':rest'))!;
 expect(copy.templateStage?.minutes).toBe(first.templateStage?.minutes);expect(copy.templateStage?.minutes).toBe(360);
 const authoredTasks=(tasks:typeof original)=>tasks.map(({id:_id,dishId:_dish,...task})=>task);expect(authoredTasks(next)).toEqual(authoredTasks(original));
 expect(next.find(t=>t.id.endsWith(':start'))?.scheduledAt).toBe(original.find(t=>t.id.endsWith(':start'))?.scheduledAt);
 expect(JSON.stringify(snapshot.recipe)).not.toContain('recommendedStart');expect(JSON.stringify(snapshot.recipe)).not.toContain('2026-');
});

import {dishReviewForRecipe} from '../src/domain/documents/dishExtraction';
import {convertRecipeReview} from '../src/domain/documents/reviewAdapter';
it('extracts a selected method after planned-time edits independently of optional meal metadata',()=>{
 let m:ExtendedMeal={...newMeal(),name:'',serveAt:'2026-11-15T13:00',dishes:[createDish('wings'),createDish('brats')]};const task=cookTimeline(m).find(t=>t.id.endsWith(':start'))!;
 m=editStep(m,task.id,task.title,task.instructions,{plannedTimeOnly:true,timingMode:'fixed',scheduledAt:'2026-11-15T10:00Z',equipment:task.equipment??'',targetTempF:null});const before=structuredClone(m);
 expect(convertMeal(m,{timeZone:'UTC',serveInstant:null}).status).toBe('skipped');const review=dishReviewForRecipe(m,task.dishId),saved=convertRecipeReview(review,'saved');expect(saved.status).toBe('converted');if(saved.status==='converted')expect(JSON.stringify(saved.document)).not.toContain('2026-11-15');expect(m).toEqual(before);expect(m.taskOverrides?.[task.id].scheduledAt).toBe('2026-11-15T10:00:00.000Z');
});
it('method extraction leaves execution, other dishes and unsupported metadata on the source intact',()=>{
 let m=startCookSession(fixture(),'2026-11-14T22:00Z');const t=cookTimeline(m).find(t=>t.dishId===m.dishes[0].id)!;m=recordEvent(m,t.id,'completed','2026-11-14T22:01Z');Object.assign(m.dishes[1],{futureSetting:true});const before=structuredClone(m);
 const review=dishReviewForRecipe(m,m.dishes[0].id),saved=convertRecipeReview(review,'saved');expect(saved.status).toBe('converted');expect(review.events).toBeUndefined();expect(review.completed).toEqual({});expect(review.notes).toEqual({});expect(m).toEqual(before);
 const unsupported=structuredClone(m);Object.assign(unsupported.dishes[0],{futureSetting:true});expect(convertRecipeReview(dishReviewForRecipe(unsupported,unsupported.dishes[0].id),'saved').status).toBe('skipped');
});

import {reorderPlannedStep} from '../src/domain/stepReorder';
it('extracts and reuses wings after moving oil preparation before the preceding doneness check',()=>{
 let m:ExtendedMeal={...newMeal(),name:'Wings',serveAt:'2026-11-15T13:00',dishes:[createDish('wings')]};const tasks=cookTimeline(m),oil=tasks.find(t=>t.id.endsWith(':oil'))!,check=tasks.find(t=>t.id.endsWith(':check'))!;
 m=reorderPlannedStep(m,oil.id,check.id,false);const before=structuredClone(m),result=convertRecipeReview(dishReviewForRecipe(m,oil.dishId),'saved');expect(result.status).toBe('converted');if(result.status!=='converted')throw Error(result.reason);
 const fresh=instantiateRecipeReview(result.document,'2026-12-25T13:00');const next=cookTimeline(fresh);expect(next.findIndex(t=>t.id.endsWith(':oil'))).toBeLessThan(next.findIndex(t=>t.id.endsWith(':check')));expect(next.find(t=>t.id.endsWith(':rest'))?.templateStage?.minutes).toBe(5);expect(m).toEqual(before);
});
