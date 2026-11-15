import type {ExtendedMeal} from '@/domain/cookState';
import {convertRecipeReview} from '@/domain/documents/reviewAdapter';
/** Keep diagnostic reasons available without presenting schema internals as UX. */
export function recipeDocumentForSave(meal:ExtendedMeal,id:string){
 const result=convertRecipeReview(meal,id);
 if(result.status==='converted')return result.document;
 console.warn('Recipe save conversion rejected:',result.reason);
 throw Error('Could not save this method. Your edits are still here. Review the changed steps and try again.');
}
