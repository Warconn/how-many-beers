import Ajv from 'ajv';
import schema from './cooking-document-v1.schema.json';
import type {RecipeTemperature} from '../meal';

export type RecipeAction = {type:'prepare'|'serve'|'custom'|'checkpoint'} | {type:'start_phase'|'end_phase';phaseId:string};
export type DocumentStep = {
 id:string; type:'preparation'|'instruction'|'checkpoint'|'phase-boundary'|'serving';title:string;instructions?:string;
 timing:{estimatedMinutes:number|null;rangeMinutes?:[number,number]};
 condition?:{description:string;manualConfirmation:true}; equipment?:string[];temperatures?:RecipeTemperature[];
 dependsOn?:string[];actions:RecipeAction[];
};
export type RecipeDefinition = {
 method:string;equipment:string[];
 source:{kind:'template'|'customized-template'|'text'|'manual'|'saved-recipe'|'past-cook';reference?:string;originalText?:string;templateId?:string;templateVersion?:number};
 ingredients?:string[];weight?:{value:number;unit:'lb'|'kg'|'g'|'oz'};yield?:string;
 parameters?:Record<string,string|number|boolean|null>;
 steps:DocumentStep[];
 phases:{id:string;kind:'heating'|'passive';purpose?:'cook'|'rest'|'hold'|'cool'|'other';estimatedMinutes:number|null;upperMinutes?:number;after?:string}[];
};
type Envelope={format:'how-many-beers';schemaVersion:1;id:string;name:string};
export type RecipeDocument=Envelope & {type:'recipe';recipe:RecipeDefinition};
export type MealDocument=Envelope & {type:'meal';serving:{local:string;timeZone:string;instant?:string};dishes:{id:string;name:string;sourceRecipe?:{id:string;revision:number};recipe:RecipeDefinition;planning?:{stepTimes?:Record<string,string|null>;stepOrder?:string[];hiddenStepIds?:string[]}}[]};
export type CookingDocument=RecipeDocument|MealDocument;
const shape=new Ajv({allErrors:true,strict:true,allowUnionTypes:true}).compile(schema);
const unique=(ids:string[])=>new Set(ids).size===ids.length;
function recipeLinks(r:RecipeDefinition):boolean{
 const stepIds=r.steps.map(s=>s.id),phaseIds=r.phases.map(p=>p.id);
 if(!unique(stepIds)||!unique(phaseIds))return false;
 for(const [index,s] of r.steps.entries()){
  if(s.dependsOn&&(!unique(s.dependsOn)||s.dependsOn.some(id=>!stepIds.slice(0,index).includes(id))))return false;
  const range=s.timing.rangeMinutes;
  if(range&&(range[0]>range[1]||(s.timing.estimatedMinutes!==null&&(s.timing.estimatedMinutes<range[0]||s.timing.estimatedMinutes>range[1]))))return false;
  for(const a of s.actions)if('phaseId' in a&&!phaseIds.includes(a.phaseId))return false;
 }
 for(const [index,p] of r.phases.entries()){
  if(p.after&&!phaseIds.slice(0,index).includes(p.after))return false;
  if(p.upperMinutes!==undefined&&p.estimatedMinutes!==null&&p.upperMinutes<p.estimatedMinutes)return false;
 }
 return true;
}
/** Authored documents only. Execution/history belongs to the existing cook store.
 * This boundary is not wired into application persistence until adapters round-trip. */
export function parseCookingDocument(value:unknown):CookingDocument{
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
  if(!unique(doc.dishes.map(d=>d.id)))throw Error('Duplicate dish identity.');
  try{new Intl.DateTimeFormat('en-US',{timeZone:doc.serving.timeZone});}catch{throw Error('Invalid serving time zone.');}
  for(const d of doc.dishes){
   if(!recipeLinks(d.recipe))throw Error('Invalid dish recipe.');
   const keys=d.recipe.steps.map(s=>s.id),p=d.planning;
   for(const ids of [p?.stepOrder,p?.hiddenStepIds,Object.keys(p?.stepTimes??{})])if(ids&&(!unique(ids)||ids.some(id=>!keys.includes(id))))throw Error('Invalid meal planning references.');
  }
 }
 return doc;
}
