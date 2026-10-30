import {describe,it,expect} from 'vitest';
import {parseRecipeText,extractRecipeTiming} from '../src/domain/recipe';
import {cookTimeline} from '../src/domain/cookState';
import {newMeal} from '../src/domain/meal';
import {cookDuration} from '../src/domain/cookDuration';
import {isStoredMeal} from '../src/domain/storageValidation';

describe('explicit recipe timing',()=>{
 it.each([
  ['Clean seeds (5 minutes). Remove pulp.',5],
  ['Preheat pellet smoker to 425 F (about 10 minutes).',10],
  ['Rest for 1 hour 30 minutes.',90],
  ['Smoke for 1 hr and 15 min.',75],
  ['Simmer 1.5 hours.',90],
  ['Wait half an hour.',30],
  ['Rest for ½ hour.',30],
  ['Stir for 30 seconds.',0.5],
  ['Roast 10–15 minutes, stirring halfway.',15],
  ['Roast 10 to 15 min.',15],
  ['Roast between 10 and 15 minutes.',15],
  ['Bake between 1 hour and 2 hours.',120],
  ['Rest for 1/2 hour.',30],
  ['Rest for one hour.',60],
  ['Bake 10 minutes or 20 minutes.',null],
  ['Bake for 20 minutes, stirring every 5 minutes.',20],
  ['Bake 1 hour, check after 30 minutes.',60],
  ['Cool completely.',null],
  ['Smoke overnight.',null],
  ['Heat until food reaches 165°F.',null],
  ['Chop 3–4 onions.',null],
  ['Rest -5 minutes.',null],
  ['Rest 999999 hours.',null],
  ['Cook for 10 minutes then simmer for 20 minutes.',null],
 ])('extracts %s without inventing duration', (text,minutes)=>expect(extractRecipeTiming(text).minutes).toBe(minutes));
 it('retains an explicit range for visible preview defaults',()=>{
  expect(extractRecipeTiming('Roast 10–15 minutes.')).toMatchObject({minutes:15,range:[10,15]});
 });
 it('skips headed ingredients/title/timing summaries, retains original recipe, and avoids double-counting stir reminders',()=>{
  const source='# Pumpkin seeds\nPrep time: 10 minutes\n## Ingredients\n1 cup seeds\n2 tsp oil\n## Instructions\n1. Clean seeds (5 minutes).\n2. Roast at 425°F for 10–15 minutes.\nStir halfway through.\n3. Cool uncovered for 10 minutes.\n## Notes\nStore airtight.';
  const dish=parseRecipeText('',source);
  expect(dish.name).toBe('Pumpkin seeds');expect(dish.recipeSource).toBe(source);
  expect(dish.steps).toHaveLength(3);expect(dish.steps!.map(s=>s.minutes)).toEqual([5,15,10]);
  expect(dish.steps![1].instructions).toContain('Stir halfway');
  const meal={...newMeal(),serveAt:'2026-11-26T00:05Z',dishes:[dish]};
  expect(cookDuration(meal,cookTimeline(meal),Date.now()).minutes).toBe(30);expect(isStoredMeal(JSON.parse(JSON.stringify(meal)))).toBe(true);
 });
 it('preserves untimed cooling and complete long instructions, while supporting unstructured paste',()=>{
  const text='Roast seeds for 15 minutes. '+('Keep checking texture. '.repeat(12))+'\nCool completely.';
  const d=parseRecipeText('Seeds',text);expect(d.steps![0].minutes).toBe(15);expect(d.steps![0].instructions).toContain('Keep checking');expect(d.steps![1].minutes).toBeNull();
 });
});

it('keeps a timed stirring action separate from a reminder',()=>{
 const d=parseRecipeText('Seeds','Roast for 15 minutes.\nStir for 2 minutes after roasting.\nCool for 10 minutes.');expect(d.steps!.map(s=>s.minutes)).toEqual([15,2,10]);
});

it('does not turn metadata into title or steps, and preserves malformed/unrecognized timing for review',()=>{
 const d=parseRecipeText('','Instructions:\nSimmer for 1/0 hour.\nCool completely.');expect(d.name).toBe('Imported recipe');expect(d.steps!.map(s=>s.minutes)).toEqual([null,null]);
 const markdown=parseRecipeText('','# Seeds\nRoast seeds for 15 minutes.');expect(markdown.name).toBe('Seeds');expect(markdown.steps).toHaveLength(1);
 expect(parseRecipeText('Seeds','Seeds\nRoast for 15 minutes.').steps).toHaveLength(1);
});
