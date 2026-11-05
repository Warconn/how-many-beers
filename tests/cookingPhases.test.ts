import {describe,it,expect} from 'vitest';
import {newMeal,createDish,type Dish} from '../src/domain/meal';
import {cookTimeline,recordEvent,startCookSession,setStepDuration,moveStep,addDishToMeal} from '../src/domain/cookState';
import {cookProjection} from '../src/domain/cookProjection';
import {recordRemainingEstimate} from '../src/domain/cookingPhases';
import {parseRecipeText} from '../src/domain/recipe';
import {exportBackup,validateBackup,archiveCook,emptyHistory,repeatArchivedCook} from '../src/domain/cookHistory';
const at=(time:string)=>'2026-11-08T'+time+':00Z';
function setup(){
 const brats: Dish={...createDish('side'),id:'brats',name:'Brats',cookMinutes:45,restMinutes:10};
 const potatoes: Dish={...createDish('side'),id:'potatoes',name:'Potatoes',cookMinutes:40,restMinutes:0};
 let meal=startCookSession({...newMeal(),serveAt:at('17:00'),dishes:[brats,potatoes]},at('15:45'));
 meal.phasePlan!.actions['brats:check'].checkpoint!.fraction=1/3;
 for(const d of meal.dishes)for(const key of ['prep','preheat'])meal=recordEvent(meal,d.id+':'+key,'completed',at('15:46'));
 meal=recordEvent(meal,'brats:start','completed',at('16:00'));
 meal=recordEvent(meal,'potatoes:start','completed',at('16:10'));
 return meal;
}
const project=(meal:ReturnType<typeof setup>,time:string)=>cookProjection(meal,cookTimeline(meal),Date.parse(at(time)));
describe('physical phases behind the checklist',()=>{
 it('overlaps dishes, and a flip/checkpoint never ends grilling',()=>{
  let meal=setup();meal=recordEvent(meal,'brats:check','completed',at('16:15'));
  const p=project(meal,'16:20');expect(p.remaining).toBe(35);expect(p.finish).toBe(at('16:55').replace('Z','.000Z'));
  expect(p.phases?.find(p=>p.id==='brats:heat')?.actualEnd).toBeNull();
 });
 it('session/preparation completion does not invent physical starts or elapsed grilling',()=>{
  let m=startCookSession({...newMeal(),dishes:[{...createDish('side'),id:'a',cookMinutes:45,restMinutes:10}]},at('16:00'));
  m=recordEvent(m,'a:prep','completed',at('16:00'));m=recordEvent(m,'a:preheat','completed',at('16:00'));
  const p=project(m,'16:20');expect(p.remaining).toBe(55);expect(p.phases?.[0].actualStart).toBeNull();
 });
 it('keeps overrun active and includes following rest as an earliest-serving bound',()=>{
  const p=project(setup(),'16:46');expect(p.remaining).toBeNull();expect(p.minimumRemaining).toBe(10);expect(p.earliestFinish).toBe(at('16:56').replace('Z','.000Z'));
  expect(p.phases?.find(p=>p.id==='brats:heat')?.overrun).toBe(true);
 });
 it('one remove/rest action ends heating and starts rest, even when checked rapidly',()=>{
  const m=recordEvent(setup(),'brats:rest','completed',at('16:55'));const p=project(m,'16:55');
  expect(p.phases?.find(p=>p.id==='brats:heat')?.actualEnd).toBe(at('16:55'));expect(p.phases?.find(p=>p.id==='brats:rest')?.actualStart).toBe(at('16:55'));
  // Potatoes remain on heat until their own removal, so confirm that actual too.
  const done=recordEvent(m,'potatoes:rest','completed',at('16:55'));expect(project(done,'16:55').finish).toBe(at('17:05').replace('Z','.000Z'));expect(done.serveAt).toBe(at('17:00'));
 });
 it('corrects only linked forecasts and appends rather than editing observations',()=>{
  const m=setup(),before=JSON.stringify(m.events),corrected=recordEvent(m,'brats:start','started',at('15:48'));
  const p=project(corrected,'16:20');expect(p.phases?.find(p=>p.id==='potatoes:heat')?.actualStart).toBe(at('16:10'));expect(JSON.stringify(corrected.events?.slice(0,m.events?.length))).toBe(before);
  expect(p.forecasts['brats:check'].start).not.toBe(project(m,'16:20').forecasts['brats:check'].start);expect(corrected.serveAt).toBe(m.serveAt);
 });
 it('a future completed checkpoint never overwrites an already recorded removal/rest',()=>{
  let m=recordEvent(setup(),'brats:rest','completed',at('16:55'));m=recordEvent(m,'brats:start','started',at('15:48'));
  expect(project(m,'16:56').phases?.find(p=>p.id==='brats:rest')?.actualStart).toBe(at('16:55'));
 });
 it('supports an optional remaining estimate without resetting the actual start',()=>{
  const m=recordRemainingEstimate(setup(),'brats:heat',8,at('16:46')),p=project(m,'16:46');
  expect(p.phases?.find(p=>p.id==='brats:heat')?.actualStart).toBe(at('16:00'));expect(p.phases?.find(p=>p.id==='brats:heat')?.finish).toBe(at('16:54').replace('Z','.000Z'));
  expect(project(m,'16:55').remaining).toBeNull();
 });
 it('uses only a supported upper estimate after an overrun and falls back after it expires',()=>{
  const m=setup();m.phasePlan!.phases.find(p=>p.id==='brats:heat')!.upperMinutes=65;
  expect(project(m,'16:46').remaining).toBe(29);expect(project(m,'16:46').finish).toBe(at('17:15').replace('Z','.000Z'));
  const ended=recordEvent(m,'potatoes:rest','completed',at('16:50'));
  expect(project(ended,'17:05').minimumRemaining).toBe(10);expect(project(ended,'17:05').remaining).toBeNull();
 });
 it('duration changes and late actual starts reflow dependents without moving the target or actuals',()=>{
  const m=setup(),changed=setStepDuration(m,'brats:start',55);
  expect(project(changed,'16:20').remaining).toBe(45);expect(changed.events).toEqual(m.events);
  const delayed=recordEvent(m,'brats:start','started',at('16:10'));
  expect(project(delayed,'16:20').finish).toBe(at('17:05').replace('Z','.000Z'));expect(delayed.serveAt).toBe(m.serveAt);
 });
 it('corrects the requested 4:12→4:00 start and its +15-minute checkpoint exactly',()=>{
  let m=recordEvent(setup(),'brats:start','started',at('16:12'));
  expect(project(m,'16:20').remaining).toBe(47);expect(project(m,'16:20').forecasts['brats:check'].start).toBe(at('16:27').replace('Z','.000Z'));
  m=recordEvent(m,'brats:start','started',at('16:00'));
  expect(project(m,'16:20').remaining).toBe(35);expect(project(m,'16:20').forecasts['brats:check'].start).toBe(at('16:15').replace('Z','.000Z'));expect(m.completed['brats:check']).toBeUndefined();
 });
 it('rejects a correction beyond an already recorded physical end without moving either actual',()=>{
  const m=recordEvent(setup(),'brats:rest','completed',at('16:55')),before=JSON.stringify(m);
  expect(()=>recordEvent(m,'brats:start','started',at('17:00'))).toThrow('actual start');expect(JSON.stringify(m)).toBe(before);
 });
 it('passive cooling reaches zero without Serve, actual end or automatic archive',()=>{
  const d=parseRecipeText('Seeds','Prepare (5 minutes)\nRoast (15 minutes)\nRemove seeds and leave to cool (10 minutes)');
  let m=startCookSession({...newMeal(),dishes:[d]},at('15:55'));
  m=recordEvent(m,d.id+':step-1','completed',at('16:00'));m=recordEvent(m,d.id+':step-2','completed',at('16:00'));m=recordEvent(m,d.id+':step-3','completed',at('16:15'));
  expect(project(m,'16:20').remaining).toBe(5);expect(project(m,'16:25').remaining).toBe(0);expect(m.completed[d.id+':serve']).toBeUndefined();
  expect(project(m,'16:25').phases?.find(p=>p.kind==='passive')?.actualEnd).toBeNull();expect(m.mode).toBe('cooking');
 });
 it('ambiguous imports do not invent a physical relationship',()=>{
  const d=parseRecipeText('Ambiguous','Cook as desired (15 minutes)\nPrepare sauce (5 minutes)');const m=startCookSession({...newMeal(),dishes:[d]},at('16:00'));
  expect(m.phasePlan?.phases).toHaveLength(0);
 });
 it('adding a dish preserves prior actuals and does not start the new dish',()=>{
  const m=setup(),added=addDishToMeal(m,{...createDish('chicken'),id:'new'},at('16:20'));
  expect(added.events).toEqual(m.events);expect(added.phasePlan!.phases.slice(0,m.phasePlan!.phases.length)).toEqual(m.phasePlan!.phases);
  expect(project(added,'16:20').phases?.find(p=>p.id==='new:heat')?.actualStart).toBeNull();expect(added.serveAt).toBe(m.serveAt);
 });
 it('an ambiguous template boundary reorder falls back without restricting planning',()=>{
  let m={...newMeal(),dishes:[{...createDish('side'),id:'a'}]};
  m=moveStep(m,'a:rest','up','a',true);m=moveStep(m,'a:rest','up','a',true);m=moveStep(m,'a:rest','up','a',true);
  expect(()=>startCookSession(m,at('16:00'))).not.toThrow();expect(startCookSession(m,at('16:00')).phasePlan?.phases).toHaveLength(0);
 });
 it('ordinary replay, backups and history preserve new observations; Cook Again resets them',()=>{
  const m=setup(),roundtrip=validateBackup(exportBackup(m,emptyHistory(),at('16:20'))).active;
  expect(project(roundtrip,'16:20')).toEqual(project(m,'16:20'));
  const h=archiveCook(m,emptyHistory(),'fine',at('18:00'));expect(h.cooks[0].meal.events).toEqual(m.events);
  const again=repeatArchivedCook(h.cooks[0]);expect(again.phasePlan).toBeUndefined();expect(again.events).toEqual([]);
 });
 it('does not retrofit an existing started session',()=>{
  const legacy={...newMeal(),mode:'cooking' as const,startedAt:at('16:00'),dishes:[createDish('brats')]};
  expect(startCookSession(legacy,at('16:20')).phasePlan).toBeUndefined();expect(startCookSession(legacy,at('16:20')).startedAt).toBe(at('16:00'));
 });
 it('a repeated completion is idempotent and reopening never erases physical actuals',()=>{
  const m=setup(),again=recordEvent(m,'brats:start','completed',at('16:15'));expect(again.events).toEqual(m.events);
  const reopened=recordEvent(m,'brats:start','reopened',at('16:20'));expect(project(reopened,'16:20').phases?.find(p=>p.id==='brats:heat')?.actualStart).toBe(at('16:00'));
 });
});
