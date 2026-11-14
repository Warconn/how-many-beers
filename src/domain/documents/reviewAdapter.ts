import type {Dish,PlannedTask} from '../meal';
import type {ExtendedMeal,TaskOverride} from '../cookState';
import {isStoredMeal} from '../storageValidation';
import {convertDish,instantiateRecipe} from './dishAdapter';
import {parseCookingDocument,type RecipeDocument,type ReviewDefinition,type AuthoredOverride,type DocumentStep} from './cookingDocument';

const clone=<T>(v:T):T=>structuredClone(v);
const json=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const stable=(v:unknown):unknown=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):v;
const equal=(a:unknown,b:unknown)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
export type ReviewContext={
 meal:Omit<ExtendedMeal,'dishes'|'taskOverrides'|'customTasks'|'hiddenTaskIds'|'taskOrder'|'planningGeneralSequence'>;
 recipeLink?:Dish['recipeLink'];dishId:string;taskIds:Record<string,string>;
 fixedOverrides:Record<string,Pick<TaskOverride,'scheduledAt'|'recordedPlanAt'>>;
 customDates:Record<string,string|null>;
 present:string[];
};
export type ReviewConversion={status:'converted';document:RecipeDocument;context:ReviewContext;original:ExtendedMeal}|{status:'skipped';reason:string;original:unknown};
const overrideKeys=['title','instructions','durationMinutes','equipment','targetTempF','scheduledAt','recordedPlanAt'];
const customKeys=['id','dishId','dishName','title','instructions','scheduledAt','isCondition','optionalDetails','durationMinutes','equipment','targetTempF'];
const reviewKeys=['version','id','name','serveAt','dishes','completed','notes','mode','events','taskOverrides','hiddenTaskIds','taskOrder','customTasks','planningGeneralSequence'];

/** Extract authored changes, retaining all date/history data in a separate context.
 * Not a migration, and never a write to the source review. */
export function convertRecipeReview(value:unknown,recipeId:string):ReviewConversion{
 const original=clone(value);
 const skip=(reason:string):ReviewConversion=>({status:'skipped',reason,original});
 try{
  if(!isStoredMeal(value))return skip('Invalid or unsupported review.');
  const m=value as ExtendedMeal;
  if(Object.keys(m).some(k=>!reviewKeys.includes(k)))return skip('Unsupported review or execution fields.');
  if(m.mode==='cooking'||m.dishes.length!==1||Object.keys(m.completed).length||m.events?.some(e=>e.kind!=='removed'))return skip('Only a single unstarted review is supported.');
  if(m.planningGeneralSequence?.length)return skip('General preparation is not owned by this recipe.');
  const dish=m.dishes[0],{planningSequence,planningStepOrder,recipeLink,...base}=dish;
  let result=convertDish(base,recipeId);if(result.status==='skipped')return skip(result.reason);
  // Selecting a wings sequence exposes the existing implicit rest allowance.
  // Compile its native rows before mapping review references. Added user steps
  // stay in the overlay; feeding their keys to the native compiler is lossy.
  if(dish.preset==='wings'&&dish.restMinutes>0&&(planningSequence!==undefined||planningStepOrder!==undefined)){
   const nativeKeys=new Set([...result.document.recipe.steps.map(s=>s.id),'rest']);
   const nativeOrder=(order:string[])=>order.filter(key=>nativeKeys.has(key));
   result=convertDish({...base,...(planningSequence!==undefined?{planningSequence:nativeOrder(planningSequence)}:{}),...(planningStepOrder!==undefined?{planningStepOrder:nativeOrder(planningStepOrder)}:{})},recipeId);
   if(result.status==='skipped')return skip(result.reason);
  }
  const document=result.document,r:ReviewDefinition={};
  const ids:Record<string,string>=Object.fromEntries(document.recipe.steps.map(s=>[s.id,dish.id+':'+s.id]));
  const lookup=new Map(Object.entries(ids).map(([local,id])=>[id,local]));
  const local=(id:string)=>{const key=lookup.get(id);if(key===undefined)throw Error('Dangling or cross-dish task reference.');return key;};
  const fixedOverrides:ReviewContext['fixedOverrides']={},customDates:ReviewContext['customDates']={};
  if(m.customTasks!==undefined)r.addedSteps=m.customTasks.map(t=>{
   if(t.dishId!==dish.id||Object.keys(t).some(k=>!customKeys.includes(k)))throw Error('Unsupported custom step ownership or fields.');
   const raw=t.id.startsWith(dish.id+':')?t.id.slice(dish.id.length+1):t.id;
   const key=t.id.startsWith(dish.id+':')&&raw.startsWith('added_')?raw:'added_'+raw;
   if(!/^[A-Za-z0-9_-]{1,160}$/.test(key)||lookup.has(t.id)||Object.hasOwn(ids,key))throw Error('Custom step identity collision.');
   ids[key]=t.id;lookup.set(t.id,key);customDates[key]=t.scheduledAt;
   const {id:_id,dishId:_dish,title,instructions,scheduledAt:_date,...nativeCustom}=t;
   return {id:key,title,instructions,timing:{estimatedMinutes:t.durationMinutes??null},type:'instruction',actions:[{type:'custom'}],nativeCustom} satisfies DocumentStep;
  });
  const order=(keys:string[])=>keys.map(k=>local(k));
  const dishOrder=(keys:string[])=>keys.map(k=>local(lookup.has(k)?k:dish.id+':'+k));
  if(planningSequence!==undefined)r.dishSequence=dishOrder(planningSequence);
  if(planningStepOrder!==undefined)r.dishStepOrder=dishOrder(planningStepOrder);
  if(m.taskOrder!==undefined)r.taskOrder=order(m.taskOrder);
  if(m.hiddenTaskIds!==undefined)r.hiddenStepIds=order(m.hiddenTaskIds);
  if(m.taskOverrides!==undefined)r.overrides=Object.fromEntries(Object.entries(m.taskOverrides).map(([id,o])=>{
   if(Object.keys(o).some(k=>!overrideKeys.includes(k)))throw Error('Unsupported override fields.');
   const key=local(id),{scheduledAt,recordedPlanAt,...authored}=o;
   if(scheduledAt!==undefined||recordedPlanAt!==undefined)fixedOverrides[key]={...(scheduledAt!==undefined?{scheduledAt}:{}),...(recordedPlanAt!==undefined?{recordedPlanAt}:{})};
   return [key,{...authored,...(scheduledAt===null?{unscheduled:true as const}:{})} satisfies AuthoredOverride];
  }));
  // Omit a vacuous overlay for unchanged plain-review compatibility.
  if(Object.keys(r).length)document.recipe.review=r;
  const parsed=parseCookingDocument(json(document)) as RecipeDocument;
  const {dishes:_dishes,customTasks:_custom,taskOverrides:_overrides,hiddenTaskIds:_hidden,taskOrder:_order,planningGeneralSequence:_general,...meal}=m;
  const context:ReviewContext={...(recipeLink?{recipeLink:clone(recipeLink)}:{}),meal:clone(meal),dishId:dish.id,taskIds:ids,fixedOverrides,customDates,present:['customTasks','taskOverrides','hiddenTaskIds','taskOrder','planningGeneralSequence'].filter(k=>Object.hasOwn(m,k))};
  const restored=materialize(parsed,context.meal,context.dishId,context);
  if(!equal(restored,m))return skip('Review cannot round-trip safely.');
  return {status:'converted',document:parsed,context,original:clone(m)};
 }catch(e){return skip(e instanceof Error?e.message:'Unsupported review.');}
}

function materialize(doc:RecipeDocument,meal:ReviewContext['meal'],dishId:string,context?:ReviewContext):ExtendedMeal{
 const {review,...recipe}=doc.recipe;
 const dish=instantiateRecipe({...doc,recipe},dishId),r=review??{};
 const ids=context?.taskIds??Object.fromEntries([...recipe.steps,...(r.addedSteps??[])].map(s=>[s.id,dishId+':'+s.id]));
 const task=(key:string)=>{const id=ids[key];if(id===undefined)throw Error('Missing task mapping.');return id;};
 const key=(k:string)=>{const id=task(k);return id.startsWith(dishId+':')?id.slice(dishId.length+1):id;};
 if(r.dishSequence!==undefined)dish.planningSequence=r.dishSequence.map(key);
 if(r.dishStepOrder!==undefined)dish.planningStepOrder=r.dishStepOrder.map(key);
 if(context?.recipeLink)dish.recipeLink=clone(context.recipeLink);
 const result:ExtendedMeal={...clone(meal),dishes:[dish]};
 if(r.addedSteps!==undefined)result.customTasks=r.addedSteps.map(s=>{
  if(!s.nativeCustom)throw Error('Missing native custom step.');
  return {id:task(s.id),dishId,title:s.title,instructions:s.instructions??'',scheduledAt:context?context.customDates[s.id]:null,...s.nativeCustom} satisfies PlannedTask;
 });
 if(r.overrides!==undefined)result.taskOverrides=Object.fromEntries(Object.entries(r.overrides).map(([k,o])=>{
  const {unscheduled,...authored}=o;
  return [task(k),{...authored,...(unscheduled?{scheduledAt:null}:{}),...(context?.fixedOverrides[k]??{})}];
 }));
 if(r.hiddenStepIds!==undefined)result.hiddenTaskIds=r.hiddenStepIds.map(task);
 if(r.taskOrder!==undefined)result.taskOrder=r.taskOrder.map(task);
 if(context?.present.includes('planningGeneralSequence'))result.planningGeneralSequence=[];
 return result;
}

/** Restore the source plan/history context, never use this when reusing a recipe. */
export function restoreRecipeReview(converted:Extract<ReviewConversion,{status:'converted'}>):ExtendedMeal{
 const document=parseCookingDocument(converted.document);
 if(document.type!=='recipe')throw Error('Choose a recipe.');
 const restored=materialize(document,converted.context.meal,converted.context.dishId,clone(converted.context));
 assertRepresentable(restored,document);
 return restored;
}
/** Reuse authored work against a new target. No source dates, notes or events. */
export function instantiateRecipeReview(value:unknown,serveAt:string,dishId:string=crypto.randomUUID()):ExtendedMeal{
 const doc=parseCookingDocument(value);if(doc.type!=='recipe')throw Error('Choose a recipe.');
 const fresh=materialize(doc,{version:1,id:crypto.randomUUID(),name:doc.name,serveAt,mode:'planning',completed:{},notes:{}},dishId);
 assertRepresentable(fresh,doc);
 return fresh;
}

/** Every accepted canonical field must survive the native bridge; reject optional
 * semantics the current app cannot execute instead of silently discarding them. */
function assertRepresentable(review:ExtendedMeal,document:RecipeDocument):void{
 const round=document.recipe.review===undefined&&!review.dishes[0].recipeLink?convertDish(review.dishes[0],document.id):convertRecipeReview(review,document.id);
 if(round.status!=='converted'||!equal(round.document,document))throw Error('Recipe review semantics cannot round-trip through the native adapter.');
}
