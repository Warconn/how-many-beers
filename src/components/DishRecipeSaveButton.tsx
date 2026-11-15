'use client';
import type {ExtendedMeal} from '@/domain/cookState';
import type {usePersonalRecipes} from '@/account/usePersonalRecipes';
import {dishReviewForRecipe} from '@/domain/documents/dishExtraction';
import type {RecipeLink} from '@/domain/recipeLink';
import RecipeSaveButton from './RecipeSaveButton';
export default function DishRecipeSaveButton({meal,dishId,recipes,disabled=false,onLinkChange}:{onLinkChange:(link:RecipeLink,renameFrom?:string)=>Promise<void>;disabled?:boolean;meal:ExtendedMeal;dishId:string;recipes:ReturnType<typeof usePersonalRecipes>}){
 const review=dishReviewForRecipe(meal,dishId);review.dishes[0].recipeLink=meal.dishes.find(d=>d.id===dishId)?.recipeLink;
 return <RecipeSaveButton disabled={disabled} mode="planning" meal={review} recipes={recipes} onLinkChange={onLinkChange} onSignIn={()=>window.dispatchEvent(new Event('hmb-open-account'))}/>;
}
