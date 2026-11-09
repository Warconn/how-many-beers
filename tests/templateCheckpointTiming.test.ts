import {expect,it} from 'vitest';
import {createDish,newMeal} from '../src/domain/meal';
import {cookTimeline,editStep} from '../src/domain/cookState';

it.each([330,390,270])('keeps ribs checkpoints inside a %i minute fixed cooking interval',minutes=>{
 const dish=createDish('ribs'),meal={...newMeal(),serveAt:'2026-11-08T18:00:00Z',dishes:[dish,createDish('brats')]};
 const start=cookTimeline(meal).find(t=>t.id===dish.id+':start')!;
 const edited=editStep(meal,start.id,start.title,start.instructions,{timingMode:'fixed',scheduledAt:'2026-11-08T13:10:00Z',durationMinutes:minutes,equipment:'Smoker',targetTempF:null});
 const tasks=cookTimeline(edited),at=(key:string)=>Date.parse(tasks.find(t=>t.id===dish.id+':'+key)!.scheduledAt!);
 expect(at('finish')).toBe(Date.parse('2026-11-08T13:10:00Z')+minutes*60000);
 expect(at('rest')).toBe(at('finish'));
 expect(at('serve')).toBe(at('finish')+20*60000);
 expect(at('check')).toBeGreaterThan(at('start'));
 expect(at('wrap')).toBeLessThan(at('finish'));
 expect(edited.serveAt).toBe(meal.serveAt);
 expect(tasks.filter(t=>t.dishId!==dish.id)).toEqual(cookTimeline(meal).filter(t=>t.dishId!==dish.id));
 const renamed=editStep(edited,start.id,'Renamed',start.instructions,{timingMode:'fixed',scheduledAt:'2026-11-08T13:10:00Z',durationMinutes:minutes,equipment:'Smoker',targetTempF:null});
 expect(cookTimeline(renamed).map(t=>t.scheduledAt)).toEqual(tasks.map(t=>t.scheduledAt));
});

it('preserves fixed checkpoints, actuals, and the legacy active-session projection',()=>{
 const dish=createDish('ribs'),meal={...newMeal(),serveAt:'2026-11-08T18:00:00Z',dishes:[dish]};
 const start=cookTimeline(meal).find(t=>t.id===dish.id+':start')!;
 const fixed=editStep(meal,start.id,start.title,start.instructions,{timingMode:'fixed',scheduledAt:'2026-11-08T13:10:00Z',durationMinutes:330,equipment:'Smoker',targetTempF:null});
 const check=cookTimeline(fixed).find(t=>t.id===dish.id+':check')!;
 const anchored=editStep(fixed,check.id,check.title,check.instructions,{timingMode:'fixed',scheduledAt:'2026-11-08T16:00:00Z',durationMinutes:null,equipment:'Smoker',targetTempF:null});
 expect(cookTimeline(anchored).find(t=>t.id===check.id)!.scheduledAt).toBe('2026-11-08T16:00:00.000Z');
 const active={...fixed,mode:'cooking' as const,events:[{id:'actual',taskId:start.id,kind:'started' as const,startSource:'physical' as const,occurredAt:'2026-11-08T13:12:00Z'}]};
 const snapshot=JSON.stringify(active);
 expect(cookTimeline(active).find(t=>t.id===dish.id+':serve')!.scheduledAt).toBe('2026-11-08T22:02:00.000Z');
 expect(JSON.stringify(active)).toBe(snapshot);
});

it('moves finish coherently for duration-only and fixed-start-only edits',()=>{
 for(const durationMinutes of [null,390]){
  const dish=createDish('ribs'),meal={...newMeal(),serveAt:'2026-11-08T18:00:00Z',dishes:[dish]};
  const start=cookTimeline(meal).find(t=>t.id===dish.id+':start')!;
  const edited=editStep(meal,start.id,start.title,start.instructions,{timingMode:durationMinutes===null?'fixed':'plan',scheduledAt:durationMinutes===null?'2026-11-08T13:10:00Z':null,durationMinutes,equipment:'Smoker',targetTempF:null});
  expect(cookTimeline(edited).find(t=>t.id===dish.id+':serve')!.scheduledAt).toBe('2026-11-08T19:00:00.000Z');
 }
});

it.each(['brisket','turkey','ribs','chicken','side','wings','brats'] as const)('preserves %s template alignment after a one-hour fixed cooking shift',preset=>{
 const dish=createDish(preset),meal={...newMeal(),serveAt:'2026-11-08T18:00:00Z',dishes:[dish]};
 const original=cookTimeline(meal),start=original.find(t=>t.templateStage?.kind==='cook')!;
 const edited=editStep(meal,start.id,start.title,start.instructions,{timingMode:'fixed',scheduledAt:new Date(Date.parse(start.scheduledAt!)+3600000).toISOString(),durationMinutes:start.templateStage!.minutes,equipment:dish.equipment,targetTempF:null});
 const after=cookTimeline(edited);
 for(const task of original){
  if(Date.parse(task.scheduledAt!)<Date.parse(start.scheduledAt!))continue;
  expect(Date.parse(after.find(t=>t.id===task.id)!.scheduledAt!)).toBe(Date.parse(task.scheduledAt!)+3600000);
 }
});
