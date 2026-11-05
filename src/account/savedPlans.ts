import type {SupabaseClient} from '@supabase/supabase-js';
import {isMeal} from '../domain/cookHistory';
import {migrateMeal, type ExtendedMeal} from '../domain/cookState';
import {localDateTime, type Meal} from '../domain/meal';
import {AccountConflict, type RawCook} from './workspace';

export type PlanWriteReceipt={operationId:string;planId:string};
export type SavedPlan={
  id:string;revision:number;meal:ExtendedMeal;serveInstant:string|null;timeZone:string;
  createdAt:string;updatedAt:string;writeId:string|null;writeReceipt?:PlanWriteReceipt;
};
export type SavedPlanAPI={
  list:()=>Promise<SavedPlan[]>;
  read:(planId:string)=>Promise<SavedPlan|null>;
  write:(planId:string,revision:number,writeId:string,document:RawCook,timeZone:string)=>Promise<SavedPlan>;
  import:(writeId:string,documents:PlanBackupDocument[])=>Promise<PlanImportResult>;
};
export function validatePlanMeal(value:unknown,expectedId?:string):ExtendedMeal{
  if(!isMeal(value)||(expectedId!==undefined&&value.id!==expectedId)||value.mode==='cooking'||value.startedAt||
    Object.keys(value.completed).length||(value as ExtendedMeal).events?.some(e=>['started','completed','temperature','equipment'].includes(e.kind)))
    throw Error('Upcoming plans cannot contain an active or completed cook.');
  return migrateMeal(value);
}
const validTime=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export function parseSavedPlan(value:unknown):SavedPlan{
  if(!value||typeof value!=='object')throw Error('This saved plan could not be read safely.');
  const p=value as SavedPlan;
  if(typeof p.id!=='string'||!p.id||!Number.isSafeInteger(p.revision)||p.revision<1||
    !(p.writeId===null||typeof p.writeId==='string')||typeof p.timeZone!=='string'||
    !validTime(p.createdAt)||!validTime(p.updatedAt)||!(p.serveInstant===null||validTime(p.serveInstant)))
    throw Error('Invalid saved plan metadata.');
  try{new Intl.DateTimeFormat('en',{timeZone:p.timeZone});}catch{throw Error('Invalid saved plan time zone.');}
  validatePlanMeal(p.meal,p.id);
  if(p.writeReceipt!==undefined&&(!p.writeReceipt||typeof p.writeReceipt.operationId!=='string'||p.writeReceipt.planId!==p.id))
    throw Error('Invalid saved plan receipt.');
  return p;
}
export function planMeal(plan:SavedPlan):ExtendedMeal{
  return migrateMeal({...plan.meal,...(plan.serveInstant?{serveAt:localDateTime(new Date(plan.serveInstant))}:{})});
}
export function planDocument(meal:Meal):RawCook{
  const valid=validatePlanMeal(meal),time=Date.parse(valid.serveAt);
  return {meal:valid,serveInstant:Number.isFinite(time)?new Date(time).toISOString():null};
}
export function planTimeZone(meal:Meal,base:SavedPlan|null):string{
  return base&&meal.serveAt===planMeal(base).serveAt?base.timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
}
export function orderPlans(plans:SavedPlan[]):SavedPlan[]{
  return [...plans].sort((a,b)=>(a.serveInstant??'9999').localeCompare(b.serveInstant??'9999')||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}
export function savedPlanAPI(client:SupabaseClient,owner:string):SavedPlanAPI{
  const call=async(name:string,values:Record<string,unknown>)=>{
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
    try{
      const {data,error}=await client.rpc(name,{expected_owner:owner,...values}).abortSignal(abort.signal);
      if(error){
        if(error.code==='40001')throw new AccountConflict('This plan changed on another device. Download your draft before loading the account version.');
        throw Error('Could not save or load this plan. Keep it open and retry.');
      }
      return data;
    }finally{clearTimeout(timer);}
  };
  return {
    import:async(writeId,documents)=>{
      const valid=validatePlanDocuments(documents);
      const value=await call('import_saved_cook_plans',{write_id:writeId,documents:valid});
      if(!value||!Array.isArray(value.plans)||value.importReceipt?.operationId!==writeId||
        !Array.isArray(value.importReceipt.planIds)||!equalPlanIds(value.importReceipt.planIds,valid.map(p=>p.id)))
        throw Error('Upcoming plans import has not been confirmed. Your existing cooks have not been replaced.');
      return {plans:orderPlans(value.plans.map(parseSavedPlan)),importReceipt:value.importReceipt};
    },
    list:async()=>{
      const value=await call('list_saved_cook_plans',{});
      if(!value||!Array.isArray(value.plans))throw Error('Upcoming plans could not be read safely.');
      const plans=value.plans.map(parseSavedPlan) as SavedPlan[];
      if(new Set(plans.map(p=>p.id)).size!==plans.length)throw Error('Duplicate upcoming plans.');
      return orderPlans(plans);
    },
    read:async id=>{
      const value=await call('read_saved_cook_plan',{target_plan_id:id});
      if(value===null)return null;
      const p=parseSavedPlan(value);if(p.id!==id)throw Error('The wrong plan was returned.');return p;
    },
    write:async(id,revision,writeId,document,timeZone)=>{
      validatePlanMeal(document.meal,id);
      return parseSavedPlan(await call('save_saved_cook_plan',{
        target_plan_id:id,expected_revision:revision,write_id:writeId,document,time_zone:timeZone,
      }));
    },
  };
}

export type PlanBackupDocument=RawCook&{id:string;timeZone:string};
export type PlanImportResult={plans:SavedPlan[];importReceipt:{operationId:string;planIds:string[]}};
const MAX_PLAN_BACKUP_BYTES=32*1024*1024;
const equalPlanIds=(a:string[],b:string[])=>a.length===b.length&&new Set(a).size===a.length&&a.every(id=>typeof id==='string'&&b.includes(id));
export function validatePlanDocuments(value:unknown):PlanBackupDocument[]{
  if(!Array.isArray(value))throw Error('Invalid upcoming plans backup.');
  const ids=new Set<string>();
  return value.map(v=>{
    if(!v||typeof v!=='object'||typeof v.id!=='string'||typeof v.timeZone!=='string'||
      !(v.serveInstant===null||validTime(v.serveInstant))||ids.has(v.id))throw Error('Invalid or duplicate upcoming plan.');
    validatePlanMeal(v.meal,v.id);
    try{new Intl.DateTimeFormat('en',{timeZone:v.timeZone});}catch{throw Error('Invalid plan time zone.');}
    ids.add(v.id);
    return {id:v.id,meal:v.meal,serveInstant:v.serveInstant,timeZone:v.timeZone};
  });
}
export function exportSavedPlans(plans:SavedPlan[],exportedAt=new Date().toISOString(),legacyPlan?:PlanBackupDocument):string{
  const documents=plans.map(p=>({id:p.id,meal:p.meal,serveInstant:p.serveInstant,timeZone:p.timeZone}));
  if(legacyPlan&&!documents.some(p=>p.id===legacyPlan.id))documents.push(legacyPlan);
  const value={format:'how-many-beers-upcoming-plans',version:1,exportedAt,plans:validatePlanDocuments(documents)};
  const json=JSON.stringify(value,null,2);if(new TextEncoder().encode(json).length>MAX_PLAN_BACKUP_BYTES)throw Error('Upcoming plans backup exceeds 32 MB.');
  return json;
}
export function validateSavedPlansBackup(raw:string):PlanBackupDocument[]{
  if(new TextEncoder().encode(raw).length>MAX_PLAN_BACKUP_BYTES)throw Error('Upcoming plans backup exceeds 32 MB.');
  const value=JSON.parse(raw);
  if(!value||value.format!=='how-many-beers-upcoming-plans'||value.version!==1||!validTime(value.exportedAt))
    throw Error('Choose an Upcoming plans backup. Cook/history backups use their separate restore action.');
  return validatePlanDocuments(value.plans);
}
