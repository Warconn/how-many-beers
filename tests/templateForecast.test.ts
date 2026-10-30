import {describe,it,expect} from 'vitest';
import {applyBrisketTiming,brisketDefaults} from '../src/domain/brisketEstimate';
import {createDish,newMeal} from '../src/domain/meal';
import {cookTimeline,recordEvent,editStep,type ExtendedMeal} from '../src/domain/cookState';
import {remainingCook} from '../src/domain/cookDuration';
import {liveStepForecasts} from '../src/domain/cookForecast';
const now=Date.parse('2026-10-29T21:05Z');
const make=():ExtendedMeal=>({...newMeal(),mode:'cooking',startedAt:'2026-10-29T21:00Z',serveAt:'2026-11-01T18:00Z',dishes:[createDish('brisket')]});
const at=(m:ExtendedMeal,key:string)=>cookTimeline(m).find(t=>t.id===m.dishes[0].id+':'+key)!;
const f=(m:ExtendedMeal,time=now)=>liveStepForecasts(m,cookTimeline(m),time);
const complete=(m:ExtendedMeal,keys:string[],time='2026-10-29T21:04Z')=>keys.reduce((m,key)=>recordEvent(m,m.dishes[0].id+':'+key,'completed',time),m);
describe('template phase estimates and checkpoints',()=>{
 it('shows wrap as a timed condition checkpoint, not an unknown-duration activity',()=>{
  const m=complete(make(),['prep','season','preheat','start','raise225','spritz','check']),wrap=at(m,'wrap');const before=JSON.stringify(m),out=f(m)[wrap.id];
  expect(out.template).toMatchObject({kind:'checkpoint',basis:'estimated',at:'2026-10-30T07:28:00.000Z'});expect(out.status).toBe('condition');expect(out.finish).toBeNull();expect(wrap.isCondition).toBe(true);expect(JSON.stringify(m)).toBe(before);
 });
 it('uses the existing cook estimate and a real on-smoker start without resetting it',()=>{
  let m=complete(make(),['prep','season','preheat']);const start=at(m,'start');
  expect(f(m)[start.id]).toMatchObject({finish:'2026-10-30T10:05:00.000Z',template:{kind:'cook',minutes:780}});
  m=recordEvent(m,start.id,'started','2026-10-29T21:05Z');expect(f(m,now+600000)[start.id].finish).toBe('2026-10-30T10:05:00.000Z');expect(f(JSON.parse(JSON.stringify(m)),now+600000)[start.id]).toEqual(f(m,now+600000)[start.id]);
 });
 it('uses verified doneness/rest activity for the rest/hold estimate and preserves the target',()=>{
  let m=complete(make(),['prep','season','preheat','start','raise225','spritz','check','wrap','raise250']);m=complete(m,['finish'],'2026-10-30T09:00Z');const rest=at(m,'rest');
  expect(f(m,Date.parse('2026-10-30T09:00Z'))[rest.id]).toMatchObject({finish:'2026-10-30T11:40:00.000Z',template:{kind:'rest',minutes:160}});expect(m.serveAt).toBe('2026-11-01T18:00Z');
 });
 it('keeps a fixed checkpoint and an explicitly unscheduled checkpoint unchanged',()=>{
  let m=complete(make(),['start']),wrap=at(m,'wrap');m=editStep(m,wrap.id,wrap.title,wrap.instructions,{timingMode:'fixed',scheduledAt:'2026-10-31T23:00Z',durationMinutes:null,equipment:'Smoker',targetTempF:null});
  expect(f(m)[wrap.id].template).toMatchObject({basis:'fixed',at:'2026-10-31T23:00:00.000Z'});
  m=editStep(m,wrap.id,wrap.title,wrap.instructions,{timingMode:'unscheduled',scheduledAt:null,durationMinutes:null,equipment:'Smoker',targetTempF:null});expect(f(m)[wrap.id].template?.at).toBeNull();
 });
 it('keeps phase estimates conditional until a real cook start or readiness is known',()=>{
  const m=make(),out=f(m)[at(m,'start').id];expect(out.template?.basis).toBe('planned');expect(out.reason).toMatch(/plan|preparation/i);
  const wrap=f(m)[at(m,'wrap').id];expect(wrap.template?.basis).toBe('planned');expect(wrap.finish).toBeNull();
 });
 it('does not turn a wrapping decision into a long physical duration or change the plan',()=>{
  const m=complete(make(),['start']),before=JSON.stringify(cookTimeline(m));f(m);expect(JSON.stringify(cookTimeline(m))).toBe(before);expect(at(m,'wrap').durationMinutes).toBeNull();
 });
});

it('keeps checkpoint-span remaining estimates and counts down a real rest start',()=>{
 let m=complete(make(),['prep','season','preheat','start','raise225','spritz','check']);expect(remainingCook(m,cookTimeline(m),now).minutes).toBe(316);
 m=complete(m,['wrap','raise250','finish','rest'],'2026-10-30T09:00Z');expect(remainingCook(m,cookTimeline(m),Date.parse('2026-10-30T09:05Z')).minutes).toBe(155);
});
it('does not restart an elapsed actual template phase or imply readiness',()=>{
 let m=complete(make(),['prep','season','preheat']);m=recordEvent(m,m.dishes[0].id+':start','started','2026-10-28T21:00Z');expect(f(m)[at(m,'start').id].status).toBe('overdue');expect(remainingCook(m,cookTimeline(m),now).minutes).toBeNull();
});

it('counts a researched rest allowance and hold buffer once',()=>{
 let m=make();m.dishes[0]=applyBrisketTiming({...m.dishes[0],brisketPlan:{mode:'manual',inputs:{...brisketDefaults,weightLb:15,restMinutes:120,holdBufferMinutes:60}}},m.serveAt);m=complete(m,['finish'],'2026-10-30T09:00Z');const rest=f(m,Date.parse('2026-10-30T09:00Z'))[at(m,'rest').id];expect(rest.template?.minutes).toBe(180);expect(rest.finish).toBe('2026-10-30T12:00:00.000Z');
});
it('treats an unrecorded rest as a forecast, while a real rest start stays anchored',()=>{
 let m=complete(make(),['finish'],'2026-10-30T09:00Z');const rest=at(m,'rest'),clock=Date.parse('2026-10-30T09:05Z');expect(f(m,clock)[rest.id].finish).toBe('2026-10-30T11:45:00.000Z');m=recordEvent(m,rest.id,'started','2026-10-30T09:00Z');expect(f(m,clock)[rest.id].finish).toBe('2026-10-30T11:40:00.000Z');
});
