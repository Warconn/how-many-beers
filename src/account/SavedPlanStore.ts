import {localDateTime,type Meal} from '../domain/meal';
import type {ExtendedMeal} from '../domain/cookState';
import {AccountConflict,equal,type RawCook} from './workspace';
import type {RecoveryStorage} from './recoveryStorage';
import {parseSavedPlan,planDocument,planMeal,planTimeZone,validatePlanMeal,type SavedPlan,type SavedPlanAPI} from './savedPlans';

type PlanOperation={id:string;revision:number;document:RawCook;timeZone:string;snapshot:ExtendedMeal};
type PlanCache={version:1;owner:string;planId:string;base:SavedPlan|null;desired:ExtendedMeal|null;desiredServeInstant?:string|null;desiredTimeZone?:string;operation:PlanOperation|null};
export type SavedPlanState={meal:ExtendedMeal|null;plan:SavedPlan|null;phase:'loading'|'load-error'|'saved'|'syncing'|'unsaved'|'conflict';error:string};
export const savedPlanCacheKey=(owner:string,id:string)=>`how-many-beers:account:v1:${owner}:plan:${id}`;
/** One document's recoverable edit; never writes the current cook or another plan. */
export class SavedPlanStore{
 readonly key:string;
 private base:SavedPlan|null=null;
 private desired:ExtendedMeal|null=null;
 private desiredServeInstant:string|null|undefined;
 private desiredTimeZone:string|undefined;
 private operation:PlanOperation|null=null;
 private visible:ExtendedMeal|null=null;
 private phase:SavedPlanState['phase']='loading';
 private error='';
 private baseline:string|null=null;
 private blocked=false;
 private recoveryRawAllowed=true;
 private disposed=false;
 private timer:ReturnType<typeof setTimeout>|undefined;
 private inflight:Promise<void>|null=null;
 constructor(readonly owner:string,readonly planId:string,private api:SavedPlanAPI,private storage:RecoveryStorage,
  private emit:(state:SavedPlanState)=>void,private maySend:()=>boolean=()=>true,private readonlyMode=false,seedMeal?:Meal,seedContext?:{serveInstant:string|null;timeZone:string}){
  this.key=savedPlanCacheKey(owner,planId);
  try{
   this.baseline=storage.getItem(this.key);
   if(this.baseline){
    const c=JSON.parse(this.baseline) as PlanCache;
    if(c.owner!==owner){this.recoveryRawAllowed=false;throw Error('Recovery owner mismatch.');}
    if(c.version!==1||c.planId!==planId)throw Error('Invalid plan recovery scope.');
    this.base=c.base?parseSavedPlan(c.base):null;
    if(this.base&&this.base.id!==planId)throw Error('Recovery plan mismatch.');
    this.desired=c.desired?validatePlanMeal(c.desired,planId):null;
    this.desiredServeInstant=c.desiredServeInstant;
    this.desiredTimeZone=c.desiredTimeZone;
    if(this.desiredServeInstant!==undefined&&this.desiredServeInstant!==null&&
      (typeof this.desiredServeInstant!=='string'||!Number.isFinite(Date.parse(this.desiredServeInstant))))
      throw Error('Invalid recovery serving instant.');
    if(this.desiredTimeZone!==undefined)new Intl.DateTimeFormat('en',{timeZone:this.desiredTimeZone});
    if(c.operation){
     const op=c.operation;
     validatePlanMeal(op.snapshot,planId);
     if(typeof op.id!=='string'||!op.id||!Number.isSafeInteger(op.revision)||op.revision<0||
       op.revision!==(this.base?.revision??0)||typeof op.timeZone!=='string'||!this.desired||
       !equal(op.snapshot,op.document?.meal)||!(op.document.serveInstant===null||
        typeof op.document.serveInstant==='string'&&Number.isFinite(Date.parse(op.document.serveInstant))))
      throw Error('Invalid plan recovery request.');
     new Intl.DateTimeFormat('en',{timeZone:op.timeZone});
     this.operation=op;
     // Older journals can recover their immutable request metadata without
     // reinterpreting a local input in a different browser time zone.
     if(this.desiredServeInstant===undefined&&equal(this.desired,op.snapshot))this.desiredServeInstant=op.document.serveInstant;
     if(this.desiredTimeZone===undefined&&equal(this.desired,op.snapshot))this.desiredTimeZone=op.timeZone;
    }
    this.visible=this.desired?this.displayDraft():(this.base?planMeal(this.base):null);
   }else if(seedMeal){
    this.desired=validatePlanMeal(seedMeal,planId);
    if(seedContext){
     if(!(seedContext.serveInstant===null||typeof seedContext.serveInstant==='string'&&Number.isFinite(Date.parse(seedContext.serveInstant))))
      throw Error('Invalid new-plan serving instant.');
     new Intl.DateTimeFormat('en',{timeZone:seedContext.timeZone});
    }
    this.desiredServeInstant=seedContext?seedContext.serveInstant:planDocument(this.desired).serveInstant;
    this.desiredTimeZone=seedContext?seedContext.timeZone:planTimeZone(this.desired,null);this.visible=this.displayDraft();this.phase='unsaved';
    this.persist();
   }
  }catch{
   this.blocked=true;this.phase='load-error';this.error='Saved plan recovery could not be read safely. Your draft has not been replaced.';
  }
 }
 private displayDraft():ExtendedMeal{return {...this.desired!,...(this.desiredServeInstant?{serveAt:localDateTime(new Date(this.desiredServeInstant))}:{})};}
 state():SavedPlanState{return {meal:this.visible,plan:this.base,phase:this.phase,error:this.error};}
 private publish(){if(!this.disposed)this.emit(this.state());}
 private persist(){
  if(this.readonlyMode)throw new AccountConflict('Another tab is editing this plan. Close it and reload here.');
  if(this.blocked)throw Error(this.error);
  if(this.storage.getItem(this.key)!==this.baseline)throw new AccountConflict('Another tab changed this plan. Download your draft before reloading.');
  const raw=JSON.stringify({version:1,owner:this.owner,planId:this.planId,base:this.base,desired:this.desired,desiredServeInstant:this.desiredServeInstant,desiredTimeZone:this.desiredTimeZone,operation:this.operation} satisfies PlanCache);
  this.storage.setItem(this.key,raw);this.baseline=raw;
 }
 private failed(error:unknown){
  this.phase=error instanceof AccountConflict?'conflict':this.visible?'unsaved':'load-error';
  this.error=error instanceof Error?error.message:'Could not save the plan. Keep it open and retry.';this.publish();
 }
 async connect():Promise<void>{
  if(this.disposed||this.blocked)return;
  if(this.inflight)await this.inflight.catch(()=>{});
  try{
   await this.storage.settled?.();
   const remote=await this.api.read(this.planId);if(this.disposed)return;
   if(remote&&this.base&&remote.revision<this.base.revision)return;
   if(this.readonlyMode){
    this.base=remote;this.desired=null;this.operation=null;this.visible=remote?planMeal(remote):this.visible;
    this.failed(new AccountConflict('Another tab is editing this plan. Close it and reload here.'));return;
   }
   if(this.operation&&remote?.writeId===this.operation.id){
    const done=this.operation;this.base=remote;this.operation=null;
    if(equal(this.desired,done.snapshot)){this.desired=null;this.desiredServeInstant=undefined;this.desiredTimeZone=undefined;}
   }else if(this.operation&&((remote?.revision??0)!==(this.base?.revision??0))){
    // Retry by immutable request ID to distinguish an acknowledged lost response
    // from a genuinely stale edit. Never rebase an unconfirmed write on a read.
    this.phase='unsaved';this.error='The last plan save is unconfirmed. Retry it or download your draft before loading the account version.';this.publish();return;
   }else if(this.desired&&((remote?.revision??0)!==(this.base?.revision??0))){
    this.failed(new AccountConflict('This plan changed on another device. Download your draft before loading the account version.'));return;
   }else this.base=remote;
   if(!remote&&!this.desired){this.failed(new AccountConflict('This plan is no longer upcoming. Return Home to see your current cooks.'));return;}
   this.visible=this.desired?this.displayDraft():(this.base?planMeal(this.base):null);this.phase=this.desired?'unsaved':'saved';this.error='';
   this.persist();await this.storage.settled?.();this.publish();if(this.desired)this.schedule();
  }catch(error){if(!this.disposed)this.failed(error);}
 }
 private schedule(){
  if(this.timer)clearTimeout(this.timer);
  this.timer=setTimeout(()=>{this.timer=undefined;void this.flush().catch(()=>{});},500);
 }
 edit(fn:(meal:Meal)=>Meal):void{
  if(!this.visible||this.blocked||this.readonlyMode||['conflict','load-error'].includes(this.phase))throw Error('Resolve plan saving before editing.');
  const previous=this.visible,next=validatePlanMeal(fn(this.visible),this.planId);
  if(next.serveAt!==previous.serveAt||this.desiredServeInstant===undefined){
   this.desiredServeInstant=next.serveAt===previous.serveAt&&this.base?this.base.serveInstant:planDocument(next).serveInstant;
   this.desiredTimeZone=planTimeZone(next,this.base);
  }
  this.desired=next;this.visible=this.displayDraft();
  try{
   this.persist();this.phase='syncing';this.error='';this.publish();
   void this.storage.settled?.().catch(error=>{if(!this.disposed)this.failed(error);});this.schedule();
  }catch(error){this.failed(error);}
 }
 async save(meal:Meal):Promise<void>{this.edit(()=>meal);await this.flush(true);}
 async flush(explicit=true):Promise<void>{
  if(this.inflight){await this.inflight;if(this.desired&&explicit)return this.flush(true);return;}
  if(this.disposed||!this.desired)return;
  if(this.blocked||this.readonlyMode||this.phase==='conflict')throw new AccountConflict(this.error||'This plan needs recovery.');
  if(!this.maySend()){this.failed(Error('Reconnect and verify your account before saving this plan.'));throw Error(this.error);}
  if(!this.operation)this.operation={id:crypto.randomUUID(),revision:this.base?.revision??0,
   document:{meal:this.desired,serveInstant:this.desiredServeInstant!==undefined?this.desiredServeInstant:planDocument(this.desired).serveInstant},timeZone:this.desiredTimeZone??planTimeZone(this.desired,this.base),snapshot:this.desired};
  const op=this.operation;
  const sending=(async()=>{
   try{
    this.persist();await this.storage.settled?.();if(this.disposed)return;
    this.phase='syncing';this.error='';this.publish();
    const remote=await this.api.write(this.planId,op.revision,op.id,op.document,op.timeZone);if(this.disposed)return;
    if(remote.id!==this.planId||remote.revision<=op.revision||
      !(remote.writeId===op.id||remote.writeReceipt?.operationId===op.id&&remote.writeReceipt.planId===this.planId))
      throw Error('The plan save has not been confirmed. Keep your draft open and retry.');
    const newerLocal=this.desired&&!equal(this.desired,op.snapshot),diverged=newerLocal&&remote.revision>op.revision+1;
    this.base=remote;this.operation=null;if(!newerLocal){this.desired=null;this.desiredServeInstant=undefined;this.desiredTimeZone=undefined;}
    this.visible=this.desired?this.displayDraft():planMeal(remote);this.phase=diverged?'conflict':this.desired?'syncing':'saved';
    this.error=diverged?'Another device changed this plan while your later edits were pending. Download your draft before loading the account version.':'';
    try{this.persist();await this.storage.settled?.();}catch(error){
     if(error instanceof AccountConflict){this.phase='conflict';this.error=error.message;}
     else if(diverged){this.phase='conflict';this.error+=' Recovery storage is unavailable; keep this page open and download your draft.';}
     else{this.phase=this.desired?'unsaved':'saved';this.error=this.desired?'Recovery storage is unavailable. Download your draft before closing.':'Your plan is saved, but recovery storage is unavailable. Download a backup before going offline.';}
    }
    this.publish();
   }catch(error){if(!this.disposed)this.failed(error);throw error;}
  })();
  this.inflight=sending;try{await sending;}finally{if(this.inflight===sending)this.inflight=null;}
  if(!this.disposed&&this.desired){
   if(this.state().phase==='conflict')throw new AccountConflict(this.error);
   if(explicit)await this.flush(true);else this.schedule();
  }
 }
 /** Retain a failed future-plan edit before returning to the separate live cook.
  * This acknowledges only local recovery, never a cloud save or a revision rebase. */
 async protectDraft():Promise<{meal:ExtendedMeal;serveInstant:string|null;timeZone:string}>{
  if(this.disposed||!this.maySend())throw Error('Confirm your account before protecting this plan draft.');
  if(this.inflight)await this.inflight.catch(()=>{});
  if(this.disposed||!this.maySend()||!this.visible)throw Error('Your account changed before the draft could be protected.');
  try{
   this.persist();await this.storage.settled?.();
   if(this.disposed||!this.maySend())throw Error('Your account changed before the draft could be protected.');
   return {meal:this.visible,
    serveInstant:this.desired?(this.desiredServeInstant!==undefined?this.desiredServeInstant:planDocument(this.desired).serveInstant):(this.base?this.base.serveInstant:planDocument(this.visible).serveInstant),
    timeZone:this.desired?this.desiredTimeZone??planTimeZone(this.desired,this.base):this.base?.timeZone??planTimeZone(this.visible,null)};
  }catch(error){
   // A failed recovery write must not unlock a revision conflict and allow a
   // later automatic save to overwrite the other device's plan.
   if(error instanceof AccountConflict)this.phase='conflict';
   else if(this.phase!=='conflict'&&this.phase!=='load-error')this.phase='unsaved';
   this.error=error instanceof Error?error.message:'The plan draft could not be protected. Keep this page open.';
   this.publish();throw error;
  }
 }
 async retry():Promise<void>{if(this.phase==='load-error'||!this.desired)return this.connect();await this.flush(true);}
 async reload():Promise<void>{
  if(this.inflight)await this.inflight.catch(()=>{});
  const remote=await this.api.read(this.planId);if(this.disposed)return;
  if(!remote)throw new AccountConflict('This plan is no longer upcoming. Return Home to see your current cooks.');
  this.base=remote;this.desired=null;this.desiredServeInstant=undefined;this.desiredTimeZone=undefined;this.operation=null;this.visible=planMeal(remote);this.phase='saved';this.error='';
  if(this.readonlyMode){this.failed(new AccountConflict('Another tab is editing this plan. Close it and reload here.'));return;}
  await this.storage.rebase?.();this.baseline=this.storage.getItem(this.key);this.blocked=false;
  this.persist();await this.storage.settled?.();this.publish();
 }
 dirty(){return !!this.desired||!!this.operation;}
 recoveryExport(){return JSON.stringify({format:'how-many-beers-plan-recovery',version:1,owner:this.owner,planId:this.planId,
  cache:this.recoveryRawAllowed?this.baseline:null,pending:this.recoveryRawAllowed?this.desired:null},null,2);}
 dispose(){this.disposed=true;if(this.timer)clearTimeout(this.timer);this.storage.close?.();}
}
