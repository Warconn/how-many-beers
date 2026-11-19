import {describe,it,expect} from 'vitest';
import {createDish,newMeal,type PlannedTask} from '../src/domain/meal';
import {formatMealPlanForShare} from '../src/domain/sharePlan';

const step=(id:string,title:string,at:string|null,durationMinutes:number|null=0):PlannedTask=>({
 id,dishId:'brats',dishName:'Brats',title,instructions:'',scheduledAt:at,isCondition:false,durationMinutes
});
describe('read-only plan sharing',()=>{
 it('uses the same whole-meal beer estimate and chronological order, without mutating the plan',()=>{
  const meal={...newMeal(),name:'Saturday dinner',serveAt:'2026-11-22T18:00:00Z',dishes:[createDish('brats')]};
  const tasks=[step('late','Finish brats','2026-11-22T17:00:00Z',60),step('early','Preheat grill','2026-11-22T16:00:00Z',120)];
  const before=JSON.stringify({meal,tasks});
  const text=formatMealPlanForShare(meal,tasks,Date.parse('2026-11-22T12:00Z'));
  expect(text).toContain('Saturday dinner');
  expect(text).toContain('🍺 ~1.3 beers');
  expect(text).toContain('Brats');
  expect(text.indexOf('Preheat grill')).toBeLessThan(text.indexOf('Finish brats'));
  expect(text).toContain('🕒 Game plan');
  expect(text).toContain('From First Beer to First Bite.');
  expect(text).not.toContain('Next cook');
  expect(JSON.stringify({meal,tasks})).toBe(before);
 });
 it('does not invent an estimate or missing step time',()=>{
  const meal={...newMeal(),name:'Timing pending',serveAt:''};
  const text=formatMealPlanForShare(meal,[step('untimed','Set table',null,null)]);
  expect(text).toContain('🍺 Beers TBD');
  expect(text).toContain('TIME TBD');
  expect(text).toContain('• Time TBD  Set table');
  expect(text).not.toContain('90 minutes per estimated beer');
  expect(text).not.toContain('Cooking times are estimates');
 });
});
