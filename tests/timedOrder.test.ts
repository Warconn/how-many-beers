import {describe,it,expect} from 'vitest';
import {timedOrder} from '../src/domain/stepTiming';
import {timedCookingTasks} from '../src/domain/stepTimingCue';
import type {PlannedTask} from '../src/domain/meal';
import type {StepForecast} from '../src/domain/cookForecast';
const task=(id:string,scheduledAt:string|null,recipeOrder=0):PlannedTask=>({id,dishId:id.split(':')[0],dishName:id,title:id,instructions:'',scheduledAt,recipeOrder,isCondition:false});
describe('timed display order',()=>{
 it('interleaves dishes across dates, even when one recipe has unknown work and saved source order differs',()=>{
  const tasks=[task('brisket:serve','2026-11-21T18:00Z',2),task('turkey:unknown',null),task('turkey:thaw','2026-11-14T12:15Z',1),task('brisket:hold','2026-11-21T12:00Z',1),task('turkey:brine','2026-11-20T12:15Z',2)];
  const original=JSON.stringify(tasks);
  expect(timedOrder(tasks,t=>t.scheduledAt).map(t=>t.id)).toEqual(['turkey:thaw','turkey:brine','brisket:hold','brisket:serve','turkey:unknown']);
  expect(JSON.stringify(tasks)).toBe(original);expect(timedOrder(tasks,t=>t.scheduledAt)[0]).toBe(tasks[2]);
 });
 it('compares instants across time zones, preserves simultaneous ties and puts invalid/unknown times last',()=>{
  const tasks=[task('invalid','bad'),task('late','2026-11-01T01:15-05:00'),task('first','2026-11-01T01:30-04:00'),task('tie','2026-11-01T05:30Z'),task('unknown',null)];
  expect(timedOrder(tasks,t=>t.scheduledAt).map(t=>t.id)).toEqual(['first','tie','late','invalid','unknown']);
 });
 it('uses displayed actual/estimated starts rather than obsolete planned order in Cooking',()=>{
  const tasks=[task('short','2026-11-21T10:00Z'),task('actual','2026-11-21T12:00Z'),task('fixed','2026-11-21T11:30Z')];tasks[2].timingMode='fixed';
  const forecasts:Record<string,StepForecast>={short:{start:'2026-11-21T13:00Z',finish:null,status:'estimated'},actual:{start:'2026-11-21T11:00Z',finish:null,status:'estimated',template:{kind:'activity',basis:'actual',at:'2026-11-21T11:00Z'}},fixed:{start:'2026-11-21T14:00Z',finish:null,status:'blocked'}};
  const before=JSON.stringify({tasks,forecasts});
  expect(timedCookingTasks(tasks,forecasts,0).map(t=>t.id)).toEqual(['actual','fixed','short']);
  expect(JSON.stringify({tasks,forecasts})).toBe(before);
 });
 it('orders archived steps by their displayed completion with planned fallback without changing snapshots',()=>{
  const tasks=[task('late','2026-11-21T12:00Z'),task('early','2026-11-21T14:00Z'),task('planned','2026-11-21T11:00Z')],completed:Record<string,string>={late:'2026-11-21T15:00Z',early:'2026-11-21T10:00Z'};
  const before=JSON.stringify({tasks,completed});
  expect(timedOrder(tasks,t=>completed[t.id]??t.scheduledAt).map(t=>t.id)).toEqual(['early','planned','late']);
  expect(JSON.stringify({tasks,completed})).toBe(before);
 });
});

it('orders a completed checkpoint by the recorded timestamp shown on its row',()=>{
 const check={...task('dish:check','2026-11-21T15:00Z'),isCondition:true},next=task('other:prep','2026-11-21T12:00Z');
 const forecasts:Record<string,StepForecast>={[check.id]:{start:check.scheduledAt,finish:null,status:'condition',template:{kind:'checkpoint',basis:'estimated',at:check.scheduledAt}}};
 const completed={[check.id]:'2026-11-21T10:00Z'},before=JSON.stringify({check,next,forecasts,completed});
 expect(timedCookingTasks([next,check],forecasts,0,completed).map(t=>t.id)).toEqual([check.id,next.id]);
 expect(JSON.stringify({check,next,forecasts,completed})).toBe(before);
});

it('orders legacy rest before its serving estimate when Cooking starts before the calendar plan',()=>{
 const rest:PlannedTask={id:'brisket:rest',dishId:'brisket',dishName:'Brisket',title:'Begin rest',instructions:'',scheduledAt:'2026-11-26T15:20Z',isCondition:true,templateStage:{kind:'rest',minutes:160,startLabel:'Begin rest now'}};
 const serve:PlannedTask={...rest,id:'brisket:serve',title:'Serve',scheduledAt:'2026-11-26T18:00Z',templateStage:undefined};
 const forecasts:Record<string,StepForecast>={
  [rest.id]:{start:'2026-11-25T23:00Z',finish:'2026-11-26T01:40Z',status:'estimated',template:{kind:'rest',basis:'estimated',at:'2026-11-25T23:00Z'}},
  [serve.id]:{start:'2026-11-26T01:40Z',finish:null,status:'condition',template:{kind:'checkpoint',basis:'estimated',at:'2026-11-26T01:40Z'}},
 };
 expect(timedCookingTasks([rest,serve],forecasts,Date.parse('2026-11-25T10:00Z')).map(t=>t.id)).toEqual([rest.id,serve.id]);
});
