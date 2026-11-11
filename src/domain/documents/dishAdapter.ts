import type {Dish,RecipeStep} from '../meal';
import {cookTimeline} from '../cookState';
import {buildPhasePlan} from '../cookingPhases';
import {stepsForDish} from '../../data/cookTemplates';
import {isStoredMeal} from '../storageValidation';
import {parseCookingDocument,type RecipeDocument,type RecipeDefinition,type DocumentStep,type RecipeAction} from './cookingDocument';

const referenceDate='2030-01-01T13:00'; // Internal compilation anchor, never serialized.
const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const keys=['id','name','preset','equipment','cookMinutes','restMinutes','pitTempF','weightLb','steps','recipeIngredients','recipeReference','recipeSource','brisketPlan','brisketTemplateVersion','turkeyPrep','planningSequence','planningStepOrder'];
export type DishConversion={status:'converted';document:RecipeDocument;original:Dish}|{status:'skipped';reason:string;original:unknown};

/** Non-mutating conversion of a native authored dish. No meal or execution input.
 * Unsupported settings remain readable through their original representation. */
export function convertDish(value:unknown,recipeId:string):DishConversion{
 const original=structuredClone(value);
 try{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw Error('Unsupported dish fields (including execution state).');
  const dish=value as Dish;
  if(!isStoredMeal({version:1,id:'check',name:'check',serveAt:referenceDate,dishes:[dish],completed:{},notes:{}}))throw Error('Invalid native dish.');
  if(dish.brisketPlan&&(dish.brisketPlan.applied||dish.brisketPlan.mode!=='manual'))throw Error('Applied calendar estimates require the meal compatibility adapter.');
  if(dish.preset!=='custom'&&dish.steps!==undefined)throw Error('Template with embedded custom steps requires compatibility review.');
  const document=projectDish(dish,recipeId);
  // Prove authored payload identity before marking eligible, including omitted fields.
  if(JSON.stringify(stable(nativeDish(document,dish.id)))!==JSON.stringify(stable(copy(dish))))throw Error('Native fields cannot round-trip safely.');
  return {status:'converted',document,original:copy(dish)};
 }catch(e){return {status:'skipped',reason:e instanceof Error?e.message:'Unsupported dish.',original};}
}
const stable=(v:unknown):unknown=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,stable(x)])):v;
function projectDish(d:Dish,id:string):RecipeDocument{
 const meal={version:1 as const,id:'compile',name:'compile',serveAt:referenceDate,dishes:[d],completed:{},notes:{}};
 const tasks=cookTimeline(meal);
 const plan=buildPhasePlan(meal,tasks);
 const local=(id:string)=>{if(!id.startsWith(d.id+':'))throw Error('Cross-dish reference.');return id.slice(d.id.length+1);};
 const template=stepsForDish(d);
 const steps:DocumentStep[]=tasks.map(t=>{
  const key=local(t.id),source=d.steps?.find(s=>s.id===key),position=template?.find(s=>s.id===key);
  const a=plan.actions[t.id],actions:RecipeAction[]=[...(a?.ends??[]).map(phaseId=>({type:'end_phase' as const,phaseId:local(phaseId)})),...(a?.starts??[]).map(phaseId=>({type:'start_phase' as const,phaseId:local(phaseId)}))];
  if(a?.checkpoint)actions.push({type:'checkpoint',phaseId:local(a.checkpoint.phaseId),fraction:a.checkpoint.fraction});
  if(!actions.length)actions.push({type:t.isCondition?'checkpoint':key==='serve'?'serve':'custom'});
  return {id:key,type:actions.some(a=>a.type==='start_phase'||a.type==='end_phase')?'phase-boundary':t.isCondition?'checkpoint':key==='serve'?'serving':'instruction',
   title:source?.title??t.title,...(source?source.instructions!==undefined?{instructions:source.instructions}:{}:{instructions:t.instructions}),
   timing:{estimatedMinutes:source?source.minutes:t.durationMinutes??t.templateStage?.minutes??null},actions,
   ...(t.isCondition?{condition:{description:t.instructions,manualConfirmation:true as const}}:{}),
   ...(source?.recipeTemperatures!==undefined?{temperatures:source.recipeTemperatures}:{}),
   ...(source?.cookingKind?{cookingKind:source.cookingKind}:{}),generated:!source,
   ...(position?{templatePosition:{anchor:position.anchor,...(position.beforeStartMin!==undefined?{beforeStartMin:position.beforeStartMin}:{}),...(position.progress!==undefined?{progress:position.progress}:{})}}:{}),
   ...(t.templateStage?{templateStage:t.templateStage}: {})};
 });
 const configuration:NonNullable<RecipeDefinition['configuration']>={preset:d.preset,cookMinutes:d.cookMinutes,restMinutes:d.restMinutes};
 for(const k of ['pitTempF','brisketTemplateVersion','turkeyPrep','planningSequence','planningStepOrder'] as const)if(d[k]!==undefined)Object.assign(configuration,{[k]:d[k]});
 if(d.brisketPlan)configuration.brisketInputs=d.brisketPlan.inputs;
 if(d.steps)configuration.sourceStepOrder=d.steps.map(s=>s.id);
 const doc={format:'how-many-beers' as const,schemaVersion:1 as const,type:'recipe' as const,id,name:d.name,recipe:{method:d.preset,equipment:[d.equipment],configuration,
  source:{kind:d.preset==='custom'?d.recipeSource!==undefined?'text' as const:'manual' as const:'template' as const,...(d.recipeReference!==undefined?{reference:d.recipeReference}:{}),...(d.recipeSource!==undefined?{originalText:d.recipeSource}:{}),...(d.preset!=='custom'?{templateId:d.preset,templateVersion:d.brisketTemplateVersion??1}:{})},
  ...(d.recipeIngredients!==undefined?{ingredients:d.recipeIngredients}:{}),...(d.weightLb!==undefined?{weight:{value:d.weightLb,unit:'lb' as const}}:{}),steps,
  phases:plan.phases.map(p=>({id:local(p.id),kind:p.kind,estimatedMinutes:p.minutes,durationStepId:local(p.durationTaskId),...(p.after?{after:local(p.after)}:{}),...(p.upperMinutes!==undefined?{upperMinutes:p.upperMinutes}:{}),...(p.leadMinutes!==undefined?{leadMinutes:p.leadMinutes}:{})})),suppressedStepIds:plan.suppressed.map(local)}};
 return parseCookingDocument(copy(doc)) as RecipeDocument;
}
function nativeDish(doc:RecipeDocument,instanceId:string):Dish{
 const r=doc.recipe,c=r.configuration;
 if(!c||r.equipment.length!==1||r.method!==c.preset||r.weight&&r.weight.unit!=='lb')throw Error('Recipe needs a supported native configuration.');
 const {brisketInputs,sourceStepOrder,...config}=c;
 const dish:Dish={id:instanceId,name:doc.name,equipment:r.equipment[0],...config,
  ...(brisketInputs?{brisketPlan:{mode:'manual',inputs:brisketInputs}}:{}),
  ...(r.weight?{weightLb:r.weight.value}:{}),...(r.ingredients!==undefined?{recipeIngredients:r.ingredients}:{}),
  ...(r.source.reference!==undefined?{recipeReference:r.source.reference}:{}),...(r.source.originalText!==undefined?{recipeSource:r.source.originalText}:{})};
 if(c.preset==='custom')dish.steps=[...r.steps.filter(s=>!s.generated)].sort((a,b)=>(sourceStepOrder?.indexOf(a.id)??0)-(sourceStepOrder?.indexOf(b.id)??0)).map((s):RecipeStep=>({id:s.id,title:s.title,minutes:s.timing.estimatedMinutes,...(s.instructions!==undefined?{instructions:s.instructions}:{}),...(s.temperatures!==undefined?{recipeTemperatures:s.temperatures}:{}),...(s.cookingKind?{cookingKind:s.cookingKind}:{})}));
 return copy(dish);
}
/** Fresh dish identity, stable recipe-local keys. Recompiles through today's
 * engine and rejects semantics it cannot express rather than silently losing them. */
export function instantiateRecipe(value:unknown,instanceId:string=crypto.randomUUID()):Dish{
 const doc=parseCookingDocument(value);
 if(doc.type!=='recipe')throw Error('Choose a recipe document.');
 if(!/^[A-Za-z0-9_-]{1,160}$/.test(instanceId))throw Error('Invalid dish identity.');
 const dish=nativeDish(doc,instanceId),round=projectDish(dish,doc.id);
 if(JSON.stringify(stable(round))!==JSON.stringify(stable(doc)))throw Error('Recipe semantics require a newer compatibility adapter.');
 return dish;
}

export {convertRecipeReview,instantiateRecipeReview,restoreRecipeReview} from './reviewAdapter';
