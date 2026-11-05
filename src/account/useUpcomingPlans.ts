"use client";
import {useEffect,useRef,useState} from 'react';
import {useAccount} from '@/auth/AccountProvider';
import {recoveryStorage,type RecoveryStorage} from './recoveryStorage';
import {SavedPlanStore,savedPlanCacheKey,type SavedPlanState} from './SavedPlanStore';
import {savedPlanAPI,orderPlans,validatePlanMeal,planDocument,planMeal,parseSavedPlan,type SavedPlan} from './savedPlans';
import {AccountConflict} from './workspace';
import {newMeal,type Meal} from '../domain/meal';
import {migrateMeal,type ExtendedMeal} from '../domain/cookState';

export type UpcomingPlan={id:string;meal:Meal;revision:number;legacy?:boolean;pending?:boolean;serveInstant:string|null;timeZone:string};
export type PendingPlan=SavedPlan&{pending:true;sourceRevision?:number;needsRecovery?:boolean};
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
      if(!entry||(entry.sourceRevision!==undefined&&(!Number.isSafeInteger(entry.sourceRevision)||entry.sourceRevision<0))||typeof entry.id!=='string'||ids.has(entry.id)||!Number.isFinite(Date.parse(entry.createdAt))||typeof entry.timeZone!=='string'||!(entry.serveInstant===null||typeof entry.serveInstant==='string'&&Number.isFinite(Date.parse(entry.serveInstant))))throw Error('Invalid upcoming draft recovery.');
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
  add(meal:Meal,sourceRevision=0):Promise<void>{
    const valid=validatePlanMeal(meal),now=new Date().toISOString();
    return this.change(entries=>entries.some(entry=>entry.id===valid.id)?entries:[...entries,{id:valid.id,revision:0,...planDocument(valid),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',createdAt:now,updatedAt:now,writeId:null,pending:true,sourceRevision,needsRecovery:sourceRevision===0}]);
  }
  protect(document:{meal:ExtendedMeal;serveInstant:string|null;timeZone:string},sourceRevision:number):Promise<void>{
    const valid=validatePlanMeal(document.meal),now=new Date().toISOString();
    if(!(document.serveInstant===null||typeof document.serveInstant==='string'&&Number.isFinite(Date.parse(document.serveInstant))))throw Error('Invalid draft serving instant.');
    new Intl.DateTimeFormat('en',{timeZone:document.timeZone});
    return this.change(entries=>[...entries.filter(entry=>entry.id!==valid.id),{id:valid.id,revision:0,...document,meal:valid,createdAt:entries.find(entry=>entry.id===valid.id)?.createdAt??now,updatedAt:now,writeId:null,pending:true,sourceRevision,needsRecovery:true}]);
  }
  remove(ids:string[]):Promise<void>{return this.change(entries=>entries.filter(entry=>!ids.includes(entry.id)));}
  close(){this.storage.close?.();}
}
export function mergePendingPlans(saved:SavedPlan[],pending:PendingPlan[]):(SavedPlan&{pending?:boolean})[]{
  const ids=new Set(saved.map(plan=>plan.id));
  return orderPlans([...saved.map(plan=>{
    const draft=pending.find(entry=>entry.id===plan.id&&entry.needsRecovery);
    return draft?{...plan,meal:draft.meal,serveInstant:draft.serveInstant,timeZone:draft.timeZone,pending:true}:plan;
  }),...pending.filter(plan=>!ids.has(plan.id))]);
}
/** Backups include protected local edits without replacing any server document. */
export function backupPendingPlan(draft:PendingPlan,raw:string|null,owner:string,confirmedIds:Set<string>):PendingPlan|null{
  if(raw===null)return draft.needsRecovery&&((draft.sourceRevision??0)>0||!confirmedIds.has(draft.id))?draft:null;
  try{
    const cached=JSON.parse(raw);
    if(cached.version!==1||cached.owner!==owner||cached.planId!==draft.id)throw Error('Invalid recovery scope.');
    if(cached.base)parseSavedPlan(cached.base);
    if(!cached.desired&&!cached.operation)return null;
    if(!cached.desired)throw Error('Invalid pending plan journal.');
    const meal=validatePlanMeal(cached.desired,draft.id);
    const serveInstant=cached.desiredServeInstant!==undefined?cached.desiredServeInstant:cached.operation?.document?.serveInstant??draft.serveInstant;
    const timeZone=cached.desiredTimeZone??cached.operation?.timeZone??draft.timeZone;
    if(!(serveInstant===null||typeof serveInstant==='string'&&Number.isFinite(Date.parse(serveInstant))))throw Error('Invalid draft serving instant.');
    new Intl.DateTimeFormat('en',{timeZone});
    return {...draft,meal,serveInstant,timeZone,needsRecovery:true};
  }catch{throw Error('An upcoming draft could not be read safely. Open it and download its recovery data before exporting all plans.');}
}
const initial:SavedPlanState={meal:null,plan:null,phase:'loading',error:''};
/** Planning-marked records can still contain real observations from older builds. */
export function currentHasActuals(meal:Meal|null|undefined):boolean{
  return !!meal&&(meal.mode==='cooking'||!!meal.startedAt||Object.keys(meal.completed).length>0||((meal as {events?:{kind:string}[]}).events??[]).some(e=>e.kind!=='removed'));
}
export function hasUpcomingContent(meal:Meal|null|undefined):boolean{
  return !!meal&&!currentHasActuals(meal)&&(meal.dishes.length>0||((meal as ExtendedMeal).customTasks?.length??0)>0||meal.name!=='Next cook'||Object.keys(meal.notes).length>0||((meal as ExtendedMeal).events?.length??0)>0||Object.keys((meal as ExtendedMeal).taskOverrides??{}).length>0);
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
  const [automaticPhase,setAutomaticPhase]=useState<SavedPlanState['phase']>('saved');
  const [actionError,setActionError]=useState('');
  const automatic=useRef<(()=>Promise<void>)|null>(null),automaticRun=useRef<Promise<void>|null>(null);
  const retryTimer=useRef<ReturnType<typeof setTimeout>|null>(null),retryAttempt=useRef(0),resumeSelected=useRef(false),resumeAgain=useRef(false);
  const backgroundGeneration=useRef(0),worker=useRef<{id:string;store?:SavedPlanStore;release:()=>void}|null>(null);
  const selectedReadonly=useRef(false);
  const store=useRef<SavedPlanStore|null>(null),release=useRef<(()=>void)|null>(null);
  const index=useRef<{owner:string;value:PendingPlanIndex}|null>(null),indexOpening=useRef<{owner:string;promise:Promise<PendingPlanIndex>}|null>(null),listRequest=useRef(0);
  const localAcknowledgements=useRef(0),acknowledgedRevisions=useRef(new Map<string,number>());
  const selectedRef=useRef<{owner:string;id:string}|null>(null);
  const activeOwner=useRef(ownerId),allowed=useRef(false),opening=useRef(false),generation=useRef(0);
  activeOwner.current=ownerId;allowed.current=phase==='authenticated';
  const isCurrent=(owner:string)=>activeOwner.current===owner;
  const api=enabled&&ownerId&&client?savedPlanAPI(client,ownerId):null;
  const getIndex=async(owner:string)=>{
    if(!isCurrent(owner))throw Error('Your account changed while opening draft recovery.');
    if(index.current?.owner===owner)return index.current.value;
    if(indexOpening.current?.owner===owner)return indexOpening.current.promise;
    const promise=(async()=>{
      const storage=await recoveryStorage(pendingPlansKey(owner));
      if(!isCurrent(owner)){storage.close?.();throw Error('Your account changed while opening draft recovery.');}
      if(index.current?.owner===owner){storage.close?.();return index.current.value;}
      let value:PendingPlanIndex;
      try{value=new PendingPlanIndex(owner,storage);}catch(error){storage.close?.();throw error;}
      index.current?.value.close();index.current={owner,value};return value;
    })();
    indexOpening.current={owner,promise};
    try{return await promise;}finally{if(indexOpening.current?.promise===promise)indexOpening.current=null;}
  };
  const forgetPending=async(id:string)=>{
    if(!ownerId)return;
    const pending=await getIndex(ownerId);
    if(pending.list().some(plan=>plan.id===id))await pending.remove([id]);
  };
  const refresh=async():Promise<void>=>{
    if(!api||!ownerId)throw Error('Upcoming plans are not available for this account yet.');
    if(!allowed.current)throw Error('Verify your account before loading upcoming plans.');
    const owner=ownerId,request=++listRequest.current,version=generation.current,knownWrites=localAcknowledgements.current;
    try{
      const pending=await getIndex(owner);
      if(!isCurrent(owner)||request!==listRequest.current||version!==generation.current)return;
      setScope(owner);setPlans(previous=>mergePendingPlans(previous.filter(plan=>!plan.pending),pending.list()));
      const next=await api.list();
      if(!isCurrent(owner)||request!==listRequest.current||version!==generation.current)return;
      if(knownWrites!==localAcknowledgements.current)return refresh();
      const recoverable:PendingPlan[]=[],stale:string[]=[];
      for(const draft of pending.list()){
        let recovery:Awaited<ReturnType<typeof recoveryStorage>>|undefined;
        try{
          recovery=await recoveryStorage(savedPlanCacheKey(owner,draft.id));
          const raw=recovery.getItem(savedPlanCacheKey(owner,draft.id));
          if(raw){
            const cached=JSON.parse(raw);
            if(cached.owner!==owner||cached.planId!==draft.id||cached.version!==1)throw Error('Invalid recovery scope.');
            if(cached.desired||cached.operation){
              const meal=validatePlanMeal(cached.desired??cached.operation.snapshot,draft.id);
              recoverable.push({...draft,meal,serveInstant:cached.desiredServeInstant!==undefined?cached.desiredServeInstant:cached.operation?.document?.serveInstant??draft.serveInstant,timeZone:cached.desiredTimeZone??cached.operation?.timeZone??draft.timeZone,needsRecovery:true});
            }else if(cached.base){
              if(next.some(plan=>plan.id===draft.id))recoverable.push({...draft,needsRecovery:false});
              else if(selectedRef.current?.id===draft.id&&store.current?.dirty())recoverable.push(draft);
              else stale.push(draft.id);
            }else recoverable.push(draft);
          }else if((draft.sourceRevision??0)>0&&!draft.needsRecovery)stale.push(draft.id);
          else recoverable.push(draft);
        }catch{recoverable.push({...draft,needsRecovery:true});}
        finally{recovery?.close?.();}
      }
      if(stale.length)await pending.remove(stale);
      if(!isCurrent(owner)||request!==listRequest.current||version!==generation.current)return;
      setPlans(mergePendingPlans(next,recoverable));setListPhase('saved');setListError('');
    }catch(e){
      if(isCurrent(owner)&&request===listRequest.current&&version===generation.current){setListPhase('load-error');setListError(e instanceof Error?e.message:'Could not load upcoming plans.');}
      throw e;
    }
  };
  const stopBackground=()=>{
    backgroundGeneration.current++;worker.current?.store?.dispose();worker.current?.release();worker.current=null;
  };
  const requestAutomatic=(restart=false)=>{
    if(restart){retryAttempt.current=0;resumeSelected.current=true;if(retryTimer.current)clearTimeout(retryTimer.current);retryTimer.current=null;}
    if(automaticRun.current){resumeAgain.current=true;return;}
    void automatic.current?.();
  };
  const releaseSelection=()=>{
    store.current?.dispose();store.current=null;release.current?.();release.current=null;
    selectedRef.current=null;selectedReadonly.current=false;setSelected(null);setState(initial);
  };
  useEffect(()=>{
    generation.current++;opening.current=false;releaseSelection();index.current?.value.close();index.current=null;setPlans([]);setAutomaticPhase('saved');setActionError('');setScope(ownerId);setListError('');setListPhase('loading');
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
    if(selectedRef.current?.id===id&&selectedRef.current.owner===ownerId){
      try{await store.current?.retryAutomatic();}catch{/* The existing saving indicator retains the unsaved phase. */}
      return;
    }
    opening.current=true;stopBackground();
    const owner=ownerId,version=generation.current;
    try{
      await close();
      if(!isCurrent(owner)||version!==generation.current)throw Error('Your account changed while opening the plan.');
      const lock=await acquire('how-many-beers:account-plan-writer:'+owner+':'+id);
      if(!isCurrent(owner)||version!==generation.current){lock.release();throw Error('Your account changed while opening the plan.');}
      release.current=lock.release;selectedReadonly.current=lock.readonly;
      const pending=await getIndex(owner);
      if(seed){await pending.add(seed);setScope(owner);setPlans(previous=>mergePendingPlans(previous.filter(plan=>!plan.pending),pending.list()));}
      else if(!pending.list().some(plan=>plan.id===id)){
        const known=plans.find(plan=>plan.id===id)??await api.read(id);
        if(!known)throw Error('This plan is no longer upcoming. Return Home to see your current cooks.');
        await pending.add(planMeal(known),known.revision);
      }
      const recovered=pending.list().find(plan=>plan.id===id);
      const recoveredSeed=seed??(recovered&&(recovered.sourceRevision??0)===0?planMeal(recovered):undefined);
      if(!isCurrent(owner)||version!==generation.current){lock.release();throw Error('Your account changed while opening the plan.');}
      const recovery=await recoveryStorage(savedPlanCacheKey(owner,id));
      if(!isCurrent(owner)||version!==generation.current){recovery.close?.();lock.release();throw Error('Your account changed while opening the plan.');}
      const next=new SavedPlanStore(owner,id,api,recovery,s=>{
        if(!isCurrent(owner)||version!==generation.current)return;
        setState(s);
        if(s.plan){
          if(acknowledgedRevisions.current.get(s.plan.id)!==s.plan.revision){acknowledgedRevisions.current.set(s.plan.id,s.plan.revision);localAcknowledgements.current++;}
          setPlans(previous=>orderPlans([...previous.filter(p=>p.id!==s.plan!.id),s.plan!]));
        }
      },()=>allowed.current&&isCurrent(owner),lock.readonly,recoveredSeed,recovered?{serveInstant:recovered.serveInstant,timeZone:recovered.timeZone}:undefined);
      store.current=next;selectedRef.current={owner,id};setSelected({owner,id});setState(next.state());
      await next.connect();
      if(recoveredSeed){try{await next.retryAutomatic();}catch{/* Keep the editable private draft and let autosave retry. */}}
      if(!next.state().meal)throw Error(next.state().error||'This plan could not be opened safely.');
      setActionError('');
    }catch(error){
      if(!store.current){release.current?.();release.current=null;setActionError(error instanceof Error?error.message:'This plan has not been saved.');}
      throw error;
    }finally{opening.current=false;requestAutomatic();}
  };
  const create=async(seed?:Meal)=>{
    const meal=migrateMeal(seed??newMeal());
    if(currentHasActuals(meal))throw Error('Use Cook Again to make a new plan without changing recorded cooking progress.');
    await open(meal.id,meal);
    return meal.id;
  };
  const forgetSelected=async()=>{
    const selection=selectedRef.current,current=store.current;
    if(selection&&current&&!selectedReadonly.current&&!current.dirty()&&current.state().plan)await forgetPending(selection.id);
  };
  const protectSelected=async()=>{
    const current=store.current,selection=selectedRef.current;
    if(!current||!selection)return;
    if(!isCurrent(selection.owner))throw Error('Confirm your account before protecting this draft.');
    const document=await current.protectDraft();
    const pending=await getIndex(selection.owner);await pending.protect(document,current.state().plan?.revision??0);
    setPlans(previous=>mergePendingPlans(previous.filter(plan=>!plan.pending),pending.list()));
  };
  const withPendingBackup=async(confirmed:SavedPlan[]):Promise<SavedPlan[]>=>{
    if(!ownerId||!isCurrent(ownerId)||!allowed.current)throw Error('Verify your account before exporting plans.');
    const pending=await getIndex(ownerId),documents=new Map(confirmed.map(plan=>[plan.id,plan])),ids=new Set(documents.keys());
    for(const draft of pending.list()){
      const recovery=await recoveryStorage(savedPlanCacheKey(ownerId,draft.id));
      try{
        if(!isCurrent(ownerId))throw Error('Your account changed while exporting plans.');
        const protectedPlan=backupPendingPlan(draft,recovery.getItem(savedPlanCacheKey(ownerId,draft.id)),ownerId,ids);
        if(protectedPlan)documents.set(protectedPlan.id,protectedPlan);
      }finally{recovery.close?.();}
    }
    return orderPlans([...documents.values()]);
  };
  const close=async()=>{
    try{await flush();await forgetSelected();}
    catch(error){
      const current=store.current,selection=selectedRef.current;
      if(!current||!selection||!isCurrent(selection.owner))throw error;
      if(!current.dirty()){
        // A read-only/unavailable document without local changes is safe to leave.
        if(current.state().phase==='conflict'||current.state().phase==='load-error'){releaseSelection();return;}
        throw error;
      }
      await protectSelected();
    }
    releaseSelection();
  };
  automatic.current=async()=>{
    if(automaticRun.current||!enabled||!ownerId||!api||!allowed.current||opening.current)return;
    const owner=ownerId,version=generation.current,background=backgroundGeneration.current;
    const valid=()=>isCurrent(owner)&&allowed.current&&version===generation.current&&background===backgroundGeneration.current&&!opening.current;
    const run=(async()=>{
      let needsRetry=false,unsaved=false,conflicted=false;
      try{
        if(resumeSelected.current){
          resumeSelected.current=false;
          const selectedStore=store.current;
          if(selectedRef.current?.owner===owner&&selectedStore){
            try{await selectedStore.retryAutomatic();}catch{/* Store phase and immutable request remain authoritative. */}
          }
        }
        if(!valid())return;
        const pending=await getIndex(owner);
        for(const draft of pending.list()){
          if(!valid())return;
          if(selectedRef.current?.id===draft.id)continue;
          const lock=await acquire('how-many-beers:account-plan-writer:'+owner+':'+draft.id);
          if(lock.readonly){lock.release();continue;}
          const entry={id:draft.id,release:lock.release,store:undefined as SavedPlanStore|undefined};worker.current=entry;
          let recovery:Awaited<ReturnType<typeof recoveryStorage>>|undefined;
          try{
            if(!valid())return;
            recovery=await recoveryStorage(savedPlanCacheKey(owner,draft.id));
            if(!valid())return;
            const raw=recovery.getItem(savedPlanCacheKey(owner,draft.id));
            const cached=raw?JSON.parse(raw):null;
            if(cached?.owner&&cached.owner!==owner)throw Error('Upcoming draft ownership could not be verified.');
            if(cached?.conflicted&&(cached.desired||cached.operation)){conflicted=true;continue;}
            const document=backupPendingPlan(draft,raw,owner,new Set());
            if(!document)continue;
            if(raw===null&&(draft.sourceRevision??0)>0){conflicted=true;continue;}
            setAutomaticPhase('syncing');
            const current=new SavedPlanStore(owner,draft.id,api,recovery,s=>{
              if(valid()&&s.phase==='syncing')setAutomaticPhase('syncing');
            },()=>valid()&&selectedRef.current?.id!==draft.id,false,planMeal(document),{serveInstant:document.serveInstant,timeZone:document.timeZone});
            entry.store=current;
            await current.connect();if(!valid())return;
            try{await current.retryAutomatic();}catch{/* The journal is retained until an acknowledged retry. */}
            if(!valid())return;
            const after=current.state();
            if(after.phase==='saved'&&!current.dirty()){
              await pending.remove([draft.id]);
              if(after.plan){localAcknowledgements.current++;setPlans(previous=>orderPlans([...previous.filter(plan=>plan.id!==draft.id),after.plan!]));}
            }else if(after.phase==='conflict')conflicted=true;
            else if(current.dirty()||after.phase==='load-error'){unsaved=true;needsRetry=after.phase!=='load-error'||needsRetry;}
          }catch(error){
            unsaved=true;needsRetry=!(error instanceof AccountConflict)||needsRetry;
          }finally{
            entry.store?.dispose();if(!entry.store)recovery?.close?.();entry.release();if(worker.current===entry)worker.current=null;
          }
        }
        if(!valid())return;
        try{await refresh();}catch{unsaved=true;needsRetry=true;}
      }catch{if(valid()){unsaved=true;needsRetry=true;}}
      finally{
        if(valid()){
          setAutomaticPhase(conflicted?'conflict':unsaved?'unsaved':'saved');
          if(needsRetry&&retryAttempt.current<4&&!retryTimer.current){
            const delay=[1000,2000,4000,8000][retryAttempt.current++];
            retryTimer.current=setTimeout(()=>{retryTimer.current=null;requestAutomatic();},delay);
          }
        }
      }
    })();
    automaticRun.current=run;
    try{await run;}finally{
      if(automaticRun.current===run){
        automaticRun.current=null;
        if(resumeAgain.current){resumeAgain.current=false;if(isCurrent(owner)&&allowed.current)requestAutomatic();}
      }
    }
  };
  useEffect(()=>{
    if(!enabled||!ownerId||!client||phase!=='authenticated')return;
    const resume=()=>{if(document.visibilityState!=='hidden')requestAutomatic(true);};
    const initialTimer=setTimeout(resume,0);
    window.addEventListener('online',resume);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
    return()=>{
      clearTimeout(initialTimer);if(retryTimer.current)clearTimeout(retryTimer.current);retryTimer.current=null;automaticRun.current=null;resumeAgain.current=false;stopBackground();
      window.removeEventListener('online',resume);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);
    };
    // Resume reads the current guarded owner/store refs instead of a stale editor closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[enabled,ownerId,client,phase]);
  const savingPhase:SavedPlanState['phase']=actionError||listPhase==='load-error'?'unsaved':automaticPhase==='conflict'?'conflict':automaticPhase==='syncing'?'syncing':automaticPhase==='unsaved'?'unsaved':plans.some(plan=>plan.pending)?'unsaved':listPhase==='loading'?'syncing':'saved';
  const retry=async()=>{if(store.current)await store.current.retry();else await refresh();};
  return {
    plans:scope===ownerId?plans:[],
    selectedId:selected?.owner===ownerId?selected.id:null,
    state:selected?.owner===ownerId?state:initial,
    listPhase,listError,savingPhase,actionError,store,open,create,flush,close,releaseSelection,forgetSelected,protectSelected,withPendingBackup,refresh,retry,
    hasSelection:()=>!!selectedRef.current&&selectedRef.current.owner===activeOwner.current,
  };
}
