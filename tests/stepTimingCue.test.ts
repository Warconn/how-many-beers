import {expect,it} from 'vitest';
import {stepTimingCue} from '../src/domain/stepTimingCue';
import type {PlannedTask} from '../src/domain/meal';
const task:PlannedTask={id:'dish:start',dishId:'dish',dishName:'Brisket',title:'Put brisket on smoker',instructions:'Load the brisket.',scheduledAt:'2026-11-08T04:30:00Z',isCondition:false,templateStage:{kind:'cook',minutes:480,startLabel:'On smoker now'}};
const now=Date.parse('2026-11-08T04:00Z');
it('leads with the planned timestamp while keeping actual start distinct',()=>{
 expect(stepTimingCue(task,undefined,now)).toEqual({label:'Planned start',at:task.scheduledAt});
 expect(stepTimingCue(task,{start:'2026-11-08T04:34:00Z',finish:null,status:'estimated',template:{kind:'cook',basis:'actual',at:'2026-11-08T04:34:00Z'}},now)).toEqual({label:'Actual start',at:'2026-11-08T04:34:00Z'});
});
it('shows supported approximate checkpoints with a physical cue and no invented overdue deadline',()=>{
 const check={...task,id:'dish:wrap',title:'Wrap brisket',instructions:'When bark is ready, wrap in butcher paper.',templateStage:undefined,isCondition:true};
 const f={start:'2026-11-08T06:00Z',finish:null,status:'condition' as const,template:{kind:'checkpoint' as const,basis:'estimated' as const,at:'2026-11-08T06:00Z'}};
 expect(stepTimingCue(check,f,now)).toMatchObject({label:'Check around',at:f.start,detail:check.instructions});
 expect(stepTimingCue(check,f,Date.parse('2026-11-08T07:00Z'))).toMatchObject({label:'Review now'});
 expect(stepTimingCue(check,{...f,lowerBound:true},now)).toEqual({label:check.instructions});
 expect(stepTimingCue({...check,scheduledAt:null},undefined,now)).toEqual({label:check.instructions});
});
it('keeps fixed blockers, unknown work and imported live estimates honest without mutating data',()=>{
 const fixed={...task,timingMode:'fixed' as const},f={start:task.scheduledAt,finish:null,status:'blocked' as const,reason:'Unfinished preparation.'};
 const before=JSON.stringify([fixed,f]);expect(stepTimingCue(fixed,f,now)).toMatchObject({label:'Planned start',detail:'Review timing: Unfinished preparation.'});expect(JSON.stringify([fixed,f])).toBe(before);
 expect(stepTimingCue({...task,recipeOrder:0},{start:'2026-11-08T05:00Z',finish:null,status:'estimated'},now)).toMatchObject({label:'Estimated start',at:'2026-11-08T05:00Z'});
});

it.each(['2026-11-08T04:24:00Z','2026-11-08T04:44:00Z'])('labels early/late actual starts without rewriting the planned instant (%s)',at=>{
 const before=JSON.stringify(task);
 expect(stepTimingCue(task,{start:at,finish:null,status:'estimated',template:{kind:'cook',basis:'actual',at}},now)).toMatchObject({label:'Actual start',at});
 expect(JSON.stringify(task)).toBe(before);
});
it('labels rest as its own actual interval and keeps expired estimates actionable',()=>{
 const rest={...task,id:'dish:rest',title:'Hold until serving',isCondition:true,templateStage:{kind:'rest' as const,minutes:180,startLabel:'Begin rest now'}};
 expect(stepTimingCue(rest,{start:'2026-11-08T12:30Z',finish:'2026-11-08T15:30Z',status:'estimated',template:{kind:'rest',basis:'actual',at:'2026-11-08T12:30Z'}},now)).toMatchObject({label:'Actual start',at:'2026-11-08T12:30Z'});
 expect(stepTimingCue(task,{start:task.scheduledAt,finish:null,status:'overdue'},now)).toMatchObject({label:'Review now'});
});

it('preserves earliest bounds for constrained rest while keeping manual plans anchored',()=>{
 const forecast={start:'2026-11-08T12:30Z',finish:null,status:'unknown' as const,lowerBound:true,reason:'Cooking still active.'};
 expect(stepTimingCue(task,forecast,now)).toMatchObject({label:'Earliest start',at:forecast.start,lowerBound:true});
 expect(stepTimingCue({...task,timingMode:'fixed'},forecast,now)).toMatchObject({label:'Planned start',at:task.scheduledAt,detail:'Review timing: Cooking still active.'});
});
