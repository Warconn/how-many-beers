import type {Meal} from './meal';
import type {ExtendedMeal} from './cookState';
import {isStoredMeal} from './storageValidation';

export const CANCELED_KEY='how-many-beers:canceled:v1';
export type CanceledCook={state:'canceled';canceledAt:string;meal:ExtendedMeal};
export type CanceledLibrary={version:1;cooks:CanceledCook[]};
export const emptyCanceled=():CanceledLibrary=>({version:1,cooks:[]});
export function readCanceled(value:unknown):CanceledLibrary{
  if(!value||typeof value!=='object')throw Error('Invalid canceled cook records.');
  const v=value as CanceledLibrary;
  if(v.version!==1||!Array.isArray(v.cooks)||!v.cooks.every(c=>c&&c.state==='canceled'&&typeof c.canceledAt==='string'&&Number.isFinite(Date.parse(c.canceledAt))&&isStoredMeal(c.meal))||new Set(v.cooks.map(c=>c.meal.id)).size!==v.cooks.length)throw Error('Invalid canceled cook records.');
  return v;
}
/** Retained records are append-only. Importing an older backup cannot erase them. */
export function mergeCanceled(existing:CanceledLibrary,incoming:CanceledLibrary):CanceledLibrary{
  readCanceled(existing);readCanceled(incoming);
  const result=[...existing.cooks];
  for(const entry of incoming.cooks){
    const old=result.find(c=>c.meal.id===entry.meal.id);
    if(old){if(JSON.stringify(old)!==JSON.stringify(entry))throw Error('A canceled cook cannot be rewritten.');}
    else result.push(entry);
  }
  return {version:1,cooks:result};
}
export function retainCanceled(meal:Meal,library:CanceledLibrary,at:string):CanceledLibrary{
  if(!isStoredMeal(meal)||!Number.isFinite(Date.parse(at)))throw Error('This cook cannot be canceled safely.');
  const entry:CanceledCook={state:'canceled',canceledAt:new Date(at).toISOString(),meal:JSON.parse(JSON.stringify(meal))};
  return mergeCanceled(library,{version:1,cooks:[entry]});
}
