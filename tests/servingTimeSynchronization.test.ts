import {describe,it,expect} from 'vitest';
import {newMeal,createDish} from '../src/domain/meal';
import {parseRecipeText} from '../src/domain/recipe';
import {recipeReview} from '../src/domain/recipeReview';
import {cookTimeline,startCookSession,recordEvent,setStepDuration,editStep,type ExtendedMeal} from '../src/domain/cookState';
import {planningReadiness} from '../src/domain/planningReadiness';
import {cookProjection} from '../src/domain/cookProjection';

const at=(time:string)=>`2026-11-22T${time}:00.000Z`;
function fixture():ExtendedMeal {
  const potatoes={...recipeReview(parseRecipeText('Potatoes',
    'Roast potatoes (75 minutes)\nRemove potatoes from oven (0 minutes)'),at('18:00')).dishes[0],id:'potatoes'};
  const brats={...recipeReview(parseRecipeText('Brats',
    'Grill brats (45 minutes)\nRemove brats from grill (0 minutes)'),at('18:00')).dishes[0],id:'brats'};
  return {...newMeal(),serveAt:at('18:00'),dishes:[potatoes,brats]};
}

describe('two-dish serving-time synchronization across Planning and Cooking Mode',()=>{
  it('plans different start times so both dishes finish at the serving target',()=>{
    const meal=fixture(),plan=planningReadiness(meal,cookTimeline(meal),Date.parse(at('16:00')))!;
    expect(plan.tasks.find(t=>t.id==='potatoes:step-1')!.scheduledAt).toBe(at('16:45'));
    expect(plan.tasks.find(t=>t.id==='brats:step-1')!.scheduledAt).toBe(at('17:15'));
    expect(plan.readyAt).toBe(at('18:00'));
    for(const id of ['potatoes','brats']){
      expect(plan.tasks.find(t=>t.id===id+':serve')!.scheduledAt).toBe(at('18:00'));
    }
  });

  it('keeps the shorter dish scheduled later when the meal enters Cooking Mode',()=>{
    const meal=startCookSession(fixture(),at('16:45'));
    const projected=cookProjection(meal,cookTimeline(meal),Date.parse(at('16:45')));
    expect(meal.events??[]).toEqual([]);
    expect(meal.serveAt).toBe(at('18:00'));
    expect(projected.forecasts['brats:step-1'].start).toBe(at('17:15'));
    expect(projected.forecasts['brats:step-1'].finish).toBe(at('18:00'));
    expect(projected.forecasts['potatoes:step-1'].finish).toBe(at('18:00'));
  });

  it('retains that synchronization after starting only the longer dish and reloading',()=>{
    let meal=startCookSession(fixture(),at('16:45'));
    meal=recordEvent(meal,'potatoes:step-1','completed',at('16:45'));
    const reloaded=JSON.parse(JSON.stringify(meal)) as ExtendedMeal;
    const before=structuredClone(reloaded);
    const projected=cookProjection(reloaded,cookTimeline(reloaded),Date.parse(at('17:00')));
    expect(reloaded).toEqual(before);
    expect(projected.forecasts['brats:step-1'].start).toBe(at('17:15'));
    expect(projected.forecasts['brats:step-1'].finish).toBe(at('18:00'));
    expect(projected.forecasts['potatoes:step-1'].finish).toBe(at('18:00'));
  });

  it('preserves actual starts and aligns finishes when both starts are explicitly recorded on plan',()=>{
    let meal=startCookSession(fixture(),at('16:45'));
    meal=recordEvent(meal,'potatoes:step-1','completed',at('16:45'));
    meal=recordEvent(meal,'brats:step-1','completed',at('17:15'));
    const before=structuredClone(meal.events);
    const projected=cookProjection(meal,cookTimeline(meal),Date.parse(at('17:30')));
    expect(projected.forecasts['potatoes:step-1'].finish).toBe(at('18:00'));
    expect(projected.forecasts['brats:step-1'].finish).toBe(at('18:00'));
    expect(projected.finish).toBe(at('18:00'));
    expect(meal.events).toEqual(before);
  });

  it.each([
    ['16:00','16:30','17:15'],
    ['17:00','17:30','18:15'],
  ])('keeps one meal window when the session starts at %s', (start,shortStart,finish)=>{
    const meal=startCookSession(fixture(),at(start));
    const projected=cookProjection(meal,cookTimeline(meal),Date.parse(at(start)));
    expect(projected.forecasts['brats:step-1'].start).toBe(at(shortStart));
    expect(projected.forecasts['potatoes:step-1'].finish).toBe(at(finish));
    expect(projected.forecasts['brats:step-1'].finish).toBe(at(finish));
    expect(meal.serveAt).toBe(at('18:00'));
    expect(meal.events??[]).toEqual([]);
  });

  it('uses a late actual start to guide the remaining unstarted dish without moving the target',()=>{
    let meal=startCookSession(fixture(),at('16:45'));
    meal=recordEvent(meal,'potatoes:step-1','completed',at('17:00'));
    const before=structuredClone(meal);
    const projected=cookProjection(meal,cookTimeline(meal),Date.parse(at('17:00')));
    expect(projected.forecasts['brats:step-1'].start).toBe(at('17:30'));
    expect(projected.finish).toBe(at('18:15'));
    expect(meal).toEqual(before);
  });

  it('preserves a shorter dish actually started early instead of padding its physical interval',()=>{
    let meal=startCookSession(fixture(),at('16:45'));
    meal=recordEvent(meal,'potatoes:step-1','completed',at('16:45'));
    meal=recordEvent(meal,'brats:step-1','completed',at('16:50'));
    const before=structuredClone(meal.events);
    const projected=cookProjection(meal,cookTimeline(meal),Date.parse(at('16:55')));
    expect(projected.forecasts['brats:step-1'].start).toBe(at('16:50'));
    expect(projected.forecasts['brats:step-1'].finish).toBe(at('17:35'));
    expect(projected.finish).toBe(at('18:00'));
    expect(meal.events).toEqual(before);
  });

  it('reports a late unstarted dish honestly instead of shrinking its duration to hit serving',()=>{
    let meal=startCookSession(fixture(),at('16:45'));
    meal=recordEvent(meal,'potatoes:step-1','completed',at('16:45'));
    const projected=cookProjection(meal,cookTimeline(meal),Date.parse(at('17:30')));
    expect(projected.forecasts['brats:step-1'].start).toBe(at('17:30'));
    expect(projected.forecasts['brats:step-1'].finish).toBe(at('18:15'));
    expect(meal.serveAt).toBe(at('18:00'));
  });

  it('recalculates the unstarted offset after a duration edit while retaining the other dish actuals',()=>{
    let meal=startCookSession(fixture(),at('16:45'));
    meal=recordEvent(meal,'potatoes:step-1','completed',at('16:45'));
    const before=structuredClone(meal.events);
    const changed=setStepDuration(meal,'brats:step-1',60);
    const projected=cookProjection(changed,cookTimeline(changed),Date.parse(at('16:45')));
    expect(projected.forecasts['brats:step-1'].start).toBe(at('17:00'));
    expect(projected.forecasts['brats:step-1'].finish).toBe(at('18:00'));
    expect(changed.events).toEqual(before);
  });

  it('honors a fixed earlier start even when that dish will finish before the meal',()=>{
    const original=fixture(),task=cookTimeline(original).find(t=>t.id==='brats:step-1')!;
    const fixed=editStep(original,task.id,task.title,task.instructions,{
      timingMode:'fixed',scheduledAt:at('16:45'),durationMinutes:45,equipment:'Grill',targetTempF:null,
    });
    const meal=startCookSession(fixed,at('16:45'));
    const projected=cookProjection(meal,cookTimeline(meal),Date.parse(at('16:45')));
    expect(projected.forecasts['brats:step-1'].start).toBe(at('16:45'));
    expect(projected.forecasts['brats:step-1'].finish).toBe(at('17:30'));
    expect(projected.finish).toBe(at('18:00'));
  });

  it('keeps unknown cooking duration uncertain rather than inventing an aligned finish',()=>{
    const meal=startCookSession(setStepDuration(fixture(),'brats:step-1',null),at('16:45'));
    const projected=cookProjection(meal,cookTimeline(meal),Date.parse(at('16:45')));
    expect(projected.remaining).toBeNull();
    expect(projected.finish).toBeNull();
    expect(projected.phases!.find(p=>p.dishId==='brats')!.minutes).toBeNull();
    expect(meal.events??[]).toEqual([]);
  });

  it('aligns built-in brisket and ribs after their different preparation, cooking and holding allowances',()=>{
    const dishes=[createDish('brisket'),createDish('ribs')];
    const meal=startCookSession({...newMeal(),serveAt:at('18:00'),dishes},at('06:00'));
    const projected=cookProjection(meal,cookTimeline(meal),Date.parse(at('06:00')));
    expect(projected.finish).not.toBeNull();
    for(const dish of dishes){
      expect(projected.forecasts[dish.id+':rest'].finish).toBe(projected.finish);
    }
    expect(meal.events??[]).toEqual([]);
    expect(meal.serveAt).toBe(at('18:00'));
  });
});
