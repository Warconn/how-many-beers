import {describe,it,expect} from 'vitest';
import {newMeal,type PlannedTask} from '../src/domain/meal';
import {parseRecipeText} from '../src/domain/recipe';
import {cookTimeline,recordEvent,editStep,setStepDuration,type ExtendedMeal} from '../src/domain/cookState';
import {liveStepForecasts} from '../src/domain/cookForecast';
import {remainingCook} from '../src/domain/cookDuration';
const now=Date.parse('2026-10-29T21:04Z');
function fixture():ExtendedMeal{
 const d=parseRecipeText('Pumpkin seeds','Preheat (10 minutes)\nClean (5 minutes)\nDry (10 minutes)\nMix (5 minutes)\nCoat (10 minutes)\nRoast (15 minutes)\nCool (10 minutes)');
 let m:ExtendedMeal={...newMeal(),dishes:[d],serveAt:'2026-10-29T22:00Z',mode:'cooking',startedAt:'2026-10-29T21:00Z'};
 for(const s of d.steps!.slice(0,5))m=recordEvent(m,d.id+':'+s.id,'completed','2026-10-29T21:03Z');return m;
}
const stage=(m:ExtendedMeal,index:number)=>cookTimeline(m).find(t=>t.id===m.dishes[0].id+':'+m.dishes[0].steps![index].id)!;
const forecast=(m:ExtendedMeal,time=now)=>liveStepForecasts(m,cookTimeline(m),time);
describe('live step forecasts',()=>{
 it('moves a 15-minute roast and 10-minute cooling earlier without rewriting the plan, actuals or notes',()=>{
  const m=fixture(),roast=stage(m,5),cool=stage(m,6);m.notes[roast.id]='Keep notes';const before=JSON.stringify(m);
  const f=forecast(m);expect(f[roast.id]).toMatchObject({start:'2026-10-29T21:04:00.000Z',finish:'2026-10-29T21:19:00.000Z',status:'estimated'});expect(f[cool.id]).toMatchObject({start:'2026-10-29T21:19:00.000Z',finish:'2026-10-29T21:29:00.000Z'});
  expect(remainingCook(m,cookTimeline(m),now).minutes).toBe(25);expect(JSON.stringify(m)).toBe(before);expect(stage(m,5).scheduledAt).toBe('2026-10-29T21:35:00.000Z');
 });
 it('moves an unstarted forecast with now, while actual starts anchor countdown through reload',()=>{
  let m=fixture();const roast=stage(m,5);expect(forecast(m,now+120000)[roast.id].finish).toBe('2026-10-29T21:21:00.000Z');
  m=recordEvent(m,roast.id,'started','2026-10-29T21:04Z');expect(forecast(m,now+300000)[roast.id].finish).toBe('2026-10-29T21:19:00.000Z');expect(remainingCook(m,cookTimeline(m),now+300000).minutes).toBe(20);
  expect(forecast(JSON.parse(JSON.stringify(m)),now+300000)).toEqual(forecast(m,now+300000));
 });
 it('updates cooling after early/late completion and does not reuse an old start after reopening',()=>{
  for(const time of ['2026-10-29T21:10Z','2026-10-29T21:40Z']){
   let m=fixture();const roast=stage(m,5),cool=stage(m,6);m=recordEvent(m,roast.id,'completed',time);
   expect(forecast(m,Date.parse(time))[cool.id].finish).toBe(new Date(Date.parse(time)+600000).toISOString());
   m=recordEvent(m,roast.id,'reopened',time);expect(forecast(m,Date.parse(time))[roast.id].finish).toBe(new Date(Date.parse(time)+900000).toISOString());
  }
 });
 it('marks an overrun for review rather than restarting a full timer or assuming completion',()=>{
  let m=fixture();const roast=stage(m,5),cool=stage(m,6);m=recordEvent(m,roast.id,'started','2026-10-29T20:40Z');
  expect(forecast(m)[roast.id]).toMatchObject({finish:null,status:'overdue'});expect(forecast(m)[cool.id]).toMatchObject({start:null,finish:null,status:'blocked'});expect(remainingCook(m,cookTimeline(m),now).minutes).toBeNull();
 });
 it('keeps fixed starts and planned waiting gaps, and blocks an infeasible fixed successor',()=>{
  let m=fixture();const cool=stage(m,6);m=editStep(m,cool.id,cool.title,cool.instructions,{timingMode:'fixed',scheduledAt:'2026-10-29T21:50Z',durationMinutes:10,equipment:'Kitchen',targetTempF:null});
  expect(forecast(m)[cool.id]).toMatchObject({start:'2026-10-29T21:50:00.000Z',finish:'2026-10-29T22:00:00.000Z'});
  expect(forecast(m,Date.parse('2026-10-29T21:45Z'))[cool.id].status).toBe('blocked');
 });
 it('does not invent an ETA across unknown duration, explicit unscheduling or a condition checkpoint',()=>{
  for(const kind of ['unknown','unscheduled','condition']){
   let m=fixture();const roast=stage(m,5),cool=stage(m,6);let timeline=cookTimeline(m);
   if(kind==='unknown'){m=setStepDuration(m,roast.id,null);timeline=cookTimeline(m);}
   if(kind==='unscheduled'){m=editStep(m,roast.id,roast.title,roast.instructions,{timingMode:'unscheduled',scheduledAt:null,durationMinutes:15,equipment:'Kitchen',targetTempF:null});timeline=cookTimeline(m);}
   if(kind==='condition')timeline=timeline.map(t=>t.id===roast.id?{...t,isCondition:true}:t);
   const f=liveStepForecasts(m,timeline,now);expect(f[roast.id].finish).toBeNull();expect(f[cool.id].finish).toBeNull();
  }
 });
 it('preserves parallel dishes, recipe order independent of checklist moves, and midnight boundaries',()=>{
  const m=fixture();const other=parseRecipeText('Sauce','Simmer for 30 minutes');m.dishes.push(other);m.taskOrder=cookTimeline(m).map(t=>t.id).reverse();
  const f=forecast(m);expect(f[stage(m,5).id].finish).toBe('2026-10-29T21:19:00.000Z');expect(f[other.id+':'+other.steps![0].id].finish).toBe('2026-10-29T21:34:00.000Z');expect(remainingCook(m,cookTimeline(m),now).minutes).toBe(30);
  expect(forecast(m,Date.parse('2026-10-29T23:55Z'))[stage(m,6).id].finish).toBe('2026-10-30T00:20:00.000Z');
 });
 it('only derives for active cooks and retains the serving target when only Serve remains',()=>{
  const m=fixture();expect(liveStepForecasts({...m,mode:'planning',startedAt:undefined},cookTimeline(m),now)).toEqual({});
  for(const t of cookTimeline(m).filter(t=>!t.id.endsWith(':serve')))m.completed[t.id]='2026-10-29T21:04Z';
  expect(remainingCook(m,cookTimeline(m),now).minutes).toBe(56);expect(m.serveAt).toBe('2026-10-29T22:00Z');
 });
});

it('retains explicit waiting gaps and recomputes after adding, removing or editing source work',()=>{
 let m=fixture();const roast=stage(m,5),cool=stage(m,6);
 const spaced=cookTimeline(m).map(t=>t.id===cool.id?{...t,scheduledAt:'2026-10-29T22:10Z'}:t);
 expect(liveStepForecasts(m,spaced,now)[cool.id].start).toBe('2026-10-29T21:39:00.000Z');
 m.dishes[0].steps!.splice(6,0,{id:'garnish',title:'Garnish',minutes:2});
 expect(forecast(m)[cool.id].finish).toBe('2026-10-29T21:31:00.000Z');
 m=setStepDuration(m,roast.id,20);expect(forecast(m)[cool.id].finish).toBe('2026-10-29T21:36:00.000Z');
 const hidden={...m,hiddenTaskIds:[m.dishes[0].id+':garnish']};expect(forecast(hidden)[cool.id].finish).toBe('2026-10-29T21:34:00.000Z');
});

it('does not bypass unfinished prerequisites when later steps were checked out of order',()=>{
 let m=fixture();const mix=stage(m,3),roast=stage(m,5);m=recordEvent(m,mix.id,'reopened','2026-10-29T21:04Z');
 expect(forecast(m)[roast.id].finish).toBe('2026-10-29T21:24:00.000Z');
 m=setStepDuration(m,mix.id,null);expect(forecast(m)[roast.id]).toMatchObject({start:null,finish:null,status:'blocked'});
});
