import {ACTIVE_KEY,HISTORY_KEY,emptyHistory,isMeal,readHistory,type HistoryLibrary} from './cookHistory';
import {migrateMeal,type ExtendedMeal} from './cookState';
import {newMeal,type Meal} from './meal';

export const JOURNAL_KEY='how-many-beers:transaction:v1';
export const RECOVERY_KEY='how-many-beers:recovery:v1';
type RawPair={active:string|null;history:string|null};
export type RawRecovery=RawPair&{journal:string|null;previousRecovery?:string|null;readError?:string};
export type LocalSnapshot={active:ExtendedMeal;history:HistoryLibrary};
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type Journal={version:1;state:'pending';before:RawPair}|{version:1;state:'committed'};
export class StorageConflict extends Error{
  constructor(){super('Another tab changed the saved cook. Download a backup of this tab before reloading the latest saved data.');}
}
export class LocalCookStore{
  private baseline:RawPair={active:null,history:null};
  private blocked=true;
  private readOnly=false;
  raw:RawRecovery={active:null,history:null,journal:null};
  constructor(private storage:Store){}
  private pair():RawPair{return {active:this.storage.getItem(ACTIVE_KEY),history:this.storage.getItem(HISTORY_KEY)};}
  private put(key:string,value:string|null){if(value===null)this.storage.removeItem(key);else this.storage.setItem(key,value);}
  private rollback(pair:RawPair){this.put(HISTORY_KEY,pair.history);this.put(ACTIVE_KEY,pair.active);}
  private cleanup(){try{this.storage.removeItem(JOURNAL_KEY);}catch{/* Committed marker is safe to retain. */}}
  load(recover=true):LocalSnapshot{
    this.readOnly=!recover;
    try{
      this.raw={active:null,history:null,journal:null};
      const failures:string[]=[];
      for(const [field,key] of [['active',ACTIVE_KEY],['history',HISTORY_KEY],['journal',JOURNAL_KEY],['previousRecovery',RECOVERY_KEY]] as const){
        try{this.raw[field]=this.storage.getItem(key);}catch{failures.push(field);}
      }
      if(failures.length)throw Error('Could not read browser storage: '+failures.join(', '));
      if(this.raw.journal!==null){
        const journal=JSON.parse(this.raw.journal) as Journal;
        if(journal.version!==1||!['pending','committed'].includes(journal.state))throw Error('Unrecognized recovery journal.');
        if(journal.state==='pending'){
          if(!recover)throw new StorageConflict();
          const before=journal.before;
          if(!before||![before.active,before.history].every(v=>v===null||typeof v==='string'))throw Error('Incomplete recovery journal.');
          this.rollback(before);
        }
        if(recover){if(journal.state==='pending')this.storage.removeItem(JOURNAL_KEY);else this.cleanup();}
      }
      this.baseline=this.pair();
      const active=this.baseline.active===null?newMeal():JSON.parse(this.baseline.active);
      if(!isMeal(active))throw Error('Unrecognized saved cook.');
      const history=this.baseline.history===null?emptyHistory():readHistory(JSON.parse(this.baseline.history));
      this.blocked=false;
      return {active:migrateMeal(active),history};
    }catch(error){this.raw.readError=error instanceof Error?error.message:'Stored data could not be read.';this.blocked=true;throw error;}
  }
  assertCurrent(){
    if(this.readOnly)throw new StorageConflict();
    if(this.blocked)throw Error('Your saved data is protected. Download recovery data before resetting or restoring it.');
    const current=this.pair();
    if(current.active!==this.baseline.active||current.history!==this.baseline.history)throw new StorageConflict();
    const journal=this.storage.getItem(JOURNAL_KEY);
    if(journal!==null){
      const value=JSON.parse(journal) as Journal;
      if(value.state!=='committed')throw new StorageConflict();
      this.cleanup();
    }
  }
  write(change:{active?:Meal;history?:HistoryLibrary}){
    this.assertCurrent();
    if(change.active&&!isMeal(change.active))throw Error('The cook contains invalid data. Export a backup before retrying.');
    if(change.history)readHistory(change.history);
    const after={active:change.active?JSON.stringify(change.active):this.baseline.active,
      history:change.history?JSON.stringify(change.history):this.baseline.history};
    // A single key is already atomic. Preserve acknowledgement semantics even on
    // explicit saves whose value did not change (quota/private-mode checks).
    if(change.active&&!change.history){this.put(ACTIVE_KEY,after.active);this.baseline=after;return;}
    if(change.history&&!change.active){this.put(HISTORY_KEY,after.history);this.baseline=after;return;}
    const before={...this.baseline};
    this.storage.setItem(JOURNAL_KEY,JSON.stringify({version:1,state:'pending',before} satisfies Journal));
    try{
      this.put(HISTORY_KEY,after.history);
      this.put(ACTIVE_KEY,after.active);
      // This small atomic write is the commit point. A crash before it rolls back
      // on next load; after it, both records are durable even if cleanup fails.
      this.storage.setItem(JOURNAL_KEY,JSON.stringify({version:1,state:'committed'} satisfies Journal));
      this.baseline=after;this.cleanup();
    }catch(error){
      try{this.rollback(before);this.storage.removeItem(JOURNAL_KEY);}catch{this.blocked=true;}
      throw error;
    }
  }
  recoveryExport(){return JSON.stringify({format:'how-many-beers-recovery',version:1,exportedAt:new Date().toISOString(),...this.raw},null,2);}
  reset(snapshot:LocalSnapshot={active:migrateMeal(newMeal()),history:emptyHistory()}):LocalSnapshot{
    if(this.readOnly)throw new StorageConflict();
    // Preserve exact unreadable bytes locally before an explicitly confirmed reset.
    this.storage.setItem(RECOVERY_KEY,this.recoveryExport());
    const wasBlocked=this.blocked;
    this.storage.removeItem(JOURNAL_KEY);this.baseline=this.pair();this.blocked=false;
    try{this.write(snapshot);return snapshot;}catch(error){this.blocked=this.blocked||wasBlocked;throw error;}
  }
}
