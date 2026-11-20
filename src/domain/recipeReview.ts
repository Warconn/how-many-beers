import {newMeal,type Dish,type Meal,type PlannedTask} from './meal';
import {cookTimeline,addDishToMeal,setStepDuration,type ExtendedMeal} from './cookState';
import {detectedActivities,activityStepKey,type RecipeActivity,type ActivityMetadata} from './activities';
import {buildPhasePlan} from './cookingPhases';
import {phaseStage,activityIssue} from './activities';

/** A recipe review is an uncommitted planning document, never the live cook. */
export function recipeReview(dish:Dish,serveAt:string):ExtendedMeal{
 const draft=structuredClone(dish);
 // Imported review is a sequential plan. Timing corrections should close the
 // original estimate's gap, without changing the source recipe or old cooks.
 if(draft.preset==='custom'&&!draft.planningSequence)draft.planningSequence=[...(draft.steps??[]).map(s=>s.id),'serve'];
 return prepareRecipeActivities({...newMeal(),serveAt,dishes:[draft]});
}

/** Run only in authoring/fresh-start paths. Existing execution never re-infers. */
export function prepareRecipeActivities(meal:ExtendedMeal):ExtendedMeal{
 if(meal.mode==='cooking'||meal.startedAt)return meal;
 const tasks=cookTimeline(meal);
 return {...meal,dishes:meal.dishes.map(d=>{
  if(d.preset!=='custom')return d;
  const detected=detectedActivities(tasks.filter(t=>t.dishId===d.id).map(t=>({id:activityStepKey(d.id,t.id),title:t.title,instructions:t.instructions,minutes:t.durationMinutes??null})));
  if(!d.activities)return {...d,activities:detected};
  const additions=detected.definitions.filter(a=>!d.activities!.definitions.some(old=>old.startStepId===a.startStepId)&&!d.activities!.dismissedStartStepIds?.includes(a.startStepId));
  return additions.length?{...d,activities:{...d.activities,definitions:[...d.activities.definitions,...additions]}}:d;
 })};
}

export function reviewActivities(meal:ExtendedMeal,dishId:string):ActivityMetadata{
 const dish=meal.dishes.find(d=>d.id===dishId)!;
 if(dish.activities)return dish.activities;
 if(dish.preset==='custom')return prepareRecipeActivities(meal).dishes.find(d=>d.id===dishId)!.activities!;
 const plan=buildPhasePlan(meal,cookTimeline(meal));
 return {version:1 as const,definitions:plan.phases.filter(p=>p.dishId===dishId).flatMap(p=>{
  const stage=phaseStage(p);return stage?[{id:activityStepKey(dishId,p.id),stage,startStepId:activityStepKey(dishId,p.startTaskId),endStepId:p.endTaskIds[0]?activityStepKey(dishId,p.endTaskIds[0]):null,
   checkpointStepIds:Object.entries(plan.actions).filter(([,a])=>a.checkpoint?.phaseId===p.id).map(([id])=>activityStepKey(dishId,id)),provenance:'template' as const}]:[];
 })};
}
export function setRecipeActivity(meal:ExtendedMeal,dishId:string,id:string,activity:RecipeActivity|null,dismissedStartId?:string):ExtendedMeal{
 if(meal.mode==='cooking'||meal.startedAt)throw Error('Activity relationships are edited before cooking. Recorded activity is retained.');
 const prepared=prepareRecipeActivities(meal),dish=prepared.dishes.find(d=>d.id===dishId);
 if(!dish)throw Error('Choose a recipe.');
 const metadata=reviewActivities(prepared,dishId);
 const previous=metadata.definitions.find(a=>a.id===id);
 if(activity&&(!activity.startStepId||!activity.endStepId))throw Error('Choose a start and end step.');
 if(activity){const issue=activityIssue(dish,cookTimeline(prepared).filter(t=>t.dishId===dishId),activity);if(issue)throw Error(issue);}
 const confirmed=activity?{...activity,provenance:'confirmed' as const}:null;
 const definitions=metadata.definitions.flatMap(a=>a.id===id?confirmed?[confirmed]:[]:[a]);
 if(confirmed&&!previous)definitions.push(confirmed);
 const dismissed=!activity?previous?.startStepId??dismissedStartId:previous&&previous.startStepId!==activity.startStepId?previous.startStepId:undefined;
 const next={...metadata,definitions,
  dismissedStartStepIds:[...new Set([...(metadata.dismissedStartStepIds??[]),...(dismissed?[dismissed]:[])])]};
 return {...prepared,dishes:prepared.dishes.map(d=>d.id===dishId?{...d,activities:next}:d)};
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
 const combined:ExtendedMeal={...current,dishes:[...current.dishes,current.mode==='cooking'?{...dish,executionAddedAt:dish.executionAddedAt??new Date().toISOString()}:dish],
  taskOverrides:{...m.taskOverrides,...review.taskOverrides},hiddenTaskIds:[...(m.hiddenTaskIds??[]),...(review.hiddenTaskIds??[])],
  customTasks:[...(m.customTasks??[]),...(review.customTasks??[]).map(t=>({...t,...(current.mode==='cooking'?{executionAddedAt:t.executionAddedAt??new Date().toISOString()}:{})}))],
  taskOrder:[...(m.taskOrder?.length?m.taskOrder:cookTimeline(current).map(t=>t.id)),...tasks.map(t=>t.id)]};
 if(!current.phasePlan)return combined;
 // Compile the reviewed configuration after its overrides/removals are applied.
 // Retries replace only this untouched dish's relationships, never live actuals.
 const plan=current.phasePlan;
 const base={...combined,dishes:combined.dishes.filter(d=>d.id!==dish.id),phasePlan:{...plan,
  phases:plan.phases.filter(p=>p.dishId!==dish.id),
  actions:Object.fromEntries(Object.entries(plan.actions).filter(([id])=>!owns(id))),
  order:Object.fromEntries(Object.entries(plan.order).filter(([id])=>id!==dish.id)),
  suppressed:plan.suppressed.filter(id=>!owns(id))}};
 return addDishToMeal(base,combined.dishes[combined.dishes.length-1],combined.dishes[combined.dishes.length-1].executionAddedAt??new Date().toISOString());
}

/** Template intervals remain estimates; an explicit unknown override stays unknown. */
export function reviewDuration(meal:ExtendedMeal,task:PlannedTask):number|null{
 const override=meal.taskOverrides?.[task.id]?.durationMinutes;
 return override!==undefined?override:task.durationMinutes??task.templateStage?.minutes??null;
}

export {reorderPlannedStep as reorderReviewedStep} from './stepReorder';

/** Authoring follows the RecipeDocument text limits, without touching calendar
 * overrides or execution. Older planning editors have shorter input limits. */
export function editReviewedStep(meal:ExtendedMeal,id:string,values:{title:string;instructions:string;durationMinutes?:number|null;equipment?:string;targetTempF?:number|null}):ExtendedMeal{
 const task=cookTimeline(meal).find(t=>t.id===id);
 if(!task||meal.mode==='cooking'||meal.startedAt||Object.keys(meal.completed).length||meal.events?.some(e=>e.kind!=='removed'))throw Error('Choose a step in an unstarted method.');
 const title=values.title===task.title?task.title:values.title.trim(),instructions=values.instructions===task.instructions?task.instructions:values.instructions.trim();
 if(!title.trim()||title.length>500)throw Error('Give the step a name (up to 500 characters).');
 if(instructions.length>16000)throw Error('Keep step instructions under 16,000 characters.');
 if(values.equipment!==undefined&&values.equipment.length>16000)throw Error('Shorten the equipment names.');
 const target=values.targetTempF;
 if(target!==undefined&&target!==null&&(!Number.isFinite(target)||target<=0||target>600))throw Error('Target food temperature must be between 1 and 600°F, or blank.');
 const override={...meal.taskOverrides?.[id],title,instructions};
 if(values.equipment!==undefined&&values.equipment!==task.equipment)Object.assign(override,{equipment:values.equipment.trim()});
 if(target!==undefined&&target!==(task.targetTempF??null))Object.assign(override,{targetTempF:target});
 let next:ExtendedMeal={...meal,taskOverrides:{...meal.taskOverrides,[id]:override}};
 if(values.durationMinutes!==undefined&&values.durationMinutes!==reviewDuration(meal,task))next=setStepDuration(next,id,values.durationMinutes);
 return next;
}
