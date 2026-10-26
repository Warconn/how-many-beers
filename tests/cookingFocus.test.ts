import {describe,it,expect} from 'vitest';
import {cookingFocus} from '../src/domain/cookingFocus';
import type {PlannedTask} from '../src/domain/meal';
const now=Date.parse('2026-11-01T06:15:00Z');
const task=(id:string,minutes:number|null):PlannedTask=>({id,title:id,dishId:'dish',dishName:'Dish',instructions:'',scheduledAt:minutes===null?null:new Date(now+minutes*60000).toISOString(),isCondition:true});
describe('clock-based cooking focus',()=>{
 it('groups chronologically across manual order and DST offsets, retaining all tasks',()=>{
  const tasks=[task('late',31),task('next',1),task('past',-60),task('now',0),task('boundary',30),task('untimed',null),task('done',-10)];
  const serialized=JSON.stringify(tasks),completed={done:'2026-11-01T06:00:00Z'};
  const g=cookingFocus(tasks,completed,now);
  expect(g.now.map(t=>t.id)).toEqual(['past','now']);expect(g.next.map(t=>t.id)).toEqual(['next','boundary']);expect(g.later.map(t=>t.id)).toEqual(['late']);expect(g.untimed.map(t=>t.id)).toEqual(['untimed']);expect(g.completed.map(t=>t.id)).toEqual(['done']);
  expect(Object.values(g).flat()).toHaveLength(tasks.length);expect(JSON.stringify(tasks)).toBe(serialized);expect(completed).toEqual({done:'2026-11-01T06:00:00Z'});
 });
 it('advances planned groups without interpreting conditions or changing completion',()=>{
  const tasks=[task('check',10)];const completed={};
  expect(cookingFocus(tasks,completed,now).next).toHaveLength(1);
  expect(cookingFocus(tasks,completed,now+11*60000).now).toHaveLength(1);expect(completed).toEqual({});
 });
 it('treats invalid timestamps as untimed and handles empty and fully completed cooks',()=>{
  expect(cookingFocus([],{},now)).toEqual({now:[],next:[],later:[],untimed:[],completed:[]});
  expect(cookingFocus([{...task('invalid',null),scheduledAt:'bad'}],{},now).untimed).toHaveLength(1);
  const t=task('done',0);const groups=cookingFocus([t],{done:'2026-11-01T06:00:00Z'},now);expect(groups.now).toEqual([]);expect(groups.completed).toEqual([t]);
 });
});
