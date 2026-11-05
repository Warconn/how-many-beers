import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import {newMeal,createDish} from '../src/domain/meal';
import {migrateMeal} from '../src/domain/cookState';
import {emptyHistory} from '../src/domain/cookHistory';
const f=vi.hoisted(()=>({account:{} as any,cloud:{} as any,local:{} as any,plans:{} as any}));
vi.mock('@/domain/localPersistence',()=>import('../src/domain/localPersistence'));
vi.mock('@/domain/cookHistory',()=>import('../src/domain/cookHistory'));
vi.mock('@/domain/meal',()=>import('../src/domain/meal'));
vi.mock('@/domain/cookState',()=>import('../src/domain/cookState'));
vi.mock('@/auth/AccountProvider',()=>({useAccount:()=>f.account}));
vi.mock('@/components/useLocalCook',()=>({useLocalCook:()=>f.local}));
vi.mock('../src/account/useAccountCook',()=>({useAccountCook:()=>f.cloud}));
vi.mock('../src/account/useUpcomingPlans',async()=>{
 const actual=await vi.importActual<typeof import('../src/account/useUpcomingPlans')>('../src/account/useUpcomingPlans');
 return {...actual,useUpcomingPlans:()=>f.plans};
});
import {useCookWorkspace} from '../src/account/useCookWorkspace';
import {currentHasActuals,hasUpcomingContent,PendingPlanIndex,pendingPlansKey,mergePendingPlans,backupPendingPlan} from '../src/account/useUpcomingPlans';
let workspace:ReturnType<typeof useCookWorkspace>;
function render(){function Probe(){workspace=useCookWorkspace();return null;}renderToString(createElement(Probe));return workspace!;}
function selected(){return {owner:'owner-a',state:()=>({plan:{id:'future-plan',revision:7},meal:f.plans.state.meal,phase:'saved',error:''}),save:vi.fn().mockResolvedValue(undefined),edit:vi.fn(),flush:vi.fn().mockResolvedValue(undefined),dirty:()=>false,recoveryExport:()=>'{"planDraft":true}'};}
beforeEach(()=>{
 vi.stubEnv('NEXT_PUBLIC_ENABLE_CLOUD_COOKS','true');
 f.account={ownerId:'owner-a',phase:'authenticated',client:{}};
 const active=migrateMeal({...newMeal(),name:'Pumpkin seeds tonight',mode:'cooking',startedAt:'2026-11-05T01:00:00Z',dishes:[createDish('side')]});
 const snapshot={active,history:emptyHistory()};
 f.cloud={state:{snapshot,backup:snapshot,phase:'saved',error:'',canPlan:true,canCancel:true},store:{current:{owner:'owner-a',state:()=>({snapshot:f.cloud.state.snapshot}),save:vi.fn().mockResolvedValue(undefined),edit:vi.fn(),flush:vi.fn().mockResolvedValue(undefined),promote:vi.fn().mockResolvedValue(undefined),cancel:vi.fn().mockResolvedValue(undefined),retry:vi.fn().mockResolvedValue(undefined),recoveryExport:()=>'{"live":true}'}},restart:vi.fn()};
 f.local={meal:null,history:emptyHistory(),status:'saved',error:'',canceled:{version:1,cooks:[]}};
 f.plans={plans:[],selectedId:null,state:{meal:null,plan:null,phase:'loading',error:''},listPhase:'saved',listError:'',store:{current:null},open:vi.fn().mockResolvedValue(undefined),create:vi.fn().mockResolvedValue('created-plan'),flush:vi.fn().mockResolvedValue(undefined),close:vi.fn().mockResolvedValue(undefined),releaseSelection:vi.fn(),forgetSelected:vi.fn().mockResolvedValue(undefined),refresh:vi.fn().mockResolvedValue(undefined),retry:vi.fn().mockResolvedValue(undefined)};
});
describe('upcoming workspace document routing',()=>{
 it('editing/saving a selected plan never writes the physical cook',async()=>{
  const plan=selected();f.plans.store.current=plan;f.plans.selectedId='future-plan';f.plans.state={meal:migrateMeal({...newMeal(),id:'future-plan',name:'Sunday brats'}),phase:'saved',error:''};
  const w=render(),before=structuredClone(w.currentCook);await w.save({active:f.plans.state.meal});w.patch(m=>({...m,name:'Revised Sunday brats'}));
  expect(plan.save).toHaveBeenCalledWith(f.plans.state.meal);expect(plan.edit).toHaveBeenCalledTimes(1);expect(f.cloud.store.current.save).not.toHaveBeenCalled();expect(f.cloud.store.current.edit).not.toHaveBeenCalled();expect(w.currentCook).toEqual(before);expect(w.meal!.id).toBe('future-plan');expect(w.backup!.active).toEqual(before);
 });
 it('history changes while a plan is selected preserve the live active document',async()=>{
  f.plans.store.current=selected();f.plans.selectedId='future-plan';f.plans.state.meal=migrateMeal(newMeal());
  const history=emptyHistory();await render().save({history});expect(f.cloud.store.current.save).toHaveBeenCalledWith({history});expect(f.plans.store.current.save).not.toHaveBeenCalled();
 });
 it('creating a future plan flushes existing work without replacing the current cook',async()=>{
  const w=render(),before=structuredClone(w.currentCook);const seed=migrateMeal({...newMeal(),name:'Sunday brats'});await w.createPlan(seed);
  expect(f.cloud.store.current.flush).toHaveBeenCalledWith(true);expect(f.plans.create).toHaveBeenCalledWith(seed);expect(f.cloud.store.current.save).not.toHaveBeenCalled();expect(w.currentCook).toEqual(before);
 });
 it('blocks starting a second physical cook and leaves the future plan intact',async()=>{
  const plan=selected();f.plans.store.current=plan;await expect(render().startSelectedPlan()).rejects.toThrow('Finish or cancel');expect(f.cloud.store.current.promote).not.toHaveBeenCalled();expect(f.plans.releaseSelection).not.toHaveBeenCalled();
 });
 it('uses the selected store ref after opening and acknowledges promotion before clearing it',async()=>{
  f.cloud.state.snapshot.active=migrateMeal(newMeal());f.plans.open.mockImplementation(async()=>{f.plans.store.current=selected();});
  await render().startSelectedPlan('future-plan');expect(f.plans.open).toHaveBeenCalledWith('future-plan');expect(f.cloud.store.current.promote).toHaveBeenCalledWith('future-plan',7);expect(f.plans.releaseSelection).toHaveBeenCalledTimes(1);expect(f.plans.refresh).toHaveBeenCalledTimes(1);
 });
 it('failed promotion or pending-plan flush never clears the selected draft',async()=>{
  f.cloud.state.snapshot.active=migrateMeal(newMeal());f.plans.store.current=selected();f.cloud.store.current.promote.mockRejectedValueOnce(Error('Unconfirmed start'));
  await expect(render().startSelectedPlan()).rejects.toThrow('Unconfirmed');expect(f.plans.releaseSelection).not.toHaveBeenCalled();
  f.cloud.store.current.flush.mockRejectedValueOnce(Error('Pending live edit'));await expect(render().returnToCurrent()).rejects.toThrow('Pending');expect(f.plans.close).not.toHaveBeenCalled();
 });
 it('recognizes an acknowledged retry of this same promoted cook without starting it twice',async()=>{
  f.cloud.state.snapshot.active.id='future-plan';f.plans.store.current=selected();await render().startSelectedPlan();expect(f.cloud.store.current.promote).not.toHaveBeenCalled();expect(f.plans.releaseSelection).toHaveBeenCalledTimes(1);
 });
 it('keeps a selected draft if the same plan was started elsewhere while edits remained pending',async()=>{
  f.cloud.state.snapshot.active.id='future-plan';f.plans.store.current={...selected(),dirty:()=>true};await expect(render().startSelectedPlan()).rejects.toThrow('Finish or cancel');expect(f.plans.releaseSelection).not.toHaveBeenCalled();
 });
 it('shows legacy future work once and protects planning-marked actual observations',()=>{
  f.cloud.state.snapshot.active=migrateMeal({...newMeal(),name:'Sunday brats',dishes:[createDish('brats')]});let w=render();expect(w.upcomingPlans).toHaveLength(1);expect(w.upcomingPlans[0]).toMatchObject({id:w.currentCook!.id,legacy:true});
  f.cloud.state.snapshot.active.completed={prep:'2026-11-05T01:00Z'};w=render();expect(w.upcomingPlans).toHaveLength(0);expect(w.currentCookInProgress).toBe(true);
  expect(hasUpcomingContent(newMeal())).toBe(false);
  const removedOnly={...newMeal(),events:[{id:'removed',taskId:'old',kind:'removed',occurredAt:'2026-11-05T01:00Z'}]} as any;
  expect(hasUpcomingContent(removedOnly)).toBe(true);expect(currentHasActuals(removedOnly)).toBe(false);
  expect(hasUpcomingContent({...newMeal(),taskOverrides:{step:{durationMinutes:5}}} as any)).toBe(true);expect(currentHasActuals({...newMeal(),mode:'planning',events:[{kind:'temperature'}]} as any)).toBe(true);
 });
 it('list failures remain separate from the live cook save status and selected recovery exports the right draft',()=>{
  f.plans.listPhase='load-error';f.plans.listError='Cannot load upcoming plans';let w=render();expect(w.plansError).toBe('Cannot load upcoming plans');expect(w.status).toBe('saved');expect(w.currentCook!.name).toBe('Pumpkin seeds tonight');
  f.plans.selectedId='future-plan';f.plans.store.current=selected();f.plans.state={meal:migrateMeal(newMeal()),phase:'unsaved',error:'Pending plan'};w=render();expect(w.recoveryExport()).toBe('{"planDraft":true}');expect(w.status).toBe('unsaved');expect(w.backup!.active.name).toBe('Pumpkin seeds tonight');
 });
});


describe('owner-scoped pending-plan discovery',()=>{
 function storage(){const data=new Map<string,string>();return {data,getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};}
 it('durably indexes the full seed before a server row exists and discovers it after reload',async()=>{
  const port=storage(),seed=migrateMeal({...newMeal(),name:'Sunday brats',dishes:[createDish('brats')]});const index=new PendingPlanIndex('owner-a',port);
  await index.add(seed);const restored=new PendingPlanIndex('owner-a',port);
  expect(restored.list()).toHaveLength(1);expect(restored.list()[0]).toMatchObject({id:seed.id,meal:JSON.parse(JSON.stringify(seed)),revision:0,pending:true});expect(port.data.has(pendingPlansKey('owner-a'))).toBe(true);
 });
 it('keeps pending drafts separate and removes only acknowledged IDs',async()=>{
  const port=storage(),a=migrateMeal(newMeal()),b=migrateMeal(newMeal()),index=new PendingPlanIndex('owner-a',port);
  await index.add(a);await index.add(b);const pending=index.list(),confirmed={...pending[0],revision:2,pending:false};
  const merged=mergePendingPlans([confirmed],pending);expect(merged).toHaveLength(2);expect(merged.find(p=>p.id===a.id)!.revision).toBe(2);expect(merged.find(p=>p.id===b.id)!.pending).toBe(true);
  await index.remove([a.id]);expect(new PendingPlanIndex('owner-a',port).list().map(p=>p.id)).toEqual([b.id]);
 });
 it('does not acknowledge failed index storage and rejects another owner cache',async()=>{
  const port=storage(),index=new PendingPlanIndex('owner-a',{...port,setItem:()=>{throw Error('Storage full');}});
  await expect(index.add(newMeal())).rejects.toThrow('Storage full');expect(index.list()).toEqual([]);expect(port.data.size).toBe(0);
  port.data.set(pendingPlansKey('owner-a'),JSON.stringify({version:1,owner:'owner-b',plans:[]}));expect(()=>new PendingPlanIndex('owner-a',port)).toThrow('could not be read safely');
 });
 it('rebases an index mutation without deleting another independently created draft',async()=>{
  const port=storage(),a=migrateMeal(newMeal()),b=migrateMeal(newMeal()),first=new PendingPlanIndex('owner-a',port),other=new PendingPlanIndex('owner-a',port);
  await first.add(a);await other.add(b);expect(new PendingPlanIndex('owner-a',port).list().map(p=>p.id).sort()).toEqual([a.id,b.id].sort());
 });
 it('keeps protected edits discoverable even when the server plan still exists or is later promoted',async()=>{
  const port=storage(),meal=migrateMeal({...newMeal(),name:'Original Sunday plan'}),index=new PendingPlanIndex('owner-a',port);
  await index.add(meal,4);
  const server={...index.list()[0],revision:4,pending:false};const edited={...meal,name:'Changed while offline'};
  await index.protect({meal:edited,serveInstant:server.serveInstant,timeZone:server.timeZone},4);
  const reloaded=new PendingPlanIndex('owner-a',port),together=mergePendingPlans([server],reloaded.list());
  expect(together).toHaveLength(1);expect(together[0]).toMatchObject({revision:4,pending:true,meal:{name:'Changed while offline'}});expect(server.meal.name).toBe('Original Sunday plan');
  expect(mergePendingPlans([],reloaded.list())[0]).toMatchObject({id:meal.id,pending:true,meal:{name:'Changed while offline'}});
 });
 it('does not acknowledge protected-draft metadata until its durable write settles',async()=>{
  const port=storage(),meal=migrateMeal(newMeal());let reject=false;
  const index=new PendingPlanIndex('owner-a',{...port,settled:async()=>{if(reject)throw Error('Cannot retain draft');}});
  await index.add(meal,1);reject=true;
  await expect(index.protect({meal:{...meal,name:'Do not lose this'},serveInstant:null,timeZone:'UTC'},1)).rejects.toThrow('Cannot retain draft');
  expect(index.list()[0].meal.name).toBe(meal.name);
 });

 it('exports the protected journal version without overwriting the confirmed source and rejects foreign/corrupt recovery',async()=>{
  const port=storage(),meal=migrateMeal({...newMeal(),name:'Confirmed plan'}),index=new PendingPlanIndex('owner-a',port);await index.add(meal,3);
  const entry=index.list()[0],edited={...meal,name:'Protected offline edit'},raw=JSON.stringify({version:1,owner:'owner-a',planId:meal.id,base:null,desired:edited,operation:null,desiredServeInstant:null,desiredTimeZone:'UTC'});
  const backup=backupPendingPlan(entry,raw,'owner-a',new Set([meal.id]));expect(backup!.meal.name).toBe('Protected offline edit');expect(entry.meal.name).toBe('Confirmed plan');
  expect(()=>backupPendingPlan(entry,raw,'other-owner',new Set())).toThrow('could not be read safely');expect(()=>backupPendingPlan(entry,'{bad','owner-a',new Set())).toThrow('could not be read safely');
 });

});
