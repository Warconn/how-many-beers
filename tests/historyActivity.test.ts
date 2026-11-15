import {describe,it,expect} from 'vitest';
import {archivedActivity} from '../src/domain/historyActivity';
import {createDish,newMeal} from '../src/domain/meal';
import {cookTimeline,type CookEvent} from '../src/domain/cookState';

const timeline=cookTimeline({...newMeal(),dishes:[createDish('brisket'),createDish('brats')]});
const first=timeline[0],second=timeline.find(t=>t.dishId!==first.dishId)!;
const snapshot=Object.freeze([Object.freeze({...first,title:'Archived check',dishName:'Brisket'}),Object.freeze({...second,title:'Archived check',dishName:'Brats'})]);
const event:CookEvent=Object.freeze({id:'original',taskId:first.id,kind:'temperature',value:166,unit:'°F',occurredAt:'2026-11-08T08:00:00Z',note:'Original note'});
describe('archived activity attribution',()=>{
 it('resolves stable archived IDs, including identical titles across dishes',()=>{
  expect(archivedActivity(event,snapshot)).toEqual({action:'Food temperature 166°F',context:'Brisket · Archived check'});
  expect(archivedActivity({...event,taskId:second.id},snapshot).context).toBe('Brats · Archived check');
  expect(event.note).toBe('Original note');expect(snapshot[0].title).toBe('Archived check');
 });
 it('does not infer absent or ambiguous steps from timestamps, names or current templates',()=>{
  expect(archivedActivity({...event,taskId:''},snapshot).context).toBe('No step recorded');
  expect(archivedActivity({...event,taskId:'unknown'},snapshot).context).toBe('Archived step unavailable');
  expect(archivedActivity(event,[...snapshot,snapshot[0]]).context).toBe('Archived step unavailable');
 });
 it.each(['started','completed','reopened','equipment','removed'] as const)('labels %s without changing recorded events',kind=>{
  expect(archivedActivity({...event,kind,value:undefined,unit:undefined},snapshot).action).toBe({started:'Started',completed:'Completed',reopened:'Reopened',equipment:'Equipment changed',removed:'Removed'}[kind]);
 });
 it('preserves original units without inventing one',()=>{
  expect(archivedActivity({...event,value:82,unit:'°C'},snapshot).action).toBe('Food temperature 82°C');
  expect(archivedActivity({...event,unit:undefined},snapshot).action).toBe('Food temperature 166');
 });
});
