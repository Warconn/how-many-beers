import type {PlannedTask} from './meal';
import type {CookEvent} from './cookState';
/** Only meaningful timed phases need an explicit physical-start action. */
export function physicalPhase(task:PlannedTask):{label:string}|null{
 if(task.recipeOrder===undefined){
  if(task.id.endsWith(':start'))return {label:/smoker|smok/i.test(task.title)?'On smoker now':'Begin cooking now'};
  if(task.id.endsWith(':rest')&&/rest|hold/i.test(task.title))return {label:'Begin rest now'};
  return null;
 }
 if(task.isCondition||!(task.durationMinutes!>0))return null;
 const verb=/^(roast|bake|smoke|grill|simmer|cool|rest)\b/i.exec(task.title)?.[1]?.toLowerCase();
 const labels:Record<string,string>={roast:'Begin roasting',bake:'Begin baking',smoke:'Begin smoking',grill:'Begin grilling',simmer:'Begin simmering',cool:'Begin cooling',rest:'Begin rest now'};
 return verb?{label:labels[verb]}:null;
}
/** Older automatic start+completion pairs remain in history, but cannot prove a
 * physical phase began. Explicit starts are tagged for unambiguous new records. */
export function physicalStartedEvent(events:CookEvent[],taskId:string):CookEvent|undefined{
 const relevant=events.filter(e=>e.taskId===taskId);
 const reopen=relevant.map(e=>e.kind).lastIndexOf('reopened');
 return relevant.slice(reopen+1).find(event=>{
  if(event.kind!=='started'||event.startSource==='activity')return false;
  if(event.startSource==='physical')return true;
  return !relevant.some(e=>e.occurredAt===event.occurredAt&&['completed','temperature','equipment'].includes(e.kind));
 });
}
