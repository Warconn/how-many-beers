import {describe,it,expect} from 'vitest';
import {parseRecipeText} from '../src/domain/recipe';
import {newMeal} from '../src/domain/meal';
import {cookTimeline,setStepDuration,editStep,addStep,removeStep,recordEvent,moveStep,type ExtendedMeal,type StepPlanEdit} from '../src/domain/cookState';
import {chronologicalTasks} from '../src/domain/stepTiming';
import {guidedCookingSteps} from '../src/domain/cookingFocus';
import {cookDuration,remainingCook} from '../src/domain/cookDuration';
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
 it('does not claim precise remaining time for unknown cooling, and handles a final serving milestone',()=>{
  const m=change(change(make(),0,5),1,15,{timingMode:'fixed',scheduledAt:'2026-11-25T23:40Z'});
  expect(remainingCook({...m,mode:'cooking'},cookTimeline(m),Date.parse('2026-11-25T23:45Z')).minutes).toBeNull();
  const timed=complete();const completed=Object.fromEntries(stages(timed).map(t=>[t.id,'2026-11-26T00:00Z']));
  expect(remainingCook({...timed,completed,mode:'cooking'},cookTimeline(timed),Date.parse('2026-11-26T00:00Z')).minutes).toBe(5);
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


describe('uploaded recipe order before timing is complete',()=>{
 it('keeps source steps before Serve in checklist, live schedule and guided cooking',()=>{
  for(const m of [make(),change(make(),2,10),change(change(make(),0,5),1,15,{timingMode:'fixed',scheduledAt:'2026-11-25T23:40Z'})]){
   const ids=[...m.dishes[0].steps!.map(s=>m.dishes[0].id+':'+s.id),m.dishes[0].id+':serve'];
   const timeline=cookTimeline(m);
   expect(timeline.map(t=>t.id)).toEqual(ids);
   expect(chronologicalTasks(timeline).map(t=>t.id)).toEqual(ids);
   const guide=guidedCookingSteps(timeline,{});expect(guide.current?.id).toBe(ids[0]);expect(guide.next?.id).toBe(ids[1]);
   expect(guidedCookingSteps(timeline,{[ids[0]]:'actual'}).current?.id).toBe(ids[1]);
  }
 });
 it('orders a newly imported dish correctly when another step already established checklist order',()=>{
  const m=addStep(newMeal(),'Set table');m.dishes=[parseRecipeText('Pumpkin seeds','Clean seeds\nRoast seeds\nCool completely')];
  expect(cookTimeline(m).filter(t=>t.dishId===m.dishes[0].id).map(t=>t.title)).toEqual(['Clean seeds','Roast seeds','Cool completely','Serve']);
 });
 it('preserves explicit checklist moves, other dishes and recorded events',()=>{
  let m=make();m.dishes.push(parseRecipeText('Salad','Wash lettuce\nDress salad'));
  const first=m.dishes[0].id+':'+m.dishes[0].steps![0].id,otherBefore=cookTimeline(m).filter(t=>t.dishId===m.dishes[1].id);
  m=recordEvent(m,first,'temperature','2026-11-25T20:00Z',50,'°F','test note');
  const moved=moveStep(m,first,'down',m.dishes[0].id);
  expect(cookTimeline(moved).filter(t=>t.dishId===m.dishes[0].id)[1].id).toBe(first);
  expect(cookTimeline(moved).filter(t=>t.dishId===m.dishes[1].id)).toEqual(otherBefore);
  expect(moved.events).toEqual(m.events);
 });
});


it('inline duration edits retain long imported text, fixed starts, notes, readings and other dishes',()=>{
 let m=complete();const first=stages(m)[0];m=change(m,0,5,{timingMode:'fixed',scheduledAt:'2026-11-25T23:35Z'});
 m.dishes[0].steps![0].title='A'.repeat(180);
 m.notes={[first.id]:'Keep these notes'};m=recordEvent(m,first.id,'temperature','2026-11-25T23:35Z',50,'°F','Reading');
 const before=cookTimeline(m).find(t=>t.id===first.id)!,events=JSON.stringify(m.events);
 const changed=setStepDuration(m,first.id,10),after=cookTimeline(changed).find(t=>t.id===first.id)!;
 expect(after).toMatchObject({...before,durationMinutes:10});expect(JSON.stringify(changed.events)).toBe(events);expect(changed.notes).toEqual(m.notes);expect(changed.dishes).toEqual(m.dishes);
 for(const invalid of [-1,43201,NaN,Infinity])expect(()=>setStepDuration(m,first.id,invalid)).toThrow(/Duration/);
 expect(stages(setStepDuration(m,first.id,null))[0].durationMinutes).toBeNull();expect(stages(setStepDuration(m,first.id,0))[0].durationMinutes).toBe(0);
});
