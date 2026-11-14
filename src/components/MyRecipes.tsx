'use client';
import {useEffect,useRef,useState} from 'react';
import type {usePersonalRecipes} from '@/account/usePersonalRecipes';
import type {PersonalRecipe} from '@/account/personalRecipes';
import type {ExtendedMeal} from '@/domain/cookState';
import {instantiateRecipeReview} from '@/domain/documents/reviewAdapter';
import RecipeMethodReview from './RecipeMethodReview';
import Icon from './Icon';
import RecipeSaveButton from './RecipeSaveButton';
import {documentFingerprint,withRecipeLink} from '@/domain/recipeLink';
export default function MyRecipes({recipes,onClose,onUse,serveAt,onDraftChange}:{onDraftChange:(open:boolean)=>void;recipes:ReturnType<typeof usePersonalRecipes>;onClose:()=>void;onUse:(meal:ExtendedMeal)=>void;serveAt:string}){
 const heading=useRef<HTMLHeadingElement>(null),latestOwner=useRef(recipes.ownerId);latestOwner.current=recipes.ownerId;
 useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});},[]);
 const [editing,setEditing]=useState<{recipe:PersonalRecipe;meal:ExtendedMeal}|null>(null),[error,setError]=useState('');
 useEffect(()=>{onDraftChange(editing!==null);return()=>onDraftChange(false);},[editing!==null,onDraftChange]);
 const open=async(recipe:PersonalRecipe)=>{try{const draft=instantiateRecipeReview(recipe.document,serveAt),fingerprint=await documentFingerprint(recipe.document);if(latestOwner.current!==recipes.ownerId)return;setEditing({recipe,meal:withRecipeLink(draft,draft.dishes[0].id,{ownerId:recipes.ownerId!,id:recipe.id,revision:recipe.revision,name:recipe.document.name,fingerprint})});setError('');}catch{setError('This recipe cannot be opened safely with this version.');}};
 return <section className="panel recipe-library-screen" aria-label="My recipes">
 <div className="recipe-library-heading"><h2 ref={heading} tabIndex={-1}>My recipes</h2>{!editing&&<button type="button" className="back-link" aria-label="Close My recipes" disabled={recipes.busy} onClick={onClose}>Back to cook</button>}</div>
 {!recipes.authenticated?<p>{recipes.enabled?'Sign in to save and reuse your recipes.':'Personal recipes require an account.'}</p>:editing?<RecipeMethodReview hidePrimary busy={recipes.busy||recipes.loading} meal={editing.meal} onChange={meal=>setEditing({...editing,meal})} onBack={()=>setEditing(null)} onAdd={async()=>{}} primaryLabel="Save changes" saveAction={(prepare,hasOpenEdit,onCopying)=><RecipeSaveButton mode="library" onCopying={onCopying} hasOpenEdit={hasOpenEdit} prepareMeal={prepare} meal={editing.meal} recipes={recipes} onSignIn={()=>{}} onSaved={()=>{setEditing(null);setError('');}} onLinkChange={async(link,renameFrom)=>{setEditing(current=>current?{...current,meal:withRecipeLink(current.meal,current.meal.dishes[0].id,link,renameFrom)}:current);}}/>}/>:<>
 {recipes.loading&&<p role="status">Loading recipes…</p>}
 {!recipes.loading&&!recipes.error&&recipes.recipes.length===0&&<p>Save a method while reviewing a recipe to find it here.</p>}
 <ul className="personal-recipe-list">{recipes.recipes.map(r=><li key={r.id}><div className="recipe-library-copy"><button type="button" className="recipe-title-link" disabled={recipes.busy} aria-label={'Edit '+r.document.name} onClick={()=>open(r)}>{r.document.name}</button><p className="muted small">{r.document.recipe.equipment.join(' · ')||'Custom method'} · {r.document.recipe.steps.length+(r.document.recipe.review?.addedSteps?.length??0)-(r.document.recipe.review?.hiddenStepIds?.length??0)} steps</p></div><div className="method-review-actions"><button type="button" className="button secondary" disabled={recipes.busy} onClick={()=>{try{const draft=instantiateRecipeReview(r.document,serveAt);void documentFingerprint(r.document).then(fingerprint=>{if(latestOwner.current===recipes.ownerId)onUse(withRecipeLink(draft,draft.dishes[0].id,{ownerId:recipes.ownerId!,id:r.id,revision:r.revision,name:r.document.name,fingerprint}));}).catch(()=>setError('This recipe cannot be opened safely.'));}catch{setError('This recipe cannot be opened safely.');}}}>Use recipe</button><button type="button" className="plan-trash" disabled={recipes.busy} title="Remove recipe" aria-label={'Remove '+r.document.name} onClick={()=>{if(window.confirm("Remove this recipe from My recipes? Existing cooks and plans won't change."))void recipes.remove(r).catch(e=>setError(e.message));}}><Icon name="trash"/></button></div></li>)}</ul>
 </>}
 {(error||recipes.error)&&<p role="alert" className="form-error">{error||recipes.error} <button type="button" className="link" disabled={recipes.busy} onClick={()=>{setError('');void recipes.reload();}}>Reload My recipes</button>{/changed|removed|pending recipe/.test(error||recipes.error)&&<button type="button" className="link" disabled={recipes.busy} onClick={()=>{if(window.confirm('Use the saved recipes? Your pending recipe change will be retained on this device.'))void recipes.useSavedVersion().then(()=>{setEditing(null);setError('');}).catch(e=>setError(e.message));}}>Use saved version</button>}</p>}
 </section>;
}
