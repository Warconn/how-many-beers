import {newMeal,type Dish,type Meal,type PlannedTask} from './meal';
import {cookTimeline,type ExtendedMeal} from './cookState';

/** A recipe review is an uncommitted planning document, never the live cook. */
export function recipeReview(dish:Dish,serveAt:string):ExtendedMeal{
 return {...newMeal(),serveAt,dishes:[structuredClone(dish)]};
}
export function addReviewedDish(current:Meal,review:ExtendedMeal,replaceUnstarted=false):ExtendedMeal{
 if(review.dishes.length!==1||review.startedAt||review.mode==='cooking'||Object.keys(review.completed).length||review.events?.some(e=>e.kind!=='removed'))throw Error('Only an unstarted recipe can be added.');
 const dish=review.dishes[0],m=current as ExtendedMeal;
 if(current.dishes.some(d=>d.id===dish.id)){
  if(!replaceUnstarted)throw Error('This dish is already in the meal.');
  const own=new Set([...cookTimeline(current).filter(t=>t.dishId===dish.id).map(t=>t.id),...(m.customTasks??[]).filter(t=>t.dishId===dish.id).map(t=>t.id),...(m.hiddenTaskIds??[]).filter(id=>id.startsWith(dish.id+':'))]);
  if(Object.keys(current.completed).some(id=>own.has(id))||(m.events??[]).some(e=>own.has(e.taskId))||Object.keys(current.notes).some(id=>own.has(id)))throw Error('This dish has cooking activity. Keep it in the meal and edit it there.');
  // A failed acknowledged-add attempt may already have a protected local copy.
  // Replace only that new, unstarted dish; never append a duplicate or erase activity.
  const clean={...current,dishes:current.dishes.filter(d=>d.id!==dish.id),customTasks:m.customTasks?.filter(t=>t.dishId!==dish.id),taskOverrides:Object.fromEntries(Object.entries(m.taskOverrides??{}).filter(([id])=>!own.has(id))),hiddenTaskIds:m.hiddenTaskIds?.filter(id=>!own.has(id)),taskOrder:m.taskOrder?.filter(id=>!own.has(id))};
  const previous=current.dishes.find(d=>d.id===dish.id)!;
  const priorTasks=new Map((m.customTasks??[]).map(t=>[t.id,t]));
  return addReviewedDish(clean,{...review,dishes:[{...dish,executionAddedAt:previous.executionAddedAt}],customTasks:review.customTasks?.map(t=>({...t,executionAddedAt:priorTasks.get(t.id)?.executionAddedAt??t.executionAddedAt}))});
 }
 const ids=new Set((review.customTasks??[]).map(t=>t.id));
 const owns=(id:string)=>id.startsWith(dish.id+':')||ids.has(id);
 const existing=new Set(cookTimeline(current).map(t=>t.id));
 if((review.customTasks??[]).some(t=>t.dishId!==dish.id||existing.has(t.id))||Object.keys(review.taskOverrides??{}).some(id=>!owns(id))||(review.hiddenTaskIds??[]).some(id=>!owns(id)))throw Error('Review contains steps from another dish.');
 const tasks=cookTimeline(review);
 if(!dish.name.trim()||!tasks.length)throw Error('Give the recipe a name and keep at least one step.');
 // Preserve every live event, completion, timestamp and other dish verbatim.
 // Review removals are planning choices, not fabricated cooking activity.
 return {...current,dishes:[...current.dishes,current.mode==='cooking'?{...dish,executionAddedAt:dish.executionAddedAt??new Date().toISOString()}:dish],
  taskOverrides:{...m.taskOverrides,...review.taskOverrides},hiddenTaskIds:[...(m.hiddenTaskIds??[]),...(review.hiddenTaskIds??[])],
  customTasks:[...(m.customTasks??[]),...(review.customTasks??[]).map(t=>({...t,...(current.mode==='cooking'?{executionAddedAt:t.executionAddedAt??new Date().toISOString()}:{})}))],
  taskOrder:[...(m.taskOrder?.length?m.taskOrder:cookTimeline(current).map(t=>t.id)),...tasks.map(t=>t.id)]};
}

/** Template intervals remain estimates; an explicit unknown override stays unknown. */
export function reviewDuration(meal:ExtendedMeal,task:PlannedTask):number|null{
 const override=meal.taskOverrides?.[task.id]?.durationMinutes;
 return override!==undefined?override:task.durationMinutes??task.templateStage?.minutes??null;
}
