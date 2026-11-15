import {it,expect,vi} from 'vitest';
import {PersonalRecipeStore,recipePendingKey,type RecipeOperation,type PersonalRecipe} from '../src/account/personalRecipes';
import fixture from './fixtures/documents/brisket-v1.json';
import {parseCookingDocument} from '../src/domain/documents/cookingDocument';
import {readFileSync} from 'node:fs';
import schema from '../src/domain/documents/cooking-document-v1.schema.json';
function storage(){const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};}
const owner='owner-one',document=parseCookingDocument(fixture);if(document.type!=='recipe')throw Error();
const op:RecipeOperation={owner,id:document.id,revision:0,writeId:'operation-one',operation:'save',document};
const saved:PersonalRecipe={id:document.id,document,state:'active',revision:1,createdAt:'2026-11-11T00:00Z',updatedAt:'2026-11-11T00:00Z',deletedAt:null};
it('replays the immutable operation after a lost response and reload',async()=>{
 const local=storage(),seen:RecipeOperation[]=[];let lost=true;
 const api={list:async()=>[saved],mutate:async(o:RecipeOperation)=>{seen.push(structuredClone(o));if(lost){lost=false;throw Error('lost response');}return saved;}};
 const first=new PersonalRecipeStore(owner,api,local);await expect(first.write(op)).rejects.toThrow();expect(first.pending()).toEqual(op);
 const reloaded=new PersonalRecipeStore(owner,api,local);await expect(reloaded.write()).resolves.toEqual(saved);expect(seen).toEqual([op,op]);expect(reloaded.pending()).toBeNull();
});
it('protects writes from storage failure and cross-owner journal substitution',async()=>{
 let calls=0;const api={list:async()=>[],mutate:async()=>{calls++;return saved;}};
 const blocked=new PersonalRecipeStore(owner,api,{...storage(),setItem:()=>{throw Error('quota');}});await expect(blocked.write(op)).rejects.toThrow('quota');expect(calls).toBe(0);
 const local=storage();local.setItem(recipePendingKey(owner),JSON.stringify({...op,owner:'other'}));await expect(new PersonalRecipeStore(owner,api,local).write()).rejects.toThrow('Protected');expect(calls).toBe(0);
});
it('does not replace an ambiguous operation with an edited document or removal',async()=>{
 const local=storage();local.setItem(recipePendingKey(owner),JSON.stringify(op));let calls=0;
 const store=new PersonalRecipeStore(owner,{list:async()=>[],mutate:async()=>{calls++;return saved;}},local);
 await expect(store.write({...op,writeId:'other',operation:'remove',document:null,revision:1})).rejects.toThrow('pending');expect(store.pending()).toEqual(op);expect(calls).toBe(0);
});
it('keeps SQL validation pinned to the checked-in canonical JSON Schema',()=>{
 const migration=readFileSync('supabase/migrations/202611130001_personal_recipe_validation.sql','utf8');const embedded=migration.split('$schema$')[1];expect(JSON.parse(embedded)).toEqual(schema);
});
it('explicit conflict resolution retains the immutable draft before releasing its journal',async()=>{
 const local=storage();local.setItem(recipePendingKey(owner),JSON.stringify(op));const store=new PersonalRecipeStore(owner,{list:async()=>[],mutate:async()=>saved},local);
 await store.protectPendingConflict();expect(local.getItem(recipePendingKey(owner))).toBeNull();expect(JSON.parse(local.getItem(recipePendingKey(owner)+':protected:'+op.writeId)!)).toEqual(op);
});

it('does not confuse Node 22 navigator with a browser that lacks Web Locks',async()=>{
 vi.stubGlobal('navigator',{userAgent:'Node.js/22'});
 try{const local=storage(),store=new PersonalRecipeStore(owner,{list:async()=>[],mutate:async()=>saved},local);await expect(store.write(op)).resolves.toEqual(saved);}finally{vi.unstubAllGlobals();}
});
it('rejects browser writes without cross-tab locking before making an RPC',async()=>{
 vi.stubGlobal('window',{});vi.stubGlobal('navigator',{});let calls=0;
 try{const local=storage(),store=new PersonalRecipeStore(owner,{list:async()=>[],mutate:async()=>{calls++;return saved;}},local);await expect(store.write(op)).rejects.toThrow('cannot protect');expect(calls).toBe(0);expect(store.pending()).toBeNull();}finally{vi.unstubAllGlobals();}
});
it('recovers an ambiguous removal without resurrecting its retained document',async()=>{
 const local=storage(),removal:RecipeOperation={...op,operation:'remove',document:null,revision:1};let lost=true;const calls:RecipeOperation[]=[];
 const deleted:PersonalRecipe={...saved,state:'deleted',revision:2,deletedAt:'2026-11-11T01:00Z'};
 const api={list:async()=>[],mutate:async(o:RecipeOperation)=>{calls.push(structuredClone(o));if(lost){lost=false;throw Error('lost delete reply');}return deleted;}};
 await expect(new PersonalRecipeStore(owner,api,local).write(removal)).rejects.toThrow();expect(local.getItem(recipePendingKey(owner))).not.toBeNull();
 const recovered=await new PersonalRecipeStore(owner,api,local).write();expect(recovered.state).toBe('deleted');expect(recovered.document).toEqual(saved.document);expect(calls).toEqual([removal,removal]);expect(local.getItem(recipePendingKey(owner))).toBeNull();
});
it('hands an authoring draft over only after the immutable recipe operation is protected',async()=>{
 const local=storage(),steps:string[]=[];const store=new PersonalRecipeStore(owner,{list:async()=>[],mutate:async()=>{steps.push('rpc');throw Error('offline');}},local);
 await expect(store.write(op,()=>{expect(JSON.parse(local.getItem(recipePendingKey(owner))!)).toEqual(op);steps.push('protected');})).rejects.toThrow('offline');expect(steps).toEqual(['protected','rpc']);expect(store.pending()).toEqual(op);
});

import {loadPersonalRecipeLibrary} from '../src/account/personalRecipes';
it('loads saved recipes despite a rejected pending write and retains the exact protected operation',async()=>{
 const local=storage();local.setItem(recipePendingKey(owner),JSON.stringify(op));const before=local.getItem(recipePendingKey(owner)),failure=new Error('Server rejected recipe');const calls:string[]=[];
 const api={list:async()=>{calls.push('list');return [saved];},mutate:async()=>{calls.push('save');throw failure;}};
 const result=await loadPersonalRecipeLibrary(new PersonalRecipeStore(owner,api,local),api);expect(result.recipes).toEqual([saved]);expect(result.recoveryError).toBe(failure);expect(calls).toEqual(['save','list']);expect(local.getItem(recipePendingKey(owner))).toBe(before);
});
it('successful recovery reuses its operation and acknowledges it before reading the current library',async()=>{
 const local=storage();local.setItem(recipePendingKey(owner),JSON.stringify(op));const calls:string[]=[];
 const api={list:async()=>{calls.push('list');return [saved];},mutate:async(value:RecipeOperation)=>{expect(value).toEqual(op);calls.push('save');return saved;}};
 expect(await loadPersonalRecipeLibrary(new PersonalRecipeStore(owner,api,local),api)).toEqual({recipes:[saved],recoveryError:null});expect(calls).toEqual(['save','list']);expect(local.getItem(recipePendingKey(owner))).toBeNull();
});
it('does not claim a successful list when both recovery and reading fail',async()=>{
 const local=storage();local.setItem(recipePendingKey(owner),JSON.stringify(op));const readFailure=new Error('Library unavailable');
 const api={list:async()=>{throw readFailure;},mutate:async()=>{throw Error('Save unavailable');}};
 await expect(loadPersonalRecipeLibrary(new PersonalRecipeStore(owner,api,local),api)).rejects.toBe(readFailure);expect(local.getItem(recipePendingKey(owner))).toBe(JSON.stringify(op));
});
it('allows read-only access around an unreadable journal without dropping it or making a write',async()=>{
 const local=storage();local.setItem(recipePendingKey(owner),'protected unreadable data');let writes=0;
 const api={list:async()=>[saved],mutate:async()=>{writes++;return saved;}};
 const result=await loadPersonalRecipeLibrary(new PersonalRecipeStore(owner,api,local),api);expect(result.recipes).toEqual([saved]);expect(result.recoveryError).toBeInstanceOf(Error);expect(writes).toBe(0);expect(local.getItem(recipePendingKey(owner))).toBe('protected unreadable data');
});
