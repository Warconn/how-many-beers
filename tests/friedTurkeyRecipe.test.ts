import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parseRecipeText} from '../src/domain/recipe';
import {recipeReview,editReviewedStep,addReviewedDish} from '../src/domain/recipeReview';
import {convertRecipeReview,instantiateRecipeReview} from '../src/domain/documents/reviewAdapter';
import {parseCookingDocument} from '../src/domain/documents/cookingDocument';
import {newMeal,createDish} from '../src/domain/meal';
import {cookTimeline,startCookSession,recordEvent} from '../src/domain/cookState';
import {cookProjection} from '../src/domain/cookProjection';
const source=readFileSync('public/recipes/deep-fried-turkey.md','utf8');
const serving='2026-11-22T15:00';
const draft=()=>recipeReview(parseRecipeText('',source),serving);
describe('owner-importable deep-fried turkey method',()=>{
 it('has distinct electric-fryer equipment, physical actions and an editable owner-specific warm-up allowance',()=>{
  const review=draft(),dish=review.dishes[0];
  expect(dish.name).toBe('Deep-fried turkey');expect(dish.preset).toBe('custom');expect(dish.equipment).toBe('Electric Fryer');
  expect(dish.steps).toHaveLength(10);expect(dish.steps![4].minutes).toBe(60);expect(dish.steps![7].minutes).toBeNull();expect(dish.steps![9].minutes).toBe(20);
  expect(dish.pitTempF).toBeUndefined(); // Ambient observation must never become a fryer setpoint.
  expect(dish.weightLb).toBeUndefined();expect(source).toContain('observed 54-minute');
  expect(dish.steps![7].recipeTemperatures).toContainEqual({value:165,unit:'F',kind:'food'});
  const titles=dish.steps!.map(s=>s.title).join('\n');for(const action of ['fully thawed','capacity','Begin warming','Verify oil is ready','Lower turkey','Fry turkey','Remove turkey','Rest turkey','carve and serve'])expect(titles).toContain(action);
 });
 it('validates and saves/reuses edited method snapshots independently from oven turkey and calendar metadata',()=>{
  let review=draft();const tasks=cookTimeline(review),warm=tasks.find(t=>t.title.startsWith('Begin warming'))!;
  review=editReviewedStep(review,warm.id,{title:'Warm my electric fryer',instructions:'Allow 55 minutes; verify the manual setting and oil-ready indicator.',durationMinutes:55});
  const conversion=convertRecipeReview(review,'fried-turkey');expect(conversion.status).toBe('converted');if(conversion.status!=='converted')throw Error(conversion.reason);
  const document=parseCookingDocument(JSON.parse(JSON.stringify(conversion.document)));if(document.type!=='recipe')throw Error();
  expect(JSON.stringify(document)).not.toContain('2026-11-22');
  const meal={...newMeal(),serveAt:serving,dishes:[createDish('turkey')]},original=structuredClone(meal);
  const fresh=instantiateRecipeReview(document,serving),combined=addReviewedDish(meal,fresh);
  expect(combined.dishes[0]).toEqual(original.dishes[0]);expect(combined.dishes[1].equipment).toBe('Electric Fryer');expect(new Set(combined.dishes.map(d=>d.id)).size).toBe(2);expect(meal).toEqual(original);
  expect(cookTimeline(combined).find(t=>t.title==='Warm my electric fryer')?.durationMinutes).toBe(55);
 });
 it('keeps the real PostgreSQL RPC fixture identical to the downloadable method',()=>{
  const result=convertRecipeReview(draft(),'a1530000-0000-4000-8000-000000000001');expect(result.status).toBe('converted');if(result.status!=='converted')throw Error(result.reason);
  const sql=readFileSync('supabase/tests/personal-recipe-fried-turkey.sql','utf8');expect(JSON.parse(sql.split('$friedTurkey$')[1])).toEqual(result.document);
 });
 it('does not turn an elapsed frying estimate or warm-up allowance into actual doneness',()=>{
  let review=draft();const fry=cookTimeline(review).find(t=>t.title.startsWith('Fry turkey'))!;
  // Test-only reviewed estimate, not a weight-derived recommendation.
  review=editReviewedStep(review,fry.id,{title:fry.title,instructions:fry.instructions,durationMinutes:75});
  let active=startCookSession(review,'2026-11-22T12:00:00Z');active=recordEvent(active,fry.id,'started','2026-11-22T12:01:00Z');
  expect(active.phasePlan?.suppressed).toContain(review.dishes[0].id+':serve');
  const original=JSON.stringify(active);cookProjection(active,cookTimeline(active),Date.parse('2026-11-22T16:00:00Z'));
  expect(JSON.stringify(active)).toBe(original);expect(active.completed[fry.id]).toBeUndefined();expect(active.events?.some(e=>e.taskId.endsWith(':step-9'))).toBe(false);
 });
});
