import {readHistory,type ArchivedCook} from '../cookHistory';
import {readCanceled,type CanceledCook} from '../canceledCooks';
import {parseSavedPlan,type SavedPlan} from '../../account/savedPlans';
import {convertMeal,restoreMeal,same,type MealConversion,type ServingMetadata} from './mealAdapter';

type RecordByKind={archived:ArchivedCook;canceled:CanceledCook;savedPlan:SavedPlan};
export type RecordKind=keyof RecordByKind;
export type RecordConversion<K extends RecordKind=RecordKind>={format:'how-many-beers-compatibility';schemaVersion:1;type:'retained-record';kind:K;meal:MealConversion;fields:Omit<RecordByKind[K],'meal'>;original:RecordByKind[K]};
export type RecordResult<K extends RecordKind=RecordKind>={status:'converted'|'unchanged';conversion:RecordConversion<K>}|{status:'skipped';reason:string;original:unknown};
function validate(kind:RecordKind,value:unknown){
 if(kind==='archived')readHistory({version:1,cooks:[value]});
 else if(kind==='canceled')readCanceled({version:1,cooks:[value]});
 else if(kind==='savedPlan')parseSavedPlan(value);
 else throw Error('Unsupported retained record kind.');
}
/** Additive structural conversion only. Original lifecycle/receipts/timeline are
 * retained independently; no finish/cancel/import is performed by this adapter. */
export function convertRetainedRecord<K extends RecordKind>(kind:K,value:unknown,metadata:ServingMetadata):RecordResult<K>{
 const original=structuredClone(value);
 try{
  if(value&&typeof value==='object'&&'format' in value){
   const old=value as RecordConversion<K>;
   if(old.kind!==kind||!same(old.meal.context.serving,metadata))throw Error('Incompatible conversion context.');
   restoreRetainedRecord(old);return {status:'unchanged',conversion:structuredClone(old)};
  }
  validate(kind,value);
  const record=value as RecordByKind[K];
  if(kind==='savedPlan'&&!same(metadata,{timeZone:(record as SavedPlan).timeZone,serveInstant:(record as SavedPlan).serveInstant}))throw Error('Saved-plan metadata differs.');
  const meal=convertMeal(record.meal,metadata);if(meal.status==='skipped')throw Error(meal.reason);
  const {meal:_meal,...fields}=record;
  const conversion={format:'how-many-beers-compatibility' as const,schemaVersion:1 as const,type:'retained-record' as const,kind,meal:meal.conversion,fields:structuredClone(fields),original:structuredClone(record)} as RecordConversion<K>;
  restoreRetainedRecord(conversion);return {status:'converted',conversion};
 }catch(e){return {status:'skipped',reason:e instanceof Error?e.message:'Unsupported record.',original};}
}
export function restoreRetainedRecord<K extends RecordKind>(conversion:RecordConversion<K>):RecordByKind[K]{
 if(conversion.format!=='how-many-beers-compatibility'||conversion.schemaVersion!==1||conversion.type!=='retained-record')throw Error('Unsupported compatibility envelope.');
 const restored={...structuredClone(conversion.fields),meal:restoreMeal(conversion.meal)} as RecordByKind[K];
 validate(conversion.kind,restored);
 if(!same(restored,conversion.original))throw Error('Retained record round-trip failed.');
 return restored;
}
/** A dry run over supplied copies, not a persistence migration runner. */
export function convertRecordBatch<K extends RecordKind>(kind:K,rows:{value:unknown;serving:ServingMetadata}[]){
 const counts={converted:0,unchanged:0,skipped:0,failed:0};
 const outcomes=rows.map(({value,serving})=>{
  try{const result=convertRetainedRecord(kind,value,serving);counts[result.status]++;return result;}
  catch(e){counts.failed++;return {status:'failed' as const,reason:e instanceof Error?e.message:'Non-JSON input.'};}
 });
 return {counts,outcomes};
}
