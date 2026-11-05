"use client";
import {useEffect,useRef,useState} from 'react';
import {useAccount} from '@/auth/AccountProvider';
import {recoveryStorage} from './recoveryStorage';
import {SavedPlanStore,savedPlanCacheKey,type SavedPlanState} from './SavedPlanStore';
import {savedPlanAPI,orderPlans,type SavedPlan} from './savedPlans';
import {newMeal,type Meal} from '../domain/meal';
import {migrateMeal,type ExtendedMeal} from '../domain/cookState';

export type UpcomingPlan={id:string;meal:Meal;revision:number;legacy?:boolean;serveInstant:string|null;timeZone:string};
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
  const [plans,setPlans]=useState<SavedPlan[]>([]);
  const [selected,setSelected]=useState<{owner:string;id:string}|null>(null);
  const [state,setState]=useState<SavedPlanState>(initial);
  const [listPhase,setListPhase]=useState<'loading'|'saved'|'load-error'>('loading');
  const [listError,setListError]=useState('');
  const store=useRef<SavedPlanStore|null>(null),release=useRef<(()=>void)|null>(null);
  const selectedRef=useRef<{owner:string;id:string}|null>(null);
  const activeOwner=useRef(ownerId),allowed=useRef(false),opening=useRef(false),generation=useRef(0);
  activeOwner.current=ownerId;allowed.current=phase==='authenticated';
  const isCurrent=(owner:string)=>activeOwner.current===owner;
  const api=enabled&&ownerId&&client?savedPlanAPI(client,ownerId):null;
  const refresh=async()=>{
    if(!api||!ownerId)throw Error('Upcoming plans are not available for this account yet.');
    const owner=ownerId;
    try{
      const next=await api.list();if(!isCurrent(owner))return;
      setScope(owner);setPlans(orderPlans(next));setListPhase('saved');setListError('');
    }catch(e){
      if(isCurrent(owner)){setListPhase('load-error');setListError(e instanceof Error?e.message:'Could not load upcoming plans.');}
      throw e;
    }
  };
  const releaseSelection=()=>{
    store.current?.dispose();store.current=null;release.current?.();release.current=null;
    selectedRef.current=null;setSelected(null);setState(initial);
  };
  useEffect(()=>{
    generation.current++;opening.current=false;releaseSelection();setPlans([]);setScope(ownerId);setListError('');setListPhase('loading');
    if(enabled&&ownerId&&client)void refresh().catch(()=>{});
    return ()=>{generation.current++;store.current?.dispose();store.current=null;release.current?.();release.current=null;selectedRef.current=null;};
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
      const recovery=await recoveryStorage(savedPlanCacheKey(owner,id));
      if(!isCurrent(owner)||version!==generation.current){recovery.close?.();lock.release();throw Error('Your account changed while opening the plan.');}
      const next=new SavedPlanStore(owner,id,api,recovery,s=>{
        if(!isCurrent(owner)||version!==generation.current)return;
        setState(s);
        if(s.plan)setPlans(previous=>orderPlans([...previous.filter(p=>p.id!==s.plan!.id),s.plan!]));
      },()=>allowed.current&&isCurrent(owner),lock.readonly,seed);
      store.current=next;selectedRef.current={owner,id};setSelected({owner,id});setState(next.state());
      await next.connect();
      if(seed)await next.flush(true);
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
  };
}
