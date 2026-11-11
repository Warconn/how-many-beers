'use client';
import {useEffect,useRef,useState} from 'react';
import {useAccount} from '@/auth/AccountProvider';
import {personalRecipeAPI,PersonalRecipeStore,type PersonalRecipe,type RecipeOperation} from './personalRecipes';
import type {RecipeDocument} from '@/domain/documents/cookingDocument';
export function usePersonalRecipes(){
 const {phase,ownerId,client}=useAccount();
 const [state,setState]=useState<{owner:string|null;recipes:PersonalRecipe[];error:string;loading:boolean;busy:boolean}>({owner:null,recipes:[],error:'',loading:false,busy:false});
 const generation=useRef(0),store=useRef<PersonalRecipeStore|null>(null);
 const authenticated=phase==='authenticated'&&!!ownerId;
 const reload=async()=>{
  const version=++generation.current;store.current=null;
  if(!authenticated||!client||!ownerId){setState({owner:null,recipes:[],error:'',loading:false,busy:false});return;}
  const owner=ownerId;setState({owner,recipes:[],error:'',loading:true,busy:false});
  try{const api=personalRecipeAPI(client,owner),next=new PersonalRecipeStore(owner,api,window.localStorage);store.current=next;
   if(next.pending())await next.write();const recipes=await api.list();if(version===generation.current)setState({owner,recipes,error:'',loading:false,busy:false});return recipes;
  }catch(e){if(version===generation.current)setState({owner,recipes:[],error:e instanceof Error?e.message:'Could not load recipes.',loading:false,busy:false});return false;}
 };
 useEffect(()=>{void reload();return ()=>{generation.current++;store.current=null;};},[phase,ownerId,client]); // owner verification precedes every action
 const useSavedVersion=async()=>{
  const current=store.current;if(!authenticated||!current||current.owner!==ownerId)throw Error('Verify your account first.');
  await current.protectPendingConflict();return reload();
 };
 const mutate=async(operation:'save'|'remove',document:RecipeDocument|null,recipe?:PersonalRecipe,onProtected?:()=>void)=>{
  const current=store.current,version=generation.current;if(!authenticated||!current||current.owner!==ownerId)throw Error('Sign in to save recipes.');
  setState(s=>({...s,busy:true,error:''}));
  try{const pending=current.pending();
   const op:RecipeOperation=pending??{owner:current.owner,id:recipe?.id??document!.id,revision:recipe?.revision??0,writeId:crypto.randomUUID(),operation,document};
   if(pending&&(pending.operation!==operation||pending.id!==(recipe?.id??document?.id)||JSON.stringify(pending.document)!==JSON.stringify(document)))throw Error('Retry the pending recipe action before saving another version.');
   const result=await current.write(op,()=>{if(version!==generation.current)throw Error('Your account changed.');onProtected?.();});if(version!==generation.current)throw Error('Your account changed. Reopen My recipes.');
   setState(s=>({...s,recipes:[...(result.state==='active'?[result]:[]),...s.recipes.filter(r=>r.id!==result.id)],busy:false}));
   if(operation==='save'&&result.state!=='active')throw Error('This recipe was removed on another device.');return result;
  }catch(e){if(version===generation.current)setState(s=>({...s,busy:false,error:e instanceof Error?e.message:'Could not save recipe.'}));throw e;}
 };
 return {recipes:state.owner===ownerId?state.recipes:[],error:state.owner===ownerId?state.error:'',loading:state.loading,busy:state.busy,authenticated,guest:phase==='guest',enabled:phase!=='disabled',reload,useSavedVersion,save:(doc:RecipeDocument,original?:PersonalRecipe,onProtected?:()=>void)=>mutate('save',doc,original,onProtected),remove:(r:PersonalRecipe)=>mutate('remove',null,r)};
}
