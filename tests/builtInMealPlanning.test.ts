import {describe,it,expect} from 'vitest';
import {createDish,newMeal} from '../src/domain/meal';
import {cookTimeline,type ExtendedMeal} from '../src/domain/cookState';
import {planningReadiness} from '../src/domain/planningReadiness';
import {stepMinutes} from '../src/domain/executionTimeline';
import {equipmentWarnings} from '../src/domain/schedule';

// Sunday November 8, 1 PM New York. Planning happens Saturday at 9 AM.
const target='2026-11-08T18:00:00.000Z',now=Date.parse('2026-11-07T14:00:00.000Z');
const seed=():ExtendedMeal=>({...newMeal(),serveAt:target,dishes:[createDish('brisket'),createDish('ribs')]});
const estimate=(meal:ExtendedMeal)=>planningReadiness(meal,cookTimeline(meal),now)!;
function task(p:ReturnType<typeof estimate>,id:string){return p.tasks.find(t=>t.id===id)!;}

describe('real brisket and ribs meal at Sunday 1 PM',()=>{
 it('aligns serving after different cooking and resting intervals, with one earliest preparation start',()=>{
  const meal=seed(),[brisket,ribs]=meal.dishes,original=structuredClone(meal),p=estimate(meal);
  expect(p.startAt).toBe('2026-11-07T16:55:00.000Z'); // Sat 11:55 AM NY, trimming first.
  expect(task(p,brisket.id+':start').scheduledAt).toBe('2026-11-08T02:20:00.000Z'); // Sat 9:20 PM.
  expect(task(p,brisket.id+':rest').scheduledAt).toBe('2026-11-08T15:20:00.000Z'); // Sun 10:20 AM.
  expect(stepMinutes(meal,task(p,brisket.id+':rest'))).toBe(160);
  expect(task(p,ribs.id+':start').scheduledAt).toBe('2026-11-08T12:10:00.000Z'); // Sun 7:10 AM.
  expect(task(p,ribs.id+':rest').scheduledAt).toBe('2026-11-08T17:40:00.000Z'); // Sun 12:40 PM.
  expect(stepMinutes(meal,task(p,ribs.id+':rest'))).toBe(20);
  expect(task(p,brisket.id+':serve').scheduledAt).toBe(target);expect(task(p,ribs.id+':serve').scheduledAt).toBe(target);expect(p.readyAt).toBe(target);expect(p.lateMinutes).toBe(0);expect(meal).toEqual(original);
 });
 it('does not change either serving endpoint when the second template is added',()=>{
  const meal=seed(),single=estimate({...meal,dishes:[meal.dishes[0]]}),both=estimate(meal);
  expect(both.tasks.filter(t=>t.dishId===meal.dishes[0].id)).toEqual(single.tasks);expect(both.readyAt).toBe(target);expect(both.startAt).toBe(single.startAt);
 });
 it('retains different rest allowances rather than forcing both dishes off the smoker together',()=>{
  const meal=seed();meal.dishes[0].restMinutes=220;const p=estimate(meal),[brisket,ribs]=meal.dishes;
  expect(task(p,brisket.id+':rest').scheduledAt).toBe('2026-11-08T14:20:00.000Z'); // 9:20 AM + 3h40 = 1 PM.
  expect(task(p,ribs.id+':rest').scheduledAt).toBe('2026-11-08T17:40:00.000Z');expect(p.readyAt).toBe(target);
 });
 it('exposes the shared-smoker limitation without automatically merging preheats or moving actuals',()=>{
  const meal=seed(),p=estimate(meal),[brisket,ribs]=meal.dishes;
  const preheat=Date.parse(task(p,ribs.id+':preheat').scheduledAt!);
  expect(preheat).toBe(Date.parse('2026-11-08T11:40:00.000Z')); // Sun 6:40 AM.
  expect(preheat).toBeGreaterThan(Date.parse(task(p,brisket.id+':start').scheduledAt!));expect(preheat).toBeLessThan(Date.parse(task(p,brisket.id+':finish').scheduledAt!));
  // Generic template labels are not a physical equipment assignment (#3).
  const explicitlyShared={...meal,dishes:meal.dishes.map(d=>({...d,equipment:'Patio smoker'}))};
  expect(equipmentWarnings(explicitlyShared)).toEqual([expect.stringContaining('Check capacity and temperature conflicts manually')]);expect(estimate(explicitlyShared).readyAt).toBe(target);expect(meal.events).toBeUndefined();
 });
});
