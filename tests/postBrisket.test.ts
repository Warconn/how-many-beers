import {it,expect} from 'vitest';
import {newMeal,createDish} from '../src/domain/meal';
import {applyBrisketTiming,brisketDefaults} from '../src/domain/brisketEstimate';
import {cookTimeline,editStep,recordEvent,startCookSession} from '../src/domain/cookState';
import {cookProjection} from '../src/domain/cookProjection';
import {exportBackup,validateBackup,emptyHistory,archiveCook} from '../src/domain/cookHistory';
import {legacyDish} from './fixtures/legacyDish';
const serve='2026-11-08T13:00:00-05:00';
const meal=()=>({...newMeal(),serveAt:serve,dishes:[createDish('brisket'),createDish('brats')]});
it('new 7lb brisket reserves 6h including rest, or 8h, with no duplicate checklist interval',()=>{
 for(const [holdBufferMinutes,start] of [[240,'2026-11-08T04:00:00.000Z'],[360,'2026-11-08T02:00:00.000Z']] as const){
  const m=meal();m.dishes[0]=applyBrisketTiming({...m.dishes[0],brisketPlan:{mode:'manual',inputs:{...brisketDefaults,weightLb:7,holdBufferMinutes}}},serve);
  const tasks=cookTimeline(m).filter(t=>t.dishId===m.dishes[0].id),find=(key:string)=>tasks.find(t=>t.id.endsWith(':'+key))!;
  expect(m.dishes[0].cookMinutes).toBe(480);expect(find('start').scheduledAt).toBe(start);
  expect(find('rest').templateStage?.minutes).toBe(120+holdBufferMinutes);
  expect(Date.parse(find('serve').scheduledAt!)-Date.parse(find('rest').scheduledAt!)).toBe((120+holdBufferMinutes)*60000);
  expect(tasks.map(t=>t.title)).toEqual(['Trim brisket','Season brisket','Preheat smoker','Put brisket on smoker','Check bark and temperature','Wrap when bark is ready','Probe for tenderness','Hold until serving','Slice and serve']);
  expect(m.serveAt).toBe(serve);
  let active=startCookSession({...m,dishes:[m.dishes[0]]},'2026-11-07T20:00Z');
  for(const task of cookTimeline(active).filter(t=>t.templateStage?.kind==='preparation'))active=recordEvent(active,task.id,'completed','2026-11-07T21:00Z');
  active=recordEvent(active,m.dishes[0].id+':start','completed',start);
  const projection=cookProjection(active,cookTimeline(active),Date.parse(start));
  expect(projection.phases?.filter(p=>p.kind==='passive').map(p=>p.minutes)).toEqual([120+holdBufferMinutes]);
  expect(projection.remaining).toBe(480+120+holdBufferMinutes);

 }
});
it('new defaults and template content do not migrate saved legacy recipes or completed snapshots',()=>{
 const old={...meal(),dishes:[legacyDish('brisket')]};const timeline=cookTimeline(old),encoded=JSON.stringify(old);
 expect(timeline).toHaveLength(12);expect(timeline.find(t=>t.id.endsWith(':prep'))?.instructions).toContain('Easter 2021');
 const restored=validateBackup(exportBackup(old,emptyHistory(),serve)).active;
 expect(cookTimeline(restored)).toEqual(timeline);expect(JSON.stringify(old)).toBe(encoded);
 const fresh=meal();expect(validateBackup(exportBackup(fresh,emptyHistory(),serve)).active.dishes[0].brisketTemplateVersion).toBe(2);
});
it('time-only save and revert preserve explicit duration, all metadata, actuals and other dishes',()=>{
 let m=meal();const id=m.dishes[0].id+':start';
 let updated=recordEvent(m,m.dishes[0].id+':prep','completed','2026-11-07T22:00:00Z');
 updated=editStep(updated,id,'My loading action','My instructions',{timingMode:'fixed',scheduledAt:'2026-11-08T04:30Z',durationMinutes:480,equipment:'Custom smoker',targetTempF:199});
 const before=structuredClone(updated),task=cookTimeline(updated).find(t=>t.id===id)!;
 for(const timingMode of ['fixed','plan','unscheduled'] as const){
  const next=editStep(updated,id,task.title,task.instructions,{plannedTimeOnly:true,timingMode,scheduledAt:'2026-11-08T05:30Z',equipment:task.equipment!,targetTempF:task.targetTempF!});
  const {scheduledAt,...metadata}=next.taskOverrides![id],{scheduledAt:old,...expected}=before.taskOverrides![id];
  expect(metadata).toEqual(expected);expect(next.events).toEqual(before.events);expect(next.dishes).toEqual(before.dishes);expect(next.serveAt).toBe(before.serveAt);expect(next.completed).toEqual(before.completed);
 }
});
it('an early actual load and Hold keep append-only events and allow finishing before reserve expires',()=>{
 let m=meal();m.dishes=[applyBrisketTiming({...m.dishes[0],brisketPlan:{mode:'manual',inputs:{...brisketDefaults,weightLb:7}}},serve)];
 let active=startCookSession(m,'2026-11-07T22:00Z');const id=m.dishes[0].id;
 active=recordEvent(active,id+':start','completed','2026-11-08T04:34Z');
 active=recordEvent(active,id+':rest','completed','2026-11-08T13:19Z');
 const saved=structuredClone(active),projection=cookProjection(active,cookTimeline(active),Date.parse('2026-11-08T14:00Z'));
 expect(active.serveAt).toBe(serve);expect(active.events).toEqual(saved.events);expect(projection.phases?.find(p=>p.kind==='passive')?.actualStart).toBe('2026-11-08T13:19Z');
 expect(cookTimeline(active).filter(t=>t.title==='Hold until serving')).toHaveLength(1);
 const history=archiveCook(active,emptyHistory(),'Served early','2026-11-08T14:01Z');
 expect(history.cooks[0].meal.events).toEqual(active.events);expect(history.cooks[0].meal.serveAt).toBe(serve);
});

it('time-only editing accepts an existing long imported title without truncating or revalidating unrelated fields',()=>{
 const title='Long imported recipe instructions '.repeat(6).slice(0,180);
 const original={...newMeal(),serveAt:serve,customTasks:[{id:'long',dishId:'custom',dishName:'Recipe',title,instructions:'Keep all authored text.',scheduledAt:null,isCondition:true}]};
 const next=editStep(original,'long',title,'Keep all authored text.',{plannedTimeOnly:true,timingMode:'fixed',scheduledAt:'2026-11-08T04:30Z',equipment:'',targetTempF:null});
 expect(next.customTasks).toEqual(original.customTasks);expect(next.taskOverrides?.long).toEqual({scheduledAt:'2026-11-08T04:30:00.000Z'});
});
