import {describe,it,expect} from 'vitest';
import {createDish,newMeal,type PlannedTask} from '../src/domain/meal';
import {cookTimeline,editStep,recordEvent,stepTimingWarnings,type StepPlanEdit} from '../src/domain/cookState';
import {adjustDishSequence} from '../src/domain/stepDependencies';
import {archiveCook,emptyHistory,exportBackup,repeatArchivedCook,validateBackup} from '../src/domain/cookHistory';
import {parseRecipeText} from '../src/domain/recipe';
const minute=60000;
const details=(durationMinutes:number|null,extra:Partial<StepPlanEdit>={}):StepPlanEdit=>({timingMode:'plan',scheduledAt:null,durationMinutes,equipment:'Oven',targetTempF:null,...extra});
const seed=()=>({...newMeal(),serveAt:'2026-10-28T16:00',dishes:[{...createDish('turkey'),turkeyPrep:{state:'thawed' as const,thawDays:0,brineHours:0,dryHours:0}},createDish('brats')]});
const dates=(m:ReturnType<typeof seed>)=>Object.fromEntries(cookTimeline(m).map(t=>[t.id,t.scheduledAt]));
function edit(m:ReturnType<typeof seed>,suffix:string,duration:number|null){const task=cookTimeline(m).find(t=>t.id===m.dishes[0].id+':'+suffix)!;return editStep(m,task.id,task.title,task.instructions,details(duration));}
describe('following dish timing',()=>{
 it('keeps the edited start, pushes successors only as needed and preserves other dishes and immutable actuals',()=>{
  const m=seed(),id=m.dishes[0].id;const active=recordEvent(m,m.dishes[1].id+':prep','completed','2026-10-27T12:00:00Z');const snapshot=JSON.stringify(active),before=dates(active);const after=edit(active,'preheat',840),tasks=cookTimeline(after),byId=Object.fromEntries(tasks.map(t=>[t.id,t]));
  expect(byId[id+':preheat'].scheduledAt).toBe(before[id+':preheat']);expect(Date.parse(byId[id+':prep'].scheduledAt!)).toBe(Date.parse(before[id+':preheat']!)+840*minute);
  for(const t of cookTimeline(m).filter(t=>t.dishId===id&&t.id!==id+':preheat'))expect(Date.parse(byId[t.id].scheduledAt!)-Date.parse(t.scheduledAt!)).toBe(795*minute);
  expect(tasks.filter(t=>t.dishId===m.dishes[1].id)).toEqual(cookTimeline(active).filter(t=>t.dishId===m.dishes[1].id));expect(after.events).toEqual(active.events);expect(after.completed).toEqual(active.completed);expect(after.serveAt).toBe(m.serveAt);expect(JSON.stringify(active)).toBe(snapshot);expect(after.taskOverrides![id+':prep']).toBeUndefined();expect(stepTimingWarnings(after).join(' ')).toMatch(/after.*serving target/);
 });
 it('removes extra delay on shortening/reset, retains original spacing and leaves unknown durations unknown',()=>{
  const m=seed(),id=m.dishes[0].id;const extended=edit(m,'preheat',840),shortened=edit(extended,'preheat',60);expect(Date.parse(dates(shortened)[id+':prep']!)-Date.parse(dates(m)[id+':preheat']!)).toBe(60*minute);
  expect(dates(edit(shortened,'preheat',null))).toEqual(dates(m));expect(dates(edit(m,'preheat',0))).toEqual(dates(m));expect(cookTimeline(m).every(t=>t.durationMinutes===null)).toBe(true);
 });
 it('stops at fixed or recorded anchors, explains conflicts and resets timing to the dependency-adjusted plan',()=>{
  const m=seed(),id=m.dishes[0].id,original=dates(m);const fixed={...m,taskOverrides:{[id+':prep']:{scheduledAt:original[id+':prep']}}};const after=edit(fixed,'preheat',840);expect(dates(after)[id+':prep']).toBe(original[id+':prep']);expect(dates(after)[id+':start']).toBe(original[id+':start']);expect(stepTimingWarnings(after).join(' ')).toMatch(/fixed.*Prepare and season/);
  const task=cookTimeline(after).find(t=>t.id===id+':prep')!;const reset=editStep(after,task.id,task.title,task.instructions,details(null));expect(Date.parse(dates(reset)[id+':prep']!)).toBe(Date.parse(original[id+':preheat']!)+840*minute);
  const recorded=recordEvent(m,id+':prep','temperature','2026-10-27T12:00:00Z',40,'°F');const changed=edit(recorded,'preheat',840);expect(dates(changed)[id+':prep']).toBe(original[id+':prep']);expect(changed.events).toEqual(recorded.events);expect(stepTimingWarnings(changed).join(' ')).toMatch(/recorded step/);
 });
 it('ignores manual checklist order, skips hidden steps and uses absolute elapsed time across DST',()=>{
  const m=seed();m.serveAt='2026-11-01T20:00:00-05:00';const id=m.dishes[0].id;const start=Date.parse(dates(m)[id+':preheat']!);const reversed={...m,taskOrder:cookTimeline(m).map(t=>t.id).reverse(),hiddenTaskIds:[id+':baste']};const changed=edit(reversed,'preheat',840);expect(Date.parse(dates(changed)[id+':prep']!)).toBe(start+840*minute);expect(cookTimeline(changed).some(t=>t.id===id+':baste')).toBe(false);expect(changed.taskOrder).toEqual(reversed.taskOrder);
 });
 it('handles chained duration edits, imported recipes, backup/archive/repeat without persisting derived fixed overrides',()=>{
  const recipe=parseRecipeText('Soup','Chop\nSimmer');recipe.steps![0].minutes=10;recipe.steps![1].minutes=20;const m={...newMeal(),serveAt:'2026-11-25T18:00',dishes:[recipe]};const task=cookTimeline(m).find(t=>t.title==='Chop')!,next=cookTimeline(m).find(t=>t.title==='Simmer')!;const changed=editStep(m,task.id,task.title,task.instructions,details(60));expect(Date.parse(dates(changed)[next.id]!)-Date.parse(dates(m)[next.id]!)).toBe(50*minute);
  const twice=editStep(changed,next.id,next.title,next.instructions,details(40));expect(Date.parse(dates(twice)[recipe.id+':serve']!)-Date.parse(m.serveAt)).toBe(70*minute);
  const history=archiveCook(twice,emptyHistory(),'','2026-11-26T12:00:00Z');const frozen=JSON.stringify(history);const backup=validateBackup(exportBackup(twice,history,'2026-11-26T13:00:00Z'));expect(cookTimeline(backup.active)).toEqual(cookTimeline(twice));const repeated=repeatArchivedCook(history.cooks[0]);expect(repeated.events).toEqual([]);expect(cookTimeline(repeated).find(t=>t.title==='Simmer')!.scheduledAt).not.toBe(next.scheduledAt);expect(JSON.stringify(history)).toBe(frozen);
 });
 it('locks a shifted planned position at first recording without snapping later steps back, and clears that anchor on repeat',()=>{
  const m=edit(seed(),'preheat',840),id=m.dishes[0].id,planned=dates(m);const active=recordEvent(m,id+':prep','completed','2026-10-29T05:00:00Z');expect(dates(active)).toEqual(planned);expect(active.taskOverrides![id+':prep'].recordedPlanAt).toBe(planned[id+':prep']);
  const changed=edit(active,'preheat',900);expect(dates(changed)[id+':prep']).toBe(planned[id+':prep']);expect(dates(changed)[id+':start']).toBe(planned[id+':start']);expect(changed.events).toEqual(active.events);
  const repeated=repeatArchivedCook(archiveCook(active,emptyHistory(),'','2026-10-30T12:00:00Z').cooks[0]);expect(Object.values(repeated.taskOverrides!).every(o=>o.recordedPlanAt===undefined)).toBe(true);
 });
 it('preserves date-only fixed overrides without automatically moving unknown-duration stages',()=>{
  const m=seed(),task=cookTimeline(m)[0],before=dates(m);const changed=editStep(m,task.id,task.title,task.instructions,details(null,{timingMode:'fixed',scheduledAt:'2026-11-26T05:30:00Z'}));for(const t of cookTimeline(changed).filter(t=>t.id!==task.id))expect(t.scheduledAt).toBe(before[t.id]);
 });
 it('links a previously untimed recipe stage once its start and duration are explicitly supplied',()=>{
  const recipe=parseRecipeText('Soup','Chop\nSimmer');recipe.steps![1].minutes=20;const m={...newMeal(),serveAt:'2026-11-25T18:00:00Z',dishes:[recipe]};const first=cookTimeline(m).find(t=>t.title==='Chop')!,second=cookTimeline(m).find(t=>t.title==='Simmer')!;const changed=editStep(m,first.id,first.title,first.instructions,details(120,{timingMode:'fixed',scheduledAt:'2026-11-25T18:00:00Z'}));expect(dates(changed)[second.id]).toBe('2026-11-25T20:00:00.000Z');
 });
 it('uses elapsed durations across a repeated DST hour',()=>{
  const task=(id:string,at:string,durationMinutes:number|null):PlannedTask=>({id,dishId:'d',dishName:'Dish',title:id,instructions:'',scheduledAt:at,baseScheduledAt:at,durationMinutes,isCondition:false});const result=adjustDishSequence([task('a','2026-11-01T05:30:00Z',120),task('b','2026-11-01T06:00:00Z',null)],new Set());expect(result.tasks[1].scheduledAt).toBe('2026-11-01T07:30:00.000Z');
 });
 it('treats untimed stages as boundaries and does not fabricate dates from malformed saved values',()=>{
  const tasks:PlannedTask[]=[{id:'a',dishId:'d',dishName:'Dish',title:'First',instructions:'',scheduledAt:'2026-11-01T05:30:00Z',baseScheduledAt:'2026-11-01T05:30:00Z',durationMinutes:120,isCondition:false},{id:'b',dishId:'d',dishName:'Dish',title:'Unknown',instructions:'',scheduledAt:null,isCondition:false},{id:'c',dishId:'d',dishName:'Dish',title:'Last',instructions:'',scheduledAt:'2026-11-01T06:00:00Z',isCondition:false}];const before=JSON.stringify(tasks);expect(adjustDishSequence(tasks,new Set()).tasks[2].scheduledAt).toBe(tasks[2].scheduledAt);expect(JSON.stringify(tasks)).toBe(before);expect(()=>adjustDishSequence([{...tasks[0],scheduledAt:'bad',baseScheduledAt:'bad'}],new Set())).not.toThrow();
 });
});
