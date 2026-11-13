'use client';
import {useEffect,useRef,useState} from 'react';
import type {usePersonalRecipes} from '@/account/usePersonalRecipes';
import type {PersonalRecipe} from '@/account/personalRecipes';
import type {ExtendedMeal} from '@/domain/cookState';
import {instantiateRecipeReview,convertRecipeReview} from '@/domain/documents/reviewAdapter';
import RecipeMethodReview from './RecipeMethodReview';
export default function MyRecipes({recipes,onClose,onUse,serveAt}:{recipes:ReturnType<typeof usePersonalRecipes>;onClose:()=>void;onUse:(meal:ExtendedMeal)=>void;serveAt:string}){
 const dialog=useRef<HTMLDialogElement>(null),[editing,setEditing]=useState<{recipe:PersonalRecipe;meal:ExtendedMeal}|null>(null),[error,setError]=useState(''),newId=useRef<string|null>(null);
 useEffect(()=>{dialog.current?.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=overflow;};},[]);
 const open=(recipe:PersonalRecipe)=>{try{newId.current=null;setEditing({recipe,meal:instantiateRecipeReview(recipe.document,serveAt)});setError('');}catch{setError('This recipe cannot be opened safely with this version.');}};
 const save=async(asNew=false,draft=editing?.meal)=>{
  if(!editing||!draft)return;const id=asNew?(newId.current??=crypto.randomUUID()):editing.recipe.id;
  const converted=convertRecipeReview(draft,id);if(converted.status!=='converted')throw Error('This method cannot be saved safely yet.');
  const result=await recipes.save(converted.document,asNew?undefined:editing.recipe);setEditing(null);setError('');return result;
 };
 return <dialog ref={dialog} className="account-dialog recipe-library-dialog" aria-label="My recipes" onCancel={e=>{e.preventDefault();if(!recipes.busy)onClose();}}><div className="account-dialog-content">
 <div className="recipe-library-heading"><h2>My recipes</h2><button type="button" className="link" disabled={recipes.busy} onClick={onClose}>Close My recipes</button></div>
 {!recipes.authenticated?<p>Sign in to save and reuse your recipes.</p>:editing?<RecipeMethodReview busy={recipes.busy||recipes.loading} meal={editing.meal} onChange={meal=>setEditing({...editing,meal})} onBack={()=>setEditing(null)} onAdd={async draft=>{await save(false,draft);}} primaryLabel="Save changes" saveAction={prepare=><button type="button" className="link" disabled={recipes.busy||recipes.loading} onClick={async()=>{try{await save(true,prepare());}catch(e){setError(e instanceof Error?e.message:'Check this step.');}}}>Save as new recipe</button>}/>:<>
 {recipes.loading&&<p role="status">Loading recipes…</p>}
 {!recipes.loading&&!recipes.error&&recipes.recipes.length===0&&<p>Save a method while reviewing a recipe to find it here.</p>}
 <ul className="personal-recipe-list">{recipes.recipes.map(r=><li key={r.id}><strong>{r.document.name}</strong><p className="muted small">{r.document.recipe.equipment.join(' · ')||'Custom method'}</p><div className="method-review-actions"><button type="button" className="button secondary" disabled={recipes.busy} onClick={()=>{try{onUse(instantiateRecipeReview(r.document,serveAt));}catch{setError('This recipe cannot be opened safely.');}}}>Use recipe</button><button type="button" className="link" disabled={recipes.busy} aria-label={'Edit '+r.document.name} onClick={()=>open(r)}>Edit</button><button type="button" className="link danger" disabled={recipes.busy} aria-label={'Remove '+r.document.name} onClick={()=>{if(window.confirm("Remove this recipe from My recipes? Existing cooks and plans won't change."))void recipes.remove(r).catch(e=>setError(e.message));}}>Remove</button></div></li>)}</ul>
 </>}
 {(error||recipes.error)&&<p role="alert" className="form-error">{error||recipes.error} <button type="button" className="link" disabled={recipes.busy} onClick={()=>{setError('');void recipes.reload();}}>Reload My recipes</button>{/changed|removed|pending recipe/.test(error||recipes.error)&&<button type="button" className="link" disabled={recipes.busy} onClick={()=>{if(window.confirm('Use the saved recipes? Your pending recipe change will be retained on this device.'))void recipes.useSavedVersion().then(()=>{setEditing(null);setError('');}).catch(e=>setError(e.message));}}>Use saved version</button>}</p>}
 </div></dialog>;
}
