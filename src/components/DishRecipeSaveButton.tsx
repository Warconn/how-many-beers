'use client';
import type {ExtendedMeal} from '@/domain/cookState';
import type {usePersonalRecipes} from '@/account/usePersonalRecipes';
import {dishReviewForRecipe} from '@/domain/documents/dishExtraction';
import RecipeSaveButton from './RecipeSaveButton';
export default function DishRecipeSaveButton({meal,dishId,recipes,disabled=false}:{disabled?:boolean;meal:ExtendedMeal;dishId:string;recipes:ReturnType<typeof usePersonalRecipes>}){
 const review=dishReviewForRecipe(meal,dishId);
 return <RecipeSaveButton disabled={disabled} appearance="link" meal={review} recipes={recipes} onSignIn={()=>window.dispatchEvent(new Event('hmb-open-account'))}/>;
}
