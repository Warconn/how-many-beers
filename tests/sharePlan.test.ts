import {describe,it,expect} from 'vitest';
import {createDish,newMeal,type PlannedTask} from '../src/domain/meal';
import {formatMealPlanForShare} from '../src/domain/sharePlan';

const step=(id:string,title:string,at:string|null,durationMinutes:number|null=0):PlannedTask=>({
 id,dishId:'brats',dishName:'Brats',title,instructions:'',scheduledAt:at,isCondition:false,durationMinutes
});
describe('read-only, text-friendly meal plan sharing',()=>{
 it('formats a compact, chronological, copyable plan with the whole-meal beer estimate',()=>{
  const meal={...newMeal(),name:'Saturday dinner',serveAt:'2026-11-22T18:00:00Z',dishes:[createDish('brats')]};
  const tasks=[step('late','Finish brats','2026-11-22T17:00:00Z',60),step('early','Preheat grill','2026-11-22T16:00:00Z',120)];
  const before=JSON.stringify({meal,tasks});
  const text=formatMealPlanForShare(meal,tasks,Date.parse('2026-11-22T12:00Z'));
  expect(text).toMatch(/^🍻 HOW MANY BEERS?\nSaturday dinner\nDinner: /);
  expect(text).toContain('🍽️ ON THE MENU\n• Grilled beer-bath brats');
  expect(text).toContain('🍺 THE BEEROMETER\n~1.3 beers estimated');
  expect(text).toContain('🗓️ THE GAME PLAN');
  expect(text.indexOf('Preheat grill')).toBeLessThan(text.indexOf('Finish brats'));
  expect(text).toContain('From First Beer to First Bite.');
  expect(text).not.toContain('**');
  expect(JSON.stringify({meal,tasks})).toBe(before);
 });
 it('groups scheduled steps by their date, including multi-day planning',()=>{
  const meal={...newMeal(),name:'Holiday cook',dishes:[createDish('brats')]};
  const tasks=[step('next','Serve','2026-11-23T18:00Z'),step('before','Prep','2026-11-22T18:00Z')];
  const text=formatMealPlanForShare(meal,tasks);
  const groups=text.match(/^[A-Z]{3}, [A-Z]{3} \d+/gm);
  expect(groups).toHaveLength(2);
  expect(text.indexOf('Prep')).toBeLessThan(text.indexOf('Serve'));
 });
 it('handles missing times and estimates without making up dates or data',()=>{
  const meal={...newMeal(),name:'Timing pending',serveAt:''};
  const text=formatMealPlanForShare(meal,[step('untimed','Set table',null,null)]);
  expect(text).toContain('Dinner time TBD');
  expect(text).toContain('🍺 THE BEEROMETER\nEstimate TBD');
  expect(text).toContain('TIME TBD\n• Time TBD  Set table');
  expect(text).toContain('From First Beer to First Bite.');
 });
});
