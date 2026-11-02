import type {PlannedTask} from './meal';
import type {TaskOverride} from './cookState';
const stamp=(s:string|null|undefined)=>s&&Number.isFinite(Date.parse(s))?Date.parse(s):null;
const iso=(n:number|null)=>n!==null&&Number.isFinite(n)&&Math.abs(n)<=8640000000000000?new Date(n).toISOString():null;
const display=(n:number)=>new Date(n).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
export const sequenceCheckpoint=(t:PlannedTask)=>t.isCondition&&!t.templateStage;
/** A check has a position, not an invented activity length. An authored/entered
 * allowance can still reserve time after it without claiming food is ready. */
export const sequenceMinutes=(t:PlannedTask)=>t.durationMinutes??(sequenceCheckpoint(t)||t.id.endsWith(':serve')?0:null);
export const localStepKey=(t:Pick<PlannedTask,'id'|'dishId'>)=>t.id.startsWith(t.dishId+':')?t.id.slice(t.dishId.length+1):t.id;
export function sequenceTasks(tasks:PlannedTask[],keys:readonly string[]):PlannedTask[]{
 const order=new Map(keys.map((key,i)=>[key,i]));
 return tasks.map((t,i)=>({t,i})).sort((a,b)=>(order.get(localStepKey(a.t))??Infinity)-(order.get(localStepKey(b.t))??Infinity)||a.i-b.i).map(x=>x.t);
}
/** User order is authoritative. Choose a real fixed/saved anchor first, otherwise
 * the serving milestone; every subsequent free start follows the preceding end.
 * Unknown work breaks inference. No planning operation writes actual activity. */
export function planStepSequence(source:PlannedTask[],keys:readonly string[],serveAt:string,recorded:ReadonlySet<string>,overrides:Record<string,TaskOverride>={}):{tasks:PlannedTask[];warnings:string[]}{
 const tasks=sequenceTasks(source,keys).map((t,i)=>{
  const inherited=t.templateStage?.minutes??t.baseDurationMinutes??t.durationMinutes??(t.id.endsWith(':serve')?0:null);
  const duration=overrides[t.id]?.durationMinutes===undefined?inherited:overrides[t.id].durationMinutes!;
  return {...t,durationMinutes:duration,baseDurationMinutes:inherited,userSequence:true,recipeOrder:i};
 });
 const warnings:string[]=[],blocked=tasks.map(t=>t.timingMode==='unscheduled'),locked=tasks.map(t=>t.timingMode==='fixed'||recorded.has(t.id));
 const times=tasks.map((t,i)=>!blocked[i]&&locked[i]?stamp(t.scheduledAt):null),lengths=tasks.map(sequenceMinutes),target=stamp(serveAt);
 let anchor=times.findIndex(n=>n!==null);
 if(anchor<0){anchor=tasks.findIndex((t,i)=>t.id.endsWith(':serve')&&!blocked[i]);if(anchor>=0)times[anchor]=target;}
 if(anchor<0){anchor=tasks.length;times.push(target);}
 for(let i=anchor-1;i>=0;i--){if(!blocked[i]&&times[i+1]!==null&&lengths[i]!==null)times[i]=times[i+1]!-lengths[i]!*60000;}
 for(let i=anchor+1;i<tasks.length;i++){
  if(blocked[i])continue;
  const end=times[i-1]!==null&&lengths[i-1]!==null?times[i-1]!+lengths[i-1]!*60000:null;
  if(locked[i]){
   if(times[i]!==null&&end!==null&&end>times[i]!)warnings.push(`${tasks[i-1].title} is estimated to finish ${display(end)}, after ${tasks[i].title}'s ${tasks[i].timingMode==='fixed'?'fixed start':'saved time'} at ${display(times[i]!)}.`);
   else if(end===null&&times[i]!==null)warnings.push(`${tasks[i].title} stays at ${display(times[i]!)}, but ${tasks[i-1].title} still needs a time estimate.`);
  }else times[i]=end;
 }
 // A later fixed start may locate work after an unknown interval. Do not fill
 // the unknown interval itself, or force an earlier fixed start to move.
 for(let i=tasks.length-2;i>=0;i--)if(!blocked[i]&&!locked[i]&&times[i]===null&&times[i+1]!==null&&lengths[i]!==null)times[i]=times[i+1]!-lengths[i]!*60000;
 const result=tasks.map((t,i)=>({...t,scheduledAt:iso(times[i]),baseScheduledAt:iso(times[i]),scheduleAdjustmentMinutes:0}));
 const serve=result.find(t=>t.id.endsWith(':serve')),serveTime=stamp(serve?.scheduledAt);
 if(serveTime!==null&&target!==null&&serveTime!==target)warnings.push(`${serve!.title} is estimated at ${display(serveTime)}; your serving target is ${display(target)}.`);
 return {tasks:result,warnings};
}
