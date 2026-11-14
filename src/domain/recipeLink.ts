import type {ExtendedMeal} from './cookState';
import {cookTimeline} from './cookState';
import {reviewDuration} from './recipeReview';
import {dishReviewForRecipe} from './documents/dishExtraction';
import {convertRecipeReview,instantiateRecipeReview} from './documents/reviewAdapter';
import type {RecipeDocument} from './documents/cookingDocument';

export type RecipeSaveIntent={id:string;revision:number;name:string;fingerprint:string;renameFrom:string};
export type RecipeLink={ownerId:string;id:string;revision:number;name:string;fingerprint:string;pending?:RecipeSaveIntent};
const stable=(x:unknown):unknown=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):x;
/** Dates, actuals and provenance never change the reusable method. */
export function reusableReview(meal:ExtendedMeal,dishId=meal.dishes[0].id):ExtendedMeal{
 const r=dishReviewForRecipe(meal,dishId);r.serveAt='2030-01-01T13:00:00Z';
 r.taskOverrides=Object.fromEntries(Object.entries(r.taskOverrides??{}).map(([id,{scheduledAt:_date,recordedPlanAt:_actual,...o}])=>[id,o]));
 r.customTasks=r.customTasks?.map(t=>({...t,scheduledAt:null}));return r;
}
export function recipeContent(meal:ExtendedMeal,dishId=meal.dishes[0].id):string{
 const review=reusableReview(meal,dishId),r=convertRecipeReview(review,'content');
 if(r.status!=='converted')throw Error('This method cannot be compared safely. Your edits are retained.');
 const canonical=instantiateRecipeReview(r.document,'2030-01-01T13:00:00Z','content');
 const tasks=cookTimeline(canonical),d=canonical.dishes[0],{id:_id,recipeLink:_link,executionAddedAt:_at,...configuration}=d;
 // Effective values avoid treating an unchanged opened/closed step as an edit.
 return JSON.stringify(stable({configuration,steps:tasks.map(t=>({id:t.id,title:t.title,instructions:t.instructions,minutes:reviewDuration(canonical,t),equipment:t.equipment,targetTempF:t.targetTempF??null,isCondition:t.isCondition}))}));
}
export async function recipeFingerprint(meal:ExtendedMeal,dishId=meal.dishes[0].id){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(recipeContent(meal,dishId)));
 return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export const documentFingerprint=(doc:RecipeDocument)=>recipeFingerprint(instantiateRecipeReview(doc,'2030-01-01T13:00:00Z'));
export function withRecipeLink(meal:ExtendedMeal,dishId:string,link:RecipeLink,renameFrom?:string):ExtendedMeal{
 if(!meal.dishes.some(d=>d.id===dishId))throw Error('This dish is no longer in the meal.');
 const rename=renameFrom!==undefined&&meal.dishes.find(d=>d.id===dishId)!.name===renameFrom;
 return {...meal,dishes:meal.dishes.map(d=>d.id===dishId?{...d,recipeLink:link,...(rename?{name:link.name}:{})}:d),...(rename&&meal.customTasks?{customTasks:meal.customTasks.map(t=>t.dishId===dishId?{...t,dishName:link.name}:t)}:{})};
}
export function copyRecipeName(name:string,existing:readonly string[]){
 const names=new Set(existing.map(n=>n.trim().toLowerCase()));let n=1;
 while(names.has((name.slice(0,75)+'_'+n).toLowerCase()))n++;
 return name.slice(0,75)+'_'+n;
}
