import {describe,it,expect} from 'vitest';
import {createDish,newMeal} from '../src/domain/meal';
import {parseRecipeText} from '../src/domain/recipe';
import {cookTimeline,moveStep,editStep,recordEvent,removeStep,stepTimingWarnings,type ExtendedMeal} from '../src/domain/cookState';
import {cookDuration} from '../src/domain/cookDuration';
import {liveStepForecasts} from '../src/domain/cookForecast';
import {archiveCook,emptyHistory,repeatArchivedCook,exportBackup,validateBackup} from '../src/domain/cookHistory';
const brats=():ExtendedMeal=>({...newMeal(),serveAt:'2026-11-01T18:00Z',dishes:[createDish('brats')]});
const recipe=():ExtendedMeal=>({...newMeal(),serveAt:'2026-11-01T18:00Z',dishes:[parseRecipeText('Soup','Chop for 5 minutes\nMix for 10 minutes\nSimmer for 15 minutes')]});
const dishTasks=(m:ExtendedMeal)=>cookTimeline(m).filter(t=>t.dishId===m.dishes[0].id);
const swap=(m:ExtendedMeal,i=1,direction:'up'|'down'='up')=>moveStep(m,dishTasks(m)[i].id,direction,m.dishes[0].id);
describe('planning sequence changes',()=>{
 it('replans brat preparation in the chosen order from known allowances, and reversing has no drift',()=>{
  const m=brats(),before=dishTasks(m),changed=swap(m),after=dishTasks(changed);
  expect(after.slice(0,3).map(t=>t.id.split(':').at(-1))).toEqual(['preheat','prep','start']);
  expect(after.slice(0,3).map(t=>t.scheduledAt)).toEqual(['2026-11-01T15:05:00.000Z','2026-11-01T15:25:00.000Z','2026-11-01T15:45:00.000Z']);
  expect(after[0].durationMinutes).toBe(20);expect(cookDuration(changed,cookTimeline(changed),0).minutes).toBe(175);
  expect(dishTasks(swap(changed)).slice(0,3).map(t=>t.scheduledAt)).toEqual(['2026-11-01T15:05:00.000Z','2026-11-01T15:25:00.000Z','2026-11-01T15:45:00.000Z']);expect(dishTasks(swap(swap(changed))).map(t=>t.scheduledAt)).toEqual(after.map(t=>t.scheduledAt));expect(m.dishes[0]).not.toHaveProperty('planningStepOrder');
 });
 it('reorders unequal imported durations without swapping their timestamps, then starts in that sequence',()=>{
  const m=recipe(),changed=swap(m),tasks=dishTasks(changed);
  expect(tasks.map(t=>t.title)).toEqual(['Mix for 10 minutes','Chop for 5 minutes','Simmer for 15 minutes','Serve']);
  expect(tasks.map(t=>t.scheduledAt)).toEqual(['2026-11-01T17:30:00.000Z','2026-11-01T17:40:00.000Z','2026-11-01T17:45:00.000Z','2026-11-01T18:00:00.000Z']);
  const active={...changed,mode:'cooking' as const,startedAt:'2026-11-01T12:00Z'},f=liveStepForecasts(active,cookTimeline(active),Date.parse(active.startedAt));
  expect(f[tasks[0].id].finish).toBe('2026-11-01T12:10:00.000Z');expect(f[tasks[1].id].start).toBe('2026-11-01T12:10:00.000Z');
  expect(dishTasks(swap(changed)).map(t=>[t.id,t.scheduledAt])).toEqual(dishTasks(m).map(t=>[t.id,t.scheduledAt]));
 });
 it('isolates other dishes and leaves the target, notes and actual logs untouched',()=>{
  let m=brats();m.dishes.push(createDish('turkey'));const id=dishTasks(m)[0].id;
  m=recordEvent(m,id,'temperature','2026-11-01T15:00Z',40,'°F','original');m.notes={[id]:'Original note'};
  const old=JSON.stringify(m),other=cookTimeline(m).filter(t=>t.dishId===m.dishes[1].id),changed=swap(m);
  expect(cookTimeline(changed).filter(t=>t.dishId===m.dishes[1].id)).toEqual(other);expect(changed.events).toEqual(m.events);expect(changed.notes).toEqual(m.notes);expect(changed.serveAt).toBe(m.serveAt);expect(JSON.stringify(m)).toBe(old);
 });
 it('retains fixed anchors and explicitly reports an impossible fixed sequence',()=>{
  let m=brats();const tasks=dishTasks(m);
  for(const t of tasks.slice(0,3))m=editStep(m,t.id,t.title,t.instructions,{timingMode:'fixed',scheduledAt:t.scheduledAt,durationMinutes:null,equipment:t.equipment??'',targetTempF:null});
  const changed=swap(m);for(const t of tasks.slice(0,3))expect(dishTasks(changed).find(n=>n.id===t.id)?.scheduledAt).toBe(t.scheduledAt);
  expect(stepTimingWarnings(changed).join(' ')).toContain("after Build the brat and vegetable tray's fixed start");
 });
 it('keeps unknown and unscheduled durations truthful after reordering',()=>{
  let m=recipe();const first=dishTasks(m)[0];m=editStep(m,first.id,first.title,first.instructions,{timingMode:'unscheduled',scheduledAt:null,durationMinutes:null,equipment:'',targetTempF:null});
  const changed=swap(m);expect(dishTasks(changed)[1].scheduledAt).toBeNull();expect(dishTasks(changed)[1].durationMinutes).toBeNull();expect(cookDuration(changed,cookTimeline(changed),0).label).toContain('Partial');
 });
 it('does not reinterpret old taskOrder on load or change active-cook display move semantics',()=>{
  const m=brats(),original=dishTasks(m),legacy={...m,taskOrder:[original[1].id,original[0].id,...original.slice(2).map(t=>t.id)]};
  expect(dishTasks(legacy).map(t=>t.scheduledAt)).toEqual([original[1].scheduledAt,original[0].scheduledAt,...original.slice(2).map(t=>t.scheduledAt)]);
  const active={...m,mode:'cooking' as const,startedAt:'2026-11-01T12:00Z'};expect(dishTasks(swap(active)).map(t=>t.scheduledAt)).toEqual(dishTasks(legacy).map(t=>t.scheduledAt));
 });
 it('allows checks and serving to move while preserving their meaning and manual completion',()=>{
  const m=brats(),tasks=dishTasks(m),moved=moveStep(m,tasks[2].id,'up',m.dishes[0].id);expect(dishTasks(moved)[1].id).toBe(tasks[2].id);expect(moveStep(m,tasks.at(-1)!.id,'up',m.dishes[0].id).completed).toEqual(m.completed);
 });
 it('round-trips a reordered plan and repeats with new IDs while preserving the frozen archive',()=>{
  const changed=swap(recipe()),history=archiveCook(changed,emptyHistory(),'','2026-11-01T19:00Z'),before=JSON.stringify(history),restored=validateBackup(exportBackup(changed,history,'2026-11-01T19:00Z'));
  expect(cookTimeline(restored.active)).toEqual(cookTimeline(changed));
  const repeated=repeatArchivedCook(history.cooks[0]);expect(dishTasks(repeated).map(t=>t.title)).toEqual(dishTasks(changed).map(t=>t.title));expect(dishTasks(repeated)[0].id).not.toBe(dishTasks(changed)[0].id);expect(JSON.stringify(history)).toBe(before);
 });
 it('new template preparation order carries through actual execution forecasts',()=>{
  const changed=swap(brats()),active={...changed,mode:'cooking' as const,startedAt:'2026-11-01T12:00Z'},tasks=dishTasks(active),f=liveStepForecasts(active,cookTimeline(active),Date.parse(active.startedAt));
  expect(f[tasks[0].id].start).toBe('2026-11-01T12:00:00.000Z');expect(f[tasks[1].id].start).toBe('2026-11-01T12:20:00.000Z');expect(f[tasks[2].id].start).toBe('2026-11-01T12:40:00.000Z');
 });
});
it('recalculates an explicitly changed allowance and preserves unknowns after opting in',()=>{
 let m=swap(brats());const first=dishTasks(m)[0];m=editStep(m,first.id,first.title,first.instructions,{timingMode:'plan',scheduledAt:null,durationMinutes:35,equipment:'',targetTempF:null});
 expect(dishTasks(m)[0].scheduledAt).toBe('2026-11-01T14:50:00.000Z');expect(dishTasks(m)[1].scheduledAt).toBe('2026-11-01T15:25:00.000Z');
 m=editStep(m,first.id,first.title,first.instructions,{timingMode:'plan',scheduledAt:null,durationMinutes:null,equipment:'',targetTempF:null});expect(dishTasks(m)[0].scheduledAt).toBeNull();expect(dishTasks(m)[0].durationMinutes).toBeNull();
});
it('hidden work does not consume a reordered preparation slot and reverse moves restore the source plan',()=>{
 let m=brats();m=swap(m);m=removeStep(m,m.dishes[0].id+':prep','2026-11-01T10:00Z');expect(dishTasks(m)[0].scheduledAt).toBe('2026-11-01T15:25:00.000Z');expect(m.events?.at(-1)?.kind).toBe('removed');
});
it('reordered imported durations use elapsed minutes across a daylight-saving change',()=>{
 const m=recipe();m.serveAt='2026-11-01T01:15:00-05:00';m.dishes[0].steps![0].minutes=45;
 const t=dishTasks(swap(m));expect(Date.parse(t[1].scheduledAt!)-Date.parse(t[0].scheduledAt!)).toBe(10*60000);expect(Date.parse(t[2].scheduledAt!)-Date.parse(t[1].scheduledAt!)).toBe(45*60000);
});
