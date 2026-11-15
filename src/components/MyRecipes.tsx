'use client';

import {useEffect,useRef,useState} from 'react';
import type {usePersonalRecipes} from '@/account/usePersonalRecipes';
import type {PersonalRecipe} from '@/account/personalRecipes';
import type {ExtendedMeal} from '@/domain/cookState';
import {cookTimeline} from '@/domain/cookState';
import {instantiateRecipeReview} from '@/domain/documents/reviewAdapter';
import {reviewDuration} from '@/domain/recipeReview';
import {formatDuration} from '@/domain/stepTiming';
import RecipeMethodReview from './RecipeMethodReview';
import Icon from './Icon';
import RecipeSaveButton from './RecipeSaveButton';
import {documentFingerprint,withRecipeLink} from '@/domain/recipeLink';

type Props={
  onDraftChange:(open:boolean)=>void;
  recipes:ReturnType<typeof usePersonalRecipes>;
  onUse:(meal:ExtendedMeal)=>void;
  serveAt:string;
};
type SelectedRecipe={recipe:PersonalRecipe;meal:ExtendedMeal};

function stepCount(recipe:PersonalRecipe):number{
  const definition=recipe.document.recipe;
  return definition.steps.length+(definition.review?.addedSteps?.length??0)-(definition.review?.hiddenStepIds?.length??0);
}

export default function MyRecipes({recipes,onUse,serveAt,onDraftChange}:Props){
  const heading=useRef<HTMLHeadingElement>(null);
  const detailHeading=useRef<HTMLHeadingElement>(null);
  const detailBack=useRef<HTMLButtonElement>(null);
  const latestOwner=useRef(recipes.ownerId);
  latestOwner.current=recipes.ownerId;
  useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});},[]);

  const [search,setSearch]=useState('');
  const [preview,setPreview]=useState<SelectedRecipe|null>(null);
  const [editing,setEditing]=useState<SelectedRecipe|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{onDraftChange(editing!==null);return()=>onDraftChange(false);},[editing!==null,onDraftChange]);
  useEffect(()=>{
    if(!preview||editing)return;
    detailHeading.current?.focus({preventScroll:true});
    detailBack.current?.scrollIntoView({block:'start',behavior:'instant'});
  },[preview?.recipe.id,editing]);

  const showPreview=(recipe:PersonalRecipe)=>{
    try{
      const meal=instantiateRecipeReview(recipe.document,serveAt);
      setPreview({recipe,meal});
      setError('');
    }catch{setError('This recipe cannot be opened safely with this version.');}
  };
  const open=async(recipe:PersonalRecipe)=>{
    try{
      const draft=instantiateRecipeReview(recipe.document,serveAt);
      const fingerprint=await documentFingerprint(recipe.document);
      if(latestOwner.current!==recipes.ownerId)return;
      setEditing({recipe,meal:withRecipeLink(draft,draft.dishes[0].id,{
        ownerId:recipes.ownerId!,id:recipe.id,revision:recipe.revision,
        name:recipe.document.name,fingerprint
      })});
      setError('');
    }catch{setError('This recipe cannot be opened safely with this version.');}
  };
  const useRecipe=(recipe:PersonalRecipe)=>{
    try{
      const draft=instantiateRecipeReview(recipe.document,serveAt);
      void documentFingerprint(recipe.document).then(fingerprint=>{
        if(latestOwner.current===recipes.ownerId)onUse(withRecipeLink(draft,draft.dishes[0].id,{
          ownerId:recipes.ownerId!,id:recipe.id,revision:recipe.revision,
          name:recipe.document.name,fingerprint
        }));
      }).catch(()=>setError('This recipe cannot be opened safely.'));
    }catch{setError('This recipe cannot be opened safely.');}
  };
  const remove=(recipe:PersonalRecipe)=>{
    if(window.confirm("Remove this recipe from My recipes? Existing cooks and plans won't change.")){
      void recipes.remove(recipe).then(()=>setPreview(null)).catch(e=>setError(e.message));
    }
  };
  const shown=recipes.recipes.filter(r=>
    (r.document.name+' '+r.document.recipe.equipment.join(' ')).toLowerCase().includes(search.trim().toLowerCase())
  );
  const previewTasks=preview?cookTimeline(preview.meal):[];

  return <section className="panel recipe-library-screen" aria-label="My recipes">
    <div className="recipe-library-heading">
      <div className="section-title">
        <span className="section-icon" aria-hidden="true"><Icon name="book"/></span>
        <div><p className="eyebrow">SAVED METHODS</p><h2 ref={heading} tabIndex={-1}>My recipes</h2></div>
      </div>
    </div>
    {!recipes.authenticated?<p>{recipes.enabled?'Sign in to save and reuse your recipes.':'Personal recipes require an account.'}</p>
    :editing?<RecipeMethodReview
      hidePrimary busy={recipes.busy||recipes.loading} meal={editing.meal}
      onChange={meal=>setEditing({...editing,meal})} onBack={()=>setEditing(null)}
      onAdd={async()=>{}} primaryLabel="Save changes"
      saveAction={(prepare,hasOpenEdit,onCopying)=><RecipeSaveButton mode="library"
        onCopying={onCopying} hasOpenEdit={hasOpenEdit} prepareMeal={prepare}
        meal={editing.meal} recipes={recipes} onSignIn={()=>{}}
        onSaved={()=>{setEditing(null);setPreview(null);setError('');}}
        onLinkChange={async(link,renameFrom)=>{
          setEditing(current=>current?{...current,meal:withRecipeLink(current.meal,current.meal.dishes[0].id,link,renameFrom)}:current);
        }}/>}
    />
    :preview?<>
      <button type="button" className="back-link library-detail-back" ref={detailBack} onClick={()=>setPreview(null)}><Icon name="arrow-left"/>All recipes</button>
      <section className="recipe-library-detail library-detail" aria-label="Saved recipe details">
        <div className="between library-detail-heading">
          <div>
            <p className="eyebrow">RECIPE DETAILS</p>
            <h3 ref={detailHeading} tabIndex={-1}>{preview.recipe.document.name}</h3>
            <p className="muted small">{preview.recipe.document.recipe.equipment.join(' · ')||'Custom method'}</p>
          </div>
          <span className="history-count">{previewTasks.length} steps</span>
        </div>
        <div className="history-actions library-detail-actions">
          <button type="button" className="button primary" disabled={recipes.busy} onClick={()=>useRecipe(preview.recipe)}>Use recipe</button>
          <button type="button" className="button secondary" disabled={recipes.busy} onClick={()=>void open(preview.recipe)}>Edit recipe</button>
          <button type="button" className="button history-delete" disabled={recipes.busy} onClick={()=>remove(preview.recipe)}>Remove</button>
        </div>
        {(preview.recipe.document.recipe.ingredients?.length??0)>0&&<>
          <h4>Ingredients</h4>
          <ul className="recipe-detail-ingredients">
            {preview.recipe.document.recipe.ingredients!.map((ingredient,index)=><li key={index}>{ingredient}</li>)}
          </ul>
        </>}
        <h4>Method</h4>
        <ol className="recipe-detail-steps">
          {previewTasks.map(task=><li key={task.id}>
            <div className="between"><strong>{task.title}</strong><span className="muted small">{task.isCondition?'Check when ready':reviewDuration(preview.meal,task)==null?'Time unknown':formatDuration(reviewDuration(preview.meal,task)!)}</span></div>
            {task.instructions&&task.instructions!==task.title&&<p>{task.instructions}</p>}
          </li>)}
        </ol>
        {preview.recipe.document.recipe.source.reference&&<p className="muted small">Source: {preview.recipe.document.recipe.source.reference}</p>}
      </section>
    </>
    :<>
      <p className="muted small">Your saved recipes, ingredients and steps, ready to cook again.</p>
      {recipes.loading&&<p role="status">Loading recipes…</p>}
      {!recipes.loading&&!recipes.error&&recipes.recipes.length===0&&<p className="history-empty">No saved recipes yet. Save a method while reviewing a recipe to find it here.</p>}
      {recipes.recipes.length>0&&<>
        <label htmlFor="recipe-library-search">Find a recipe</label>
        <input id="recipe-library-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search recipe or equipment"/>
        <ul className="personal-recipe-list history-list">
          {shown.map(r=><li key={r.id} className="history-item">
            <div className="between">
              <div className="recipe-library-copy">
                <button type="button" className="recipe-title-link" disabled={recipes.busy} aria-label={'Edit '+r.document.name} onClick={()=>void open(r)}>{r.document.name}</button>
                <p className="muted small">{r.document.recipe.equipment.join(' · ')||'Custom method'}</p>
              </div>
              <span className="history-count">{stepCount(r)} steps</span>
            </div>
            <div className="history-actions">
              <button type="button" className="button primary" disabled={recipes.busy} onClick={()=>showPreview(r)}>View recipe</button>
              <button type="button" className="button secondary" disabled={recipes.busy} onClick={()=>useRecipe(r)}>Use recipe</button>
              <button type="button" className="button history-delete" disabled={recipes.busy} title="Remove recipe" aria-label={'Remove '+r.document.name} onClick={()=>remove(r)}>Remove</button>
            </div>
          </li>)}
          {!shown.length&&<li className="muted small">No matching recipes.</li>}
        </ul>
      </>}
    </>}
    {(error||recipes.error)&&<p role="alert" className="form-error">{error||recipes.error} <button type="button" className="link" disabled={recipes.busy} onClick={()=>{setError('');void recipes.reload();}}>Reload My recipes</button>{/changed|removed|pending recipe/.test(error||recipes.error)&&<button type="button" className="link" disabled={recipes.busy} onClick={()=>{if(window.confirm('Use the saved recipes? Your pending recipe change will be retained on this device.'))void recipes.useSavedVersion().then(()=>{setEditing(null);setPreview(null);setError('');}).catch(e=>setError(e.message));}}>Use saved version</button>}</p>}
  </section>;
}
