import {describe,it,expect} from 'vitest';
import {estimateBrisket,brisketDefaults,applyBrisketTiming,type BrisketInputs} from '../src/domain/brisketEstimate';
import {createDish,newMeal} from '../src/domain/meal';
import {cookTimeline,editStep,recordEvent} from '../src/domain/cookState';
import {archiveCook,emptyHistory,exportBackup,validateBackup,repeatArchivedCook} from '../src/domain/cookHistory';
const serve='2026-11-25T20:00:00Z';
const input=(changes:Partial<BrisketInputs>={})=>({...brisketDefaults,weightLb:15,...changes});
describe('versioned brisket planning policy',()=>{
 for(const weightLb of [8,13,15,18,22])for(const cut of ['packer','flat'] as const)it(`${weightLb} lb ${cut} produces bounded estimates for each supported profile`,()=>{
  const staged=estimateBrisket(input({weightLb,cut}),serve);
  const steady=estimateBrisket(input({weightLb,cut,method:'traeger-225-v1',pitTempF:225}),serve);
  for(const e of [staged,steady]){
   expect(e.smokeMin).toBeGreaterThan(0);expect(e.smokeMax).toBeGreaterThan(e.smokeMin!);
   expect(Date.parse(e.recommendedStart!)).toBeLessThan(Date.parse(e.latestStart!));
   expect(Date.parse(serve)-Date.parse(e.recommendedStart!)).toBe((e.smokeMax!+120+60)*60000);
   expect(e.version).toBe('brisket-window-v1');
  }
 });
 it('uses the published broad guide only in its selected profile, disclosing extrapolation',()=>{
  expect(estimateBrisket(input({method:'traeger-225-v1',pitTempF:225}),serve)).toMatchObject({smokeMin:450,smokeMax:900});
  expect(estimateBrisket(input(),serve).assumptions.join(' ')).toContain('unvalidated');
  expect(estimateBrisket(input({wrap:'none'}),serve).smokeMax).toBeGreaterThan(estimateBrisket(input(),serve).smokeMax!);
  expect(estimateBrisket(input({wrap:'foil'}),serve).smokeMax).toBe(estimateBrisket(input(),serve).smokeMax);
 });
 it('does not invent estimates for unknown/invalid weights, untrimmed inputs or uncalibrated temperatures',()=>{
  for(const changes of [{weightLb:undefined},{weightLb:0},{weightLb:NaN},{weightLb:41},{weightMeasured:'untrimmed' as const},{pitTempF:250},{restMinutes:-1},{holdBufferMinutes:721}])expect(estimateBrisket(input(changes),serve).smokeMax).toBeNull();
  expect(estimateBrisket(input(),'invalid').recommendedStart).toBeNull();
  expect(createDish('brisket').weightLb).toBeUndefined();
 });
 it('counts rest/hold once, overlaps prep/preheat and subtracts elapsed minutes across DST and midnight',()=>{
  for(const date of ['2026-03-08T08:00:00Z','2026-11-01T08:00:00Z']){
   const e=estimateBrisket(input({restMinutes:0,holdBufferMinutes:0,prepMinutes:20,preheatMinutes:35}),date);
   expect(Date.parse(date)-Date.parse(e.recommendedStart!)).toBe(e.smokeMax!*60000);
   expect(Date.parse(e.recommendedStart!)-Date.parse(e.prepStart!)).toBe(35*60000);
  }
 });
 it('keeps IDs, fixed times and actuals, snapshots provenance and supports backup/repeat',()=>{
  const dish=createDish('brisket'),brats=createDish('brats');
  let m=recordEvent({...newMeal(),serveAt:serve,dishes:[dish,brats]},dish.id+':prep','completed','2026-10-25T12:00:00Z');
  m=editStep(m,dish.id+':start','My start','My details',{timingMode:'fixed',scheduledAt:'2026-11-24T12:00:00Z',durationMinutes:null,equipment:'My smoker',targetTempF:null});
  const original=JSON.stringify(m),before=cookTimeline(m);
  const updated={...m,dishes:[applyBrisketTiming({...dish,brisketPlan:{inputs:input(),mode:'manual'}},serve),brats]};
  expect(cookTimeline(updated).map(t=>t.id).sort()).toEqual(before.map(t=>t.id).sort());
  expect(cookTimeline(updated).find(t=>t.id===dish.id+':start')?.scheduledAt).toBe('2026-11-24T12:00:00.000Z');
  expect(updated.events).toEqual(m.events);expect(updated.completed).toEqual(m.completed);expect(JSON.stringify(m)).toBe(original);
  const history=archiveCook(updated,emptyHistory(),'','2026-11-25T23:00:00Z');
  const restored=validateBackup(exportBackup(updated,history,'2026-11-25T23:00:00Z'));
  expect(restored.active.dishes[0].brisketPlan).toEqual(updated.dishes[0].brisketPlan);
  const repeat=repeatArchivedCook(history.cooks[0]);expect(repeat.completed).toEqual({});expect(repeat.dishes[0].brisketPlan).toEqual(updated.dishes[0].brisketPlan);
 });
 it('manual timing retains an applied buffer and method; unapplied comparisons do not change legacy plans',()=>{
  const dish=createDish('brisket');const meal={...newMeal(),serveAt:serve,dishes:[dish]};const old=cookTimeline(meal);
  dish.brisketPlan={inputs:input(),mode:'manual'};expect(cookTimeline(meal)).toEqual(old);
  const applied=applyBrisketTiming(dish,serve);const plan=cookTimeline({...meal,dishes:[applied]});
  const manual={...applied,brisketPlan:{...applied.brisketPlan!,mode:'manual' as const}};
  expect(cookTimeline({...meal,dishes:[manual]})).toEqual(plan);
 });
});
