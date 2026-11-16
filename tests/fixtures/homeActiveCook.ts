import {newMeal} from '../../src/domain/meal';
import {parseRecipeText} from '../../src/domain/recipe';
import {migrateMeal,type ExtendedMeal} from '../../src/domain/cookState';
export function homeActiveCook(){
 const wings={...parseRecipeText('Wings','Heat oil (0 minutes)'),id:'a1450000-0000-4000-8000-000000000011',equipment:'Fryer'};
 const potatoes={...parseRecipeText('Potatoes','Check potatoes (0 minutes)'),id:'a1450000-0000-4000-8000-000000000012',equipment:'Oven'};
 wings.steps![0]={...wings.steps![0],title:'Heat oil',instructions:'Warm the oil for your recipe.'};potatoes.steps![0]={...potatoes.steps![0],title:'Check potatoes',instructions:'Check the potatoes.'};
 const first=wings.id+':step-1',second=potatoes.id+':step-1';
 const meal:ExtendedMeal={...newMeal(),id:'a1450000-0000-4000-8000-000000000001',name:'Sunday dinner',serveAt:'2026-11-22T15:00:00Z',mode:'cooking',startedAt:'2026-11-22T11:00:00Z',dishes:[wings,potatoes],taskOverrides:{[first]:{scheduledAt:'2026-11-22T12:01:00.000Z'},[second]:{scheduledAt:'2026-11-22T12:01:00.000Z'}}};
 return {first,second,meal:migrateMeal(meal)};
}
