import {it,expect} from 'vitest';
import {presets,createDish,newMeal,type PresetId} from '../src/domain/meal';
import {cookTimeline,recordEvent,editStep,type ExtendedMeal} from '../src/domain/cookState';
import {liveStepForecasts} from '../src/domain/cookForecast';
import {remainingCook} from '../src/domain/cookDuration';
const now=Date.parse('2026-10-30T21:00Z');
const make=(preset:Exclude<PresetId,'custom'>):ExtendedMeal=>({...newMeal(),mode:'cooking',startedAt:new Date(now).toISOString(),serveAt:'2026-11-01T18:00Z',dishes:[createDish(preset)]});
const out=(m:ExtendedMeal,time=now)=>liveStepForecasts(m,cookTimeline(m),time);
for(const preset of Object.keys(presets) as Exclude<PresetId,'custom'>[]){
 it(preset+' has authored preparation/cook/rest estimates and honest checkpoints',()=>{
  const m=make(preset),before=JSON.stringify(m),tasks=cookTimeline(m),f=out(m),id=m.dishes[0].id;
  expect(f[id+':prep'].template!.minutes).toBeGreaterThan(0);expect(f[id+':preheat'].template!.minutes).toBeGreaterThan(0);expect(f[id+':start'].template!.minutes).toBeGreaterThan(0);
  for(const t of tasks.filter(t=>t.isCondition&&!t.templateStage&&!t.id.endsWith(':thaw'))){expect(f[t.id].finish).toBeNull();expect(f[t.id].template?.minutes).toBeUndefined();}
  if(m.dishes[0].restMinutes>0&&tasks.some(t=>t.id===id+':rest'))expect(f[id+':rest'].template?.minutes).toBeGreaterThan(0);
  expect(JSON.stringify(m)).toBe(before);
 });
}
it('brats split the 135-minute allowance into 120 covered + 15 searing; a real sear start updates remaining time',()=>{
 let m=make('brats'),id=m.dishes[0].id;
 for(const key of ['prep','preheat','start','check'])m=recordEvent(m,id+':'+key,'completed',new Date(now).toISOString());
 let f=out(m);expect(f[id+':start'].template?.minutes).toBe(120);expect(f[id+':bath'].template?.minutes).toBe(15);expect(remainingCook(m,cookTimeline(m),now).minutes).toBe(135);
 m=recordEvent(m,id+':bath','started',new Date(now).toISOString());f=out(m,now+60000);expect(f[id+':bath'].finish).toBe('2026-10-30T21:15:00.000Z');expect(remainingCook(m,cookTimeline(m),now+60000).minutes).toBe(14);expect(f[id+':finish'].status).toBe('condition');
 expect(out(JSON.parse(JSON.stringify(m)),now+60000)[id+':bath']).toEqual(f[id+':bath']);
});
it('wings explicitly allocate smoking, oil preparation, frying and draining without serializing checkpoints',()=>{
 let m=make('wings'),id=m.dishes[0].id;for(const key of ['dry','prep','preheat'])m=recordEvent(m,id+':'+key,'completed',new Date(now).toISOString());
 const f=out(m);expect(f[id+':start'].template?.minutes).toBe(180);expect(f[id+':oil'].template?.minutes).toBe(10);expect(f[id+':fry'].template?.minutes).toBe(3);expect(f[id+':finish'].template?.minutes).toBe(2);
 expect(f[id+':oil'].start).toBe('2026-10-31T00:00:00.000Z');expect(f[id+':fry'].start).toBe('2026-10-31T00:10:00.000Z');expect(f[id+':finish'].finish).toBe('2026-10-31T00:15:00.000Z');expect(f[id+':serve'].start).toBe('2026-10-31T00:20:00.000Z');
});
it('turkey refrigeration uses the selected brine/drying hours, not activity gaps',()=>{
 const m=make('turkey'),id=m.dishes[0].id;m.dishes[0].turkeyPrep={state:'thawed',thawDays:0,brineHours:12,dryHours:2};const f=out(m);expect(f[id+':brine'].template?.minutes).toBe(720);expect(f[id+':dry'].template?.minutes).toBe(120);expect(f[id+':thaw'].template?.minutes).toBe(0);
});
it('finishing phases respect fixed/unknown constraints, explicit overrides and expired predecessor estimates',()=>{
 let m=make('brats'),id=m.dishes[0].id;for(const key of ['prep','preheat'])m=recordEvent(m,id+':'+key,'completed',new Date(now).toISOString());m=recordEvent(m,id+':start','started','2026-10-30T18:00Z');m=recordEvent(m,id+':start','completed','2026-10-30T18:01Z');expect(out(m)[id+':bath'].status).toBe('blocked');
 const t=cookTimeline(m).find(t=>t.id===id+':bath')!;
 m=editStep(m,t.id,t.title,t.instructions,{timingMode:'fixed',scheduledAt:'2026-10-31T01:00Z',durationMinutes:30,equipment:'Blackstone',targetTempF:null});expect(out(m)[id+':bath'].start).toBe('2026-10-31T01:00:00.000Z');
 m=recordEvent(m,t.id,'started',new Date(now).toISOString());expect(out(m)[t.id].finish).toBe('2026-10-30T21:30:00.000Z');expect(out(m)[id+':finish'].start).toBe('2026-10-30T21:30:00.000Z');
});
