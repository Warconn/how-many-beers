import {describe,it,expect} from 'vitest';
import {LocalCookStore,JOURNAL_KEY,RECOVERY_KEY,StorageConflict} from '../src/domain/localPersistence';
import {ACTIVE_KEY,HISTORY_KEY,archiveCook,emptyHistory,validateBackup,exportBackup} from '../src/domain/cookHistory';
import {newMeal,createDish} from '../src/domain/meal';
import {migrateMeal,recordEvent,cookTimeline} from '../src/domain/cookState';

function memory(){
 const data=new Map<string,string>();let fail:(key:string,value?:string)=>boolean=()=>false;
 return {data,setFail:(fn:typeof fail)=>{fail=fn;},getItem:(k:string)=>data.get(k)??null,
  setItem:(k:string,v:string)=>{if(fail(k,v))throw Error('Quota exceeded');data.set(k,v);},
  removeItem:(k:string)=>{if(fail(k))throw Error('Storage unavailable');data.delete(k);}};
}
function seeded(){
 const storage=memory();const active=migrateMeal({...newMeal(),dishes:[createDish('brisket')]});
 const history=archiveCook(active,emptyHistory(),'Previous','2026-10-20T12:00:00Z');
 storage.setItem(ACTIVE_KEY,JSON.stringify(active));storage.setItem(HISTORY_KEY,JSON.stringify(history));
 const store=new LocalCookStore(storage);store.load();return {storage,store,active,history};
}
describe('local cook persistence and recovery',()=>{
 it('reads legacy version-one saves without changing bytes or actuals',()=>{
  const {storage,active}=seeded();const legacy=recordEvent(active,cookTimeline(active)[0].id,'completed','2026-10-25T23:00:00Z');
  storage.setItem(ACTIVE_KEY,JSON.stringify(legacy));const before=new Map(storage.data);
  const loaded=new LocalCookStore(storage).load();expect(loaded.active).toEqual(legacy);expect(storage.data).toEqual(before);
 });
 it.each(['{bad','{"version":2}','{"version":1,"dishes":[null]}'])('protects unreadable active data: %s',raw=>{
  const storage=memory();storage.setItem(ACTIVE_KEY,raw);const store=new LocalCookStore(storage);
  expect(()=>store.load()).toThrow();expect(()=>store.write({active:newMeal()})).toThrow(/protected/);
  expect(storage.getItem(ACTIVE_KEY)).toBe(raw);expect(JSON.parse(store.recoveryExport()).active).toBe(raw);
 });
 it('protects invalid history rather than replacing it with an empty library',()=>{
  const {storage}=seeded();storage.setItem(HISTORY_KEY,'{"version":1,"cooks":[null]}');
  const store=new LocalCookStore(storage);expect(()=>store.load()).toThrow();expect(()=>store.write({history:emptyHistory()})).toThrow();
  expect(storage.getItem(HISTORY_KEY)).toContain('[null]');
 });
 it('does not acknowledge failed single-key writes',()=>{
  const {store,storage,active}=seeded();storage.setFail(k=>k===ACTIVE_KEY);expect(()=>store.write({active:{...active,name:'Unsaved'}})).toThrow();
  expect(JSON.parse(storage.getItem(ACTIVE_KEY)!).name).toBe(active.name);
  storage.setFail(()=>false);store.write({active:{...active,name:'Retried'}});expect(new LocalCookStore(storage).load().active.name).toBe('Retried');
 });
 it.each(['journal','history','active','commit'])('rolls back both records when %s writing fails',stage=>{
  const {storage,store}=seeded();const before=new Map(storage.data);let failed=false;
  storage.setFail((key,value)=>{
   const match=stage==='journal'?key===JOURNAL_KEY:stage==='history'?key===HISTORY_KEY:stage==='active'?key===ACTIVE_KEY:key===JOURNAL_KEY&&value?.includes('committed');
   if(match&&!failed){failed=true;return true;}return false;
  });
  expect(()=>store.write({active:newMeal(),history:emptyHistory()})).toThrow();expect(storage.data).toEqual(before);
  expect(new LocalCookStore(storage).load().history.cooks).toHaveLength(1);
 });
 it('recovers a crash between the two writes from the pending journal',()=>{
  const {storage,active,history}=seeded();const before={active:storage.getItem(ACTIVE_KEY),history:storage.getItem(HISTORY_KEY)};
  storage.setItem(JOURNAL_KEY,JSON.stringify({version:1,state:'pending',before}));storage.setItem(HISTORY_KEY,JSON.stringify(emptyHistory()));
  const recovered=new LocalCookStore(storage).load();expect(recovered.active).toEqual(active);expect(recovered.history).toEqual(history);expect(storage.getItem(JOURNAL_KEY)).toBeNull();
 });
 it('retains committed records when a crash occurs before journal cleanup',()=>{
  const {storage}=seeded();storage.setItem(ACTIVE_KEY,JSON.stringify({...newMeal(),name:'Committed'}));
  storage.setItem(JOURNAL_KEY,JSON.stringify({version:1,state:'committed'}));
  expect(new LocalCookStore(storage).load().active.name).toBe('Committed');
 });
 it('can read a committed pair even when journal cleanup is unavailable',()=>{
  const {storage,store}=seeded();storage.setFail((key,value)=>key===JOURNAL_KEY&&value===undefined);
  store.write({active:{...newMeal(),name:'Committed'},history:emptyHistory()});
  expect(new LocalCookStore(storage).load().active.name).toBe('Committed');
 });
 it('a read-only tab never rolls back another writer’s pending transaction',()=>{
  const {storage}=seeded();const before={active:storage.getItem(ACTIVE_KEY),history:storage.getItem(HISTORY_KEY)};
  storage.setItem(JOURNAL_KEY,JSON.stringify({version:1,state:'pending',before}));storage.setItem(HISTORY_KEY,JSON.stringify(emptyHistory()));
  const unchanged=new Map(storage.data);expect(()=>new LocalCookStore(storage).load(false)).toThrow(StorageConflict);expect(storage.data).toEqual(unchanged);
 });
 it('the adapter itself refuses writes and reset from a read-only tab',()=>{
  const {storage}=seeded();const store=new LocalCookStore(storage);store.load(false);const before=new Map(storage.data);
  expect(()=>store.write({active:newMeal()})).toThrow(StorageConflict);expect(()=>store.reset()).toThrow(StorageConflict);expect(storage.data).toEqual(before);
 });
 it('exports readable bytes even when a different storage read is denied',()=>{
  const {storage,active}=seeded();const store=new LocalCookStore({...storage,getItem:key=>{if(key===HISTORY_KEY)throw Error('Denied');return storage.getItem(key);}});
  expect(()=>store.load()).toThrow();const recovery=JSON.parse(store.recoveryExport());expect(JSON.parse(recovery.active)).toEqual(active);expect(recovery.readError).toContain('history');
 });
 it('retains the journal if rollback also fails, then recovers on a later load',()=>{
  const {storage,store,active}=seeded();storage.setFail(k=>k===ACTIVE_KEY);
  expect(()=>store.write({active:newMeal(),history:emptyHistory()})).toThrow();expect(storage.getItem(JOURNAL_KEY)).toContain('pending');
  expect(()=>store.write({active:newMeal()})).toThrow(/protected/);storage.setFail(()=>false);
  expect(new LocalCookStore(storage).load().active).toEqual(active);
 });
 it('blocks a stale tab without changing the newer saved data',()=>{
  const {storage,store,active}=seeded();const other=new LocalCookStore(storage);other.load();other.write({active:{...active,name:'Newer'}});
  expect(()=>store.write({active:{...active,name:'Stale'}})).toThrow(StorageConflict);
  expect(new LocalCookStore(storage).load().active.name).toBe('Newer');
 });
 it('preserves unreadable bytes in a recovery copy before confirmed reset',()=>{
  const storage=memory();storage.setItem(ACTIVE_KEY,'{original');const store=new LocalCookStore(storage);expect(()=>store.load()).toThrow();
  store.reset();expect(JSON.parse(storage.getItem(RECOVERY_KEY)!).active).toBe('{original');expect(new LocalCookStore(storage).load().history.cooks).toEqual([]);
 });
 it('rejects malformed nested backup data before any storage writes',()=>{
  const {active,history}=seeded();const backup=JSON.parse(exportBackup(active,history,'2026-10-25T12:00:00Z'));
  backup.active.customTasks=[{id:'broken'}];expect(()=>validateBackup(JSON.stringify(backup))).toThrow();
  backup.active=active;backup.history.cooks[0].plannedTimeline=[null];expect(()=>validateBackup(JSON.stringify(backup))).toThrow();
 });
 it('round-trips a large history and keeps active events intact',()=>{
  const {storage,store,active,history}=seeded();
  const large={version:1 as const,cooks:Array.from({length:1000},(_,i)=>({...history.cooks[0],id:'archive-'+i,feedback:'Notes '.repeat(100)}))};
  store.write({active,history:large});const loaded=new LocalCookStore(storage).load();expect(loaded.history.cooks).toHaveLength(1000);expect(loaded.active).toEqual(active);
  expect(validateBackup(exportBackup(loaded.active,loaded.history,'2026-10-25T12:00:00Z')).history.cooks).toHaveLength(1000);
 });
});
