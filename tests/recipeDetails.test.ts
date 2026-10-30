import {describe,it,expect} from 'vitest';
import {parseRecipeText} from '../src/domain/recipe';
import {newMeal} from '../src/domain/meal';
import {isStoredMeal} from '../src/domain/storageValidation';
describe('recipe detail review data',()=>{
 it('structures reference sections and equipment without making extra actions',()=>{
  const source='# Seeds\n## Ingredients\n- 1 ½ cups seeds\n- 2 tsp olive oil\n- salt to taste\n## Equipment\nPellet smoker\n## Source\nFamily notes\n## Instructions\nPreheat pellet smoker to 425°F.\nRoast for 10–15 minutes.\nStir halfway through.\nCool completely.';
  const dish=parseRecipeText('',source);
  expect(dish.recipeIngredients).toEqual(['1 ½ cups seeds','2 tsp olive oil','salt to taste']);
  expect(dish.recipeReference).toContain('Family notes');expect(dish.equipment).toBe('Pellet Smoker');expect(dish.pitTempF).toBe(425);
  expect(dish.steps).toHaveLength(3);expect(dish.steps![1].minutes).toBe(15);expect(dish.steps![1].instructions).toContain('halfway');expect(dish.steps![2].minutes).toBeNull();expect(dish.recipeSource).toBe(source);
  expect(isStoredMeal({...newMeal(),dishes:[dish]})).toBe(true);
 });
 it('separates food endpoints from settings in one sentence and preserves Celsius',()=>{
  const dish=parseRecipeText('Chicken','Preheat oven to 200°C.\nRoast at 180°C until internal temperature reaches 74°C.\nIncrease oven to 220°C for 5 minutes.');
  expect(dish.pitTempF).toBe(392);expect(dish.equipment).toBe('Oven');
  expect(dish.steps![1].recipeTemperatures).toEqual([{value:180,unit:'C',kind:'equipment'},{value:74,unit:'C',kind:'food'}]);
  expect(dish.steps![2].recipeTemperatures).toEqual([{value:220,unit:'C',kind:'equipment'}]);
 });
 it('never guesses an ambiguous or unitless number into a pit setting',()=>{
  for(const source of ['Heat to 200°F.','Cook until internal temperature is 165 F.','Preheat oven to 200.','Set smoker to -50 F.','Set oven to 999999 C.'])expect(parseRecipeText('',source).pitTempF).toBeUndefined();
  expect(parseRecipeText('','Heat to 200°F.').steps![0].recipeTemperatures?.[0].kind).toBe('unknown');
 });
 it('validates additive structures without rejecting existing recipes',()=>{
  const dish=parseRecipeText('Seeds','Roast 15 minutes.');expect(isStoredMeal({...newMeal(),dishes:[dish]})).toBe(true);
  expect(isStoredMeal({...newMeal(),dishes:[{...dish,recipeIngredients:[4]}]})).toBe(false);
  expect(isStoredMeal({...newMeal(),dishes:[{...dish,steps:[{...dish.steps![0],recipeTemperatures:[{value:'hot',unit:'C',kind:'food'}]}]}]})).toBe(false);
 });
});
it('retains ambiguous temperature ranges for review and supports inline source/equipment',()=>{
 const d=parseRecipeText('','Equipment: Oven\nSource: Grandma\nBake at 180–200°C for 15 minutes.');
 expect(d.steps).toHaveLength(1);expect(d.equipment).toBe('Oven');expect(d.recipeReference).toContain('Grandma');expect(d.pitTempF).toBeUndefined();expect(d.steps![0].recipeTemperatures?.[0].kind).toBe('unknown');
});
it('uses only unambiguous food targets in tasks and preserves structured data in history',async()=>{
 const {cookTimeline}=await import('../src/domain/cookState');
 const {archiveCook,emptyHistory,readHistory}=await import('../src/domain/cookHistory');
 const dish=parseRecipeText('Chicken','Ingredients:\n1 chicken\nInstructions:\nPreheat oven to 200°C.\nRoast at 180°C until internal temperature reaches 74°C.');
 const meal={...newMeal(),dishes:[dish]},tasks=cookTimeline(meal);
 expect(tasks[0].targetTempF).toBeNull();expect(tasks[1].targetTempF).toBe(165.2);
 const history=readHistory(JSON.parse(JSON.stringify(archiveCook(meal,emptyHistory(),'Original','2026-10-30T00:00Z'))));
 expect(history.cooks[0].meal.dishes[0]).toEqual(dish);
});
it('does not label an oven reaching its setting or meat roasting at a setting as an internal food target',()=>{
 const oven=parseRecipeText('','Heat oven until it reaches 425°F.');expect(oven.steps![0].recipeTemperatures?.[0].kind).not.toBe('food');
 const meat=parseRecipeText('','Roast meat at 200°C for 1 hour.');expect(meat.steps![0].recipeTemperatures?.[0].kind).toBe('equipment');
});
it('applies reviewed temperatures to editable step copy while preserving original source',async()=>{
 const {reviewRecipeTemperature}=await import('../src/domain/recipe');
 const source='Roast at 200°C until internal temperature reaches 74°C.';
 const dish=parseRecipeText('Chicken',source),step=reviewRecipeTemperature(dish.steps![0],0,{value:180,unit:'C',kind:'equipment'});
 expect(step.instructions).toBe('Roast at 180°C until internal temperature reaches 74°C.');expect(step.title).toContain('180°C');expect(step.recipeTemperatures?.[1].value).toBe(74);expect(dish.recipeSource).toBe(source);
});
it('preserves decimal ingredient quantities while removing actual numbered list markers',()=>{
 const d=parseRecipeText('Seeds','Ingredients:\n1.5 cups seeds\n0.25 tsp salt\n1/2 tsp paprika\n1. 2 tsp oil\nInstructions:\nMix seeds.');
 expect(d.recipeIngredients).toEqual(['1.5 cups seeds','0.25 tsp salt','1/2 tsp paprika','2 tsp oil']);
});
