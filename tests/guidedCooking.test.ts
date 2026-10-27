import {describe,it,expect} from 'vitest';
import {guidedCookingSteps} from '../src/domain/cookingFocus';
import type {PlannedTask} from '../src/domain/meal';
const task=(id:string,at:string|null):PlannedTask=>({id,title:id,dishId:'dish',dishName:'Dish',instructions:'',scheduledAt:at,isCondition:true});
const tasks=[task('later','2026-11-01T07:00:00Z'),task('soon','2026-11-01T06:30:00Z'),task('due','2026-11-01T05:30:00Z'),task('untimed',null),task('done','2026-11-01T04:00:00Z')];
describe('guided cooking selection',()=>{
 it('selects chronological unfinished work across offset changes and ignores manual order',()=>{
  const result=guidedCookingSteps(tasks,{done:'2026-11-01T04:30:00Z'});
  expect(result.current?.id).toBe('due');expect(result.next?.id).toBe('soon');expect(result.ordered.map(t=>t.id)).toEqual(['done','due','soon','later','untimed']);
 });
 it('previews any selected step, including completed activity, without mutating plans or actuals',()=>{
  const completed={done:'2026-11-01T04:30:00Z'},before=JSON.stringify({tasks,completed});
  expect(guidedCookingSteps(tasks,completed,'later').next?.id).toBe('untimed');
  expect(guidedCookingSteps(tasks,completed,'done').current?.id).toBe('done');
  expect(guidedCookingSteps(tasks,completed,'untimed').next?.id).toBe('due');
  expect(JSON.stringify({tasks,completed})).toBe(before);
 });
 it('advances only after explicit completion and handles removed, last, empty and completed steps',()=>{
  expect(guidedCookingSteps(tasks,{done:'actual',due:'actual'}).current?.id).toBe('soon');
  expect(guidedCookingSteps(tasks,{},'removed').current?.id).toBe('done');
  expect(guidedCookingSteps([tasks[0]],{}).next).toBeNull();expect(guidedCookingSteps([],{}).current).toBeNull();
  expect(guidedCookingSteps(tasks,Object.fromEntries(tasks.map(t=>[t.id,'actual']))).current).toBeNull();
 });
 it('reviews untimed imported work before suggesting its sole serving milestone',()=>{
  const unknown=task('recipe:mix',null),serve=task('recipe:serve','2026-11-25T20:00:00Z');
  expect(guidedCookingSteps([serve,unknown],{}).current?.id).toBe(unknown.id);
  expect(guidedCookingSteps([serve,unknown],{}).next?.id).toBe(serve.id);
 });
});
