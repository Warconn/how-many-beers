import {it,expect} from 'vitest';
import {newMeal,createDish} from '../src/domain/meal';
import {planningDraftKey,readPlanningDraft,protectPlanningDraft} from '../src/account/planningDraft';
it('protects serving/name edits separately from account plans with owner isolation',()=>{
 const data=new Map<string,string>(),storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
 const meal={...newMeal(),name:'Sunday wings',serveAt:'2026-11-15T18:00'};const saved=protectPlanningDraft(storage,'one',meal,true);
 expect(readPlanningDraft(storage,'one')).toEqual(saved);expect(readPlanningDraft(storage,'two')).toBeNull();expect([...data.keys()]).toEqual([planningDraftKey('one')]);
});
it('keeps unreadable/wrong-owner drafts intact and refuses cooking actuals',()=>{
 let raw=JSON.stringify({version:1,owner:'other',meal:newMeal(),edited:true});const storage={getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}};
 const before=raw;expect(()=>readPlanningDraft(storage,'one')).toThrow();expect(raw).toBe(before);
 expect(()=>protectPlanningDraft(storage,'one',{...newMeal(),dishes:[createDish('brats')],mode:'cooking'})).toThrow();expect(raw).toBe(before);
});
it('does not pretend a draft is protected when browser storage fails',()=>{
 expect(()=>protectPlanningDraft({setItem:()=>{throw Error('storage unavailable');}},'one',newMeal())).toThrow('storage unavailable');
});
