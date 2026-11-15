import Ajv from 'ajv';
import schema from './cooking-document-v1.schema.json';
import type {Dish,RecipeTemperature} from '../meal';

export type RecipeAction = {type:'prepare'|'serve'|'custom'} | {type:'checkpoint';phaseId?:string;fraction?:number} | {type:'start_phase'|'end_phase';phaseId:string};
export type DocumentStep = {
 nativeCustom?:Pick<import('../meal').PlannedTask,'dishName'|'isCondition'|'optionalDetails'|'durationMinutes'|'equipment'|'targetTempF'>;
 generated?:boolean;cookingKind?:'heating'|'passive';
 templatePosition?:{anchor:'prep'|'preheat'|'start'|'progress'|'finish'|'serve';beforeStartMin?:number;progress?:number};
 templateStage?:import('../meal').TemplateStage;
 id:string; type:'preparation'|'instruction'|'checkpoint'|'phase-boundary'|'serving';title:string;instructions?:string;
 timing:{estimatedMinutes:number|null;rangeMinutes?:[number,number]};
 condition?:{description:string;manualConfirmation:true}; equipment?:string[];temperatures?:RecipeTemperature[];
 dependsOn?:string[];actions:RecipeAction[];
};
export type AuthoredOverride=Pick<import('../cookState').TaskOverride,'title'|'instructions'|'durationMinutes'|'equipment'|'targetTempF'> & {unscheduled?:true};
export type ReviewDefinition={overrides?:Record<string,AuthoredOverride>;hiddenStepIds?:string[];taskOrder?:string[];dishSequence?:string[];dishStepOrder?:string[];addedSteps?:DocumentStep[]};
export type RecipeDefinition = {
 review?:ReviewDefinition;
 configuration?:Pick<Dish,'preset'|'cookMinutes'|'restMinutes'|'pitTempF'|'brisketTemplateVersion'|'turkeyPrep'|'planningSequence'|'planningStepOrder'> & {brisketMode?:'manual'|'estimate';brisketApplied?:Omit<import('../brisketEstimate').BrisketEstimate,'recommendedStart'|'latestStart'|'prepStart'>;brisketInputs?:import('../brisketEstimate').BrisketInputs;sourceStepOrder?:string[]};
 suppressedStepIds?:string[];
 method:string;equipment:string[];
 source:{kind:'template'|'customized-template'|'text'|'manual'|'saved-recipe'|'past-cook';reference?:string;originalText?:string;templateId?:string;templateVersion?:number};
 ingredients?:string[];weight?:{value:number;unit:'lb'|'kg'|'g'|'oz'};yield?:string;
 parameters?:Record<string,string|number|boolean|null>;
 steps:DocumentStep[];
 phases:{id:string;kind:'heating'|'passive';purpose?:'cook'|'rest'|'hold'|'cool'|'other';estimatedMinutes:number|null;upperMinutes?:number;after?:string;leadMinutes?:number;durationStepId?:string}[];
};
type Envelope={format:'how-many-beers';schemaVersion:1;id:string;name:string};
export type RecipeDocument=Envelope & {type:'recipe';recipe:RecipeDefinition};
export type TaskReference={dishId:string|null;stepId:string};
export type MealDocument=Envelope & {generalSteps?:DocumentStep[];ordering?:{taskOrder?:TaskReference[];hiddenTasks?:TaskReference[];generalSequence?:string[];generalOverrides?:Record<string,AuthoredOverride>};type:'meal';serving:{local:string;timeZone:string;instant?:string};dishes:{id:string;name:string;sourceRecipe?:{id:string;revision:number};recipe:RecipeDefinition;planning?:{stepTimes?:Record<string,string|null>;stepOrder?:string[];hiddenStepIds?:string[]}}[]};
export type CookingDocument=RecipeDocument|MealDocument;
const shape=new Ajv({allErrors:true,strict:true,allowUnionTypes:true}).compile(schema);
const unique=(ids:string[])=>new Set(ids).size===ids.length;
function recipeLinks(r:RecipeDefinition):boolean{
 const allSteps=[...r.steps,...(r.review?.addedSteps??[])];
 const stepIds=allSteps.map(s=>s.id),phaseIds=r.phases.map(p=>p.id);
 if(!unique(stepIds)||!unique(phaseIds))return false;
 if(r.review?.addedSteps?.some(s=>!s.nativeCustom||s.actions.length!==1||s.actions[0].type!=='custom'))return false;
 for(const [index,s] of allSteps.entries()){
  if(s.dependsOn&&(!unique(s.dependsOn)||s.dependsOn.some(id=>!stepIds.slice(0,index).includes(id))))return false;
  const range=s.timing.rangeMinutes;
  if(range&&(range[0]>range[1]||(s.timing.estimatedMinutes!==null&&(s.timing.estimatedMinutes<range[0]||s.timing.estimatedMinutes>range[1]))))return false;
  for(const a of s.actions)if('phaseId' in a&&a.phaseId!==undefined&&!phaseIds.includes(a.phaseId))return false;
 }
 for(const ids of [r.suppressedStepIds,r.configuration?.planningSequence,r.configuration?.planningStepOrder,r.configuration?.sourceStepOrder,r.review?.hiddenStepIds,r.review?.taskOrder,r.review?.dishSequence,r.review?.dishStepOrder,Object.keys(r.review?.overrides??{})])if(ids&&(!unique(ids)||ids.some(id=>!stepIds.includes(id))))return false;
 for(const s of allSteps)for(const a of s.actions)if(a.type==='checkpoint'&&((a.phaseId===undefined)!==(a.fraction===undefined)))return false;
 for(const [index,p] of r.phases.entries()){
  if(p.durationStepId&&!stepIds.includes(p.durationStepId))return false;
  if(p.after&&!phaseIds.slice(0,index).includes(p.after))return false;
  if(p.upperMinutes!==undefined&&p.estimatedMinutes!==null&&p.upperMinutes<p.estimatedMinutes)return false;
 }
 return true;
}
/** Authored documents only. Execution/history belongs to the existing cook store.
 * This boundary is not wired into application persistence until adapters round-trip. */
export function parseCookingDocument(value:unknown):CookingDocument{
 assertJson(value);
 let encoded:string|undefined;
 try{encoded=JSON.stringify(value);}catch{throw Error('Cooking document must be JSON.');}
 if(!encoded||new TextEncoder().encode(encoded).length>1024*1024)throw Error('Cooking document exceeds 1 MiB.');
 // Validate a JSON snapshot: do not retain mutable references supplied by a caller.
 const snapshot:unknown=JSON.parse(encoded);
 if(!shape(snapshot))throw Error('Invalid or unsupported cooking document.');
 const doc=snapshot as CookingDocument;
 if(doc.type==='recipe'){
  if(!recipeLinks(doc.recipe))throw Error('Invalid recipe relationships or timing.');
 }else{
  const general=doc.generalSteps??[];
  if(!unique(general.map(s=>s.id))||general.some(s=>!s.nativeCustom||s.actions.length!==1||s.actions[0].type!=='custom'))throw Error('Invalid general steps.');
  const known=new Map(doc.dishes.map(d=>[d.id,new Set([...d.recipe.steps,...(d.recipe.review?.addedSteps??[])].map(s=>s.id))]));
  const generalIds=new Set(general.map(s=>s.id));
  for(const refs of [doc.ordering?.taskOrder,doc.ordering?.hiddenTasks]){
   if(refs&&(new Set(refs.map(r=>JSON.stringify([r.dishId,r.stepId]))).size!==refs.length||refs.some(r=>!(r.dishId===null?generalIds:known.get(r.dishId))?.has(r.stepId))))throw Error('Invalid meal task references.');
  }
  for(const ids of [doc.ordering?.generalSequence,Object.keys(doc.ordering?.generalOverrides??{})])if(ids&&(!unique(ids)||ids.some(id=>!generalIds.has(id))))throw Error('Invalid general references.');
  if(!unique(doc.dishes.map(d=>d.id)))throw Error('Duplicate dish identity.');
  if(!validLocal(doc.serving.local)||doc.serving.instant!==undefined&&(!/Z$|[+-]\d{2}:\d{2}$/.test(doc.serving.instant)||!Number.isFinite(Date.parse(doc.serving.instant))))throw Error('Invalid serving date.');
  try{new Intl.DateTimeFormat('en-US',{timeZone:doc.serving.timeZone});}catch{throw Error('Invalid serving time zone.');}
  for(const d of doc.dishes){
   if(!recipeLinks(d.recipe))throw Error('Invalid dish recipe.');
   const keys=[...d.recipe.steps,...(d.recipe.review?.addedSteps??[])].map(s=>s.id),p=d.planning;
   for(const ids of [p?.stepOrder,p?.hiddenStepIds,Object.keys(p?.stepTimes??{})])if(ids&&(!unique(ids)||ids.some(id=>!keys.includes(id))))throw Error('Invalid meal planning references.');
  }
 }
 return doc;
}

/** Reject non-JSON values before stringify can silently coerce or omit them. */
function assertJson(value:unknown,seen=new Set<object>(),depth=0):void{
 if(depth>100)throw Error('Cooking document is nested too deeply.');
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'&&Number.isFinite(value))return;
 if(typeof value!=='object'||!value||seen.has(value)||(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null))throw Error('Cooking document must contain only JSON values.');
 seen.add(value);
 for(const v of Array.isArray(value)?Array.from(value):Object.values(value))assertJson(v,seen,depth+1);
 seen.delete(value);
}
function validLocal(value:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return false;
 const date=new Date(value+'Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,16)===value;
}
