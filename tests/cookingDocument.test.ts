import {describe,it,expect} from 'vitest';
import {parseCookingDocument} from '../src/domain/documents/cookingDocument';
import brisket from './fixtures/documents/brisket-v1.json';
import meal from './fixtures/documents/meal-v1.json';

describe('canonical authored document v1 boundary',()=>{
 it('retains unknown timing, hold ranges and multiple phase actions without execution',()=>{
  expect(parseCookingDocument(brisket)).toEqual(brisket);
  expect(brisket.recipe.steps[1].timing.estimatedMinutes).toBeNull();
  expect(brisket.recipe.steps[2].actions).toHaveLength(2);
 });
 it('uses independent snapshots in a meal',()=>{
  const parsed=parseCookingDocument(meal);expect(parsed).toEqual(meal);
  if(parsed.type==='meal')parsed.dishes[0].recipe.steps[0].title='Changed';
  expect(meal.dishes[0].recipe.steps[0].title).toBe('Put brisket on smoker');
 });
 it.each([
  (r:any)=>{r.schemaVersion=2;},
  (r:any)=>{r.recipe.steps.push(r.recipe.steps[0]);},
  (r:any)=>{r.recipe.steps[0].actions=[{type:'start_phase',phaseId:'missing'}];},
  (r:any)=>{r.recipe.steps[0].dependsOn=['serve'];},
  (r:any)=>{r.recipe.steps[0].completed=true;},
  (r:any)=>{r.recipe.events=[];},
  (r:any)=>{r.recipe.steps[0].timing.estimatedMinutes=-1;},
  (r:any)=>{r.recipe.steps[2].timing.rangeMinutes=[480,360];},
  (r:any)=>{r.recipe.phases[0].after='hold';},
  (r:any)=>{r.recipe.steps[0].actions=[{type:'guess_done'}];}
 ])('rejects unsupported versions, execution leakage and malformed links',mutate=>{
  const r=structuredClone(brisket);mutate(r);expect(()=>parseCookingDocument(r)).toThrow();
 });
 it('keeps zero distinct from unknown',()=>{
  const r=structuredClone(brisket);r.recipe.steps[0].timing.estimatedMinutes=0;
  expect(parseCookingDocument(r)).toEqual(r);
 });
 it('rejects invalid meal references and oversized documents',()=>{
  expect(()=>parseCookingDocument({...meal,dishes:[{...meal.dishes[0],planning:{hiddenStepIds:['missing']}}]})).toThrow();
  expect(()=>parseCookingDocument({...brisket,name:'x'.repeat(1024*1024)})).toThrow();
 });
});

it.each([NaN,Infinity,undefined,new Date(),()=>0])('rejects non-JSON parameter values before coercion',value=>{
 expect(()=>parseCookingDocument({...brisket,recipe:{...brisket.recipe,parameters:{unsafe:value}}})).toThrow();
});
it.each(['2026-02-30T13:00','2026-11-15T25:00','2026-00-15T13:00'])('rejects impossible local dates',local=>{
 expect(()=>parseCookingDocument({...meal,serving:{...meal.serving,local}})).toThrow();
});
it('rejects cycles, excessive nesting and partial checkpoint references',()=>{
 const cycle:Record<string,unknown>={};cycle.self=cycle;expect(()=>parseCookingDocument(cycle)).toThrow();
 const r=structuredClone(brisket);r.recipe.steps[1].actions=[{type:'checkpoint',phaseId:'heat'}];
 expect(()=>parseCookingDocument(r)).toThrow();
});
