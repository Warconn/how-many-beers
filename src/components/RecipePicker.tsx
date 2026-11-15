'use client';
import {useEffect,useRef,useState} from 'react';
import type {usePersonalRecipes} from '@/account/usePersonalRecipes';
import type {PersonalRecipe} from '@/account/personalRecipes';
import type {ExtendedMeal} from '@/domain/cookState';
import {instantiateRecipeReview} from '@/domain/documents/reviewAdapter';
import {documentFingerprint,withRecipeLink} from '@/domain/recipeLink';
import Icon from './Icon';

/** Add-dish choices only. Management remains in the header's My recipes screen. */
export default function RecipePicker({recipes,serveAt,onUse,onCreate}:{recipes:ReturnType<typeof usePersonalRecipes>;serveAt:string;onUse:(meal:ExtendedMeal)=>void;onCreate:()=>void}){
 const [opening,setOpening]=useState(false),[error,setError]=useState('');
 const generation=useRef(0),latestOwner=useRef(recipes.ownerId);latestOwner.current=recipes.ownerId;
 useEffect(()=>{generation.current++;return()=>{generation.current++;};},[recipes.ownerId]);
 const choose=async(recipe:PersonalRecipe)=>{
  const version=generation.current,owner=recipes.ownerId;
  if(!owner||!recipes.authenticated)return;
  setOpening(true);setError('');
  try{
   const draft=instantiateRecipeReview(recipe.document,serveAt),fingerprint=await documentFingerprint(recipe.document);
   if(version!==generation.current||latestOwner.current!==owner)return;
   onUse(withRecipeLink(draft,draft.dishes[0].id,{ownerId:owner,id:recipe.id,revision:recipe.revision,name:recipe.document.name,fingerprint}));
  }catch{if(version===generation.current)setError('This recipe cannot be opened safely. Choose another recipe or add your own.');}
  finally{if(version===generation.current)setOpening(false);}
 };
 return <section aria-label="Choose a saved recipe" aria-busy={opening||recipes.loading}>
  <h3>My recipes</h3>
  {recipes.authenticated&&recipes.loading&&<p role="status">Loading recipes…</p>}
  {recipes.authenticated&&!recipes.loading&&!recipes.error&&!recipes.recipes.length&&<p className="muted small">No saved recipes yet. Add your own to get started.</p>}
  {!recipes.authenticated&&recipes.enabled&&<p className="muted small">Sign in to choose saved recipes, or add your own.</p>}
  <div className="template-picker">
   {recipes.authenticated&&recipes.recipes.map(recipe=><button type="button" className="template-choice" key={recipe.id} aria-label={'Choose '+recipe.document.name} disabled={opening||recipes.busy||recipes.loading} onClick={()=>void choose(recipe)}><strong>{recipe.document.name}</strong><span>{recipe.document.recipe.equipment.join(' · ')||'Custom method'}</span><Icon name="plus" className="template-add-icon"/></button>)}
   <button type="button" className="template-choice" aria-label="Add your own recipe" disabled={opening||recipes.busy} onClick={onCreate}><strong>Add your own recipe</strong><span>Paste steps or upload a .txt or .md file.</span><Icon name="plus" className="template-add-icon"/></button>
  </div>
  {(error||recipes.error)&&<p role="alert" className="form-error">{error||recipes.error}{recipes.error&&<> <button type="button" className="link" disabled={recipes.busy||recipes.loading} onClick={()=>void recipes.reload()}>Reload recipes</button></>}</p>}
 </section>;
}
