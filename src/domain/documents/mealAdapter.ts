import type {Dish,PlannedTask} from '../meal';
import type {ExtendedMeal,TaskOverride} from '../cookState';
import {isStoredMeal} from '../storageValidation';
import {convertRecipeReview,restoreRecipeReview,type ReviewContext} from './reviewAdapter';
import {parseCookingDocument,type MealDocument,type DocumentStep,type AuthoredOverride,type TaskReference} from './cookingDocument';

export type ServingMetadata={timeZone:string;serveInstant:string|null};
type DishContext={review:ReviewContext;brisketPlan?:Dish['brisketPlan'];executionAddedAt?:string};
export type MealContext={
 envelope:Omit<ExtendedMeal,'dishes'|'taskOverrides'|'customTasks'|'hiddenTaskIds'|'taskOrder'|'planningGeneralSequence'>;
 dishes:Record<string,DishContext>;
 generalRuntime:Record<string,Omit<PlannedTask,'title'|'instructions'|'dishName'|'isCondition'|'optionalDetails'|'durationMinutes'|'equipment'|'targetTempF'>>;
 generalDates:Record<string,Pick<TaskOverride,'scheduledAt'|'recordedPlanAt'>>;
 customExecution:Record<string,string>;customTaskOrder:string[];present:string[];serving:ServingMetadata;
};
export type MealConversion={format:'how-many-beers-compatibility';schemaVersion:1;type:'meal';document:MealDocument;context:MealContext;original:ExtendedMeal};
export type MealConversionResult={status:'converted'|'unchanged';conversion:MealConversion}|{status:'skipped';reason:string;original:unknown};
const copy=<T>(x:T):T=>structuredClone(x);
const clean=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
const sorted=(v:unknown):unknown=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,sorted(v)])):v;
export const same=(a:unknown,b:unknown)=>JSON.stringify(sorted(a))===JSON.stringify(sorted(b));
const mealKeys=['version','id','name','serveAt','dishes','completed','notes','mode','startedAt','phasePlan','events','taskOverrides','customTasks','hiddenTaskIds','taskOrder','planningGeneralSequence'];
const authoredKeys=['title','instructions','durationMinutes','equipment','targetTempF'];
function splitOverride(o:TaskOverride){
 if(Object.keys(o).some(k=>![...authoredKeys,'scheduledAt','recordedPlanAt'].includes(k)))throw Error('Unsupported override.');
 const {scheduledAt,recordedPlanAt,...authored}=o;
 return {authored:{...authored,...(scheduledAt===null?{unscheduled:true as const}:{})} as AuthoredOverride,dates:{...(scheduledAt!==undefined?{scheduledAt}:{}),...(recordedPlanAt!==undefined?{recordedPlanAt}:{})}};
}
function localAt(instant:string,timeZone:string):string{
 const p=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant));
 const part=(kind:string)=>p.find(p=>p.type===kind)!.value;
 return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
function serving(meal:ExtendedMeal,metadata:ServingMetadata):MealDocument['serving']{
 new Intl.DateTimeFormat('en',{timeZone:metadata.timeZone});
 const isLocal=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(meal.serveAt);
 const instant=metadata.serveInstant;
 if(instant!==null&&(!/Z$|[+-]\d{2}:\d{2}$/.test(instant)||!Number.isFinite(Date.parse(instant))))throw Error('Invalid explicit serving instant.');
 if(!isLocal&&(!/Z$|[+-]\d{2}:\d{2}$/.test(meal.serveAt)||!Number.isFinite(Date.parse(meal.serveAt))))throw Error('Unsupported serving date draft.');
 if(instant&&((isLocal&&meal.serveAt!==localAt(instant,metadata.timeZone))||(!isLocal&&Date.parse(meal.serveAt)!==Date.parse(instant))))throw Error('Serving local/instant metadata conflict.');
 return {local:isLocal?meal.serveAt:localAt(meal.serveAt,metadata.timeZone),timeZone:metadata.timeZone,...(instant!==null?{instant}:!isLocal?{instant:meal.serveAt}:{})};
}

/** Pure read-old adapter. No writes, migration or automatic library extraction. */
export function convertMeal(value:unknown,metadata:ServingMetadata):MealConversionResult{
 const original=copy(value);
 try{
  if(value&&typeof value==='object'&&'format' in value){
   const old=value as MealConversion;
   if(old.format!=='how-many-beers-compatibility'||old.schemaVersion!==1||old.type!=='meal')throw Error('Unsupported compatibility version.');
   if(!same(old.context.serving,metadata))throw Error('Conversion serving metadata differs.');
   restoreMeal(old);return {status:'unchanged',conversion:copy(old)};
  }
  if(!isStoredMeal(value)||Object.keys(value).some(k=>!mealKeys.includes(k)))throw Error('Unsupported native meal.');
  const m=value as ExtendedMeal;
  const {dishes:_d,taskOverrides:_o,customTasks:_c,hiddenTaskIds:_h,taskOrder:_t,planningGeneralSequence:_g,...envelope}=m;
  const context:MealContext={envelope:copy(envelope),dishes:Object.create(null),generalRuntime:Object.create(null),generalDates:Object.create(null),customExecution:Object.fromEntries((m.customTasks??[]).filter(t=>t.executionAddedAt!==undefined).map(t=>[t.id,t.executionAddedAt!])),customTaskOrder:(m.customTasks??[]).map(t=>t.id),present:['taskOverrides','customTasks','hiddenTaskIds','taskOrder','planningGeneralSequence'].filter(k=>Object.hasOwn(m,k)),serving:copy(metadata)};
  const refs=new Map<string,TaskReference>();
  const dishes=m.dishes.map(d=>{
   const {executionAddedAt,brisketPlan,...base}=d;
   const native:Dish={...base,...(brisketPlan?{brisketPlan:{mode:'manual',inputs:brisketPlan.inputs}}:{})};
   const own=(id:string)=>id.startsWith(d.id+':')||(m.customTasks??[]).some(t=>t.id===id&&t.dishId===d.id);
   const review:ExtendedMeal={version:1,id:'extract',name:d.name,serveAt:m.serveAt,mode:'planning',completed:{},notes:{},dishes:[native],
    ...(m.customTasks!==undefined?{customTasks:m.customTasks.filter(t=>t.dishId===d.id).map(({executionAddedAt:_at,...t})=>t)}:{}),
    ...(m.taskOverrides!==undefined?{taskOverrides:Object.fromEntries(Object.entries(m.taskOverrides).filter(([id])=>own(id)))}:{}),
    ...(m.hiddenTaskIds!==undefined?{hiddenTaskIds:m.hiddenTaskIds.filter(own)}:{}),...(m.taskOrder!==undefined?{taskOrder:m.taskOrder.filter(own)}:{})};
   const result=convertRecipeReview(review,'snapshot');if(result.status!=='converted')throw Error(result.reason);
   // Custom execution-added markers stay outside reusable authored definitions.
   for(const [key,id] of Object.entries(result.context.taskIds))refs.set(id,{dishId:d.id,stepId:key});
   context.dishes[d.id]={review:result.context,...(brisketPlan!==undefined?{brisketPlan:copy(brisketPlan)}:{}),...(executionAddedAt!==undefined?{executionAddedAt}:{})};
   return {id:d.id,name:d.name,recipe:result.document.recipe};
  });
  const general=(m.customTasks??[]).filter(t=>t.dishId==='custom').map(t=>{
   if(refs.has(t.id))throw Error('Task identity collision.');
   const {title,instructions,dishName,isCondition,optionalDetails,durationMinutes,equipment,targetTempF,...runtime}=t;
   const known=['id','dishId','scheduledAt','executionAddedAt','baseScheduledAt','baseDurationMinutes','baseEquipment','recordedPlanAt','scheduleAdjustmentMinutes','recipeOrder','timingMode','userSequence','templateStage'];
   if(Object.keys(runtime).some(k=>!known.includes(k)))throw Error('Unsupported general task fields.');
   refs.set(t.id,{dishId:null,stepId:t.id});context.generalRuntime[t.id]=copy(runtime);
   return {id:t.id,title,instructions,type:'instruction',timing:{estimatedMinutes:durationMinutes??null},actions:[{type:'custom'}],nativeCustom:{dishName,isCondition,...(optionalDetails!==undefined?{optionalDetails}:{}),...(durationMinutes!==undefined?{durationMinutes}:{}),...(equipment!==undefined?{equipment}:{}),...(targetTempF!==undefined?{targetTempF}:{})}} satisfies DocumentStep;
  });
  const ref=(id:string)=>{const r=refs.get(id);if(!r)throw Error('Dangling or cross-meal task reference.');return r;};
  const generalOverrides=Object.fromEntries(Object.entries(m.taskOverrides??{}).filter(([id])=>ref(id).dishId===null).map(([id,o])=>{const split=splitOverride(o);context.generalDates[id]=split.dates;return [id,split.authored];}));
  const ordering:NonNullable<MealDocument['ordering']>={...(m.taskOrder!==undefined?{taskOrder:m.taskOrder.map(ref)}:{}),...(m.hiddenTaskIds!==undefined?{hiddenTasks:m.hiddenTaskIds.map(ref)}:{}),...(m.planningGeneralSequence!==undefined?{generalSequence:m.planningGeneralSequence}:{}),...(m.taskOverrides!==undefined?{generalOverrides}:{})};
  const document=parseCookingDocument(clean({format:'how-many-beers',schemaVersion:1,type:'meal',id:m.id,name:m.name,serving:serving(m,metadata),dishes,...(m.customTasks!==undefined?{generalSteps:general}:{}),ordering})) as MealDocument;
  const conversion:MealConversion={format:'how-many-beers-compatibility',schemaVersion:1,type:'meal',document,context,original:copy(m)};
  restoreNativeMeal(conversion);return {status:'converted',conversion};
 }catch(e){return {status:'skipped',reason:e instanceof Error?e.message:'Unsupported meal.',original};}
}

/** Compatibility restore only: never regenerate a completed cook's timeline. */
function restoreNativeMeal(conversion:MealConversion):ExtendedMeal{
 if(conversion.format!=='how-many-beers-compatibility'||conversion.schemaVersion!==1||conversion.type!=='meal')throw Error('Unsupported compatibility envelope.');
 const doc=parseCookingDocument(conversion.document);if(doc.type!=='meal')throw Error('Choose a meal.');
 const c=conversion.context,result:ExtendedMeal={...copy(c.envelope),id:doc.id,name:doc.name,dishes:[]};
 const tasks:PlannedTask[]=[],overrides:Record<string,TaskOverride>=Object.create(null);
 for(const d of doc.dishes){
  const ctx=c.dishes[d.id];if(!ctx)throw Error('Missing dish context.');
  const restored=restoreRecipeReview({status:'converted',document:{format:'how-many-beers',schemaVersion:1,type:'recipe',id:'snapshot',name:d.name,recipe:d.recipe},context:ctx.review,original:conversion.original});
  const dish=restored.dishes[0];if(ctx.brisketPlan!==undefined)dish.brisketPlan=copy(ctx.brisketPlan);if(ctx.executionAddedAt!==undefined)dish.executionAddedAt=ctx.executionAddedAt;
  result.dishes.push(dish);tasks.push(...(restored.customTasks??[]));Object.assign(overrides,restored.taskOverrides);
 }
 for(const s of doc.generalSteps??[]){if(!s.nativeCustom||!c.generalRuntime[s.id])throw Error('Missing general context.');tasks.push({...copy(c.generalRuntime[s.id]),title:s.title,instructions:s.instructions??'',...s.nativeCustom});}
 for(const [id,o] of Object.entries(doc.ordering?.generalOverrides??{})){const {unscheduled,...authored}=o;overrides[id]={...authored,...(unscheduled?{scheduledAt:null}:{}),...copy(c.generalDates[id]??{})};}
 const id=(r:TaskReference)=>r.dishId===null?r.stepId:c.dishes[r.dishId]?.review.taskIds[r.stepId];
 if(c.present.includes('taskOverrides'))result.taskOverrides=overrides;
 if(c.present.includes('customTasks'))result.customTasks=c.customTaskOrder.map(id=>{const t=tasks.find(t=>t.id===id);if(!t)throw Error('Missing custom task.');return {...t,...(c.customExecution[id]!==undefined?{executionAddedAt:c.customExecution[id]}:{})};});
 if(doc.ordering?.taskOrder!==undefined)result.taskOrder=doc.ordering.taskOrder.map(r=>id(r)!);
 if(doc.ordering?.hiddenTasks!==undefined)result.hiddenTaskIds=doc.ordering.hiddenTasks.map(r=>id(r)!);
 if(doc.ordering?.generalSequence!==undefined)result.planningGeneralSequence=copy(doc.ordering.generalSequence);
 if(!same(result,conversion.original)||!same(doc.serving,serving(result,c.serving)))throw Error('Meal conversion failed immutable round-trip verification.');
 return result;
}

export function restoreMeal(conversion:MealConversion):ExtendedMeal{
 const meal=restoreNativeMeal(conversion);
 const round=convertMeal(meal,conversion.context.serving);
 if(round.status==='skipped'||!same(round.conversion.document,conversion.document))throw Error('Canonical meal cannot round-trip.');
 return meal;
}
