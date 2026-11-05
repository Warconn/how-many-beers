import {afterEach, describe, expect, it} from 'vitest';
import {AccountCookStore, accountCacheKey} from '../src/account/AccountCookStore';
import {AccountConflict, parseRemote, type CancellationReceipt, type Remote, type WorkspaceAPI} from '../src/account/workspace';
import {createDish, newMeal} from '../src/domain/meal';
import {migrateMeal, recordEvent} from '../src/domain/cookState';
import {archiveCook, emptyHistory} from '../src/domain/cookHistory';

const owner='00000000-0000-4000-8000-000000000001';
const at='2026-11-04T18:00:00.000Z';
const copy=<T>(v:T):T=>structuredClone(v);
const stores:AccountCookStore[]=[];
afterEach(()=>stores.splice(0).forEach(s=>s.dispose()));
function fixture(){
 const dish=createDish('brats');
 const original=recordEvent(migrateMeal({...newMeal(),name:'Keep my observations',dishes:[dish],mode:'cooking',startedAt:at}),dish.id+':prep','completed',at);
 const history=archiveCook({...newMeal(),name:'Earlier dinner',dishes:[createDish('side')]},emptyHistory(),'Preserve this history','2026-11-03T18:00Z');
 let remote:Remote={revision:1,writeId:null,active:{meal:copy(original),serveInstant:null},history:history.cooks.map(c=>({...c,serveInstant:null})),capabilities:{cancelCook:true}};
 const values=new Map<string,string>(),retained=new Map<string,Remote['active']>(),receipts=new Map<string,CancellationReceipt>();
 const calls:{kind:'save'|'cancel';id:string;cookId?:string}[]=[];
 let fail=false,lose=false,wrongReceipt=false,storageFull=false,authenticated=true;
 const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{if(storageFull)throw Error('Recovery storage full');values.set(k,v);}};
 const api:WorkspaceAPI={
  read:async()=>copy(remote),
  write:async(revision,id,document)=>{
   calls.push({kind:'save',id});
   if(revision!==remote.revision)throw new AccountConflict('Newer workspace');
   remote={...copy(document),revision:revision+1,writeId:id,capabilities:{cancelCook:true}};
   return copy(remote);
  },
  cancel:async(revision,id,cookId)=>{
   calls.push({kind:'cancel',id,cookId});
   if(fail)throw Error('Cancellation offline');
   let receipt=receipts.get(id);
   if(receipt&&receipt.cookId!==cookId)throw Error('Operation target mismatch');
   if(!receipt){
    if(revision!==remote.revision||remote.active?.meal.id!==cookId)throw new AccountConflict('Newer workspace');
    retained.set(cookId,copy(remote.active));
    receipt={operationId:id,cookId,canceledAt:at};receipts.set(id,receipt);
    remote={...remote,revision:remote.revision+1,writeId:id,active:null};
   }
   if(lose){lose=false;throw Error('Cancellation response lost');}
   return {...copy(remote),cancellation:{...receipt,...(wrongReceipt?{operationId:'unrelated-operation'}:{})}};
  },
 };
 const store=(custom=api,who=owner)=>{const s=new AccountCookStore(who,custom,storage,()=>{},()=>authenticated);stores.push(s);return s;};
 return {original,history,api,store,calls,values,retained,get:()=>copy(remote),set:(v:Remote)=>{remote=copy(v);},fail:(v=true)=>{fail=v;},lose:()=>{lose=true;},wrong:(v=true)=>{wrongReceipt=v;},storageFull:(v=true)=>{storageFull=v;},authenticated:(v:boolean)=>{authenticated=v;}};
}
describe('account retained cancellation',()=>{
 it('waits for ordinary edits and authoritative cancellation before clearing the current cook',async()=>{
  const f=fixture(),s=f.store();await s.connect();
  s.edit(m=>({...m,notes:{...m.notes,observed:'Smoker at 250'}}));
  await s.cancel(f.original.id);
  expect(f.calls.map(c=>c.kind)).toEqual(['save','cancel']);
  expect(f.retained.get(f.original.id)?.meal.notes.observed).toBe('Smoker at 250');
  expect(f.retained.get(f.original.id)?.meal.events).toEqual(f.original.events);
  expect(f.retained.get(f.original.id)?.meal.completed).toEqual(f.original.completed);
  expect(f.get().active).toBeNull();
  expect(s.state().snapshot!.active.id).not.toBe(f.original.id);
  expect(s.state().snapshot!.history).toEqual(f.history);
  expect(s.state().phase).toBe('saved');expect(s.dirty()).toBe(false);
  await s.save({active:migrateMeal({...newMeal(),name:'Next dinner'})});
  expect(f.get().active?.meal.name).toBe('Next dinner');
  expect(f.retained.get(f.original.id)?.meal.events).toEqual(f.original.events);
 });
 it('keeps cancellation capability disabled on older servers without issuing an RPC',async()=>{
  const f=fixture();f.set({...f.get(),capabilities:undefined});const s=f.store();await s.connect();
  expect(s.state().canCancel).toBe(false);
  await expect(s.cancel(f.original.id)).rejects.toThrow('not available');
  expect(f.calls).toHaveLength(0);expect(s.state().snapshot!.active).toEqual(f.original);
 });
 it('retains the old active cook and retries the same cancellation after an offline failure',async()=>{
  const f=fixture(),s=f.store();await s.connect();f.fail();
  await expect(s.cancel(f.original.id)).rejects.toThrow('offline');
  expect(s.state().phase).toBe('blocked');expect(s.state().snapshot!.active).toEqual(f.original);expect(s.dirty()).toBe(true);
  await expect(s.save({active:newMeal()})).rejects.toThrow('Resolve');
  f.fail(false);await s.cancel(f.original.id);
  expect(f.calls.map(c=>c.kind)).toEqual(['cancel','cancel']);
  expect(f.calls[0].id).toBe(f.calls[1].id);expect(s.state().phase).toBe('saved');
  expect(s.state().snapshot!.history).toEqual(f.history);
 });
 it('recovers a lost response after a newer cook exists without canceling that newer cook or replaying a save',async()=>{
  const f=fixture(),s=f.store();await s.connect();f.lose();
  await expect(s.cancel(f.original.id)).rejects.toThrow('response lost');
  s.dispose();
  const nextMeal=migrateMeal({...newMeal(),name:'New cook from another device',dishes:[createDish('wings')]});
  f.set({...f.get(),revision:3,writeId:crypto.randomUUID(),active:{meal:nextMeal,serveInstant:null}});
  const restored=f.store();await restored.connect();
  expect(restored.state().phase).toBe('blocked');expect(restored.state().snapshot!.active).toEqual(f.original);
  expect(f.calls).toHaveLength(1);
  await restored.retry();
  expect(f.calls.map(c=>c.kind)).toEqual(['cancel','cancel']);expect(f.calls[0].id).toBe(f.calls[1].id);
  expect(f.retained.size).toBe(1);expect(f.get().active!.meal).toEqual(nextMeal);
  expect(restored.state().snapshot!.active).toEqual(nextMeal);expect(restored.state().phase).toBe('saved');
 });
 it('does not acknowledge cancellation without the exact target and operation receipt',async()=>{
  const f=fixture(),s=f.store();await s.connect();f.wrong();
  await expect(s.cancel(f.original.id)).rejects.toThrow('not been confirmed');
  expect(s.state().phase).toBe('blocked');expect(s.state().backup!.active).toEqual(f.original);
  f.wrong(false);await s.retry();expect(s.state().phase).toBe('saved');expect(f.retained.size).toBe(1);
 });
 it('blocks stale cancellation and keeps a recovery copy instead of canceling another device’s cook',async()=>{
  const f=fixture(),s=f.store();await s.connect();
  const other=migrateMeal({...newMeal(),name:'Other device'});
  f.set({...f.get(),revision:2,active:{meal:other,serveInstant:null}});
  await expect(s.cancel(f.original.id)).rejects.toBeInstanceOf(AccountConflict);
  expect(s.state().phase).toBe('conflict');expect(s.state().backup!.active).toEqual(f.original);expect(f.retained.size).toBe(0);
  expect(f.get().active!.meal).toEqual(other);await s.reload();expect(s.state().snapshot!.active).toEqual(other);
 });
 it('never sends cancellation when its recovery journal cannot be stored or identity is unverified',async()=>{
  const f=fixture(),s=f.store();await s.connect();f.storageFull();
  await expect(s.cancel(f.original.id)).rejects.toThrow('storage full');expect(f.calls).toHaveLength(0);
  expect(s.state().phase).toBe('blocked');f.storageFull(false);f.authenticated(false);
  await expect(s.retry()).rejects.toThrow('Reconnect');expect(f.calls).toHaveLength(0);
  expect(s.state().snapshot!.active).toEqual(f.original);f.authenticated(true);await s.retry();expect(f.retained.size).toBe(1);
 });
 it('protects a corrupt recovery target from replay instead of canceling a different cook',async()=>{
  const f=fixture(),s=f.store();await s.connect();f.fail();
  await expect(s.cancel(f.original.id)).rejects.toThrow();s.dispose();
  const key=accountCacheKey(owner),cache=JSON.parse(f.values.get(key)!);cache.operation.cookId=crypto.randomUUID();f.values.set(key,JSON.stringify(cache));
  const restored=f.store();await restored.connect();expect(restored.state().phase).toBe('load-error');
  expect(f.calls).toHaveLength(1);expect(f.retained.size).toBe(0);
 });
 it('preserves owner separation when a pending cancellation belongs to another account',async()=>{
  const f=fixture(),s=f.store();await s.connect();f.fail();await expect(s.cancel(f.original.id)).rejects.toThrow();s.dispose();
  const otherOwner='00000000-0000-4000-8000-000000000002';
  const other=f.store({read:async()=>({revision:0,writeId:null,active:null,history:[],capabilities:{cancelCook:true}}),write:async()=>{throw Error('Not expected');},cancel:async()=>{throw Error('Not expected');}},otherOwner);
  await other.connect();expect(other.state().phase).toBe('saved');expect(other.state().snapshot!.active.id).not.toBe(f.original.id);
  expect(other.dirty()).toBe(false);expect(f.values.get(accountCacheKey(owner))).toContain('"kind":"cancel"');expect(f.calls).toHaveLength(1);
 });
 it('rejects malformed capability or cancellation metadata from remote data',()=>{
  const f=fixture();expect(()=>parseRemote({...f.get(),capabilities:{cancelCook:'yes'}})).toThrow('capabilities');
  expect(()=>parseRemote({...f.get(),cancellation:{operationId:'x',cookId:'y',canceledAt:'invalid'}})).toThrow('receipt');
 });
});
