import {it,expect,vi,afterEach} from 'vitest';
import {SavedPlanStore,savedPlanCacheKey} from '../src/account/SavedPlanStore';
import {newMeal} from '../src/domain/meal';
import {migrateMeal} from '../src/domain/cookState';
import {planDocument,type SavedPlanAPI,type SavedPlan} from '../src/account/savedPlans';
import {AccountConflict} from '../src/account/workspace';
const owner='discard-owner',at='2026-11-09T18:00:00Z';
const stores:SavedPlanStore[]=[];
afterEach(()=>{stores.forEach(s=>s.dispose());stores.length=0;vi.useRealTimers();});
function fixture(){
 const meal=migrateMeal(newMeal()),original:SavedPlan={id:meal.id,revision:1,...planDocument(meal),timeZone:'UTC',createdAt:at,updatedAt:at,writeId:null};
 const data=new Map<string,string>(),calls:{id:string;revision:number;writeId:string}[]=[];
 let remote:SavedPlan|null=structuredClone(original),fail=false,lose=false,full=false,verified=true;
 const receipts=new Set<string>();
 const api:SavedPlanAPI={list:async()=>remote?[remote]:[],read:async()=>remote,import:async()=>{throw Error('unused');},write:async()=>{throw Error('Discard must not write a replacement plan');},discard:async(id,revision,writeId)=>{
  calls.push({id,revision,writeId});if(fail)throw Error('Offline');
  if(!receipts.has(writeId)){if(!remote||remote.id!==id||remote.revision!==revision)throw new AccountConflict('Changed on another device');receipts.add(writeId);remote=null;}
  if(lose){lose=false;throw Error('Response lost');}
 }};
 const create=(readonly=false)=>{const s=new SavedPlanStore(owner,meal.id,api,{getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(full)throw Error('Storage full');data.set(k,v);}},()=>{},()=>verified,readonly);stores.push(s);return s;};
 return {original,data,calls,create,remote:()=>remote,fail:()=>{fail=true;},lose:()=>{lose=true;},full:()=>{full=true;},unverify:()=>{verified=false;},vanish:()=>{remote=null;},advance:()=>{remote={...original,revision:2};}};
}
it('retains the source until acknowledged discard and blocks later edits',async()=>{
 const f=fixture(),s=f.create();await s.connect();await s.discard();
 expect(f.calls).toHaveLength(1);expect(f.remote()).toBeNull();expect(s.state().discarded).toBe(true);expect(s.dirty()).toBe(false);
 expect(()=>s.edit(m=>({...m,name:'Resurrection'}))).toThrow();
 expect(JSON.parse(f.data.get(savedPlanCacheKey(owner,f.original.id))!).discard.confirmed).toBe(true);
});
it('replays one immutable discard receipt after a lost response and reload',async()=>{
 const f=fixture(),s=f.create();await s.connect();f.lose();await expect(s.discard()).rejects.toThrow('Response lost');
 expect(s.state().discarded).not.toBe(true);expect(s.dirty()).toBe(true);expect(f.remote()).toBeNull();s.dispose();
 const recovered=f.create();await recovered.connect();expect(recovered.state().discarded).toBe(true);
 expect(f.calls).toHaveLength(2);expect(f.calls[1]).toEqual(f.calls[0]);
});
it('offline failures retain the plan and its recovery journal',async()=>{
 const f=fixture(),s=f.create();await s.connect();f.fail();await expect(s.discard()).rejects.toThrow('Offline');
 expect(f.remote()).toEqual(f.original);expect(s.state().discarded).not.toBe(true);expect(s.dirty()).toBe(true);
});
it('a competing revision prevents discard without rebasing the user intent',async()=>{
 const f=fixture(),s=f.create();await s.connect();f.advance();await expect(s.discard()).rejects.toThrow(/changed on another device/i);
 expect(f.remote()?.revision).toBe(2);expect(s.state().phase).toBe('conflict');expect(s.state().discarded).not.toBe(true);
});
it('readonly, unverified and failed local journal writes never send discard',async()=>{
 for(const mode of ['readonly','unverified','storage'] as const){
  const f=fixture(),s=f.create(mode==='readonly');await s.connect();
  if(mode==='unverified')f.unverify();if(mode==='storage')f.full();
  await expect(s.discard()).rejects.toThrow();expect(f.calls).toHaveLength(0);expect(f.remote()).toEqual(f.original);
 }
});

it('does not discard a newer revision discovered after the user chose an older Home card',async()=>{
 const f=fixture();f.advance();const s=f.create();await s.connect();
 await expect(s.discard(1)).rejects.toThrow('changed on another device');
 expect(f.calls).toHaveLength(0);expect(f.remote()?.revision).toBe(2);expect(s.state().phase).toBe('conflict');
});

it('protects a malformed terminal journal instead of treating it as an acknowledged discard',async()=>{
 const f=fixture(),s=f.create();await s.connect();const key=savedPlanCacheKey(owner,f.original.id),raw=JSON.stringify({version:1,owner,planId:f.original.id,base:f.original,desired:null,operation:null,discard:{id:'bad',revision:1,confirmed:'yes'}});
 s.dispose();f.data.set(key,raw);const recovered=f.create();await recovered.connect();
 expect(recovered.state().phase).toBe('load-error');expect(recovered.state().discarded).not.toBe(true);expect(f.calls).toEqual([]);expect(f.data.get(key)).toBe(raw);
});


it('explicit discard resolves a retained draft after the remote plan was discarded without saving it again',async()=>{
 const f=fixture(),s=f.create();await s.connect();s.edit(m=>({...m,name:'Next cook',serveAt:'2026-11-15T18:00'}));s.dispose();f.vanish();
 const recovered=f.create();await recovered.connect();expect(recovered.dirty()).toBe(true);
 await recovered.discard();expect(recovered.state().discarded).toBe(true);expect(recovered.dirty()).toBe(false);expect(f.calls).toEqual([]);
 recovered.dispose();const reloaded=f.create();await reloaded.connect();expect(reloaded.state().discarded).toBe(true);expect(f.remote()).toBeNull();
});
it('explicit discard of unsent local changes does not flush them before discarding the saved revision',async()=>{
 const f=fixture(),s=f.create();await s.connect();s.edit(m=>({...m,name:'Protected edits'}));
 await s.discard();expect(f.calls).toHaveLength(1);expect(f.calls[0].revision).toBe(1);expect(s.state().discarded).toBe(true);
});

it('discards a never-saved local draft without any save or discard RPC',async()=>{
 const f=fixture();f.vanish();const key=savedPlanCacheKey(owner,f.original.id);
 f.data.set(key,JSON.stringify({version:1,owner,planId:f.original.id,base:null,desired:f.original.meal,operation:null}));
 const s=f.create();await s.discard();expect(s.state().discarded).toBe(true);expect(f.calls).toEqual([]);expect(s.dirty()).toBe(false);
});
it('a failed explicit discard keeps unsaved author work recoverable until acknowledgement',async()=>{
 const f=fixture(),s=f.create();await s.connect();s.edit(m=>({...m,name:'My unsaved method'}));f.fail();await expect(s.discard()).rejects.toThrow('Offline');
 expect(s.state().discarded).not.toBe(true);expect(s.recoveryExport()).toContain('My unsaved method');expect(f.remote()).toEqual(f.original);
});

it('keeps an acknowledged Home snapshot visible before the discard read while preserving its revision',async()=>{
 const f=fixture();const s=new SavedPlanStore(owner,f.original.id,{list:async()=>[f.original],read:async()=>f.original,write:async()=>{throw Error('No save');},import:async()=>{throw Error('unused');},discard:async()=>{}},{getItem:k=>f.data.get(k)??null,setItem:(k,v)=>{f.data.set(k,v);}},()=>{},()=>true,false,undefined,undefined,f.original);stores.push(s);
 expect(s.state().meal).toEqual(f.original.meal);expect(s.state().plan?.revision).toBe(1);expect(s.dirty()).toBe(false);await s.discard(1);expect(s.state().discarded).toBe(true);
});
