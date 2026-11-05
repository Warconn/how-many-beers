import {afterEach,describe,it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {SavedPlanStore,savedPlanCacheKey} from '../src/account/SavedPlanStore';
import {AccountCookStore} from '../src/account/AccountCookStore';
import {AccountConflict,equal,type Remote,type WorkspaceAPI} from '../src/account/workspace';
import {createDish,newMeal} from '../src/domain/meal';
import {migrateMeal,type ExtendedMeal} from '../src/domain/cookState';
import {emptyHistory} from '../src/domain/cookHistory';
import {exportSavedPlans,validateSavedPlansBackup,planDocument,planMeal,planTimeZone,parseSavedPlan,savedPlanAPI,type SavedPlan,type SavedPlanAPI} from '../src/account/savedPlans';

const owner='00000000-0000-4000-8000-000000000001',at='2026-11-04T18:00:00Z';
const copy=<T>(v:T):T=>structuredClone(v);
const stores:{dispose:()=>void}[]=[];
afterEach(()=>{stores.splice(0).forEach(s=>s.dispose());vi.unstubAllEnvs();});
const make=(name:string):ExtendedMeal=>migrateMeal({...newMeal(),name,serveAt:'2026-11-08T18:00',dishes:[createDish('brats')]});
function plan(meal=make('Sunday brats'),revision=1):SavedPlan{return {...planDocument(meal),meal,id:meal.id,revision,timeZone:'UTC',createdAt:at,updatedAt:at,writeId:crypto.randomUUID()};}
function fixture(initial:SavedPlan[]=[]){
 const records=new Map(initial.map(p=>[p.id,copy(p)])),values=new Map<string,string>(),receipts=new Map<string,{planId:string;document:unknown}>();
 const calls:{id:string;revision:number;writeId:string}[]=[];
 let fail=false,lose=false,storageFull=false,verified=true;
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,v:string)=>{if(storageFull)throw Error('Recovery storage full');values.set(key,v);}};
 const api:SavedPlanAPI={
  list:async()=>[...records.values()].map(copy),read:async id=>copy(records.get(id)??null),
  write:async(id,revision,writeId,document,timeZone)=>{
   calls.push({id,revision,writeId});if(fail)throw Error('Plan is offline');
   const oldReceipt=receipts.get(writeId),old=records.get(id);
   if(oldReceipt){if(oldReceipt.planId!==id||!equal(oldReceipt.document,document))throw Error('Write ID reused');if(!old)throw new AccountConflict('No longer upcoming');}
   else{
    if((old?.revision??0)!==revision)throw new AccountConflict('Another device edited this plan');
    records.set(id,{...copy(document),meal:copy(document.meal),id,revision:revision+1,timeZone,createdAt:old?.createdAt??at,updatedAt:at,writeId});
    receipts.set(writeId,{planId:id,document:copy(document)});
   }
   if(lose){lose=false;throw Error('Plan response lost');}
   return {...copy(records.get(id)!),writeReceipt:{operationId:writeId,planId:id}};
  },import:async()=>{throw Error('Not used by document store');},
 };
 const store=(id:string,seed?:ExtendedMeal,who=owner,readonly=false,custom=api)=>{
  const s=new SavedPlanStore(who,id,custom,storage,()=>{},()=>verified,readonly,seed);stores.push(s);return s;
 };
 return {records,values,storage,api,calls,store,fail:(v=true)=>{fail=v;},lose:()=>{lose=true;},storageFull:(v=true)=>{storageFull=v;},verify:(v:boolean)=>{verified=v;}};
}
describe('isolated saved-plan recovery',()=>{
 it('saves two independent documents without changing the other plan or its revision',async()=>{
  const a=plan(make('Sunday')),b=plan(make('Tuesday')),f=fixture([a,b]),s=f.store(a.id);await s.connect();
  s.edit(m=>({...m,name:'Sunday dinner',serveAt:'2026-11-09T19:00'}));await s.flush();
  expect(f.records.get(a.id)?.meal.name).toBe('Sunday dinner');expect(f.records.get(b.id)).toEqual(b);
  expect(f.calls.map(c=>c.id)).toEqual([a.id]);expect(s.state().phase).toBe('saved');
  expect(()=>s.edit(m=>({...m,id:b.id}))).toThrow('Upcoming plans');
 });
 it('journals new plan creation by its own identity before claiming it is saved',async()=>{
  const meal=make('A new upcoming cook'),f=fixture(),s=f.store(meal.id,meal);
  expect(f.values.get(savedPlanCacheKey(owner,meal.id))).toContain('A new upcoming cook');
  expect(f.records.size).toBe(0);await s.connect();await s.flush();
  expect(s.state().plan?.revision).toBe(1);expect(f.records.get(meal.id)?.meal).toEqual(meal);expect(s.dirty()).toBe(false);
 });
 it('keeps a draft across reload/offline failures and retries its original write ID',async()=>{
  const p=plan(),f=fixture([p]),s=f.store(p.id);await s.connect();s.edit(m=>({...m,name:'Keep my draft'}));f.fail();
  await expect(s.flush()).rejects.toThrow('offline');expect(s.state().phase).toBe('unsaved');s.dispose();
  const next=f.store(p.id);await next.connect();expect(next.state().meal?.name).toBe('Keep my draft');
  f.fail(false);await next.retry();expect(f.calls[0].writeId).toBe(f.calls[1].writeId);
  expect(next.state().phase).toBe('saved');expect(f.records.get(p.id)?.meal.name).toBe('Keep my draft');
 });
 it('acknowledges a lost save after a later device edit without overwriting the newer plan',async()=>{
  const p=plan(),f=fixture([p]),s=f.store(p.id);await s.connect();s.edit(m=>({...m,name:'My committed name'}));f.lose();
  await expect(s.flush()).rejects.toThrow('response lost');s.dispose();
  const latest={...copy(f.records.get(p.id)!),revision:3,meal:{...p.meal,name:'Another device renamed it'},writeId:crypto.randomUUID()};f.records.set(p.id,latest);
  const next=f.store(p.id);await next.connect();expect(next.state().phase).toBe('unsaved');expect(next.state().meal?.name).toBe('My committed name');
  await next.retry();expect(f.calls[0].writeId).toBe(f.calls[1].writeId);expect(f.records.get(p.id)).toEqual(latest);
  expect(next.state().meal?.name).toBe('Another device renamed it');expect(next.state().phase).toBe('saved');
 });
 it('protects later local edits when the acknowledged lost write also has newer remote edits',async()=>{
  const p=plan(),f=fixture([p]),s=f.store(p.id);await s.connect();s.edit(m=>({...m,name:'First committed edit'}));f.lose();
  await expect(s.flush()).rejects.toThrow('response lost');s.edit(m=>({...m,name:'Later local draft'}));
  const other={...copy(f.records.get(p.id)!),revision:3,meal:{...p.meal,name:'Other device changed it'},writeId:crypto.randomUUID()};f.records.set(p.id,other);
  await expect(s.retry()).rejects.toBeInstanceOf(AccountConflict);
  expect(s.state().phase).toBe('conflict');expect(s.state().meal?.name).toBe('Later local draft');expect(s.recoveryExport()).toContain('Later local draft');
  expect(f.records.get(p.id)).toEqual(other);expect(f.calls).toHaveLength(2);
 });
 it('retains an unconfirmed request instant when the browser time zone changes before reload',async()=>{
  vi.stubEnv('TZ','UTC');const p=plan(),f=fixture([p]),s=f.store(p.id);await s.connect();s.edit(m=>({...m,serveAt:'2026-11-08T18:00',name:'Preserve target'}));f.fail();
  await expect(s.flush()).rejects.toThrow('offline');s.dispose();vi.stubEnv('TZ','America/Los_Angeles');
  const restored=f.store(p.id);await restored.connect();expect(restored.state().meal?.serveAt).toBe('2026-11-08T10:00');
  f.fail(false);await restored.retry();expect(f.records.get(p.id)?.serveInstant).toBe('2026-11-08T18:00:00.000Z');expect(f.records.get(p.id)?.timeZone).toBe('UTC');
  expect(restored.state().phase).toBe('saved');expect(f.calls[0].writeId).toBe(f.calls[1].writeId);
 });
 it('retains a newly created offline draft instant even before its first request exists',async()=>{
  vi.stubEnv('TZ','UTC');const meal=make('Offline future'),f=fixture(),s=f.store(meal.id,meal);s.dispose();vi.stubEnv('TZ','America/Los_Angeles');
  const restored=f.store(meal.id);await restored.connect();expect(restored.state().meal?.serveAt).toBe('2026-11-08T10:00');
  await restored.flush();expect(f.records.get(meal.id)?.serveInstant).toBe('2026-11-08T18:00:00.000Z');expect(f.records.get(meal.id)?.timeZone).toBe('UTC');
 });
 it('refuses a stale save and keeps its pending plan exportable',async()=>{
  const p=plan(),f=fixture([p]),s=f.store(p.id);await s.connect();s.edit(m=>({...m,name:'Pending edit'}));
  const other={...p,revision:2,meal:{...p.meal,name:'Other device'}};f.records.set(p.id,other);
  await expect(s.flush()).rejects.toBeInstanceOf(AccountConflict);expect(s.state().phase).toBe('conflict');
  expect(s.recoveryExport()).toContain('Pending edit');expect(f.records.get(p.id)).toEqual(other);
  await s.reload();expect(s.state().meal?.name).toBe('Other device');expect(s.dirty()).toBe(false);
 });
 it('does not recreate a plan that has already been promoted',async()=>{
  const p=plan(),f=fixture([p]),s=f.store(p.id);await s.connect();f.records.delete(p.id);await s.connect();
  expect(s.state().phase).toBe('conflict');expect(f.calls).toHaveLength(0);
  expect(()=>s.edit(m=>({...m,name:'Resurrect me'}))).toThrow('Resolve');
 });
 it('does not send unsafely without durable recovery or verified identity',async()=>{
  const p=plan(),f=fixture([p]),s=f.store(p.id);await s.connect();s.edit(m=>({...m,name:'Retain me'}));f.storageFull();
  await expect(s.flush()).rejects.toThrow('storage full');expect(f.calls).toHaveLength(0);f.storageFull(false);f.verify(false);
  await expect(s.retry()).rejects.toThrow('verify');expect(f.calls).toHaveLength(0);expect(s.state().meal?.name).toBe('Retain me');
  f.verify(true);await s.retry();expect(f.records.get(p.id)?.meal.name).toBe('Retain me');
 });
 it('separates account/plan recovery keys and protects another owner’s corrupt cache',async()=>{
  const p=plan(),f=fixture([p]),s=f.store(p.id);await s.connect();s.edit(m=>({...m,name:'PRIVATE'}));
  const other='00000000-0000-4000-8000-000000000002',key=savedPlanCacheKey(other,p.id);
  f.values.set(key,f.values.get(savedPlanCacheKey(owner,p.id))!);
  const next=f.store(p.id,undefined,other);await next.connect();expect(next.state().phase).toBe('load-error');
  expect(next.recoveryExport()).not.toContain('PRIVATE');expect(next.state().meal).toBeNull();expect(f.calls).toHaveLength(0);
 });
 it('protects readonly plans and lost-response receipts after account disposal',async()=>{
  const p=plan(),f=fixture([p]),s=f.store(p.id,undefined,owner,true);await s.connect();expect(s.state().phase).toBe('conflict');
  expect(()=>s.edit(m=>m)).toThrow('Resolve');
  let release:(()=>void)|undefined;const custom={...f.api,write:async(...args:Parameters<SavedPlanAPI['write']>)=>{const result=await f.api.write(...args);await new Promise<void>(r=>{release=r;});return result;}};
  const active=f.store(p.id,undefined,owner,false,custom);await active.connect();active.edit(m=>({...m,name:'Awaiting response'}));const pending=active.flush();
  while(!release)await Promise.resolve();active.dispose();release();await pending;
  expect(JSON.parse(f.values.get(savedPlanCacheKey(owner,p.id))!).operation).not.toBeNull();
 });
 it('lets a readonly viewer leave without replaying or discarding the writer’s pending journal',async()=>{
  const p=plan(),f=fixture([p]),writer=f.store(p.id);await writer.connect();writer.edit(m=>({...m,name:'Writer pending draft'}));
  const key=savedPlanCacheKey(owner,p.id),before=f.values.get(key);const reader=f.store(p.id,undefined,owner,true);await reader.connect();
  expect(reader.state().phase).toBe('conflict');expect(reader.dirty()).toBe(false);await reader.flush();
  expect(f.values.get(key)).toBe(before);expect(f.calls).toHaveLength(0);expect(reader.state().meal?.name).toBe(p.meal.name);
 });
 it('preserves target instant and source time zone during unrelated edits across browser time zones',()=>{
  vi.stubEnv('TZ','America/New_York');const p={...plan(),timeZone:'America/New_York',serveInstant:'2026-11-08T23:00:00.000Z'};
  vi.stubEnv('TZ','America/Los_Angeles');const displayed=planMeal(p);
  expect(displayed.serveAt).toBe('2026-11-08T15:00');expect(planDocument(displayed).serveInstant).toBe(p.serveInstant);
  expect(planTimeZone({...displayed,name:'Rename only'},p)).toBe('America/New_York');
 });
});

describe('upcoming-plan backups and RPC boundaries',()=>{
 it('round-trips all separate plans and a legacy plan once without including live/history data',()=>{
  const a=plan(make('First')),b=plan(make('Second')),legacy=plan(make('Legacy'));
  const backup=exportSavedPlans([a,b],at,{...planDocument(legacy.meal),id:legacy.id,timeZone:'UTC'});
  const docs=validateSavedPlansBackup(backup);expect(docs.map(p=>p.id)).toEqual([a.id,b.id,legacy.id]);expect(docs[0].meal).toEqual(a.meal);
  expect(validateSavedPlansBackup(exportSavedPlans([a,b],at,{...planDocument(a.meal),id:a.id,timeZone:'UTC'}))).toHaveLength(2);
  expect(backup).not.toContain('history');expect(backup).not.toContain('active');
 });
 it('rejects duplicate identities, unknown zones and physical cooking records before import',()=>{
  const p=plan(),raw=JSON.parse(exportSavedPlans([p],at));raw.plans.push(raw.plans[0]);expect(()=>validateSavedPlansBackup(JSON.stringify(raw))).toThrow('duplicate');
  raw.plans.pop();raw.plans[0].timeZone='Invalid/Zone';expect(()=>validateSavedPlansBackup(JSON.stringify(raw))).toThrow('time zone');
  raw.plans[0].timeZone='UTC';raw.plans[0].meal.events=[{id:'old-reopen',taskId:'phase',kind:'reopened',occurredAt:at}];expect(()=>validateSavedPlansBackup(JSON.stringify(raw))).toThrow('active or completed');
  raw.plans[0].meal.events=[];raw.plans[0].meal.mode='cooking';expect(()=>validateSavedPlansBackup(JSON.stringify(raw))).toThrow('active or completed');
  expect(()=>validateSavedPlansBackup(JSON.stringify({format:'how-many-beers-backup',version:1}))).toThrow('separate restore');
 });
 it('pins owner/operation identity on atomic import and requires the exact full receipt',async()=>{
  const p=plan(),docs=validateSavedPlansBackup(exportSavedPlans([p],at)),id=crypto.randomUUID(),calls:unknown[]=[];
  let bad=true;
  const client={rpc:(name:string,values:unknown)=>{calls.push({name,values});return {abortSignal:async()=>({data:{plans:[p],importReceipt:{operationId:bad?'wrong':id,planIds:[p.id]}},error:null})};}} as unknown as SupabaseClient;
  const api=savedPlanAPI(client,owner);await expect(api.import(id,docs)).rejects.toThrow('not been confirmed');bad=false;
  const result=await api.import(id,docs);expect(result.plans).toEqual([p]);expect(calls[1]).toMatchObject({name:'import_saved_cook_plans',values:{expected_owner:owner,write_id:id,documents:docs}});
 });
 it('rejects unsafe remote plan metadata without presenting it as an editable draft',()=>{
  const p=plan();expect(()=>parseSavedPlan({...p,revision:-1})).toThrow('metadata');expect(()=>parseSavedPlan({...p,meal:{...p.meal,id:'different'}})).toThrow('Upcoming');
 });
});

describe('account atomic plan promotion',()=>{
 function promotionFixture(){
  const target=plan(),legacy=make('Existing planning cook'),values=new Map<string,string>(),calls:{revision:number;id:string;planId:string;planRevision:number}[]=[];
  let remote:Remote={revision:1,writeId:null,active:{meal:legacy,serveInstant:null},history:[],capabilities:{cancelCook:true,savedPlans:true}};
  let lost=false,fail=false;const receipts=new Map<string,{operationId:string;planId:string;cookId:string}>();
  const api:WorkspaceAPI={read:async()=>copy(remote),write:async(rev,id,doc)=>{if(rev!==remote.revision)throw new AccountConflict('Workspace changed');remote={...doc,revision:rev+1,writeId:id,capabilities:remote.capabilities};return copy(remote);},promote:async(rev,id,planId,planRevision)=>{
   calls.push({revision:rev,id,planId,planRevision});if(fail)throw Error('Start request offline');
   let receipt=receipts.get(id);if(!receipt){if(rev!==remote.revision||planId!==target.id||planRevision!==target.revision)throw new AccountConflict('Plan or workspace changed');
    receipt={operationId:id,planId,cookId:planId};receipts.set(id,receipt);remote={...remote,revision:rev+1,writeId:id,active:{...planDocument({...target.meal,mode:'planning'}),meal:{...target.meal,mode:'cooking',startedAt:at}}};}
   if(lost){lost=false;throw Error('Start response lost');}return {...copy(remote),promotion:receipt};
  }};
  const store=()=>{const s=new AccountCookStore(owner,api,{getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);}},()=>{});stores.push(s);return s;};
  return {target,legacy,calls,store,get:()=>copy(remote),set:(v:Remote)=>{remote=copy(v);},lose:()=>{lost=true;},fail:(v=true)=>{fail=v;}};
 }
 it('flushes the workspace before pinning both promotion revisions and waits for acknowledgment',async()=>{
  const f=promotionFixture(),s=f.store();await s.connect();s.edit(m=>({...m,name:'Legacy notes preserved'}));
  await s.promote(f.target.id,f.target.revision);expect(f.calls[0]).toMatchObject({revision:2,planId:f.target.id,planRevision:1});
  expect(s.state().snapshot!.active.id).toBe(f.target.id);expect(s.state().snapshot!.active.mode).toBe('cooking');expect(s.state().phase).toBe('saved');
 });
 it('blocks a second live cooking session without sending a promotion',async()=>{
  const f=promotionFixture();f.set({...f.get(),active:{meal:{...f.legacy,mode:'cooking',startedAt:at},serveInstant:null}});const s=f.store();await s.connect();
  await expect(s.promote(f.target.id,1)).rejects.toThrow('Finish or cancel');expect(f.calls).toHaveLength(0);expect(f.get().active!.meal.id).toBe(f.legacy.id);
 });
 it('treats legacy planning snapshots with physical history as an in-progress cook',async()=>{
  const f=promotionFixture();f.set({...f.get(),active:{meal:{...f.legacy,events:[{id:'physical-history',taskId:'phase',kind:'reopened',occurredAt:at}]},serveInstant:null}});
  const s=f.store();await s.connect();await expect(s.promote(f.target.id,1)).rejects.toThrow('Finish or cancel');expect(f.calls).toHaveLength(0);
 });
 it('retries a lost promotion receipt after a later cook exists without restarting the original plan',async()=>{
  const f=promotionFixture(),s=f.store();await s.connect();f.lose();await expect(s.promote(f.target.id,1)).rejects.toThrow('response lost');s.dispose();
  const next={...make('A later cook'),mode:'cooking' as const,startedAt:at};f.set({...f.get(),revision:3,writeId:crypto.randomUUID(),active:{meal:next,serveInstant:null}});
  const restored=f.store();await restored.connect();expect(restored.state().phase).toBe('blocked');expect(restored.state().snapshot!.active.id).toBe(f.legacy.id);
  await restored.promote(f.target.id,1);expect(f.calls[0].id).toBe(f.calls[1].id);expect(f.get().active!.meal.id).toBe(next.id);expect(restored.state().snapshot!.active.id).toBe(next.id);
 });
 it('keeps the prior workspace visible and recoverable when a plan revision is stale',async()=>{
  const f=promotionFixture(),s=f.store();await s.connect();await expect(s.promote(f.target.id,2)).rejects.toBeInstanceOf(AccountConflict);
  expect(s.state().phase).toBe('conflict');expect(s.state().snapshot!.active).toEqual(f.legacy);expect(s.recoveryExport()).toContain(f.target.id);
 });
});
