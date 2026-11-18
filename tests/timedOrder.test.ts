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
