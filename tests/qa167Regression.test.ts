import {describe,it,expect} from 'vitest';
import {newMeal,createDish} from '../src/domain/meal';
import {cookTimeline,startCookSession,recordEvent,correctActivityBoundary} from '../src/domain/cookState';
import {planningReadiness} from '../src/domain/planningReadiness';
import {cookProjection} from '../src/domain/cookProjection';
import {cookDuration} from '../src/domain/cookDuration';
import {guidedCookingSteps} from '../src/domain/cookingFocus';
import {isStoredMeal} from '../src/domain/storageValidation';
import {stepTimingCue} from '../src/domain/stepTimingCue';

const now='2026-11-18T22:04:00.000Z',target='2026-11-19T23:00:00.000Z';
const meal=(thawed=false)=>({...newMeal(),serveAt:target,dishes:[{...createDish('brisket'),id:'brisket'},{...createDish('turkey'),id:'turkey',...(thawed?{turkeyPrep:{state:'thawed' as const,thawDays:6,brineHours:22,dryHours:2.25}}:{})}]});
describe('QA #167 planning and actual-start regressions',()=>{
 it.each([false,true])('planning and an immediate start agree, already thawed=%s',thawed=>{
  const m=meal(thawed),before=structuredClone(m),p=planningReadiness(m,cookTimeline(m),Date.parse(now))!;
  const active=startCookSession(m,now),live=cookProjection(active,cookTimeline(active),Date.parse(now));
  expect(p.readyAt).toBe(live.finish);
  expect(cookDuration(m,p.tasks,Date.parse(now)).minutes).toBe(live.remaining);
  expect(p.tasks.find(t=>t.id==='turkey:brine')!.scheduledAt).toBe(thawed?now:'2026-11-24T22:04:00.000Z');
  expect(active.events??[]).toEqual([]);expect(m).toEqual(before);expect(active.serveAt).toBe(target);
 });
 it('includes six full days of frozen thawing before brining without moving the target',()=>{
  const m=meal(),p=planningReadiness(m,cookTimeline(m),Date.parse(now))!;
  expect(p.tasks.find(t=>t.id==='turkey:thaw')!.scheduledAt).toBe(now);
  expect(p.readyAt).toBe('2026-11-26T03:49:00.000Z');
  expect(p.lateMinutes).toBe(8929);expect(m.serveAt).toBe(target);
 });
 it('keeps a future preparation window when Cooking is opened early, including reload',()=>{
  const m={...meal(true),serveAt:'2026-11-28T18:00:00.000Z'},p=planningReadiness(m,cookTimeline(m),Date.parse(now))!;
  const active=JSON.parse(JSON.stringify(startCookSession(m,now))),live=cookProjection(active,cookTimeline(active),Date.parse(now));
  expect(live.finish).toBe(p.readyAt);expect(Date.parse(live.finish!)).toBeGreaterThan(Date.parse('2026-11-27T00:00:00Z'));
  expect(active.startedAt).toBe(now);expect(active.events??[]).toEqual([]);expect(isStoredMeal(active)).toBe(true);
 });
 it('does not recommend ended smoking or oil after starts recorded without checking the rows',()=>{
  let m=startCookSession({...newMeal(),serveAt:target,dishes:[{...createDish('wings'),id:'wings'}]},now);
  for(const id of ['dry','prep','preheat'])m=recordEvent(m,'wings:'+id,'completed',now);
  m=recordEvent(m,'wings:start','started',now);m=recordEvent(m,'wings:oil','started',now);
  m=recordEvent(m,'wings:oil-ready','completed',now);
  let p=cookProjection(m,cookTimeline(m),Date.parse(now)),g=guidedCookingSteps(cookTimeline(m),m.completed,null,p.forecasts);
  expect(g.current?.id).not.toBe('wings:oil');expect(g.next?.id).not.toBe('wings:start');
  for(const id of ['check','smoke-end'])m=recordEvent(m,'wings:'+id,'completed',now);
  m=recordEvent(m,'wings:fry','started',now);m=recordEvent(m,'wings:finish','completed',now);
  const restored=JSON.parse(JSON.stringify(m)),before=structuredClone(restored);
  p=cookProjection(restored,cookTimeline(restored),Date.parse(now));g=guidedCookingSteps(cookTimeline(restored).filter(t=>!restored.phasePlan.suppressed.includes(t.id)),restored.completed,null,p.forecasts);
  expect(g.current).toBeNull();expect(g.next).toBeNull();expect(g.remaining).toBe(0);
  expect(restored.completed['wings:start']).toBeUndefined();expect(restored).toEqual(before);
 });
 it('retains an early physical start over a future forecast window',()=>{
  let m=startCookSession({...newMeal(),serveAt:target,dishes:[{...createDish('wings'),id:'wings'}]},now);
  m=recordEvent(m,'wings:start','started',now);m=correctActivityBoundary(m,'wings:heat','start','2026-11-18T21:04:00.000Z');
  const before=structuredClone(m),p=cookProjection(m,cookTimeline(m),Date.parse(now));
  expect(p.phases!.find(p=>p.id==='wings:heat')!.actualStart).toBe('2026-11-18T21:04:00.000Z');expect(m).toEqual(before);
 });
 it('gives a completed checkpoint its recorded status, then restores review after explicit reopen',()=>{
  let m=startCookSession({...newMeal(),serveAt:target,dishes:[{...createDish('wings'),id:'wings'}]},now);
  m=recordEvent(m,'wings:start','started',now);m=recordEvent(m,'wings:check','completed',now);
  const clock=Date.parse(now)+4*3600000,task=cookTimeline(m).find(t=>t.id==='wings:check')!;
  let p=cookProjection(m,cookTimeline(m),clock);
  expect(stepTimingCue(task,p.forecasts[task.id],clock,m.completed[task.id])).toEqual({label:'Completed check',at:now});
  m=recordEvent(m,task.id,'reopened',new Date(clock).toISOString());p=cookProjection(m,cookTimeline(m),clock);
  expect(stepTimingCue(task,p.forecasts[task.id],clock,m.completed[task.id]).label).toBe('Review now');
 });
 it('rejects malformed forecast windows while keeping old stored plans valid',()=>{
  const active=startCookSession(meal(true),now);
  expect(isStoredMeal({...active,phasePlan:{...active.phasePlan,forecastOrigin:'not-a-date'}})).toBe(false);
  expect(isStoredMeal({...active,phasePlan:{...active.phasePlan,forecastOrigin:undefined}})).toBe(true);
 });
});
