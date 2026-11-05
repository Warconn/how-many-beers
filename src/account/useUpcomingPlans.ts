"use client";
import {useEffect,useRef,useState} from 'react';
import {useAccount} from '@/auth/AccountProvider';
import {recoveryStorage,type RecoveryStorage} from './recoveryStorage';
import {SavedPlanStore,savedPlanCacheKey,type SavedPlanState} from './SavedPlanStore';
import {savedPlanAPI,orderPlans,validatePlanMeal,planDocument,planMeal,type SavedPlan} from './savedPlans';
import {AccountConflict} from './workspace';
import {newMeal,type Meal} from '../domain/meal';
import {migrateMeal,type ExtendedMeal} from '../domain/cookState';

export type UpcomingPlan={id:string;meal:Meal;revision:number;legacy?:boolean;pending?:boolean;serveInstant:string|null;timeZone:string};
export type PendingPlan=SavedPlan&{pending:true};
export const pendingPlansKey=(owner:string)=>`how-many-beers:account:v1:${owner}:pending-plans`;
/** Index precedes a new plan journal, so even a crash between writes can recover its seed. */
export class PendingPlanIndex{
  readonly key:string;
  private entries:PendingPlan[]=[];
  private queued:Promise<void>=Promise.resolve();
  constructor(private owner:string,private storage:RecoveryStorage){this.key=pendingPlansKey(owner);this.read();}
  private read(){
    const raw=this.storage.getItem(this.key);
    if(raw===null){this.entries=[];return;}
    const index=JSON.parse(raw);
    if(index.version!==1||index.owner!==this.owner||!Array.isArray(index.plans))throw Error('Upcoming draft recovery could not be read safely.');
    const ids=new Set<string>();
    this.entries=index.plans.map((entry:PendingPlan)=>{
      if(!entry||typeof entry.id!=='string'||ids.has(entry.id)||!Number.isFinite(Date.parse(entry.createdAt))||typeof entry.timeZone!=='string'||!(entry.serveInstant===null||typeof entry.serveInstant==='string'&&Number.isFinite(Date.parse(entry.serveInstant))))throw Error('Invalid upcoming draft recovery.');
      ids.add(entry.id);new Intl.DateTimeFormat('en',{timeZone:entry.timeZone});
      return {...entry,meal:validatePlanMeal(entry.meal,entry.id),revision:0,writeId:null,pending:true};
    });
  }
  list(){return [...this.entries];}
  private change(fn:(entries:PendingPlan[])=>PendingPlan[]):Promise<void>{
    const work=this.queued.catch(()=>{}).then(async()=>{
      for(let attempt=0;attempt<3;attempt++){
        try{
          await this.storage.rebase?.();this.read();
          const next=fn(this.entries);
          this.storage.setItem(this.key,JSON.stringify({version:1,owner:this.owner,plans:next}));
          await this.storage.settled?.();this.entries=next;return;
        }catch(error){if(!(error instanceof AccountConflict)||attempt===2)throw error;}
      }
    });
    this.queued=work;return work;
  }
  add(meal:Meal):Promise<void>{
    const valid=validatePlanMeal(meal),now=new Date().toISOString();
    return this.change(entries=>entries.some(entry=>entry.id===valid.id)?entries:[...entries,{id:valid.id,revision:0,...planDocument(valid),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',createdAt:now,updatedAt:now,writeId:null,pending:true}]);
  }
  remove(ids:string[]):Promise<void>{return this.change(entries=>entries.filter(entry=>!ids.includes(entry.id)));}
  close(){this.storage.close?.();}
}
export function mergePendingPlans(saved:SavedPlan[],pending:PendingPlan[]):(SavedPlan&{pending?:boolean})[]{
  const ids=new Set(saved.map(plan=>plan.id));return orderPlans([...saved,...pending.filter(plan=>!ids.has(plan.id))]);
}
const initial:SavedPlanState={meal:null,plan:null,phase:'loading',error:''};
/** Planning-marked records can still contain real observations from older builds. */
export function currentHasActuals(meal:Meal|null|undefined):boolean{
  return !!meal&&(meal.mode==='cooking'||!!meal.startedAt||Object.keys(meal.completed).length>0||((meal as {events?:{kind:string}[]}).events??[]).some(e=>e.kind!=='removed'));
}
export function hasUpcomingContent(meal:Meal|null|undefined):boolean{
  return !!meal&&!currentHasActuals(meal)&&(meal.dishes.length>0||((meal as ExtendedMeal).customTasks?.length??0)>0||meal.name!=='Next cook'||Object.keys(meal.notes).length>0);
}
/** Each selected plan has its own recovery document and writer lock. */
export function useUpcomingPlans(enabled:boolean){
  const {ownerId,client,phase}=useAccount();
  const [scope,setScope]=useState<string|null>(null);
  const [plans,setPlans]=useState<(SavedPlan&{pending?:boolean})[]>([]);
  const [selected,setSelected]=useState<{owner:string;id:string}|null>(null);
  const [state,setState]=useState<SavedPlanState>(initial);
  const [listPhase,setListPhase]=useState<'loading'|'saved'|'load-error'>('loading');
  const [listError,setListError]=useState('');
  const store=useRef<SavedPlanStore|null>(null),release=useRef<(()=>void)|null>(null);
  const index=useRef<{owner:string;value:PendingPlanIndex}|null>(null),listRequest=useRef(0);
  const selectedRef=useRef<{owner:string;id:string}|null>(null);
  const activeOwner=useRef(ownerId),allowed=useRef(false),opening=useRef(false),generation=useRef(0);
  activeOwner.current=ownerId;allowed.current=phase==='authenticated';
  const isCurrent=(owner:string)=>activeOwner.current===owner;
  const api=enabled&&ownerId&&client?savedPlanAPI(client,ownerId):null;
  const getIndex=async(owner:string)=>{
    if(index.current?.owner===owner)return index.current.value;
    const storage=await recoveryStorage(pendingPlansKey(owner));
    if(!isCurrent(owner)){storage.close?.();throw Error('Your account changed while opening draft recovery.');}
    const value=new PendingPlanIndex(owner,storage);index.current?.value.close();index.current={owner,value};return value;
  };
  const forgetPending=async(id:string)=>{
    if(!ownerId)return;
    const pending=await getIndex(ownerId);
    if(pending.list().some(plan=>plan.id===id))await pending.remove([id]);
  };
  const refresh=async()=>{
    if(!api||!ownerId)throw Error('Upcoming plans are not available for this account yet.');
    if(!allowed.current)throw Error('Verify your account before loading upcoming plans.');
    const owner=ownerId,request=++listRequest.current,version=generation.current;
    try{
      const pending=await getIndex(owner);
      if(!isCurrent(owner)||request!==listRequest.current||version!==generation.current)return;
      setScope(owner);setPlans(previous=>mergePendingPlans(previous.filter(plan=>!plan.pending),pending.list()));
      const next=await api.list();
      if(!isCurrent(owner)||request!==listRequest.current||version!==generation.current)return;
      const confirmed=next.filter(plan=>pending.list().some(p=>p.id===plan.id)).map(plan=>plan.id);
      if(confirmed.length)await pending.remove(confirmed);
      if(!isCurrent(owner)||request!==listRequest.current||version!==generation.current)return;
      setPlans(mergePendingPlans(next,pending.list()));setListPhase('saved');setListError('');
    }catch(e){
      if(isCurrent(owner)&&request===listRequest.current&&version===generation.current){setListPhase('load-error');setListError(e instanceof Error?e.message:'Could not load upcoming plans.');}
      throw e;
    }
  };
  const releaseSelection=()=>{
    store.current?.dispose();store.current=null;release.current?.();release.current=null;
    selectedRef.current=null;setSelected(null);setState(initial);
  };
  useEffect(()=>{
    generation.current++;opening.current=false;releaseSelection();index.current?.value.close();index.current=null;setPlans([]);setScope(ownerId);setListError('');setListPhase('loading');
    if(enabled&&ownerId&&client)void refresh().catch(()=>{});
    return ()=>{generation.current++;store.current?.dispose();store.current=null;release.current?.();release.current=null;selectedRef.current=null;index.current?.value.close();index.current=null;};
    // Refresh is intentionally scoped to account/capability changes, not a new API object on render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[enabled,ownerId,client]);
  useEffect(()=>{
    const protect=(event:Event)=>{if(store.current?.dirty()){event.preventDefault();if(event.type==='beforeunload')(event as BeforeUnloadEvent).returnValue='';}};
    window.addEventListener('beforeunload',protect);window.addEventListener('hmb-before-signout',protect);
    return()=>{window.removeEventListener('beforeunload',protect);window.removeEventListener('hmb-before-signout',protect);};
  },[]);
  const flush=async()=>{
    const current=store.current,selection=selectedRef.current;
    if(!current)return;
    if(!selection||!isCurrent(selection.owner))throw Error('Confirm your account before saving this plan.');
    await current.flush(true);
    if(current.state().plan)await forgetPending(selection.id);
  };
  const acquire=async(name:string)=>{
    if(!navigator.locks)return {readonly:false,release:()=>{}};
    return new Promise<{readonly:boolean;release:()=>void}>(resolve=>{
      void navigator.locks.request(name,{ifAvailable:true},async lock=>{
        if(!lock){resolve({readonly:true,release:()=>{}});return;}
        let finish:()=>void=()=>{};
        const held=new Promise<void>(done=>{finish=done;});resolve({readonly:false,release:finish});await held;
      }).catch(()=>resolve({readonly:false,release:()=>{}}));
    });
  };
  const open=async(id:string,seed?:Meal)=>{
    if(!enabled||!api||!ownerId||!allowed.current)throw Error('Confirm your account before opening an upcoming plan.');
    if(opening.current)throw Error('Wait for the current plan to finish opening.');
    if(selectedRef.current?.id===id&&selectedRef.current.owner===ownerId){await flush();return;}
    opening.current=true;
    const owner=ownerId,version=generation.current;
    try{
      await flush();
      if(!isCurrent(owner)||version!==generation.current)throw Error('Your account changed while opening the plan.');
      releaseSelection();
      const lock=await acquire('how-many-beers:account-plan-writer:'+owner+':'+id);
      if(!isCurrent(owner)||version!==generation.current){lock.release();throw Error('Your account changed while opening the plan.');}
      release.current=lock.release;
      const pending=await getIndex(owner);
      if(seed){await pending.add(seed);setScope(owner);setPlans(previous=>mergePendingPlans(previous.filter(plan=>!plan.pending),pending.list()));}
      const recovered=pending.list().find(plan=>plan.id===id);
      const recoveredSeed=seed??(recovered?planMeal(recovered):undefined);
      if(!isCurrent(owner)||version!==generation.current){lock.release();throw Error('Your account changed while opening the plan.');}
      const recovery=await recoveryStorage(savedPlanCacheKey(owner,id));
      if(!isCurrent(owner)||version!==generation.current){recovery.close?.();lock.release();throw Error('Your account changed while opening the plan.');}
      const next=new SavedPlanStore(owner,id,api,recovery,s=>{
        if(!isCurrent(owner)||version!==generation.current)return;
        setState(s);
        if(s.plan)setPlans(previous=>orderPlans([...previous.filter(p=>p.id!==s.plan!.id),s.plan!]));
      },()=>allowed.current&&isCurrent(owner),lock.readonly,recoveredSeed);
      store.current=next;selectedRef.current={owner,id};setSelected({owner,id});setState(next.state());
      await next.connect();
      if(recoveredSeed)await next.flush(true);
      if(next.state().plan)await forgetPending(id);
      if(['load-error','conflict'].includes(next.state().phase))throw Error(next.state().error||'This plan could not be opened safely.');
    }catch(error){
      if(!store.current){release.current?.();release.current=null;}
      throw error;
    }finally{opening.current=false;}
  };
  const create=async(seed?:Meal)=>{
    const meal=migrateMeal(seed??newMeal());
    if(currentHasActuals(meal))throw Error('Use Cook Again to make a new plan without changing recorded cooking progress.');
    await open(meal.id,meal);
    return meal.id;
  };
  const close=async()=>{await flush();releaseSelection();};
  const retry=async()=>{if(store.current)await store.current.retry();else await refresh();};
  return {
    plans:scope===ownerId?plans:[],
    selectedId:selected?.owner===ownerId?selected.id:null,
    state:selected?.owner===ownerId?state:initial,
    listPhase,listError,store,open,create,flush,close,releaseSelection,refresh,retry,
    hasSelection:()=>!!selectedRef.current&&selectedRef.current.owner===activeOwner.current,
  };
}
