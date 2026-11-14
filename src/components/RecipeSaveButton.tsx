'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {recipeDocumentForSave} from '@/account/recipeDraft';
import {RecipeConflict} from '@/account/personalRecipes';
import type {usePersonalRecipes} from '@/account/usePersonalRecipes';
import type {ExtendedMeal} from '@/domain/cookState';
import {createDish} from '@/domain/meal';
import {recipeReview} from '@/domain/recipeReview';
import {copyRecipeName,documentFingerprint,recipeContent,recipeFingerprint,reusableReview,type RecipeLink,type RecipeSaveIntent} from '@/domain/recipeLink';

type Props={meal:ExtendedMeal;recipes:ReturnType<typeof usePersonalRecipes>;onSignIn:(draft:ExtendedMeal)=>void;onLinkChange:(link:RecipeLink,renameFrom?:string)=>Promise<void>;onSaved?:()=>void;onProtected?:()=>void;prepareMeal?:()=>ExtendedMeal;hasOpenEdit?:boolean;disabled?:boolean;mode?:'review'|'planning'|'library';onCopying?:(open:boolean)=>void};
/** One explicit destination per save. Acknowledged source identity is persisted
 * with the meal; an intent precedes the RPC so retries never mint duplicates. */
export default function RecipeSaveButton({meal,recipes,onSignIn,onLinkChange,onSaved,onProtected,prepareMeal,hasOpenEdit=false,disabled=false,mode='review',onCopying}:Props){
 const originalSelectId=useId();
 const dish=meal.dishes[0],link=dish.recipeLink,owner=recipes.ownerId;
 const [fingerprint,setFingerprint]=useState<string|null>(null),[templateClean,setTemplateClean]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false),[associating,setAssociating]=useState(false),[selectedOriginal,setSelectedOriginal]=useState(''),[copying,setCopying]=useState(false),[copyName,setCopyName]=useState('');
 const generation=useRef(0),latest=useRef({onLinkChange,link});latest.current={onLinkChange,link};
 const key=JSON.stringify(meal);
 useEffect(()=>{let active=true;setFingerprint(null);void recipeFingerprint(meal).then(hash=>{if(active)setFingerprint(hash);}).catch(()=>{if(active)setFingerprint('unsupported');});
  try{setTemplateClean(dish.preset!=='custom'&&recipeContent(meal)===recipeContent(recipeReview(createDish(dish.preset),'2030-01-01T13:00:00Z')));}catch{setTemplateClean(false);}
  return()=>{active=false;};
 },[key]);
 useEffect(()=>{generation.current++;return()=>{generation.current++;};},[owner]);
 const own=!!owner&&link?.ownerId===owner,record=own?recipes.recipes.find(r=>r.id===link.id):undefined;
 const pending=own?(link.pending??(link.revision===0?{id:link.id,revision:0,name:link.name,fingerprint:link.fingerprint,renameFrom:dish.name}:undefined)):undefined;
 // Reconcile only a known durable intent, never a guessed name/content match.
 useEffect(()=>{
  if(!pending||busy||recipes.loading||recipes.busy)return;
  const row=recipes.recipes.find(r=>r.id===pending.id);if(!row||row.revision!==pending.revision+1)return;
  const version=generation.current;let active=true;
  void documentFingerprint(row.document).then(async hash=>{if(!active||hash!==pending.fingerprint||version!==generation.current)return;
   await latest.current.onLinkChange({ownerId:owner!,id:row.id,revision:row.revision,name:row.document.name,fingerprint:hash},pending.renameFrom);setError('');
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Could not restore the recipe link.');});
  return()=>{active=false;};
 },[pending?.id,pending?.fingerprint,recipes.recipes,recipes.loading,recipes.busy,owner,busy]);
 const dirty=hasOpenEdit||fingerprint!==null&&(!link||link.revision===0||fingerprint!==link.fingerprint);
 const unchanged=!!link&&link.revision>0&&!dirty;
 const unavailable=!!link&&link.revision>0&&(!own||!record||record.revision!==link.revision||record.document.name!==link.name);
 const canSave=dirty&&(!templateClean||!!link||hasOpenEdit)||!!pending;
 const copy=(open:boolean)=>{setCopying(open);onCopying?.(open);};
 const perform=async(asCopy:boolean)=>{
  const version=generation.current;setBusy(true);setError('');
  try{
   const snapshot=prepareMeal?.()??meal;
   if(!recipes.authenticated||!owner){onSignIn(snapshot);return;}
   if(asCopy&&(!copyName.trim()||recipes.recipes.some(r=>r.document.name.trim().toLowerCase()===copyName.trim().toLowerCase())))throw Error('Choose a different name for the copy.');
   if(!asCopy&&!own&&recipes.recipes.some(r=>r.document.name.trim().toLowerCase()===snapshot.dishes[0].name.trim().toLowerCase())){setAssociating(true);return;}
   if(!asCopy&&link?.revision&&(!own||!record||record.revision!==link.revision||record.document.name!==link.name))throw Error('The original recipe changed or was removed. Your meal is unchanged; save a copy or open My recipes.');
   if(pending&&asCopy){if(conflict)await recipes.useSavedVersion();else throw Error('Retry the pending recipe save before creating a copy.');}
   const intent:RecipeSaveIntent=!asCopy&&pending?structuredClone(pending):{id:asCopy||!own?crypto.randomUUID():link!.id,revision:asCopy||!own?0:link!.revision,name:asCopy?copyName.trim():snapshot.dishes[0].name,fingerprint:'',renameFrom:snapshot.dishes[0].name};
   const review=reusableReview(snapshot);review.dishes[0].name=intent.name;review.customTasks=review.customTasks?.map(t=>({...t,dishName:intent.name}));
   const document=recipeDocumentForSave(review,intent.id),hash=await documentFingerprint(document);
   if(!asCopy&&pending&&hash!==pending.fingerprint)throw Error('Retry the pending recipe save before saving newer edits. Your edits are retained.');
   intent.fingerprint=hash;
   if(version!==generation.current)throw Error('Your account changed. Reopen the recipe.');
   const baseline:RecipeLink=own?link!:{ownerId:owner,id:intent.id,revision:0,name:intent.name,fingerprint:intent.fingerprint};
   await onLinkChange({...baseline,pending:intent});
   const original=intent.revision>0?recipes.recipes.find(r=>r.id===intent.id):undefined;
   if(intent.revision>0&&!original)throw Error('The original recipe is no longer available. Your edits are retained.');
   const saved=await recipes.save(document,original?{...original,revision:intent.revision}:undefined,onProtected);
   if(version!==generation.current)throw Error('Your account changed. Reopen the recipe.');
   await onLinkChange({ownerId:owner,id:saved.id,revision:saved.revision,name:saved.document.name,fingerprint:intent.fingerprint},intent.renameFrom);
   copy(false);setConflict(false);onSaved?.();
  }catch(e){setConflict(e instanceof RecipeConflict);setError(e instanceof Error?e.message:'Could not save this recipe. Your edits are retained.');}finally{setBusy(false);}
 };
 if(!recipes.enabled)return null;
 if(!canSave&&!copying&&!associating&&!error)return link?.revision?<p className="muted small recipe-save-status">Saved recipe</p>:null;
 const locked=disabled||busy||recipes.busy||recipes.loading||fingerprint===null||!!(pending&&recipes.recipes.some(r=>r.id===pending.id&&r.revision===pending.revision+1));
 return <div className={'recipe-save-action'+(mode==='planning'?' recipe-plan-actions':'')} aria-busy={busy}>
 {associating?<form aria-label="Choose original recipe" onSubmit={e=>{e.preventDefault();void(async()=>{setBusy(true);try{const version=generation.current;const row=recipes.recipes.find(r=>r.id===selectedOriginal);if(!row||!owner)throw Error('Choose a saved recipe.');const hash=await documentFingerprint(row.document);if(version!==generation.current)throw Error('Your account changed. Reopen the recipe.');await onLinkChange({ownerId:owner,id:row.id,revision:row.revision,name:row.document.name,fingerprint:hash});setAssociating(false);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not link this recipe.');}finally{setBusy(false);}})();}}>
  <p>A recipe with this name already exists. Choose its original to update, or save a separately named copy.</p>
  <label htmlFor={originalSelectId}>Original recipe</label><select id={originalSelectId} value={selectedOriginal} onChange={e=>setSelectedOriginal(e.target.value)}><option value="">Choose a saved recipe</option>{recipes.recipes.map(r=><option key={r.id} value={r.id}>{r.document.name}</option>)}</select>
  <div className="method-review-actions"><button type="submit" className="button primary" disabled={locked||!selectedOriginal}>Link original recipe</button><button type="button" className="button secondary" disabled={locked} onClick={()=>{setAssociating(false);setCopyName(copyRecipeName(dish.name,recipes.recipes.map(r=>r.document.name)));copy(true);}}>Save as copy</button></div>
 </form>:unchanged&&!copying?<p className="muted small recipe-save-status">Saved recipe</p>:copying?<form aria-label="Save recipe copy" onSubmit={e=>{e.preventDefault();void perform(true);}}>
  <label>Copy name<input autoFocus maxLength={80} value={copyName} onChange={e=>setCopyName(e.target.value)} disabled={locked}/></label>
  <div className="method-review-actions"><button type="submit" className="button primary" disabled={locked}>Save copy</button><button type="button" className="link" disabled={busy||recipes.busy} onClick={()=>copy(false)}>Cancel copy</button></div>
 </form>:<div className="method-review-actions recipe-save-buttons">
  {!unavailable&&<button type="button" className={'button '+(mode==='review'?'secondary':'primary')} disabled={locked} onClick={()=>void perform(false)}>{busy?'Saving recipe…':mode==='library'?'Save changes':link?.revision?'Update original recipe':'Save to My recipes'}</button>}
  {!!link?.revision&&<button type="button" className="button secondary" disabled={locked} onClick={()=>{setCopyName(copyRecipeName(dish.name,recipes.recipes.map(r=>r.document.name)));copy(true);}}>Save as copy</button>}
 </div>}
 {unavailable&&dirty&&<p className="muted small">The original recipe changed or is unavailable. Your meal keeps its own copy.</p>}
 {error&&<p role="alert" className="form-error">{error} <button type="button" className="link" disabled={busy||recipes.busy} onClick={()=>void recipes.reload()}>Retry pending save</button></p>}
 </div>;
}
