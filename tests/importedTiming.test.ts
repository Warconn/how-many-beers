import {describe,it,expect} from 'vitest';
import {parseRecipeText} from '../src/domain/recipe';
import {newMeal} from '../src/domain/meal';
import {cookTimeline,editStep,addStep,removeStep,recordEvent,moveStep,type ExtendedMeal,type StepPlanEdit} from '../src/domain/cookState';
import {cookDuration} from '../src/domain/cookDuration';
const make=():ExtendedMeal=>({...newMeal(),serveAt:'2026-11-26T00:05Z',dishes:[parseRecipeText('Pumpkin seeds','Clean seeds\nRoast seeds\nCool completely')]});
const change=(m:ExtendedMeal,i:number,durationMinutes:number|null,extra:Partial<StepPlanEdit>={})=>{
 const id=m.dishes[0].id+':'+m.dishes[0].steps![i].id,t=cookTimeline(m).find(t=>t.id===id)!;
 return editStep(m,id,t.title,t.instructions,{timingMode:'plan',scheduledAt:null,durationMinutes,equipment:'Pellet smoker',targetTempF:null,...extra});
};
const stages=(m:ExtendedMeal)=>m.dishes[0].steps!.map(s=>cookTimeline(m).find(t=>t.id===m.dishes[0].id+':'+s.id)!);
const complete=()=>change(change(change(make(),0,5),1,15),2,10);
describe('manually confirmed imported durations',()=>{
 it('uses overrides to back-plan from serving time, updates 5→10→5 across midnight and survives reload',()=>{
  const m=complete();expect(stages(m).map(t=>t.scheduledAt)).toEqual(['2026-11-25T23:35:00.000Z','2026-11-25T23:40:00.000Z','2026-11-25T23:55:00.000Z']);
  expect(cookDuration(m,cookTimeline(m),Date.now()).minutes).toBe(30);
  const changed=change(m,0,10);expect(stages(changed)[0].scheduledAt).toBe('2026-11-25T23:30:00.000Z');expect(cookDuration(changed,cookTimeline(changed),Date.now()).minutes).toBe(35);
  expect(stages(change(changed,0,5))).toEqual(stages(m));expect(cookTimeline(JSON.parse(JSON.stringify(changed)))).toEqual(cookTimeline(changed));
 });
 it('keeps unknown cooling unknown and never presents a serve-only point as a full cook',()=>{
  const m=change(make(),0,5),first=stages(m)[0];expect(first.durationMinutes).toBe(5);expect(first.isCondition).toBe(false);expect(first.instructions).not.toMatch(/Timing needed/);expect(first.scheduledAt).toBeNull();
  expect(cookDuration(m,cookTimeline(m),Date.now()).minutes).toBeNull();expect(stages(m)[2].durationMinutes).toBeNull();
 });
 it('derives around a fixed start without a serving target, preserving recorded events and notes',()=>{
  let m=complete();m={...m,serveAt:''};m=change(m,1,15,{timingMode:'fixed',scheduledAt:'2026-11-25T23:40Z'});
  expect(stages(m).map(t=>t.scheduledAt)).toEqual(['2026-11-25T23:35:00.000Z','2026-11-25T23:40:00.000Z','2026-11-25T23:55:00.000Z']);
  const first=stages(m)[0];m=recordEvent(m,first.id,'completed','2026-11-25T23:39Z');m.notes={[first.id]:'Keep spice notes'};const before=JSON.stringify(m.events);
  const changed=change(m,0,10);expect(stages(changed)[0].scheduledAt).toBe(first.scheduledAt);expect(JSON.stringify(changed.events)).toBe(before);expect(changed.notes).toEqual(m.notes);
 });
 it('labels a partial fixed-start window, respects explicit unscheduling and retains authored instructions',()=>{
  let m=change(change(make(),0,5),1,15,{timingMode:'fixed',scheduledAt:'2026-11-25T23:40Z'});
  expect(cookDuration(m,cookTimeline(m),Date.now()).label).toContain('Partial');expect(stages(m)[2].durationMinutes).toBeNull();
  const t=stages(m)[0];m=editStep(m,t.id,t.title,'Keep refrigerated; use clean utensils.');m=change(m,0,10,{timingMode:'unscheduled'});expect(stages(m)[0].scheduledAt).toBeNull();expect(stages(m)[0].instructions).toContain('Keep refrigerated');
 });
 it('reset to unknown removes fabricated timing; hidden steps and display reordering do not corrupt recipe order',()=>{
  const m=complete(),first=stages(m)[0];expect(stages(change(m,0,null))[0].scheduledAt).toBeNull();
  expect(stages(moveStep(m,first.id,'down',m.dishes[0].id)).map(t=>t.scheduledAt)).toEqual(stages(m).map(t=>t.scheduledAt));
  const hidden=removeStep(m,first.id,'2026-11-25T23:00Z');expect(cookDuration(hidden,cookTimeline(hidden),Date.now()).minutes).toBe(25);
 });
});


describe('import anchors and independent prep',()=>{
 it('leaves missing anchors unknown and shifts derived recipes when serving time changes',()=>{
  const m=complete();expect(stages({...m,serveAt:''}).every(t=>t.scheduledAt===null)).toBe(true);
  expect(stages({...m,serveAt:'2026-11-27T00:05Z'})[0].scheduledAt).toBe('2026-11-26T23:35:00.000Z');
  const zero=change(change(change(make(),0,0),1,0),2,0);expect(cookDuration(zero,cookTimeline(zero),Date.now()).minutes).toBe(0);
 });
 it('clearing an originally timed duration makes it unknown rather than reusing its source value',()=>{
  const m=make();m.dishes[0].steps!.forEach(s=>s.minutes=10);
  expect(stages(change(m,0,null))[0].scheduledAt).toBeNull();expect(stages(change(m,0,null))[0].durationMinutes).toBeNull();
 });
 it('ignores hidden unknown intervals without erasing their recorded removal',()=>{
  const m=change(change(make(),0,5),1,15),cool=stages(m)[2];const changed=removeStep(m,cool.id,'2026-11-25T20:00Z');
  expect(cookDuration(changed,cookTimeline(changed),Date.now()).minutes).toBe(20);expect(changed.events).toHaveLength(1);
 });
 it('derives a duration-only general prep step independently, and keeps its recorded position',()=>{
  let m=addStep({...newMeal(),serveAt:'2026-11-26T00:05Z'},'Set table');const t=cookTimeline(m)[0];
  m=editStep(m,t.id,t.title,'Keep these notes',{timingMode:'plan',scheduledAt:null,durationMinutes:5,equipment:'Table',targetTempF:null});
  expect(cookTimeline(m)[0].scheduledAt).toBe('2026-11-26T00:00:00.000Z');expect(cookDuration(m,cookTimeline(m),Date.now()).minutes).toBe(5);
  m=recordEvent(m,t.id,'completed','2026-11-26T00:01Z');expect(cookTimeline({...m,serveAt:'2026-11-27T00:05Z'})[0].scheduledAt).toBe('2026-11-26T00:00:00.000Z');
 });
});
