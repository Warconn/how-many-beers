import {describe,it,expect} from 'vitest';
import {newMeal,createDish} from '../src/domain/meal';
import {migrateMeal,recordEvent,cookTimeline} from '../src/domain/cookState';
import {LocalCookStore,JOURNAL_KEY,StorageConflict} from '../src/domain/localPersistence';
import {ACTIVE_KEY,HISTORY_KEY,emptyHistory,archiveCook,exportBackup,validateBackup} from '../src/domain/cookHistory';
import {CANCELED_KEY,emptyCanceled,readCanceled,retainCanceled} from '../src/domain/canceledCooks';
const at='2026-11-05T02:00:00.000Z';
function setup(){
 const data=new Map<string,string>();let fail=(key:string,value?:string)=>false;
 const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{if(fail(key,value))throw Error('No storage');data.set(key,value);},removeItem:(key:string)=>{if(fail(key))throw Error('No storage');data.delete(key);}};
 let active=migrateMeal({...newMeal(),name:'Retain my cook',dishes:[createDish('brats')],mode:'cooking',startedAt:'2026-11-05T01:00:00.000Z'});
 active=recordEvent(active,cookTimeline(active)[0].id,'completed','2026-11-05T01:05:00.000Z');
 const history=archiveCook({...newMeal(),dishes:[createDish('side')]},emptyHistory(),'Prior history','2026-11-01T18:00:00.000Z');
 storage.setItem(ACTIVE_KEY,JSON.stringify(active));storage.setItem(HISTORY_KEY,JSON.stringify(history));
 const store=new LocalCookStore(storage);store.load();
 return {store,storage,data,active,history,setFail:(fn:typeof fail)=>{fail=fn;}};
}
describe('retained local cancellation',()=>{
 it('retains full actual records and history while releasing the active slot immediately',()=>{
  const {store,storage,active,history}=setup(),oldHistory=storage.getItem(HISTORY_KEY);
  const next=store.cancel(active.id,at);
  expect(next.active.id).not.toBe(active.id);expect(next.active.mode).toBe('planning');expect(next.history).toEqual(history);
  expect(storage.getItem(HISTORY_KEY)).toBe(oldHistory);
  expect(next.canceled).toEqual({version:1,cooks:[{state:'canceled',canceledAt:at,meal:active}]});
  const restored=new LocalCookStore(storage).load();expect(restored.canceled).toEqual(next.canceled);expect(restored.history.cooks).toHaveLength(1);
  store.write({active:{...next.active,name:'Next dinner'}});expect(new LocalCookStore(storage).load().active.name).toBe('Next dinner');
 });
 it('retains the latest unsaved in-memory meal only when cancellation commits',()=>{
  const {store,storage,active}=setup();const unsaved={...active,notes:{...active.notes,extra:'Still in this tab'}};
  const next=store.cancel(active.id,at,unsaved);expect(next.canceled!.cooks[0].meal).toEqual(unsaved);
  expect(JSON.parse(storage.getItem(CANCELED_KEY)!).cooks[0].meal.notes.extra).toBe('Still in this tab');
 });
 it.each(['journal','retained','history','active','commit'])('does not acknowledge cancellation if %s write fails',stage=>{
  const {store,storage,data,active,setFail}=setup(),before=new Map(data);let failed=false;
  setFail((key,value)=>{const match=stage==='journal'?key===JOURNAL_KEY:stage==='retained'?key===CANCELED_KEY:stage==='history'?key===HISTORY_KEY:stage==='active'?key===ACTIVE_KEY:key===JOURNAL_KEY&&!!value?.includes('committed');if(match&&!failed){failed=true;return true;}return false;});
  expect(()=>store.cancel(active.id,at)).toThrow();expect(data).toEqual(before);
  expect(new LocalCookStore(storage).load().active).toEqual(active);
 });
 it('recovers a crash after retention/rotation writes but before commit',()=>{
  const {storage,active,history}=setup();const before={active:storage.getItem(ACTIVE_KEY),history:storage.getItem(HISTORY_KEY),canceled:null};
  storage.setItem(JOURNAL_KEY,JSON.stringify({version:1,state:'pending',before}));storage.setItem(CANCELED_KEY,JSON.stringify(retainCanceled(active,emptyCanceled(),at)));storage.setItem(ACTIVE_KEY,JSON.stringify(newMeal()));
  const recovered=new LocalCookStore(storage).load();expect(recovered.active).toEqual(active);expect(recovered.history).toEqual(history);expect(recovered.canceled).toBeUndefined();expect(storage.getItem(CANCELED_KEY)).toBeNull();
 });
 it('keeps retention after a committed crash and blocks old-tab resurrection',()=>{
  const {store,storage,active}=setup(),stale=new LocalCookStore(storage);stale.load();
  const canceled=store.cancel(active.id,at);storage.setItem(JOURNAL_KEY,JSON.stringify({version:1,state:'committed'}));
  const recovered=new LocalCookStore(storage).load();expect(recovered.active.id).toBe(canceled.active.id);expect(recovered.canceled!.cooks[0].meal).toEqual(active);
  expect(()=>stale.write({active})).toThrow(StorageConflict);expect(()=>store.write({active})).toThrow(/canceled/);
  expect(()=>store.write({history:archiveCook(active,emptyHistory(),'','2026-11-05T03:00Z')})).toThrow(/canceled/);
 });
 it('cannot cancel another cook ID or write from a read-only tab',()=>{
  const {store,storage,active,data}=setup();const before=new Map(data);
  expect(()=>store.cancel('wrong',at)).toThrow(StorageConflict);
  const reader=new LocalCookStore(storage);reader.load(false);expect(()=>reader.cancel(active.id,at)).toThrow(StorageConflict);expect(data).toEqual(before);
 });
 it('includes retained records in backups and preserves them when older backups omit them',()=>{
  const {store,storage,active,history}=setup();const canceled=store.cancel(active.id,at),legacy=validateBackup(exportBackup({...newMeal(),name:'Legacy plan'},history,at));
  store.write(legacy);expect(new LocalCookStore(storage).load().canceled).toEqual(canceled.canceled);
  const backup=validateBackup(exportBackup(canceled.active,history,at,canceled.canceled));expect(backup.canceled).toEqual(canceled.canceled);
  const fresh=setup();fresh.store.write(backup);expect(new LocalCookStore(fresh.storage).load().canceled).toEqual(canceled.canceled);
  expect(()=>store.write(validateBackup(exportBackup(active,history,at)))).toThrow(/canceled/);
 });
 it('does not erase existing retention on an explicit reset or empty retention import',()=>{
  const {store,storage,active,history}=setup();const canceled=store.cancel(active.id,at);
  store.reset({active:migrateMeal(newMeal()),history,canceled:emptyCanceled()});expect(new LocalCookStore(storage).load().canceled).toEqual(canceled.canceled);
 });
 it('protects malformed retained records and rejects modified terminal entries',()=>{
  const {store,storage,active,data}=setup();const next=store.cancel(active.id,at),before=new Map(data);
  expect(()=>store.write({canceled:{version:1,cooks:[{...next.canceled!.cooks[0],canceledAt:'2026-11-05T03:00Z'}]}})).toThrow(/rewritten/);expect(data).toEqual(before);
  storage.setItem(CANCELED_KEY,'{unreadable');const broken=new LocalCookStore(storage);expect(()=>broken.load()).toThrow();expect(()=>broken.write({active:newMeal()})).toThrow(/protected/);expect(JSON.parse(broken.recoveryExport()).canceled).toBe('{unreadable');
  expect(()=>readCanceled({version:1,cooks:[{state:'completed',canceledAt:at,meal:active}]})).toThrow();
 });
});
