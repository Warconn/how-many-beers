import type {ExtendedMeal} from '../cookState';
/** Select only this method's authored inputs. This is extraction, not conversion
 * or replacement of a meal/history envelope. The caller's data stays untouched. */
export function dishReviewForRecipe(meal:ExtendedMeal,dishId:string):ExtendedMeal{
 if(meal.version!==1)throw Error('This meal version is not supported.');
 const dish=meal.dishes.find(d=>d.id===dishId);if(!dish)throw Error('This dish is no longer in the meal.');
 const {executionAddedAt:_added,recipeLink:_link,...native}=structuredClone(dish);
 if(native.brisketPlan?.applied)native.brisketPlan.applied={...native.brisketPlan.applied,recommendedStart:null,latestStart:null,prepStart:null};
 const custom=meal.customTasks?.filter(t=>t.dishId===dishId).map(({executionAddedAt:_at,...t})=>structuredClone(t));
 const customIds=new Set(custom?.map(t=>t.id));
 const own=(id:string)=>id.startsWith(dishId+':')||customIds.has(id);
 return {version:1,id:meal.id,name:dish.name,serveAt:meal.serveAt,mode:'planning',completed:{},notes:{},dishes:[native],
  ...(custom!==undefined?{customTasks:custom}:{}),
  ...(meal.taskOverrides!==undefined?{taskOverrides:structuredClone(Object.fromEntries(Object.entries(meal.taskOverrides).filter(([id])=>own(id))))}:{}),
  ...(meal.hiddenTaskIds!==undefined?{hiddenTaskIds:meal.hiddenTaskIds.filter(own)}:{}),
  ...(meal.taskOrder!==undefined?{taskOrder:meal.taskOrder.filter(own)}:{})};
}
