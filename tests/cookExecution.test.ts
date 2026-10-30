import {it,expect} from 'vitest';
import {createDish,newMeal} from '../src/domain/meal';
import {parseRecipeText} from '../src/domain/recipe';
import {cookTimeline,recordEvent,editStep,removeStep,type ExtendedMeal} from '../src/domain/cookState';
import {cookProjection} from '../src/domain/cookProjection';
import {cookDuration,remainingCook} from '../src/domain/cookDuration';
import {resolvePlannedTime} from '../src/domain/stepTiming';
const start='2026-10-29T22:43:00Z',clock=Date.parse(start);
const recipe=(text='Prepare (5 minutes)\nRoast (15 minutes)\nCool (10 minutes)'):ExtendedMeal=>({...newMeal(),name:'Execution test',mode:'cooking',startedAt:start,serveAt:'2026-11-01T13:00Z',dishes:[parseRecipeText('Seeds',text)]});
const p=(m:ExtendedMeal,now=clock)=>cookProjection(m,cookTimeline(m),now);
const key=(m:ExtendedMeal,suffix:string)=>m.dishes[0].id+':'+suffix;
it('Sunday target stays immutable but Thursday brisket finishes Friday from authored work',()=>{
 const m={...recipe(),dishes:[createDish('brisket')]},before=JSON.stringify(m),plan=JSON.stringify(cookTimeline(m));const out=p(m);
 expect(out.remaining).toBe(1015);expect(out.projected).toBe(1015);expect(out.finish).toBe('2026-10-30T15:38:00.000Z');expect(out.provisional).toBe(true);
 expect(p(m,clock+60000).remaining).toBe(1014);expect(p(m,clock+60000).projected).toBe(1015);expect(JSON.stringify(m)).toBe(before);expect(JSON.stringify(cookTimeline(m))).toBe(plan);
 expect(cookDuration({...m,mode:'planning',startedAt:undefined},cookTimeline(m),clock).minutes).toBe(1505);
});
it('14-hour physical work is a stable provisional forecast, not an invented actual phase start',()=>{
 const m=recipe('Smoke (14 hours)'),before=JSON.stringify(m);expect(p(m).finish).toBe('2026-10-30T12:43:00.000Z');expect(p(m,clock+600000).finish).toBe(p(m).finish);expect(p(m,clock+600000).remaining).toBe(830);expect(JSON.stringify(m)).toBe(before);
 expect(p(JSON.parse(JSON.stringify(m)),clock+600000)).toEqual(p(m,clock+600000));
});
it('5+15+10 moves to 26 minutes after quick prep, and 31 after a 20-minute real roast',()=>{
 let m=recipe();expect(p(m).finish).toBe('2026-10-29T23:13:00.000Z');m=recordEvent(m,key(m,'step-1'),'completed',new Date(clock+60000).toISOString());expect(p(m,clock+60000).finish).toBe('2026-10-29T23:09:00.000Z');
 m=recordEvent(m,key(m,'step-2'),'started',new Date(clock+60000).toISOString());expect(p(m,clock+21*60000).finish).toBeNull();expect(p(m,clock+21*60000).reason).toMatch(/overdue/i);expect(m.completed[key(m,'step-2')]).toBeUndefined();
 m=recordEvent(m,key(m,'step-2'),'completed',new Date(clock+21*60000).toISOString());expect(p(m,clock+21*60000).finish).toBe('2026-10-29T23:14:00.000Z');expect(p(m,clock+21*60000).projected).toBe(31);expect(p(m,clock+21*60000).remaining).toBe(10);
});
it('an actual smoker/rest start supersedes the forecast without changing original times',()=>{
 let m={...recipe(),dishes:[createDish('brisket')]};const id=m.dishes[0].id,plan=cookTimeline(m).find(t=>t.id===id+':start')!.scheduledAt;
 m=recordEvent(m,id+':start','started',start);expect(p(m).forecasts[id+':start'].finish).toBe('2026-10-30T11:43:00.000Z');expect(cookTimeline(m).find(t=>t.id===id+':start')!.scheduledAt).toBe(plan);
 for(const t of cookTimeline(m).filter(t=>!['rest','serve'].some(k=>t.id.endsWith(':'+k))))m=recordEvent(m,t.id,'completed',new Date(clock+700*60000).toISOString());
 m=recordEvent(m,id+':rest','started',new Date(clock+701*60000).toISOString());const f=p(m,clock+702*60000);expect(f.remaining).toBe(159);expect(f.projected).toBe(861);expect(m.serveAt).toBe('2026-11-01T13:00Z');
});
it('parallel dishes share one window and newly added work has a durable creation anchor',()=>{
 const m=recipe('Simmer (20 minutes)'),other=parseRecipeText('Roast','Roast (30 minutes)');m.dishes.push(other);expect(p(m).remaining).toBe(30);
 other.executionAddedAt=new Date(clock+10*60000).toISOString();expect(p(m,clock+10*60000).remaining).toBe(30);expect(p(m,clock+11*60000).remaining).toBe(29);expect(p(m,clock+11*60000).finish).toBe('2026-10-29T23:23:00.000Z');
});
it('real refrigerated waits and overlapping oven prep remain, rather than the target-date gap',()=>{
 const t={...createDish('turkey'),turkeyPrep:{state:'thawed' as const,thawDays:0,brineHours:2,dryHours:1}},m={...recipe(),dishes:[t]};expect(p(m).remaining).toBe(510);
 const frozen={...m,dishes:[{...t,turkeyPrep:{...t.turkeyPrep,state:'frozen' as const,thawDays:2}}]};expect(p(frozen).remaining).toBe(3390);expect(p(frozen).provisional).toBe(true);expect(frozen.completed).toEqual({});
});
it('fixed dates survive rebasing across DST and can make finish unavailable when infeasible',()=>{
 let m=recipe('Roast (15 minutes)\nCool (10 minutes)'),cool=cookTimeline(m).find(t=>t.id===key(m,'step-2'))!;
 const fixed=resolvePlannedTime('2026-11-01T01:30','America/New_York','2026-11-01T06:30:00.000Z');
 m=editStep(m,cool.id,cool.title,cool.instructions,{timingMode:'fixed',scheduledAt:fixed,durationMinutes:10,equipment:'Kitchen',targetTempF:null});expect(p(m).finish).toBe('2026-11-01T06:40:00.000Z');expect(p(m).forecasts[cool.id].start).toBe(fixed);
 m=recordEvent(m,key(m,'step-1'),'completed','2026-11-01T06:35Z');expect(p(m,Date.parse('2026-11-01T06:35Z')).finish).toBeNull();expect(m.taskOverrides![cool.id].scheduledAt).toBe(fixed);
});
it('unknown durations, unscheduled work and unresolved custom conditions cannot promise an exact finish',()=>{
 for(const text of ['Roast until ready\nCool (10 minutes)','Roast (15 minutes)\nCool completely']){const m=recipe(text);expect(p(m).finish).toBeNull();expect(p(m).remaining).toBeNull();}
 let m=recipe(),first=cookTimeline(m)[0];m=editStep(m,first.id,first.title,first.instructions,{timingMode:'unscheduled',scheduledAt:null,durationMinutes:5,equipment:'Kitchen',targetTempF:null});expect(p(m).finish).toBeNull();
 const base=recipe(),condition=cookTimeline(base).map((t,i)=>i===0?{...t,isCondition:true}:t);expect(cookProjection(base,condition,clock).finish).toBeNull();
});
it('reopen and duration/edit/removal changes recompute unfinished work, not recorded actuals',()=>{
 let m=recipe();m=recordEvent(m,key(m,'step-1'),'completed',new Date(clock+60000).toISOString());m=recordEvent(m,key(m,'step-1'),'reopened',new Date(clock+120000).toISOString());expect(p(m,clock+120000).finish).toBe('2026-10-29T23:15:00.000Z');
 const roast=cookTimeline(m).find(t=>t.id===key(m,'step-2'))!;m=editStep(m,roast.id,roast.title,roast.instructions,{timingMode:'plan',scheduledAt:null,durationMinutes:20,equipment:'Kitchen',targetTempF:null});expect(p(m,clock+120000).remaining).toBe(35);
 m=removeStep(m,key(m,'step-3'),new Date(clock+120000).toISOString());expect(p(m,clock+120000).remaining).toBe(25);const before=JSON.stringify(m.events);p(m,clock+180000);expect(JSON.stringify(m.events)).toBe(before);
});
it('serving targets do not hold an otherwise finished cook, and invalid clocks never emit NaN',()=>{
 const m=recipe();for(const t of cookTimeline(m).filter(t=>!t.id.endsWith(':serve')))m.completed[t.id]=start;expect(p(m).remaining).toBe(0);expect(p(m).finish).toBe('2026-10-29T22:43:00.000Z');
 expect(cookProjection(m,cookTimeline(m),NaN).remaining).toBeNull();expect(remainingCook(m,cookTimeline(m),clock).minutes).toBe(0);
});

it('removing a template physical phase recalculates work without mutating its plan or restoring hidden work',()=>{
 let m={...recipe(),dishes:[createDish('brats')]};m=removeStep(m,m.dishes[0].id+':start',start);expect(p(m).remaining).toBe(45);expect(m.hiddenTaskIds).toContain(m.dishes[0].id+':start');
});

it('fixed thaw/brine, cooking and rest constraints cannot bypass required preparation or doneness',()=>{
 const date=new Date(clock+60000).toISOString();
 const situations=[{preset:'turkey' as const,phase:'brine'},{preset:'brats' as const,phase:'start'},{preset:'brisket' as const,phase:'rest'}];
 for(const {preset,phase} of situations){
  let m={...recipe(),dishes:[createDish(preset)]};if(preset==='turkey')m.dishes[0].turkeyPrep={state:'frozen',thawDays:2,brineHours:2,dryHours:1};
  if(phase==='rest'){for(const t of cookTimeline(m).filter(t=>t.templateStage?.kind==='preparation'))m=recordEvent(m,t.id,'completed',start);m=recordEvent(m,key(m,'start'),'started',start);}
  const t=cookTimeline(m).find(t=>t.id===key(m,phase))!;m=editStep(m,t.id,t.title,t.instructions,{timingMode:'fixed',scheduledAt:date,durationMinutes:t.templateStage?.minutes??null,equipment:t.equipment??'',targetTempF:null});
  const out=p(m);expect(out.forecasts[t.id].status).toBe('blocked');expect(out.finish).toBeNull();expect(m.taskOverrides![t.id].scheduledAt).toBe(date);
  m=recordEvent(m,t.id,'started',date);expect(p(m,clock+60000).forecasts[t.id].status).not.toBe('blocked');
 }
});

it('a fixed first recipe phase does not create a synthetic wait to the old serving target',()=>{
 let m=recipe('Roast (15 minutes)\nCool (10 minutes)'),roast=cookTimeline(m)[0];m=editStep(m,roast.id,roast.title,roast.instructions,{timingMode:'fixed',scheduledAt:start,durationMinutes:15,equipment:'Oven',targetTempF:null});expect(p(m).remaining).toBe(25);expect(p(m).finish).toBe('2026-10-29T23:08:00.000Z');expect(m.serveAt).toBe('2026-11-01T13:00Z');expect(p(m,clock+26*60000).remaining).toBeNull();
});
it('new independent general work starts at creation without adding a second serving-relative delay',()=>{
 const m=recipe('Roast (15 minutes)'),tasks=[{id:'existing',dishId:'custom',dishName:'General prep',title:'Mix',instructions:'',durationMinutes:30,scheduledAt:null,isCondition:false},{id:'new',dishId:'custom',dishName:'General prep',title:'Chop',instructions:'',durationMinutes:20,scheduledAt:null,isCondition:false,executionAddedAt:new Date(clock+10*60000).toISOString()}];m.customTasks=tasks;expect(p(m,clock+10*60000).remaining).toBe(20);expect(p(m,clock+10*60000).forecasts.new.start).toBe('2026-10-29T22:53:00.000Z');
});

it('removed finishing stages are not retained through an implicit rest/serve allowance',()=>{
 let m={...recipe(),dishes:[createDish('wings')]};for(const t of cookTimeline(m).filter(t=>t.templateStage?.kind==='preparation'))m=recordEvent(m,t.id,'completed',start);expect(p(m).remaining).toBe(200);
 m=removeStep(m,key(m,'finish'),start);expect(p(m).remaining).toBe(198);
});

it('legacy started sessions project consistently even when the saved mode still says planning',()=>{
 const m={...recipe(),mode:'planning' as const};expect(cookDuration(m,cookTimeline(m),clock).minutes).toBe(30);expect(remainingCook(m,cookTimeline(m),clock).minutes).toBe(30);expect(m.mode).toBe('planning');
});
