'use client';
import {useRef,useState} from 'react';
import {recipeDocumentForSave} from '@/account/recipeDraft';
import type {ExtendedMeal} from '@/domain/cookState';
import {recipeDocumentsEqual} from '@/account/personalRecipes';
import {convertRecipeReview} from '@/domain/documents/reviewAdapter';
import type {usePersonalRecipes} from '@/account/usePersonalRecipes';
export default function RecipeSaveButton({meal,recipes,onSignIn,onSaved,onProtected,initiallySaved=false,prepareMeal,hasOpenEdit=false,appearance='secondary',disabled=false}:{disabled?:boolean;appearance?:'secondary'|'link';prepareMeal?:()=>ExtendedMeal;hasOpenEdit?:boolean;initiallySaved?:boolean;onSaved?:()=>void;onProtected?:()=>void;meal:ExtendedMeal;recipes:ReturnType<typeof usePersonalRecipes>;onSignIn:(draft:ExtendedMeal)=>void}){
 const version=useRef('');
 const id=useRef<string|null>(null),[saved,setSaved]=useState(initiallySaved?JSON.stringify(meal):''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const fingerprint=JSON.stringify(meal),isSaved=saved===fingerprint&&!hasOpenEdit;
 if(!recipes.enabled)return null;
 return <div className="recipe-save-action"><button type="button" className={appearance==='link'?'link':'button secondary'} disabled={disabled||busy||recipes.busy||recipes.loading||(isSaved&&!hasOpenEdit)} onClick={async()=>{
  let draft:ExtendedMeal;try{draft=prepareMeal?.()??meal;}catch(e){setError(e instanceof Error?e.message:'Check this step.');return;}
  const fingerprint=JSON.stringify(draft);
  if(!recipes.authenticated){try{onSignIn(draft);}catch{setError('Could not protect this recipe draft for sign-in. Keep this review open and try again.');}return;}
  if(id.current===null||(saved&&version.current!==fingerprint)){id.current=crypto.randomUUID();version.current=fingerprint;}
  setBusy(true);setError('');try{const document=recipeDocumentForSave(draft,id.current);await recipes.save(document,undefined,onProtected);setSaved(fingerprint);onSaved?.();}catch(e){setError(e instanceof Error?e.message:'Could not save recipe.');}finally{setBusy(false);}
 }}>{busy?'Saving recipe…':isSaved?'Saved to My recipes':saved?'Save as new recipe':'Save to My recipes'}</button>
 {error&&<p className="form-error" role="alert">{error} <button type="button" className="link" onClick={()=>void recipes.reload().then(rows=>{if(Array.isArray(rows)){const recovered=rows.find(r=>r.id===id.current);const snapshot=JSON.parse(version.current);const expected=convertRecipeReview(snapshot,id.current??'missing');const same=recovered&&expected.status==='converted'&&recipeDocumentsEqual(recovered.document,expected.document);setSaved(same?version.current:'');id.current=null;setError(same?'':'The saved version changed or was removed. You can save your method as a new recipe.');}})}>Retry pending save</button></p>}</div>;
}
