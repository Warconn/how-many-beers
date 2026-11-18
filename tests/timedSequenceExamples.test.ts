import {describe,it,expect} from 'vitest';
import {cookTimeline,recordEvent,type ExtendedMeal} from '../src/domain/cookState';
import {cookProjection} from '../src/domain/cookProjection';
import {timedMeal,onTimeActions,mealTime as at} from './fixtures/timedMealSchedule';
import {recordRemainingEstimate} from '../src/domain/cookingPhases';
import {guidedCookingSteps} from '../src/domain/cookingFocus';

// Acceptance examples for the holding-handoff correction. Independent expected
// times come from a Saturday 1 PM NY meal: 13 h smoke + 6 h hold; 22 h brine,
// 2 h 15 min drying, 4 h 30 min roasting and 1 h turkey rest.
function meal():ExtendedMeal {
 let m=timedMeal();
 for(const [id,time] of [
  ['turkey:thaw',at(20,'12:15')],['turkey:brine',at(20,'12:15')],
  ['brisket:prep',at(20,'22:15')],['brisket:season',at(20,'22:30')],['brisket:preheat',at(20,'22:55')],
 ] as const)m=recordEvent(m,id,'completed',time);
 return m;
}
describe('on-time meal handoff acceptance examples',()=>{
 it('offers brisket holding immediately after its on-time doneness check, while preserving the separate physical end action',()=>{
  let m=recordEvent(meal(),'brisket:start','completed',at(20,'23:00'));
  for(const [id,time] of [
   ['brisket:check',at(21,'06:09')],['brisket:wrap',at(21,'09:24')],
   ['turkey:dry',at(21,'10:15')],['turkey:preheat',at(21,'11:30')],
   ['brisket:finish',at(21,'12:00')],
  ] as const)m=recordEvent(m,id,'completed',time);
  const before=structuredClone(m),tasks=cookTimeline(m),p=cookProjection(m,tasks,Date.parse(at(21,'12:00')));
  // Readiness confirmation does not fabricate smoker removal/holding actuals.
  expect(p.phases!.find(phase=>phase.id==='brisket:heat')!.actualEnd).toBeNull();
  expect(p.phases!.find(phase=>phase.id==='brisket:rest')!.actualStart).toBeNull();
  expect(m).toEqual(before);
  expect(guidedCookingSteps(tasks,m.completed,null,p.forecasts).current?.id).toBe('brisket:rest');
  expect(p.forecasts['brisket:rest'].start).toBe(at(21,'12:00')); // Sat 7 AM NY
  expect(p.forecasts['brisket:rest'].finish).toBe(at(21,'18:00')); // Sat 1 PM NY
  expect(p.finish).toBe(at(21,'18:00'));
 });
 it('reports a one-hour late actual brisket start as a 2 PM meal estimate without changing the 1 PM target',()=>{
  const m=recordEvent(meal(),'brisket:start','completed',at(21,'00:00')),before=structuredClone(m);
  const p=cookProjection(m,cookTimeline(m),Date.parse(at(21,'00:00')));
  expect(p.forecasts['brisket:start'].start).toBe(at(21,'00:00'));
  expect(p.finish).toBe(at(21,'19:00'));
  expect(m.serveAt).toBe(at(21,'18:00'));expect(m).toEqual(before);
 });
});


it('follows the independent twenty-action timeline and serves both dishes at Saturday 1 PM',()=>{
 let m=timedMeal();
 for(const [id,time] of onTimeActions){
  const tasks=cookTimeline(m),p=cookProjection(m,tasks,Date.parse(time));
  expect(guidedCookingSteps(tasks,m.completed,null,p.forecasts).current?.id,`next at ${time}`).toBe(id);
  if(['brisket:rest','turkey:rest','brisket:serve','turkey:serve'].includes(id))expect(p.forecasts[id].start).toBe(time);
  m=recordEvent(m,id,'completed',time);
 }
 expect(Object.keys(m.completed)).toHaveLength(20);
 const p=cookProjection(m,cookTimeline(m),Date.parse(at(21,'18:00')));
 for(const id of ['brisket:rest','turkey:rest'])expect(p.phases!.find(phase=>phase.id===id)!.actualEnd).toBe(at(21,'18:00'));
 expect(p.remaining).toBe(0);
});
function readyMeal(){return recordEvent(recordEvent(meal(),'brisket:start','completed',at(20,'23:00')),'brisket:finish','completed',at(21,'12:00'));}
function project(m:ExtendedMeal,time=at(21,'12:00')){return cookProjection(m,cookTimeline(m),Date.parse(time));}
it('does not treat elapsed time, readings or an intermediate checkpoint as terminal readiness',()=>{
 let m=recordEvent(meal(),'brisket:start','completed',at(20,'23:00'));
 m=recordEvent(m,'brisket:wrap','completed',at(21,'11:59'));
 m=recordEvent(m,'brisket:finish','temperature',at(21,'12:00'),203,'°F');
 const before=structuredClone(m),p=project(m);
 expect(Date.parse(p.forecasts['brisket:rest'].start!)).toBeGreaterThan(Date.parse(at(21,'12:00')));
 expect(p.phases!.find(phase=>phase.id==='brisket:heat')!.actualEnd).toBeNull();expect(m).toEqual(before);
});
it('reopening readiness restores the conservative forecast without removing any observations',()=>{
 const m=recordEvent(readyMeal(),'brisket:finish','reopened',at(21,'12:01')),before=structuredClone(m),p=project(m,at(21,'12:01'));
 expect(Date.parse(p.forecasts['brisket:rest'].start!)).toBeGreaterThan(Date.parse(at(21,'12:01')));
 expect(m).toEqual(before);
});
it('uses a confirmed check after an older remaining estimate',()=>{
 let m=recordEvent(meal(),'brisket:start','completed',at(20,'23:00'));
 m=recordRemainingEstimate(m,'brisket:heat',60,at(21,'11:50'));
 m=recordEvent(m,'brisket:finish','completed',at(21,'12:00'));
 expect(project(m).forecasts['brisket:rest'].start).toBe(at(21,'12:00'));
});
it('respects an explicit remaining estimate recorded after readiness',()=>{
 const m=recordRemainingEstimate(readyMeal(),'brisket:heat',10,at(21,'12:01')),before=structuredClone(m);
 expect(project(m,at(21,'12:01')).forecasts['brisket:rest'].start).toBe(at(21,'12:11'));
 expect(m).toEqual(before);
});
it('keeps a separately recorded holding start and its actual heat end exact through reload',()=>{
 const m=recordEvent(readyMeal(),'brisket:rest','completed',at(21,'12:05')),restored=JSON.parse(JSON.stringify(m)),before=structuredClone(restored);
 const p=project(restored,at(21,'12:06'));
 expect(p.phases!.find(phase=>phase.id==='brisket:heat')!.actualEnd).toBe(at(21,'12:05'));
 expect(p.phases!.find(phase=>phase.id==='brisket:rest')!.actualStart).toBe(at(21,'12:05'));
 expect(restored).toEqual(before);
});

it('keeps an explicitly fixed later holding start anchored',()=>{
 const ready=readyMeal(),m={...ready,taskOverrides:{...ready.taskOverrides,'brisket:rest':{scheduledAt:at(21,'12:30')}}},before=structuredClone(m);
 expect(project(m).forecasts['brisket:rest'].start).toBe(at(21,'12:30'));
 expect(m).toEqual(before);
});
it('does not start holding automatically while an overdue handoff waits for the cook',()=>{
 const m=readyMeal(),before=structuredClone(m),p=project(m,at(21,'12:05'));
 expect(p.forecasts['brisket:rest'].start).toBe(at(21,'12:05'));
 expect(p.phases!.find(phase=>phase.id==='brisket:heat')!.actualEnd).toBeNull();
 expect(p.phases!.find(phase=>phase.id==='brisket:rest')!.actualStart).toBeNull();
 expect(m).toEqual(before);
});

it('keeps turkey prep inside the authored drying/preheating overlap after preheating is checked',()=>{
 let m=recordEvent(meal(),'brisket:start','completed',at(20,'23:00'));
 m=recordEvent(m,'turkey:dry','completed',at(21,'10:15'));
 m=recordEvent(m,'turkey:preheat','completed',at(21,'11:30'));
 const before=structuredClone(m),p=project(m,at(21,'11:30'));
 expect(p.forecasts['turkey:prep'].start).toBe(at(21,'12:15'));
 expect(p.forecasts['turkey:start'].start).toBe(at(21,'12:30'));
 expect(p.forecasts['turkey:rest'].finish).toBe(at(21,'18:00'));
 expect(p.finish).toBe(at(21,'18:00'));expect(m).toEqual(before);
});
