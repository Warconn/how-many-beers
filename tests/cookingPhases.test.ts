import {describe,it,expect} from 'vitest';
import {newMeal,createDish,type Dish} from '../src/domain/meal';
import {cookTimeline,recordEvent,startCookSession,setStepDuration,moveStep,addDishToMeal,editStep,type ExtendedMeal} from '../src/domain/cookState';
import {cookProjection} from '../src/domain/cookProjection';
import {recordRemainingEstimate} from '../src/domain/cookingPhases';
import {applyBrisketTiming,brisketDefaults} from '../src/domain/brisketEstimate';
import {parseRecipeText} from '../src/domain/recipe';
import {guidedCookingSteps} from '../src/domain/cookingFocus';
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
 it('a deliberately later preheat stays after actual cooking instead of overlapping it',()=>{
  const d={...createDish('brats'),id:'a'};let m=moveStep({...newMeal(),dishes:[d]},'a:start','up','a',true);
  m=startCookSession(m,at('16:00'));m=recordEvent(m,'a:prep','completed',at('16:01'));m=recordEvent(m,'a:start','started',at('16:05'));m=recordEvent(m,'a:start','completed',at('16:06'));
  expect(project(m,'16:06').forecasts['a:preheat'].finish).toBe(at('18:25').replace('Z','.000Z'));
 });
 it('ordinary prep estimates use elapsed session time without inventing dish starts',()=>{
  const d={...createDish('side'),id:'a',cookMinutes:45,restMinutes:10},m=startCookSession({...newMeal(),dishes:[d]},at('16:00'));
  expect(project(m,'16:01').remaining).toBe(project(m,'16:00').remaining!-1);expect(project(m,'16:01').phases?.[0].actualStart).toBeNull();
 });
 it('an actual cooking start outranks overdue unchecked preparation without checking it automatically',()=>{
  const d={...createDish('side'),id:'a',cookMinutes:45,restMinutes:10};let m=startCookSession({...newMeal(),dishes:[d]},at('16:00'));
  m=recordEvent(m,'a:start','completed',at('16:30'));
  expect(project(m,'16:31').remaining).toBe(54);expect(project(m,'16:31').finish).toBe(at('17:25').replace('Z','.000Z'));expect(m.completed['a:prep']).toBeUndefined();
 });
 it('a recipe without a reviewed heat-end action falls back, and edited serving actions remain',()=>{
  const d=parseRecipeText('Roast only','Roast (15 minutes)'),m=startCookSession({...newMeal(),dishes:[d]},at('16:00'));expect(m.phasePlan?.phases).toHaveLength(0);
  const seeds=parseRecipeText('Seeds','Roast (15 minutes)\nCool (10 minutes)'),plan={...newMeal(),dishes:[seeds],taskOverrides:{[seeds.id+':serve']:{title:'Check food before serving'}}};
  expect(startCookSession(plan,at('16:00')).phasePlan?.suppressed).toEqual([]);
 });
 it('ordinary replay, backups and history preserve new observations; Cook Again resets them',()=>{
  const m=setup(),roundtrip=validateBackup(exportBackup(m,emptyHistory(),at('16:20'))).active;
  expect(project(roundtrip,'16:20')).toEqual(project(m,'16:20'));
  const h=archiveCook(m,emptyHistory(),'fine',at('18:00'));expect(h.cooks[0].meal.events).toEqual(m.events);
  const again=repeatArchivedCook(h.cooks[0]);expect(again.phasePlan).toBeUndefined();expect(again.events).toEqual([]);
 });
 it('keeps full-checklist order stable while live priority advances across dishes',()=>{
  const m=setup(),tasks=cookTimeline(m),p=project(m,'16:20'),a=guidedCookingSteps(tasks,m.completed,null,p.forecasts);
  const done=recordEvent(m,a.current!.id,'completed',at('16:20')),b=guidedCookingSteps(cookTimeline(done),done.completed,null,project(done,'16:20').forecasts);
  expect(b.ordered.map(t=>t.id)).toEqual(a.ordered.map(t=>t.id));expect(b.current?.id).not.toBe(a.current?.id);
 });
 it('retains concurrency for independent general tasks with the same explicit start',()=>{
  const m:ExtendedMeal={...newMeal(),customTasks:[20,30].map((durationMinutes,i)=>({id:'general-'+i,dishId:'custom',dishName:'General prep',title:'Independent activity '+i,instructions:'',scheduledAt:at('16:00'),durationMinutes,isCondition:false})),taskOverrides:{'general-0':{scheduledAt:at('16:00')},'general-1':{scheduledAt:at('16:00')}}};
  expect(project(startCookSession(m,at('16:00')),'16:00').remaining).toBe(30);
 });
 it('the real brat template retains its covered/searing allowances and one physical transition',()=>{
  const d={...createDish('brats'),id:'a'};let m=startCookSession({...newMeal(),dishes:[d]},at('16:00'));
  for(const key of ['prep','preheat','start'])m=recordEvent(m,'a:'+key,'completed',at('16:00'));
  expect(project(m,'16:00').remaining).toBe(135);m=recordEvent(m,'a:check','completed',at('17:00'));expect(project(m,'17:00').remaining).toBe(75);
  m=recordEvent(m,'a:bath','completed',at('18:05'));expect(project(m,'18:05').remaining).toBe(15);expect(m.events?.at(-1)?.phaseObservations).toEqual([{phaseId:'a:heat',boundary:'end'},{phaseId:'a:sear',boundary:'start'}]);
 });
 it('wings preserve oil/drain/rest allowances and preparing the fryer does not end smoking',()=>{
  const d={...createDish('wings'),id:'a'};let m=startCookSession({...newMeal(),dishes:[d]},at('16:00'));
  for(const key of ['dry','prep','preheat','start'])m=recordEvent(m,'a:'+key,'completed',at('16:00'));
  expect(project(m,'16:00').remaining).toBe(200);m=recordEvent(m,'a:oil','completed',at('17:00'));
  expect(project(m,'17:00').phases?.find(p=>p.id==='a:heat')?.actualEnd).toBeNull();
  m=recordEvent(m,'a:fry','completed',at('19:00'));expect(project(m,'19:00').phases?.find(p=>p.id==='a:heat')?.actualEnd).toBe(at('19:00'));
 });
 it('fresh starts can compile conservative reviewed imports saved before hints existed',()=>{
  const d=parseRecipeText('Seeds','Roast (15 minutes)\nCool (10 minutes)');for(const step of d.steps!)delete step.cookingKind;
  expect(startCookSession({...newMeal(),dishes:[d]},at('16:00')).phasePlan?.phases).toHaveLength(2);
 });
 it('does not retrofit an existing started session',()=>{
  const legacy={...newMeal(),mode:'cooking' as const,startedAt:at('16:00'),dishes:[createDish('brats')]};
  expect(startCookSession(legacy,at('16:20')).phasePlan).toBeUndefined();expect(startCookSession(legacy,at('16:20')).startedAt).toBe(at('16:00'));
 });
 it('a repeated completion is idempotent and reopening never erases physical actuals',()=>{
  const m=setup(),again=recordEvent(m,'brats:start','completed',at('16:15'));expect(again.events).toEqual(m.events);
  const reopened=recordEvent(m,'brats:start','reopened',at('16:20'));expect(project(reopened,'16:20').phases?.find(p=>p.id==='brats:heat')?.actualStart).toBe(at('16:00'));
 });
 it('a fixed future brisket load gives a provisional nominal finish without falsifying actuals or target',()=>{
  const serve='2026-11-08T18:00:00Z'; // Sunday 1 PM EST
  const d=applyBrisketTiming({...createDish('brisket'),id:'brisket',brisketPlan:{mode:'manual',inputs:{...brisketDefaults,weightLb:7}}},serve);
  let m=startCookSession({...newMeal(),serveAt:serve,dishes:[d]},'2026-11-07T22:00:00Z');
  const edit=(id:string,scheduledAt:string,durationMinutes?:number)=> {
    const task=cookTimeline(m).find(t=>t.id===id)!;
    m=editStep(m,id,task.title,task.instructions,{timingMode:'fixed',scheduledAt,durationMinutes,equipment:task.equipment??'Pellet smoker',targetTempF:null});
  };
  // A real stale preparatory checkpoint prevents an exact upper bound.
  edit('brisket:prep','2026-11-07T21:00:00Z',75);
  // The user edits only the loading clock; the 8h template allowance survives.
  edit('brisket:start','2026-11-08T06:00:00Z');
  expect(m.taskOverrides?.['brisket:start']?.durationMinutes).toBeUndefined();
  const original=JSON.stringify(m),now=Date.parse('2026-11-07T22:20:00Z');
  const p=cookProjection(m,cookTimeline(m),now);
  expect(p.remaining).toBeNull();
  expect(p.provisionalTiming).toEqual({
   offSmoker:'2026-11-08T14:00:00.000Z', // 1 AM load + 8h
   readyAfterRest:'2026-11-08T17:00:00.000Z', // + 2h rest, 1h hold
   basedOn:'planned'
  });
  expect(JSON.stringify(m)).toBe(original);
  expect(m.serveAt).toBe(serve);
  edit('brisket:start','2026-11-08T05:00:00Z');
  expect(cookProjection(m,cookTimeline(m),now).provisionalTiming?.offSmoker).toBe('2026-11-08T13:00:00.000Z');

  // Previously saved time-only edits sometimes wrote a null duration.
  // Do not make the cook re-enter a duration just to see the fixed-time ETA.
  const legacy={...m,taskOverrides:{...m.taskOverrides,'brisket:start':{...m.taskOverrides?.['brisket:start'],durationMinutes:null}}};
  expect(cookProjection(legacy,cookTimeline(legacy),now).provisionalTiming).toEqual({
   offSmoker:'2026-11-08T13:00:00.000Z',
   readyAfterRest:'2026-11-08T16:00:00.000Z',
   basedOn:'planned'
  });
  expect(legacy.taskOverrides?.['brisket:start']?.durationMinutes).toBeNull();

  m=recordEvent(m,'brisket:start','completed','2026-11-08T05:00:00Z');
  expect(cookProjection(m,cookTimeline(m),Date.parse('2026-11-08T05:01:00Z')).provisionalTiming).toMatchObject({
   offSmoker:'2026-11-08T13:00:00.000Z',readyAfterRest:'2026-11-08T16:00:00.000Z',basedOn:'actual'
  });
  // If the brisket has not actually come off the smoker when the estimated
  // time passes, an open-ended warning is preferable to a made-up new finish.
  const overdue=cookProjection(m,cookTimeline(m),Date.parse('2026-11-08T13:01:00Z'));
  expect(overdue.provisionalTiming).toBeUndefined();
  expect(overdue.remaining).toBeNull();
 });

 it('provisional single-brisket projection does not omit work from a multi-dish meal',()=>{
  const serve='2026-11-08T18:00:00Z';
  const b=applyBrisketTiming({...createDish('brisket'),id:'brisket',brisketPlan:{mode:'manual',inputs:{...brisketDefaults,weightLb:7}}},serve);
  let m=startCookSession({...newMeal(),serveAt:serve,dishes:[b,{...createDish('side'),id:'side'}]},'2026-11-07T22:00:00Z');
  const t=cookTimeline(m).find(t=>t.id==='brisket:start')!;
  m=editStep(m,t.id,t.title,t.instructions,{timingMode:'fixed',scheduledAt:'2026-11-08T06:00:00Z',equipment:t.equipment??'Pellet smoker',targetTempF:null});
  expect(cookProjection(m,cookTimeline(m),Date.parse('2026-11-07T22:20:00Z')).provisionalTiming).toBeUndefined();
 });

});
