import {describe,it,expect} from 'vitest';
import {newMeal,createDish,type Meal} from '../src/domain/meal';
import {parseRecipeText} from '../src/domain/recipe';
import {recipeReview} from '../src/domain/recipeReview';
import {cookTimeline,setStepDuration,editStep,moveStep,removeStep,addStep,recordEvent,startCookSession,type ExtendedMeal} from '../src/domain/cookState';
import {planningReadiness} from '../src/domain/planningReadiness';
import {cookDuration} from '../src/domain/cookDuration';
const at=(time:string)=>'2026-11-08T'+time+':00.000Z';
function dish(name:string,text:string,equipment=name){return {...recipeReview({...parseRecipeText(name,text),equipment},at('18:00')).dishes[0]};}
function meal(...dishes:Meal['dishes']):ExtendedMeal{return {...newMeal(),serveAt:at('18:00'),dishes};}
const project=(m:Meal,time='16:00')=>planningReadiness(m,cookTimeline(m),Date.parse(at(time)))!;
const start=(p:ReturnType<typeof project>,dishId:string,index=0)=>p.tasks.filter(t=>t.dishId===dishId&&!t.id.endsWith(':serve')).sort((a,b)=>(a.recipeOrder??0)-(b.recipeOrder??0))[index].scheduledAt;
function sequence(){const d=dish('Brats','Preheat grill (15 minutes)\nGrill brats (35 minutes)\nRest brats (10 minutes)');return {d,m:meal(d)};}
describe('#109 whole-meal planning',()=>{
 it('overlaps independent 75-minute potatoes and 45-minute brats at 6 PM',()=>{
  const potatoes=dish('Potatoes','Roast potatoes (75 minutes)'),brats=dish('Brats','Grill brats (45 minutes)'),m=meal(potatoes,brats),before=structuredClone(m),p=project(m);
  expect(start(p,potatoes.id)).toBe(at('16:45'));expect(start(p,brats.id)).toBe(at('17:15'));expect(p.readyAt).toBe(at('18:00'));expect(p.lateMinutes).toBe(0);expect(cookDuration(m,p.tasks,Date.parse(at('16:00'))).minutes).toBe(75);expect(m).toEqual(before);
 });
 it('does not invent past work when a target is impossible, and accepts a suggestion only explicitly',()=>{
  const potatoes=dish('Potatoes','Roast potatoes (75 minutes)'),brats=dish('Brats','Grill brats (45 minutes)'),m=meal(potatoes,brats),p=project(m,'17:15');
  expect(start(p,potatoes.id)).toBe(at('17:15'));expect(p.readyAt).toBe(at('18:30'));expect(p.lateMinutes).toBe(30);expect(p.suggestedServeAt).toBe(at('18:30'));expect(m.serveAt).toBe(at('18:00'));expect(m.events).toBeUndefined();expect(m.completed).toEqual({});
  const changed={...m,serveAt:p.suggestedServeAt!},next=project(changed,'17:15');expect(start(next,potatoes.id)).toBe(at('17:15'));expect(start(next,brats.id)).toBe(at('17:45'));expect(next.readyAt).toBe(at('18:30'));expect(next.lateMinutes).toBe(0);
 });
 it('keeps a full illustrative three-hour turkey sequence at 4 PM and suggests 7 PM',()=>{
  const turkey=dish('Turkey','Prepare turkey (30 minutes)\nRoast turkey (120 minutes)\nRest turkey (30 minutes)'),m=meal(turkey),p=project(m);
  expect(start(p,turkey.id)).toBe(at('16:00'));expect(p.readyAt).toBe(at('19:00'));expect(p.suggestedServeAt).toBe(at('19:00'));expect(p.lateMinutes).toBe(60);expect(m.startedAt).toBeUndefined();expect(cookDuration(m,p.tasks,Date.parse(at('16:00'))).minutes).toBe(180);
 });
 it('aligns a short additional sauce without delaying dinner',()=>{
  const potatoes=dish('Potatoes','Roast (75 minutes)'),sauce=dish('Sauce','Simmer (15 minutes)'),p=project(meal(potatoes,sauce));expect(start(p,sauce.id)).toBe(at('17:45'));expect(p.readyAt).toBe(at('18:00'));
 });
 it('moves eligible paths when the target changes, retaining durations and fixed anchors',()=>{
  const potatoes=dish('Potatoes','Roast (75 minutes)'),brats=dish('Brats','Grill (45 minutes)');let m=meal(potatoes,brats);const id=cookTimeline(m).find(t=>t.dishId===brats.id&&!t.id.endsWith(':serve'))!.id;
  const shifted=project({...m,serveAt:at('18:45')});expect(start(shifted,potatoes.id)).toBe(at('17:30'));expect(start(shifted,brats.id)).toBe(at('18:00'));
  m=editStep(m,id,'Grill','',{timingMode:'fixed',scheduledAt:at('17:15'),durationMinutes:45,equipment:'Grill',targetTempF:null});const fixed=project({...m,serveAt:at('18:45')});expect(fixed.tasks.find(t=>t.id===id)?.scheduledAt).toBe(at('17:15'));expect(fixed.tasks.find(t=>t.id===id)?.durationMinutes).toBe(45);
 });
 it('propagates fixed preheat 5:20 through grilling/rest to 6:20',()=>{
  let {d,m}=sequence();const task=cookTimeline(m).find(t=>t.dishId===d.id&&!t.id.endsWith(':serve'))!;
  m=editStep(m,task.id,task.title,task.instructions,{timingMode:'fixed',scheduledAt:at('17:20'),durationMinutes:15,equipment:'Grill',targetTempF:null});const p=project(m);
  expect(start(p,d.id)).toBe(at('17:20'));expect(start(p,d.id,1)).toBe(at('17:35'));expect(start(p,d.id,2)).toBe(at('18:10'));expect(p.readyAt).toBe(at('18:20'));expect(p.lateMinutes).toBe(20);
 });
 it('extends fixed preheat but moves flexible preheat earlier when feasible',()=>{
  const {d,m}=sequence(),task=cookTimeline(m).find(t=>t.dishId===d.id&&!t.id.endsWith(':serve'))!;
  const longer=setStepDuration(m,task.id,25),flex=project(longer);expect(start(flex,d.id)).toBe(at('16:50'));expect(flex.readyAt).toBe(at('18:00'));
  const fixed=editStep(longer,task.id,task.title,task.instructions,{timingMode:'fixed',scheduledAt:at('17:00'),durationMinutes:25,equipment:'Grill',targetTempF:null}),p=project(fixed);expect(p.readyAt).toBe(at('18:10'));expect(p.lateMinutes).toBe(10);expect(cookDuration(fixed,p.tasks,Date.parse(at('16:00'))).minutes).toBe(70);
 });
 it('reflows an edited independent dish without moving another dish',()=>{
  const potatoes=dish('Potatoes','Prepare (10 minutes)\nRoast (65 minutes)'),brats=dish('Brats','Grill (45 minutes)'),m=meal(potatoes,brats),id=cookTimeline(m).find(t=>t.dishId===potatoes.id&&!t.id.endsWith(':serve'))!.id,before=project(m);
  const after=project(setStepDuration(m,id,20));expect(after.readyAt).toBe(at('18:00'));expect(after.tasks.filter(t=>t.dishId===brats.id)).toEqual(before.tasks.filter(t=>t.dishId===brats.id));expect(start(after,potatoes.id)).toBe(at('16:35'));
 });
 it('recalculates additions, removals, arbitrary order and serialized reload',()=>{
  let {d,m}=sequence();m=addStep(m,'Sauce','');const added=m.customTasks!.at(-1)!;m={...m,customTasks:m.customTasks!.map(t=>({...t,dishId:d.id,dishName:d.name}))};m.dishes[0].planningSequence=[...m.dishes[0].planningSequence!];m.dishes[0].planningSequence!.splice(2,0,added.id);m=setStepDuration(m,added.id,15);
  let p=project(m,'17:00');expect(p.readyAt).toBe(at('18:15'));m=removeStep(m,added.id,at('16:00'));p=project(m,'17:00');expect(p.readyAt).toBe(at('18:00'));
  const rows=cookTimeline(m).filter(t=>t.dishId===d.id);m=moveStep(m,rows[1].id,'up',d.id,true);p=project(m,'17:00');expect(start(p,d.id)).toBe(at('17:00'));expect(p.readyAt).toBe(at('18:00'));expect(project(JSON.parse(JSON.stringify(m)),'17:00')).toEqual(p);
 });
 it('retains authored template overlaps and treats thaw/skipped brine as reminders',()=>{
  const brats=createDish('brats'),m=meal(brats),raw=cookTimeline(m),p=project(m,'10:00');
  expect(p.readyAt).toBe(at('18:00'));expect(p.partial).toBe(false);expect(p.tasks.map(t=>t.scheduledAt)).toEqual(raw.map(t=>t.scheduledAt));
  const turkey={...createDish('turkey'),turkeyPrep:{state:'thawed' as const,thawDays:0,brineHours:0,dryHours:0}},t=project(meal(turkey),'10:00');expect(t.readyAt).toBe(at('18:00'));expect(t.partial).toBe(false);
 });
 it('keeps the Beerometer coherent when a template ends at a known interval, and retains explicit unknowns',()=>{
  const d=createDish('brats'),m=meal(d),id=d.id+':start';m.hiddenTaskIds=cookTimeline(m).filter(t=>!t.id.endsWith(':prep')&&!t.id.endsWith(':preheat')&&t.id!==id).map(t=>t.id);
  const p=project(m,'10:00'),from=Math.min(...p.tasks.map(t=>Date.parse(t.scheduledAt!)));
  expect(cookDuration(m,p.tasks,Date.parse(at('10:00'))).minutes).toBe((Date.parse(p.readyAt!)-from)/60000);
  const savedUnknown:ExtendedMeal={...m,taskOverrides:{[id]:{durationMinutes:null}}};const unknown=project(savedUnknown,'10:00');expect(unknown.readyAt).toBeNull();expect(unknown.tasks.find(t=>t.id===id)?.durationMinutes).toBeNull();
 });
 it('does not reinterpret actuals, active phases or recorded history',()=>{
  const {m}=sequence(),active=startCookSession(m,at('16:00')),t=cookTimeline(active)[0],observed=recordEvent(active,t.id,'completed',at('16:01')),before=structuredClone(observed);expect(planningReadiness(observed,cookTimeline(observed),Date.parse(at('17:00')))).toBeNull();expect(observed).toEqual(before);
 });
 it('keeps unknown work and fixed-start conflicts explicit without changing anchors',()=>{
  const unknown=meal(dish('Unknown','Prepare\nRoast (15 minutes)'));expect(project(unknown).readyAt).toBeNull();expect(project(unknown).partial).toBe(true);
  const {m,d}=sequence(),task=cookTimeline(m)[0],fixed=editStep(m,task.id,task.title,task.instructions,{timingMode:'fixed',scheduledAt:at('17:00'),durationMinutes:15,equipment:'Grill',targetTempF:null}),p=project(fixed,'17:10');expect(start(p,d.id)).toBe(at('17:00'));expect(p.conflicts.join(' ')).toContain(task.title);expect(p.readyAt).toBe(at('18:10'));expect(fixed.taskOverrides?.[task.id].scheduledAt).toBe(at('17:00'));
 });
});
