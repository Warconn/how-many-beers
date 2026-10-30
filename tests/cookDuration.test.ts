import {describe,it,expect} from 'vitest';
import {createDish,newMeal} from '../src/domain/meal';
import type {ExtendedMeal} from '../src/domain/cookState';
import {cookTimeline,recordEvent} from '../src/domain/cookState';
import {cookDuration,remainingCook} from '../src/domain/cookDuration';
const now=Date.parse('2026-11-25T10:00Z');
const read=(m:ExtendedMeal)=>cookDuration(m,cookTimeline(m),now);
describe('whole cook duration',()=>{
 it('includes brisket prep and serving, counts overlaps once, ignores dish order',()=>{
  const brisket=createDish('brisket'),brats=createDish('brats');const m={...newMeal(),dishes:[brisket],serveAt:'2026-11-25T18:00Z'};
  expect(read(m).minutes).toBe(1505);expect(read({...m,dishes:[brats,brisket]}).minutes).toBe(1505);
 });
 it('includes refrigerated brining, excludes thaw reminders and skipped brine',()=>{
  const t={...createDish('turkey'),turkeyPrep:{state:'frozen' as const,thawDays:5,brineHours:22,dryHours:8}};
  const m={...newMeal(),dishes:[t],serveAt:'2026-11-25T18:00Z'};
  expect(read(m).minutes).toBe(270+60+30*60);
  expect(read({...m,dishes:[{...t,turkeyPrep:{...t.turkeyPrep,brineHours:0}}]}).minutes).toBe(270+60+8*60);
 });
 it('uses edited times/durations, excludes hidden steps, handles untimed input',()=>{
  const d=createDish('brats'),m={...newMeal(),dishes:[d],serveAt:'2026-11-25T18:00Z'};
  const task=cookTimeline(m)[0];const extended={...m,taskOverrides:{[task.id]:{scheduledAt:'2026-11-25T12:00Z',durationMinutes:600}}};
  expect(read(extended).minutes).toBe(755);
  expect(read({...extended,hiddenTaskIds:[task.id]}).minutes).toBeLessThan(600);
  expect(read({...m,serveAt:''}).minutes).toBeNull();expect(read(newMeal()).minutes).toBeNull();
 });
 it('keeps actual observations, projected total and elapsed distinct; freezes archived actuals',()=>{
  const d=createDish('brats');let m={...newMeal(),dishes:[d],serveAt:'2026-11-25T12:00Z',mode:'cooking' as const,startedAt:'2026-11-25T09:00Z'};
  const before=read(m);const updated=recordEvent(m,cookTimeline(m)[1].id,'completed','2026-11-25T09:30Z');
  expect(read(updated)).toEqual(before);expect(before.elapsed).toBe(60);expect(before.minutes).toBe(180);
  const timeline=cookTimeline(updated);expect(cookDuration(updated,timeline,now,'2026-11-25T13:00Z').minutes).toBe(240);
  expect(cookDuration(updated,timeline,now+9999999,'2026-11-25T13:00Z').minutes).toBe(240);
  expect(cookDuration({...m,startedAt:undefined},timeline,now,'2026-11-25T13:00Z').label).toBe('Planned cook');
  expect(read({...m,startedAt:'invalid'}).minutes).toBeGreaterThan(0);
 });
});


describe('remaining whole-cook window',()=>{
 const m={...newMeal(),mode:'cooking' as const};
 const task=(id:string,at:string|null,durationMinutes=0)=>({id,dishId:id,dishName:id,title:id,instructions:'',scheduledAt:at,durationMinutes,isCondition:false});
 const timeline=[task('prep','2026-11-25T10:00Z',120),task('overlap','2026-11-25T11:00Z',180),task('serve','2026-11-25T14:00Z')];
 it('counts overlap once, advances past completed early work and keeps totals separate',()=>{
  const at=Date.parse('2026-11-25T09:00Z');
  expect(remainingCook(m,timeline,at).minutes).toBe(240);
  const partial={...m,completed:{prep:'2026-11-25T09:00Z'}};
  expect(remainingCook(partial,timeline,at).minutes).toBe(180);
  expect(cookDuration(partial,timeline,at).minutes).toBe(240);
  expect(remainingCook(m,timeline,Date.parse('2026-11-25T12:00Z')).minutes).toBe(120);
 });
 it('reaches zero when all steps are checked early, persists through reload and reopens',()=>{
  const completed=Object.fromEntries(timeline.map(t=>[t.id,'2026-11-25T09:01Z']));
  expect(remainingCook({...m,completed},timeline,now).minutes).toBe(0);
  expect(remainingCook(JSON.parse(JSON.stringify({...m,completed})),timeline,now).minutes).toBe(0);
  delete completed.prep;expect(remainingCook({...m,completed},timeline,now).minutes).toBe(120);
  expect(remainingCook(m,timeline,now,'2026-11-25T09:02Z').minutes).toBe(0);
 });
 it('does not claim an overdue or untimed unfinished cook is complete',()=>{
  expect(remainingCook(m,timeline,Date.parse('2026-11-26T12:00Z')).minutes).toBeNull();
  expect(remainingCook(m,[...timeline,task('unknown',null)],now).minutes).toBeNull();
  expect(remainingCook({...m,completed:{unknown:'2026-11-25T09:00Z'}},[...timeline,task('unknown',null)],now).minutes).toBe(240);
 });
});
