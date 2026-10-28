'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ACTIVE_KEY,HISTORY_KEY,emptyHistory,type HistoryLibrary} from '@/domain/cookHistory';
import {LocalCookStore,StorageConflict,JOURNAL_KEY,type LocalSnapshot} from '@/domain/localPersistence';
import {migrateMeal} from '@/domain/cookState';
import {newMeal,type Meal} from '@/domain/meal';

export function useLocalCook(enabled=true){
  const [meal,setMeal]=useState<Meal|null>(null);
  const [history,setHistory]=useState<HistoryLibrary>(emptyHistory);
  const [status,setStatus]=useState<'loading'|'saved'|'unsaved'|'conflict'|'recovery'>('loading');
  const [error,setError]=useState('');
  const store=useRef<LocalCookStore|null>(null);
  const current=useRef<LocalSnapshot|null>(null);
  const dirty=useRef(false);
  const writer=useRef(false);
  const publish=useCallback((next:LocalSnapshot)=>{
    current.current=next;setMeal(next.active);setHistory(next.history);
  },[]);
  useEffect(()=>{
    if(!enabled)return;
    let alive=true,release:(()=>void)|undefined;
    const load=(mayWrite:boolean)=>{
      if(!alive)return;
      writer.current=mayWrite;
      try{
        if(window.localStorage.getItem('how-many-beers:legacy-owner:v1')){store.current=null;throw Error('Earlier cooks are protected by an account.');}
        store.current=new LocalCookStore(window.localStorage);
        publish(store.current.load(mayWrite));setStatus(mayWrite?'saved':'conflict');
        if(!mayWrite)setError('Another tab is editing these cooks. Close the other cooking tab, then reload saved cooks here. You can export any unsaved work first.');
      }catch{
        publish({active:migrateMeal(newMeal()),history:emptyHistory()});setStatus('recovery');
        setError('Your saved data could not be read safely. It has not been replaced. Download recovery data before resetting saved cooks.');
      }
    };
    // One writer per origin prevents simultaneous check/write races. The
    // compare-before-write guard also catches old tabs and unsupported browsers.
    queueMicrotask(()=>{
      if(!alive)return;
      if(navigator.locks){
        void navigator.locks.request('how-many-beers:writer:v1',{ifAvailable:true},async lock=>{
          if(!alive)return;
          if(!lock){load(false);return;}
          const held=new Promise<void>(resolve=>{release=resolve;});load(true);await held;
        }).catch(()=>load(true));
      }else load(true);
    });
    const changed=(event:StorageEvent)=>{
      if(event.key==='how-many-beers:legacy-owner:v1'&&event.newValue){store.current=null;dirty.current=false;publish({active:migrateMeal(newMeal()),history:emptyHistory()});setStatus('recovery');setError('Earlier cooks are protected by an account. Sign in to recover them.');return;}

      if([ACTIVE_KEY,HISTORY_KEY,JOURNAL_KEY].includes(event.key??'')||event.key===null){
        setStatus(s=>s==='recovery'?s:'conflict');
        setError('Another tab changed the saved cook. Download a backup of this tab before reloading the latest saved data.');
      }
    };
    const leave=(event:BeforeUnloadEvent)=>{if(dirty.current){event.preventDefault();event.returnValue='';}};
    window.addEventListener('storage',changed);window.addEventListener('beforeunload',leave);
    return ()=>{alive=false;writer.current=false;release?.();window.removeEventListener('storage',changed);window.removeEventListener('beforeunload',leave);};
  },[publish,enabled]);
  const save=useCallback((change:{active?:Meal;history?:HistoryLibrary})=>{
    const snapshot=current.current;
    if(!snapshot||!store.current)throw Error('Browser storage is not available.');
    const active=change.active??snapshot.active,history=change.history??snapshot.history;
    try{
      if(!writer.current)throw Error('Another tab is editing these cooks. Close it, then reload saved cooks here.');
      if(window.localStorage.getItem('how-many-beers:legacy-owner:v1'))throw Error('Sign in to open your account cooks.');
      store.current.write({...change,...(dirty.current?{active}: {})});
      publish({active:migrateMeal(active),history});dirty.current=false;setStatus('saved');setError('');
    }catch(error){
      const reason=error instanceof StorageConflict||!writer.current?(error instanceof Error?error.message:'Another tab is editing these cooks.'):
        error instanceof DOMException&&['QuotaExceededError','NS_ERROR_DOM_QUOTA_REACHED'].includes(error.name)?'Device storage is full.':'This browser could not save your cook.';
      setError(reason+' Your latest changes are not saved. Download a backup before closing this tab.');
      setStatus(s=>s==='recovery'||s==='conflict'?s:'unsaved');
      throw error;
    }
  },[publish]);
  const patch=useCallback((fn:(m:Meal)=>Meal)=>{
    if(!current.current)return;
    const next=migrateMeal(fn(current.current.active));
    try{save({active:next});}
    catch{dirty.current=true;publish({...current.current,active:next});}
  },[publish,save]);
  const retry=()=>{if(current.current)save({active:current.current.active});};
  const reset=()=>{
    if(!writer.current)throw Error('Close the other cooking tab before resetting saved cooks.');
    if(!store.current)throw Error('Storage is unavailable. Try reopening this site after exporting your backup.');
    publish(store.current.reset());dirty.current=false;setStatus('saved');setError('');
  };
  const recoveryExport=()=>store.current?.recoveryExport()??JSON.stringify({format:'how-many-beers-recovery',error:'Browser storage could not be accessed.'});
  const restore=(snapshot:LocalSnapshot)=>{
    if(!writer.current)throw Error('Close the other cooking tab before restoring a backup.');
    if(status!=='recovery'){save(snapshot);return;}
    if(!store.current)throw Error('Storage is unavailable.');
    publish(store.current.reset(snapshot));dirty.current=false;setStatus('saved');setError('');
  };
  return {meal,history,status,error,setError,patch,save,retry,reset,restore,recoveryExport};
}
