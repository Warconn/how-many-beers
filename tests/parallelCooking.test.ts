import {describe,it,expect} from 'vitest';
import {createDish,newMeal} from '../src/domain/meal';
import {legacyDish} from './fixtures/legacyDish';
import {cookTimeline,recordEvent,startCookSession} from '../src/domain/cookState';
import {buildPhasePlan,phaseObservations} from '../src/domain/cookingPhases';
import {cookProjection} from '../src/domain/cookProjection';
import {homeNextAction} from '../src/domain/homeNextAction';
import {exportBackup,validateBackup,emptyHistory,archiveCook} from '../src/domain/cookHistory';
import {recordedTurkeyBaseline,twoTurkeyPlan,turkeyTime as at} from './fixtures/parallelCooking';

describe('issue #3 parallel cooking acceptance (synthetic fixtures)',()=>{
  it('detects fryer preheat separately from lowering/removing the turkey even with unknown frying duration',()=>{
    const meal=twoTurkeyPlan(),plan=buildPhasePlan(meal,cookTimeline(meal));
    const oil=plan.phases.find(p=>p.startTaskId==='fryer:step-5');
    expect(oil,'Preheat fryer → Verify oil ready must be an independent activity').toMatchObject({
      dishId:'fryer',endTaskIds:['fryer:step-6'],stage:'preheating'});
    const fry=plan.phases.find(p=>p.startTaskId==='fryer:step-7');
    expect(fry,'Lower turkey → Lift turkey must not require an invented duration').toMatchObject({
      dishId:'fryer',endTaskIds:['fryer:step-9'],stage:'cooking'});
  });

  it('runs oven cooking and fryer preheat concurrently and oil readiness ends only preheat',()=>{
    let meal=startCookSession(twoTurkeyPlan(),at('12:00'));
    meal=recordEvent(meal,'oven:start','completed',at('12:10'));
    meal=recordEvent(meal,'fryer:step-5','completed',at('13:00'));
    const before=cookProjection(meal,cookTimeline(meal),Date.parse(at('13:10')));
    expect(before.phases?.filter(p=>p.active).map(p=>p.startTaskId).sort()).toEqual(['fryer:step-5','oven:start']);
    const oil=meal.phasePlan!.phases.find(p=>p.startTaskId==='fryer:step-5')!;
    meal=recordEvent(meal,'fryer:step-6','equipment',at('13:15'),300,'°F','Synthetic oil check');
    expect(phaseObservations(meal,oil.id).end).toBeUndefined();
    meal=recordEvent(meal,'fryer:step-6','completed',at('13:20'));
    expect(phaseObservations(meal,oil.id).end?.occurredAt).toBe(at('13:20'));
    expect(phaseObservations(meal,'oven:heat').end).toBeUndefined();
  });

  it('starts an independently bounded oil-preheating activity while wings keep smoking',()=>{
    const dish={...createDish('wings'),id:'wings'};
    let meal=startCookSession({...newMeal(),serveAt:at('20:00'),dishes:[dish]},at('12:00'));
    meal=recordEvent(meal,'wings:start','completed',at('12:10'));
    meal=recordEvent(meal,'wings:oil','completed',at('13:00'));
    const active=cookProjection(meal,cookTimeline(meal),Date.parse(at('13:10'))).phases?.filter(p=>p.active);
    expect(active?.map(p=>p.startTaskId).sort()).toEqual(['wings:oil','wings:start']);
    expect(phaseObservations(meal,'wings:heat').start?.occurredAt).toBe(at('12:10'));
    expect(phaseObservations(meal,'wings:heat').end).toBeUndefined();
  });

  it.each([
    {preset:'brisket' as const,checkpoint:'spritz',values:[145,162,181]},
    {preset:'brats' as const,checkpoint:'start',values:[130,150,165]},
  ])('preserves repeated $preset temperatures on one checked step through reload, reopen and archive',({preset,checkpoint,values})=>{
    const dish={...legacyDish(preset),id:preset};
    let meal=startCookSession({...newMeal(),serveAt:at('20:00'),dishes:[dish]},at('12:00'));
    meal=recordEvent(meal,`${preset}:start`,'completed',at('12:10'));
    if(checkpoint!=='start')meal=recordEvent(meal,`${preset}:${checkpoint}`,'completed',at('13:00'));
    const originalStart=phaseObservations(meal,`${preset}:heat`).start;
    for(const [i,value] of values.entries()) {
      meal=recordEvent(meal,`${preset}:${checkpoint}`,'temperature',at(`13:${10+i*10}`),value,'°F');
      meal=validateBackup(exportBackup(meal,emptyHistory(),at('14:00'))).active;
    }
    const readings=meal.events!.filter(e=>e.kind==='temperature');
    expect(readings.map(e=>e.value)).toEqual(values);
    expect(readings.map(e=>e.occurredAt)).toEqual(values.map((_,i)=>at(`13:${10+i*10}`)));
    expect(new Set(readings.map(e=>e.taskId))).toEqual(new Set([`${preset}:${checkpoint}`]));
    expect(meal.completed[`${preset}:${checkpoint}`]).toBeTruthy();
    const before=structuredClone(meal.events!);
    meal=recordEvent(meal,`${preset}:start`,'reopened',at('14:00'));
    expect(meal.events!.slice(0,before.length)).toEqual(before);
    expect(phaseObservations(meal,`${preset}:heat`).start).toEqual(originalStart);
    expect(phaseObservations(meal,`${preset}:heat`).end).toBeUndefined();
    expect(archiveCook(meal,emptyHistory(),'Synthetic fixture',at('19:00')).cooks[0].meal.events).toEqual(meal.events);
  });

  it('keeps stale replaced-dish metadata out of projections and Home without rewriting eight historical completions',()=>{
    const meal=recordedTurkeyBaseline(),original=structuredClone(meal);
    const timeline=cookTimeline(meal),projection=cookProjection(meal,timeline,Date.parse(at('13:00')));
    expect(meal.dishes.map(d=>d.id)).toEqual(['oven','fryer']);
    expect(meal.phasePlan!.phases).toHaveLength(6);
    expect(meal.phasePlan!.phases.filter(p=>p.dishId==='oven')).toHaveLength(5);
    expect(projection.phases?.some(p=>p.dishId==='replaced-fryer')).toBe(false);
    const next=homeNextAction(meal,timeline,projection,Date.parse(at('13:00')));
    if(next?.kind==='action')expect(['oven','fryer']).toContain(next.task.dishId);
    expect(meal.events).toHaveLength(8);
    expect(meal.events!.flatMap(e=>e.phaseObservations??[])).toEqual([]);
    expect(meal).toEqual(original);
    expect(validateBackup(exportBackup(meal,emptyHistory(),at('13:00'))).active.events).toEqual(original.events);
  });
});
