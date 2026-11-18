import {presets,type Meal,type PlannedTask,type Dish} from './meal';
import type {CookEvent,ExtendedMeal} from './cookState';
import {stepsForDish} from '../data/cookTemplates';
import {turkeyPreparation} from './turkeyPrep';
import {activityIssue,activityTask,activityStages,type ActivityStage} from './activities';

export type CookingPhase={id:string;dishId:string;kind:'heating'|'passive';startTaskId:string;endTaskIds:string[];durationTaskId:string;minutes:number|null;upperMinutes?:number;after?:string;leadMinutes?:number;stage?:ActivityStage;independent?:boolean};
export type PhaseAction={starts?:string[];ends?:string[];checkpoint?:{phaseId:string;fraction:number};observes?:string[]};
type PhaseRelationships={version:1;phases:CookingPhase[];actions:Record<string,PhaseAction>;order:Record<string,string[]>;suppressed:string[]};
export type PhasePlan=PhaseRelationships & {activityVersion?:1;originalPlan?:PhaseRelationships;forecastOrigin?:string};
export type PhaseObservation={phaseId:string;boundary:'start'|'end'};

/** Strict suggestions at import review only. Ambiguous multi-action text stays a
 * normal checklist item; these labels never create actual events by themselves. */
export function recipeCookingKind(title:string,minutes:number|null):'heating'|'passive'|undefined{
 if(minutes===null||minutes<=0)return;
 if(/^(?:cool|rest)\b|^remove\b[^.!?]*\b(?:cool|rest)\b|^leave\b[^.!?]*\b(?:cool|rest)\b/i.test(title))return 'passive';
 if(/^(?:roast|bake|smoke|grill|simmer|boil|fry)\b/i.test(title)&&! /\bthen\s+(?:roast|bake|smoke|grill|simmer|cool|rest)\b/i.test(title))return 'heating';
}

/** Persist authored relationships once when starting a fresh session. No title
 * heuristics during a cook and no reinterpretation of legacy activity/history. */
export function buildPhasePlan(meal:Meal,tasks:PlannedTask[]):PhasePlan{
 const plan:PhasePlan={version:1,activityVersion:1,phases:[],actions:{},order:{},suppressed:[]};
 const visible=new Map(tasks.map(t=>[t.id,t]));
 const action=(id:string)=>plan.actions[id]??(plan.actions[id]={});
 const phase=(d:Dish,key:string,start:string,ends:string[],kind:CookingPhase['kind'],minutes:number|null,after?:string,upperMinutes?:number)=>{
  const startTaskId=d.id+':'+start;if(!visible.has(startTaskId))return;
  const p:CookingPhase={id:d.id+':'+key,dishId:d.id,kind,startTaskId,endTaskIds:ends.map(k=>d.id+':'+k).filter(id=>visible.has(id)),durationTaskId:startTaskId,minutes,...(after?{after:d.id+':'+after}:{}),...(upperMinutes!==undefined?{upperMinutes}:{})};
  plan.phases.push(p);(action(startTaskId).starts??=[]).push(p.id);
  for(const id of p.endTaskIds)(action(id).ends??=[]).push(p.id);
  return p;
 };
 for(const d of meal.dishes){
  const own=tasks.filter(t=>t.dishId===d.id).sort((a,b)=>(a.recipeOrder??0)-(b.recipeOrder??0));
  plan.order[d.id]=own.map(t=>t.id);
  if(d.activities){
   const definitions=[...d.activities.definitions].sort((a,b)=>(activityTask(d,own,a.startStepId)?own.indexOf(activityTask(d,own,a.startStepId)!):Infinity)-(activityTask(d,own,b.startStepId)?own.indexOf(activityTask(d,own,b.startStepId)!):Infinity));
   for(const a of definitions){
    if(activityIssue(d,own,a))continue;
    const start=activityTask(d,own,a.startStepId)!,end=activityTask(d,own,a.endStepId!)!;
    const duration=activityTask(d,own,a.durationStepId??a.startStepId)??start;
    const kind=a.stage==='cooking'||a.stage==='preheating'?'heating':'passive';
    const startIndex=own.findIndex(t=>t.id===start.id),previous=own[startIndex-1];
    const prior=d.preset==='wings'&&a.id==='fry'?definitions.find(p=>p.id==='oil'):definitions.find(p=>p.id!==a.id&&(p.endStepId===a.startStepId||previous&&activityTask(d,own,p.endStepId??'')?.id===previous.id));
    let minutes=duration.durationMinutes??duration.templateStage?.minutes??null;
    if(d.preset==='wings')minutes=a.id==='heat'?Math.max(15,d.cookMinutes)-15:a.id==='oil'?10:a.id==='fry'?3:a.id==='dry'?480:a.id==='rest'?d.restMinutes:minutes;
    const p:CookingPhase={id:d.id+':'+a.id,dishId:d.id,kind,stage:a.stage,independent:true,startTaskId:start.id,endTaskIds:[end.id],durationTaskId:duration.id,minutes,...(prior?{after:d.id+':'+prior.id}:{}),...(d.preset==='wings'&&a.id==='rest'?{leadMinutes:2}:{})};
    plan.phases.push(p);(action(start.id).starts??=[]).push(p.id);(action(end.id).ends??=[]).push(p.id);
    for(const key of a.checkpointStepIds){const step=activityTask(d,own,key);if(step){(action(step.id).observes??=[]).push(p.id);action(step.id).checkpoint??={phaseId:p.id,fraction:1/2};}}
   }
   // Only the generated final serving row is replaced by the explicit Finish
   // cook action. An authored serve/carve/safety instruction remains visible.
   const last=own.filter(t=>!t.id.endsWith(':serve')).at(-1);
   if(plan.phases.some(p=>p.dishId===d.id&&p.stage==='holding'&&p.startTaskId===last?.id&&p.endTaskIds.includes(d.id+':serve'))&&!(meal as ExtendedMeal).taskOverrides?.[d.id+':serve'])plan.suppressed.push(d.id+':serve');
   continue;
  }
  if(d.preset==='custom'){
   let previous:CookingPhase|undefined;
   for(const t of own){
    const step=d.steps?.find(s=>d.id+':'+s.id===t.id);
    if(!step)continue;
    // Older saved plans may predate parser hints. Compile the same conservative
    // suggestions once at a fresh start, never from a running session's titles.
    const kind=step.cookingKind??recipeCookingKind(step.instructions??step.title,t.durationMinutes??step.minutes);
    if(!kind)continue;
    // Only explicitly timed, reviewed source steps carry these relationships.
    // A next physical instruction (including cool/rest) is a real transition.
    const key=t.id.slice(d.id.length+1);
    const p=phase(d,'phase-'+key,key,[],kind,step.minutes,previous?.id.slice(d.id.length+1));
    if(p&&previous){previous.endTaskIds.push(t.id);(action(t.id).ends??=[]).push(previous.id);}
    previous=p;
   }
   if(previous){
    const last=own.filter(t=>!t.id.endsWith(':serve')).at(-1);
    const servingEdit=(meal as ExtendedMeal).taskOverrides?.[d.id+':serve'];
    if(previous.kind==='passive'&&last?.id===previous.startTaskId&&!servingEdit)plan.suppressed.push(d.id+':serve');
   }
   continue;
  }
  const nominal=Math.max(15,d.cookMinutes),rest=Math.max(0,d.restMinutes)+(d.preset==='brisket'?d.brisketPlan?.applied?.inputs.holdBufferMinutes??0:0);
  const stages=d.preset==='brats'||d.preset==='wings'?15:0;
  const range=presets[d.preset].cookRangeMinutes;
  const upper=d.brisketPlan?.applied?.smokeMax??(range&&d.cookMinutes===presets[d.preset].cookMinutes?range[1]-stages:undefined);
  const heatEnd=d.preset==='brats'?'bath':d.preset==='wings'?'fry':'rest';
  const heat=phase(d,'heat','start',[heatEnd],'heating',nominal-stages,undefined,upper??undefined);
  if(d.preset==='brats'){
   phase(d,'sear','bath',['finish'],'heating',15,'heat');
   if(rest>0)phase(d,'rest','finish',['serve'],'passive',rest,'sear');
  }else if(d.preset==='wings'){
   phase(d,'fry','fry',['finish'],'heating',3);
   if(rest>0){const resting=phase(d,'rest','finish',['serve'],'passive',rest,'fry');if(resting)resting.leadMinutes=2;}
  }else if(rest>0)phase(d,'rest','rest',['serve'],'passive',rest,'heat');
  // A condition check is never a heat-end observation. The actual removal/rest
  // instruction is the physical boundary, even if all checks were ticked early.
  if(heat){
   const source=stepsForDish(d);
   for(const t of own){
    const key=t.id.slice(d.id.length+1),entry=source?.find(s=>s.id===key);
    if(!plan.actions[t.id]&&!t.templateStage&&(entry?.anchor==='progress'||key==='check'||key==='wrap'||key==='finish'||t.isCondition))action(t.id).checkpoint={phaseId:d.preset==='brats'&&key==='hold'?d.id+':sear':heat.id,fraction:entry?.anchor==='progress'?(entry.progress??0.5)*nominal/(nominal-stages):key==='finish'||key==='hold'?1:0.5};
   }
  }
  // Refrigerated preparation has real start/end boundaries too. Expiring these
  // allowances never confirms thawing/brining or safe holding.
  if(d.preset==='turkey'){
   const prep=turkeyPreparation(d);
   if(prep.state!=='thawed')phase(d,'thaw','thaw',[prep.brineHours>0?'brine':'dry'],'passive',prep.thawDays*1440);
   if(prep.brineHours>0)phase(d,'brine','brine',['dry'],'passive',prep.brineHours*60);
   if(prep.dryHours>0)phase(d,'dry','dry',['start'],'passive',prep.dryHours*60);
  }else if(d.preset==='wings')phase(d,'dry','dry',['prep'],'passive',480);
 }
 // Arbitrary planning moves remain allowed. If a template boundary was moved
 // before its own start, don't invent a new interpretation of that instruction.
 for(const d of meal.dishes){
  const order=plan.order[d.id];
  const ambiguous=plan.phases.some(p=>p.dishId===d.id&&p.endTaskIds.some(id=>order.indexOf(id)<order.indexOf(p.startTaskId)));
  if(ambiguous){plan.phases=plan.phases.filter(p=>p.dishId!==d.id);for(const id of order)delete plan.actions[id];plan.suppressed=plan.suppressed.filter(id=>!order.includes(id));}
 }
 // A heating instruction with no reviewed removal/transition has no reliable
 // physical end. Keep that ambiguous work in the ordinary checklist flow.
 const unsupported=new Set(plan.phases.filter(p=>p.kind==='heating'&&!p.endTaskIds.length).map(p=>p.id));
 plan.phases=plan.phases.filter(p=>!unsupported.has(p.id));
 for(const a of Object.values(plan.actions)){
  if(a.starts)a.starts=a.starts.filter(id=>!unsupported.has(id));
  if(a.ends)a.ends=a.ends.filter(id=>!unsupported.has(id));
  if(a.checkpoint&&unsupported.has(a.checkpoint.phaseId))delete a.checkpoint;
 }
 for(const p of plan.phases)if(p.after&&unsupported.has(p.after))delete p.after;
 for(const [index,p] of plan.phases.entries())if(p.after&&!plan.phases.slice(0,index).some(prior=>prior.id===p.after))delete p.after;
 return plan;
}

/** Read-only ownership filtering: preserve stored originals/history, but never
 * execute an orphan or a cross-dish action. Active hidden boundaries retain facts. */
export function effectivePhasePlan(meal:Meal,tasks:PlannedTask[]):PhasePlan|undefined {
 const plan=meal.phasePlan;if(!plan)return;
 const dishes=new Set(meal.dishes.map(d=>d.id)),byId=new Map(tasks.map(t=>[t.id,t]));
 const observed=new Set(((meal as ExtendedMeal).events??[]).flatMap(e=>(e.phaseObservations??[]).map(o=>o.phaseId)));
 const phases=plan.phases.filter(p=>dishes.has(p.dishId)&&(!byId.has(p.startTaskId)||byId.get(p.startTaskId)?.dishId===p.dishId)
   &&p.endTaskIds.every(id=>!byId.has(id)||byId.get(id)?.dishId===p.dishId)
   &&(!p.independent||observed.has(p.id)||byId.has(p.startTaskId)&&p.endTaskIds.length>0&&p.endTaskIds.every(id=>byId.has(id))));
 const known=new Map(phases.map(p=>[p.id,p]));
 const actions:Record<string,PhaseAction>={};
 for(const [id,a] of Object.entries(plan.actions)){
  const task=byId.get(id);if(!task)continue;
  const owns=(phaseId:string)=>known.get(phaseId)?.dishId===task.dishId;
  actions[id]={...(a.starts?{starts:a.starts.filter(p=>owns(p)&&known.get(p)?.startTaskId===id)}:{}),
   ...(a.ends?{ends:a.ends.filter(p=>owns(p)&&known.get(p)?.endTaskIds.includes(id))}:{}),
   ...(a.observes?{observes:a.observes.filter(owns)}:{}),...(a.checkpoint&&owns(a.checkpoint.phaseId)?{checkpoint:a.checkpoint}:{})};
 }
 return {...plan,phases,actions,order:Object.fromEntries(Object.entries(plan.order).filter(([id])=>dishes.has(id)).map(([id,ids])=>[id,ids.filter(k=>byId.get(k)?.dishId===id)])),suppressed:plan.suppressed.filter(id=>byId.has(id)&&phases.some(p=>p.dishId===byId.get(id)!.dishId&&p.kind==='passive'))};
}

export function taskActivityIds(meal:Meal,taskId:string,tasks:PlannedTask[]):string[]{
 const a=effectivePhasePlan(meal,tasks)?.actions[taskId];
 return [...new Set([...(a?.starts??[]),...(a?.ends??[]),...(a?.observes??[]),...(a?.checkpoint?[a.checkpoint.phaseId]:[])])];
}

export function activityBoundaryWarnings(meal:Meal,tasks:PlannedTask[]):string[]{
 const known=new Set(tasks.map(t=>t.id));
 return (meal.phasePlan?.phases??[]).filter(p=>p.independent&&meal.dishes.some(d=>d.id===p.dishId)&&(!known.has(p.startTaskId)||p.endTaskIds.some(id=>!known.has(id))))
  .map(p=>`${meal.dishes.find(d=>d.id===p.dishId)!.name}: ${p.stage?activityStages[p.stage]:'Activity'} needs review because its ${!known.has(p.startTaskId)?'start':'end'} step was removed. Recorded observations are retained.`);
}

export function phaseObservations(meal:Meal,phaseId:string){
 const observations=((meal as ExtendedMeal).events??[]).flatMap(e=>(e.phaseObservations??[]).filter(o=>o.phaseId===phaseId).map(o=>({event:e,boundary:o.boundary})));
 return {start:observations.filter(o=>o.boundary==='start').at(-1)?.event,end:observations.filter(o=>o.boundary==='end').at(-1)?.event};
}

/** Optional observation, stored using an existing allowed event kind/payload.
 * It is not a physical-start event and never changes a plan duration or actual. */
export function recordRemainingEstimate(meal:Meal,phaseId:string,minutes:number,occurredAt:string):ExtendedMeal{
 const phase=meal.phasePlan?.phases.find(p=>p.id===phaseId);
 if(!phase||!phaseObservations(meal,phaseId).start||phaseObservations(meal,phaseId).end)throw Error('Choose an active cooking phase.');
 if(!Number.isFinite(minutes)||minutes<0||minutes>43200)throw Error('Enter a remaining estimate between 0 and 43200 minutes.');
 if(!Number.isFinite(Date.parse(occurredAt)))throw Error('Choose a valid observation time.');
 if(Date.parse(occurredAt)<Date.parse(phaseObservations(meal,phaseId).start!.occurredAt))throw Error('The estimate must be recorded after the actual start.');
 const event:CookEvent={id:crypto.randomUUID(),taskId:phase.startTaskId,kind:'started',occurredAt,phaseEstimate:{phaseId,minutes},note:'Updated remaining estimate'};
 return {...meal,events:[...((meal as ExtendedMeal).events??[]),event]};
}
