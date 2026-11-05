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
import {currentHasActuals,hasUpcomingContent} from '../src/account/useUpcomingPlans';
let workspace:ReturnType<typeof useCookWorkspace>;
function render(){function Probe(){workspace=useCookWorkspace();return null;}renderToString(createElement(Probe));return workspace!;}
function selected(){return {state:()=>({plan:{id:'future-plan',revision:7},meal:f.plans.state.meal,phase:'saved',error:''}),save:vi.fn().mockResolvedValue(undefined),edit:vi.fn(),flush:vi.fn().mockResolvedValue(undefined),dirty:()=>false,recoveryExport:()=>'{"planDraft":true}'};}
beforeEach(()=>{
 vi.stubEnv('NEXT_PUBLIC_ENABLE_CLOUD_COOKS','true');
 f.account={ownerId:'owner-a',phase:'authenticated',client:{}};
 const active=migrateMeal({...newMeal(),name:'Pumpkin seeds tonight',mode:'cooking',startedAt:'2026-11-05T01:00:00Z',dishes:[createDish('side')]});
 const snapshot={active,history:emptyHistory()};
 f.cloud={state:{snapshot,backup:snapshot,phase:'saved',error:'',canPlan:true,canCancel:true},store:{current:{state:()=>({snapshot:f.cloud.state.snapshot}),save:vi.fn().mockResolvedValue(undefined),edit:vi.fn(),flush:vi.fn().mockResolvedValue(undefined),promote:vi.fn().mockResolvedValue(undefined),cancel:vi.fn().mockResolvedValue(undefined),retry:vi.fn().mockResolvedValue(undefined),recoveryExport:()=>'{"live":true}'}},restart:vi.fn()};
 f.local={meal:null,history:emptyHistory(),status:'saved',error:'',canceled:{version:1,cooks:[]}};
 f.plans={plans:[],selectedId:null,state:{meal:null,plan:null,phase:'loading',error:''},listPhase:'saved',listError:'',store:{current:null},open:vi.fn().mockResolvedValue(undefined),create:vi.fn().mockResolvedValue('created-plan'),flush:vi.fn().mockResolvedValue(undefined),close:vi.fn().mockResolvedValue(undefined),releaseSelection:vi.fn(),refresh:vi.fn().mockResolvedValue(undefined),retry:vi.fn().mockResolvedValue(undefined)};
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
  expect(hasUpcomingContent(newMeal())).toBe(false);expect(currentHasActuals({...newMeal(),mode:'planning',events:[{kind:'temperature'}]} as any)).toBe(true);
 });
 it('list failures remain separate from the live cook save status and selected recovery exports the right draft',()=>{
  f.plans.listPhase='load-error';f.plans.listError='Cannot load upcoming plans';let w=render();expect(w.plansError).toBe('Cannot load upcoming plans');expect(w.status).toBe('saved');expect(w.currentCook!.name).toBe('Pumpkin seeds tonight');
  f.plans.selectedId='future-plan';f.plans.store.current=selected();f.plans.state={meal:migrateMeal(newMeal()),phase:'unsaved',error:'Pending plan'};w=render();expect(w.recoveryExport()).toBe('{"planDraft":true}');expect(w.status).toBe('unsaved');expect(w.backup!.active.name).toBe('Pumpkin seeds tonight');
 });
});
