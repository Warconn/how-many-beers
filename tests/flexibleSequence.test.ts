import {describe,it,expect} from 'vitest';
import {newMeal,createDish,type Meal,type PresetId} from '../src/domain/meal';
import {parseRecipeText} from '../src/domain/recipe';
import {cookTimeline,moveStep,addStep,editStep,recordEvent,stepTimingWarnings,type ExtendedMeal} from '../src/domain/cookState';
import {liveStepForecasts} from '../src/domain/cookForecast';
import {cookProjection} from '../src/domain/cookProjection';
import {cookDuration} from '../src/domain/cookDuration';
const at='2026-11-02T12:00:00.000Z';
const seed=(preset:Exclude<PresetId,'custom'>='brats'):ExtendedMeal=>({...newMeal(),serveAt:'2026-11-02T18:00Z',dishes:[createDish(preset)]});
const own=(m:Meal)=>cookTimeline(m).filter(t=>t.dishId===m.dishes[0].id);
const shift=(m:Meal,i:number,dir:'up'|'down'='up')=>moveStep(m,own(m)[i].id,dir,m.dishes[0].id);
const active=(m:Meal):ExtendedMeal=>({...m,mode:'cooking' as const,startedAt:at});
describe('user-configured planning sequence',()=>{
 it('permits every adjacent move in all seven templates without internal phase restrictions',()=>{
  for(const preset of ['brats','brisket','turkey','wings','side','ribs','chicken'] as const){const m=seed(preset),tasks=own(m);for(let i=1;i<tasks.length;i++){const moved=shift(m,i);expect(own(moved).filter(t=>tasks.some(old=>old.id===t.id)).map(t=>t.id)).toEqual([...tasks.slice(0,i-1),tasks[i],tasks[i-1],...tasks.slice(i+1)].map(t=>t.id));}}
 });
 it('lets cooking and searing move across checks, with each timed action following the preceding length',()=>{
  const m=shift(seed(),2),t=own(m);expect(t.slice(0,3).map(x=>x.id.split(':').at(-1))).toEqual(['prep','start','preheat']);
  expect(t.slice(0,3).map(x=>x.scheduledAt)).toEqual(['2026-11-02T15:05:00.000Z','2026-11-02T15:25:00.000Z','2026-11-02T17:25:00.000Z']);expect(t[1].durationMinutes).toBe(120);
  const check=t.find(x=>x.id.endsWith(':check'))!;expect(check.isCondition).toBe(true);expect(check.durationMinutes).toBeNull();expect(m.completed).toEqual({});
 });
 it('allows serving in any position and places subsequent work after it',()=>{
  let m=seed();for(let i=own(m).length-1;i>0;i--)m=shift(m,i);const t=own(m);expect(t[0].id).toBe(m.dishes[0].id+':serve');expect(t[0].scheduledAt).toBe('2026-11-02T18:00:00.000Z');expect(t[1].scheduledAt).toBe(t[0].scheduledAt);expect(stepTimingWarnings(m).join(' ')).toMatch(/serving target/);
 });
 it('includes added dish steps instead of rejecting them as independent work',()=>{
  let m=seed();m=addStep(m,'Clean the grill');const added=m.customTasks!.at(-1)!;m={...m,customTasks:[{...added,dishId:m.dishes[0].id,dishName:m.dishes[0].name,durationMinutes:10}]};
  m=shift(m,own(m).length-1);const t=own(m),index=t.findIndex(x=>x.id===added.id);expect(index).toBe(t.length-2);expect(Date.parse(t[index+1].scheduledAt!)-Date.parse(t[index].scheduledAt!)).toBe(10*60000);
 });
 it('retains fixed and recorded times and explains a conflict using the actual step names',()=>{
  let m=seed(),t=own(m);for(const step of t.slice(0,3))m=editStep(m,step.id,step.title,step.instructions,{timingMode:'fixed',scheduledAt:step.scheduledAt,durationMinutes:null,equipment:'',targetTempF:null});const before=JSON.stringify(m);m=shift(m,2);for(const step of t.slice(0,3))expect(own(m).find(x=>x.id===step.id)!.scheduledAt).toBe(step.scheduledAt);const warning=stepTimingWarnings(m).join(' ');expect(warning).toContain('Cover and cook the brat tray');expect(warning).toContain('Preheat grill');expect(warning).not.toContain('template phase');expect(JSON.parse(before).events).toEqual(m.events);
 });
 it('unknown activities remain unknown and do not become zero-minute intervals',()=>{
  let m=seed();m=addStep(m,'Wait for guests');const task=m.customTasks!.at(-1)!;m={...m,customTasks:[{...task,dishId:m.dishes[0].id,dishName:m.dishes[0].name}]};m=shift(m,own(m).length-1);expect(own(m).find(t=>t.id===task.id)!.durationMinutes).toBeNull();expect(cookDuration(m,cookTimeline(m),0).label).toContain('Partial');
 });
 it('uses the chosen sequence for current/upcoming forecasts without inventing physical progress',()=>{
  let m=active(shift(seed(),2)),tasks=own(m),f=liveStepForecasts(m,cookTimeline(m),Date.parse(at));expect(f[tasks[0].id].finish).toBe('2026-11-02T12:20:00.000Z');expect(f[tasks[1].id].start).toBe('2026-11-02T12:20:00.000Z');expect(f[tasks[2].id].start).toBe('2026-11-02T14:20:00.000Z');
  m=recordEvent(m,tasks[0].id,'completed','2026-11-02T12:01Z');m=recordEvent(m,tasks[1].id,'completed','2026-11-02T12:02Z');const events=JSON.stringify(m.events);f=liveStepForecasts(m,cookTimeline(m),Date.parse('2026-11-02T12:03Z'));expect(f[tasks[2].id].start).toBe('2026-11-02T14:01:00.000Z');expect(cookProjection(m,cookTimeline(m),Date.parse('2026-11-02T12:03Z')).remaining).toBeGreaterThan(120);expect(JSON.stringify(m.events)).toBe(events);
 });
 it('anchors actual starts and never auto-completes condition checkpoints from elapsed time',()=>{
  let m=active(shift(seed(),2)),tasks=own(m);m=recordEvent(m,tasks[0].id,'completed','2026-11-02T12:01Z');m=recordEvent(m,tasks[1].id,'started','2026-11-02T12:05Z');const f=liveStepForecasts(m,cookTimeline(m),Date.parse('2026-11-02T12:10Z'));expect(f[tasks[1].id].finish).toBe('2026-11-02T14:05:00.000Z');expect(f[tasks[2].id].start).toBe('2026-11-02T14:05:00.000Z');expect(m.completed[tasks[3].id]).toBeUndefined();
 });
 it('keeps other dishes and original recipe metadata unchanged',()=>{
  const m=seed(),other=parseRecipeText('Salad','# Salad\n## Ingredients\n1 cup greens\n## Instructions\nToss for 5 minutes');m.dishes.push(other);const before=cookTimeline(m).filter(t=>t.dishId===other.id),changed=shift(m,2);expect(cookTimeline(changed).filter(t=>t.dishId===other.id)).toEqual(before);expect(changed.dishes[1]).toEqual(other);expect(changed.serveAt).toBe(m.serveAt);
 });
});
it('duration changes update the following start from a fixed beginning',()=>{
 let m=shift(seed(),2),tasks=own(m),first=tasks[0],cook=tasks[1];m=editStep(m,first.id,first.title,first.instructions,{timingMode:'fixed',scheduledAt:at,durationMinutes:20,equipment:'',targetTempF:null});
 m=editStep(m,cook.id,cook.title,cook.instructions,{timingMode:'plan',scheduledAt:null,durationMinutes:150,equipment:'',targetTempF:null});tasks=own(m);expect(tasks[1].scheduledAt).toBe('2026-11-02T12:20:00.000Z');expect(tasks[2].scheduledAt).toBe('2026-11-02T14:50:00.000Z');
});
it('reorders timed general prep as a sequence without changing another dish',()=>{
 let m=seed();m=addStep(m,'Set table');m=addStep(m,'Mix drinks');for(const [i,t] of m.customTasks!.entries())m=editStep(m,t.id,t.title,t.instructions,{timingMode:'plan',scheduledAt:null,durationMinutes:i?10:5,equipment:'',targetTempF:null});const before=own(m);m=moveStep(m,m.customTasks![1].id,'up','custom');const tasks=cookTimeline(m).filter(t=>t.dishId==='custom');expect(tasks.map(t=>t.title)).toEqual(['Mix drinks','Set table']);expect(tasks.map(t=>t.scheduledAt)).toEqual(['2026-11-02T17:45:00.000Z','2026-11-02T17:55:00.000Z']);expect(own(m)).toEqual(before);
});
it('editing the active plan can reorder unfinished work without modifying physical starts or notes',()=>{
 let m=active(seed()),tasks=own(m);m=recordEvent(m,tasks[0].id,'completed','2026-11-02T12:01Z');m=recordEvent(m,tasks[2].id,'started','2026-11-02T12:05Z');m.notes[tasks[2].id]='Original note';const events=JSON.stringify(m.events),completed=JSON.stringify(m.completed),notes=JSON.stringify(m.notes);
 m=moveStep(m,tasks[2].id,'up',m.dishes[0].id,true);const f=liveStepForecasts(m,cookTimeline(m),Date.parse('2026-11-02T12:10Z'));expect(f[tasks[2].id].start).toBe('2026-11-02T12:05:00.000Z');expect(f[tasks[2].id].finish).toBe('2026-11-02T14:05:00.000Z');expect(JSON.stringify(m.events)).toBe(events);expect(JSON.stringify(m.completed)).toBe(completed);expect(JSON.stringify(m.notes)).toBe(notes);
});
it('old saved preparation orders do not silently become a different cooking method',()=>{
 const m=seed(),tasks=own(m);m.dishes[0].planningStepOrder=['preheat','prep',...tasks.slice(2).map(t=>t.id.split(':').at(-1)!)];m.taskOrder=[tasks[1].id,tasks[0].id,...tasks.slice(2).map(t=>t.id)];const original=JSON.stringify(m);expect(own(m).some(t=>t.userSequence)).toBe(false);expect(JSON.stringify(m)).toBe(original);expect(shift(m,2).dishes[0].planningSequence).toBeDefined();
});
it('retains existing wings rest as an editable step rather than dropping or hiding its allowance',()=>{
 const m=shift(seed('wings'),1),tasks=own(m),rest=tasks.find(t=>t.id.endsWith(':rest'))!,serve=tasks.find(t=>t.id.endsWith(':serve'))!;expect(rest.durationMinutes).toBe(5);expect(tasks.findIndex(t=>t.id===rest.id)).toBe(tasks.findIndex(t=>t.id===serve.id)-1);expect(Date.parse(serve.scheduledAt!)-Date.parse(rest.scheduledAt!)).toBe(5*60000);expect(new Set(tasks.map(t=>t.id)).size).toBe(tasks.length);const changed=moveStep(m,rest.id,'up',m.dishes[0].id);expect(own(changed).findIndex(t=>t.id===rest.id)).toBe(tasks.findIndex(t=>t.id===rest.id)-1);
});
it('refrigerated waiting estimates remain real waits and conditions are never auto-verified',()=>{
 const m=shift(seed('turkey'),1),tasks=own(m),thaw=tasks.find(t=>t.id.endsWith(':thaw'))!,brine=tasks.find(t=>t.id.endsWith(':brine'))!;expect(thaw.durationMinutes).toBeGreaterThan(0);expect(brine.durationMinutes).toBeGreaterThan(0);const live=active(m);const snapshot=JSON.stringify(live.completed);liveStepForecasts(live,cookTimeline(live),Date.parse(at)+60*60000);expect(JSON.stringify(live.completed)).toBe(snapshot);
});
it('a user-estimated checkpoint remains Check when ready after its allowance passes',()=>{
 let m=shift(seed(),3),check=own(m).find(t=>t.id.endsWith(':check'))!;m=editStep(m,check.id,check.title,check.instructions,{timingMode:'fixed',scheduledAt:at,durationMinutes:5,equipment:'',targetTempF:null});m=active(m);for(const t of own(m).slice(0,own(m).findIndex(t=>t.id===check.id)))m=recordEvent(m,t.id,'completed',at);const f=liveStepForecasts(m,cookTimeline(m),Date.parse(at)+10*60000)[check.id];expect(f.status).toBe('condition');expect(m.completed[check.id]).toBeUndefined();
});
it('backup, archive and Cook Again preserve and remap native, added and General prep sequences',async()=>{
 const {archiveCook,emptyHistory,exportBackup,validateBackup,repeatArchivedCook}=await import('../src/domain/cookHistory');
 let m=seed();m=addStep(m,'Clean grill');m=addStep(m,'Set table');m=addStep(m,'Mix drinks');m.customTasks=m.customTasks!.map((t,i)=>({...t,...(i===0?{dishId:m.dishes[0].id,dishName:m.dishes[0].name}:{}),durationMinutes:5}));
 m=shift(m,own(m).length-1);m=moveStep(m,m.customTasks![2].id,'up','custom');const history=archiveCook(m,emptyHistory(),'Keep original feedback',at),snapshot=JSON.stringify(history);const restored=validateBackup(exportBackup(m,history,at));expect(cookTimeline(restored.active)).toEqual(cookTimeline(m));expect(JSON.stringify(restored.history)).toBe(snapshot);
 const repeated=repeatArchivedCook(restored.history.cooks[0]);expect(repeated.dishes[0].id).not.toBe(m.dishes[0].id);expect(cookTimeline(repeated).map(t=>t.title)).toEqual(cookTimeline(m).map(t=>t.title));expect(repeated.dishes[0].planningSequence).toContain(repeated.customTasks![0].id);expect(repeated.planningGeneralSequence).toEqual([repeated.customTasks![2].id,repeated.customTasks![1].id]);expect(repeated.completed).toEqual({});expect(repeated.events).toEqual([]);expect(JSON.stringify(restored.history)).toBe(snapshot);
});
it('reopening an elapsed physical phase blocks false finishes until it is explicitly started again',()=>{
 let m=active(shift(seed(),2)),tasks=own(m);m=recordEvent(m,tasks[0].id,'completed',at);m=recordEvent(m,tasks[1].id,'started',at);m=recordEvent(m,tasks[1].id,'completed','2026-11-02T12:01Z');let f=liveStepForecasts(m,cookTimeline(m),Date.parse('2026-11-02T15:00Z'));expect(f[tasks[1].id].status).toBe('overdue');expect(f[tasks[2].id].status).toBe('blocked');
 m=recordEvent(m,tasks[1].id,'reopened','2026-11-02T15:00Z');m=recordEvent(m,tasks[1].id,'started','2026-11-02T15:05Z');f=liveStepForecasts(m,cookTimeline(m),Date.parse('2026-11-02T15:10Z'));expect(f[tasks[1].id].finish).toBe('2026-11-02T17:05:00.000Z');expect(f[tasks[2].id].start).toBe('2026-11-02T17:05:00.000Z');
});
it('keeps an imported roast window after checking its loading action and anchors cooling on its real start',()=>{
 const dish=parseRecipeText('Pumpkin seeds','# Pumpkin seeds\n## Instructions\n1. Mix seasoning for 2 minutes\n2. Roast for 15 minutes\n3. Cool for 10 minutes');let m:ExtendedMeal={...newMeal(),serveAt:'2026-11-02T18:00Z',dishes:[dish]};let tasks=own(m);m=moveStep(m,tasks[1].id,'up',dish.id);m=moveStep(m,tasks[1].id,'down',dish.id);m=active(m);tasks=own(m);const mix=tasks.find(t=>/^Mix/.test(t.title))!,roast=tasks.find(t=>/^Roast/.test(t.title))!,cool=tasks.find(t=>/^Cool/.test(t.title))!;
 m=recordEvent(m,mix.id,'completed',at);m=recordEvent(m,roast.id,'started','2026-11-02T12:01Z');m=recordEvent(m,roast.id,'completed','2026-11-02T12:02Z');let f=liveStepForecasts(m,cookTimeline(m),Date.parse('2026-11-02T12:03Z'));expect(f[roast.id].finish).toBe('2026-11-02T12:16:00.000Z');expect(f[cool.id].start).toBe(f[roast.id].finish);expect(f[cool.id].finish).toBe('2026-11-02T12:26:00.000Z');expect(cookProjection(m,cookTimeline(m),Date.parse('2026-11-02T12:03Z')).remaining).toBe(23);
 m=recordEvent(m,cool.id,'started','2026-11-02T12:20Z');f=liveStepForecasts(m,cookTimeline(m),Date.parse('2026-11-02T12:21Z'));expect(f[cool.id].finish).toBe('2026-11-02T12:30:00.000Z');expect(f[roast.id]).toBeUndefined();
});
it('retains physical preparation and finishing allowances after their loading checkboxes',()=>{
 for(const [preset,suffix,minutes] of [['wings','dry',480],['brats','bath',15]] as const){let m=active(shift(seed(preset),1)),tasks=own(m),t=tasks.find(t=>t.id.endsWith(':'+suffix))!;for(const prior of tasks.slice(0,tasks.indexOf(t)))m=recordEvent(m,prior.id,'completed',at);m=recordEvent(m,t.id,'started',at);m=recordEvent(m,t.id,'completed','2026-11-02T12:01Z');const f=liveStepForecasts(m,cookTimeline(m),Date.parse('2026-11-02T12:02Z'))[t.id];expect(f.retainDuration).toBe(true);expect(f.finish).toBe(new Date(Date.parse(at)+minutes*60000).toISOString());}
});
