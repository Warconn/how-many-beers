import type {SupabaseClient} from '@supabase/supabase-js';
import {parseCookingDocument,type RecipeDocument} from '../domain/documents/cookingDocument';
export type PersonalRecipe={id:string;state:'active'|'deleted';document:RecipeDocument;revision:number;createdAt:string;updatedAt:string;deletedAt:string|null};
export type RecipeOperation={owner:string;id:string;revision:number;writeId:string;operation:'save'|'remove';document:RecipeDocument|null};
export type RecipeAPI={list:()=>Promise<PersonalRecipe[]>;mutate:(op:RecipeOperation)=>Promise<PersonalRecipe>};
export class RecipeUnavailable extends Error{}
export class RecipeConflict extends Error{}
export function parsePersonalRecipe(value:unknown):PersonalRecipe{
 const r=value as PersonalRecipe;if(!r||!['active','deleted'].includes(r.state)||typeof r.id!=='string'||!Number.isSafeInteger(r.revision)||r.revision<1||![r.createdAt,r.updatedAt].every(s=>typeof s==='string'&&Number.isFinite(Date.parse(s)))||(r.state==='deleted'?typeof r.deletedAt!=='string'||!Number.isFinite(Date.parse(r.deletedAt)):r.deletedAt!==null))throw Error('Invalid saved recipe.');
 const document=parseCookingDocument(r.document);if(document.type!=='recipe'||document.id!==r.id)throw Error('Recipe identity mismatch.');return {...r,document};
}
export function personalRecipeAPI(client:SupabaseClient,owner:string):RecipeAPI{
 const call=async(name:string,args:Record<string,unknown>)=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const {data,error}=await client.rpc(name,{expected_owner:owner,...args}).abortSignal(controller.signal);if(error){if(error.code==='PGRST202'||error.code==='42883')throw new RecipeUnavailable('Recipe saving is not available on this server yet.');if(error.code==='40001')throw new RecipeConflict('This recipe changed or was removed on another device. Reload My recipes before editing it.');throw Error('Could not save or load your recipes. Your draft is still here.');}return data;}finally{clearTimeout(timer);}
 };
 return {list:async()=>{const data=await call('list_personal_recipes',{});if(!Array.isArray(data?.recipes))throw new RecipeUnavailable('Recipe saving is not available on this server yet.');return data.recipes.map(parsePersonalRecipe).filter((r:PersonalRecipe)=>r.state==='active');},mutate:async op=>{
  if(op.owner!==owner)throw Error('Recipe belongs to another account.');const data=await call('mutate_personal_recipe',{target_recipe_id:op.id,expected_revision:op.revision,write_id:op.writeId,operation:op.operation,document:op.document});
  if(data?.receipt?.operationId!==op.writeId||data.receipt.recipeId!==op.id||data.receipt.operation!==op.operation)throw Error('Recipe write has not been confirmed. Retry without closing your draft.');const result=parsePersonalRecipe(data);if(op.operation==='save'&&result.state==='active'&&JSON.stringify(canonical(result.document))!==JSON.stringify(canonical(op.document)))throw new RecipeConflict('This recipe has newer changes. Reload My recipes before saving another version.');return result;
 }};
}
export const recipePendingKey=(owner:string)=>`how-many-beers:recipes:v1:${owner}:operation`;
/** Immutable write-ahead operation, owner-scoped and replayed after lost replies. */
export class PersonalRecipeStore{
 private running=false;
 async protectPendingConflict():Promise<void>{
  if(typeof navigator!=='undefined'&&!navigator.locks)throw Error('This browser cannot protect recipe changes between tabs. Use a current browser.');
  const work=async()=>{const pending=this.pending();if(!pending)return;const key=recipePendingKey(this.owner),raw=JSON.stringify(pending);
   if(this.storage.getItem(key)!==raw)throw Error('Recipe recovery changed. Reload first.');
   this.storage.setItem(key+':protected:'+pending.writeId,raw);
   if(this.storage.getItem(key+':protected:'+pending.writeId)!==raw)throw Error('Could not protect the pending change.');
   this.storage.removeItem(key);
  };
  if(typeof navigator!=='undefined'&&navigator.locks)await navigator.locks.request(recipePendingKey(this.owner),work);else await work();
 }

 constructor(readonly owner:string,private api:RecipeAPI,private storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>){}
 pending():RecipeOperation|null{
  const raw=this.storage.getItem(recipePendingKey(this.owner));if(raw===null)return null;
  const op=JSON.parse(raw) as RecipeOperation;
  if(!op||op.owner!==this.owner||!['save','remove'].includes(op.operation)||typeof op.id!=='string'||typeof op.writeId!=='string'||!Number.isSafeInteger(op.revision)||op.revision<0)throw Error('Protected recipe operation could not be read.');
  if(op.operation==='save'){const d=parseCookingDocument(op.document);if(d.type!=='recipe'||d.id!==op.id)throw Error('Invalid protected recipe.');}else if(op.document!==null||op.revision<1)throw Error('Invalid protected removal.');return op;
 }
 async write(op?:RecipeOperation):Promise<PersonalRecipe>{
  if(this.running)throw Error('A recipe action is still saving.');
  if(typeof navigator!=='undefined'&&!navigator.locks)throw Error('This browser cannot protect recipe changes between tabs. Use a current browser.');
  this.running=true;
  const work=async()=>{
   let pending=this.pending();
   if(pending&&op&&JSON.stringify(pending)!==JSON.stringify(op))throw Error('Retry the pending recipe action before saving another version.');
   if(!pending){if(!op||op.owner!==this.owner)throw Error('No pending recipe action.');this.storage.setItem(recipePendingKey(this.owner),JSON.stringify(op));pending=this.pending();}
   if(!pending)throw Error('Could not protect this recipe write.');
   const result=await this.api.mutate(pending);
   if(this.storage.getItem(recipePendingKey(this.owner))!==JSON.stringify(pending))throw Error('Recipe recovery changed in another tab. Reload My recipes.');
   this.storage.removeItem(recipePendingKey(this.owner));return result;
  };
  try{return typeof navigator!=='undefined'&&navigator.locks?await navigator.locks.request(recipePendingKey(this.owner),work):await work();}finally{this.running=false;}
 }
}

function canonical(value:unknown):unknown{return Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value;}

export const recipeDocumentsEqual=(a:unknown,b:unknown)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
