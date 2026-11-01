import type {Meal} from './meal';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown)=>typeof v==='string';
const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
const optional=(v:unknown,check:(v:unknown)=>boolean)=>v===undefined||check(v);
const nullableText=(v:unknown)=>v===null||text(v);
const duration=(v:unknown)=>v===null||(number(v)&&(v as number)>=0&&(v as number)<=43200);
const temperatures=(v:unknown)=>Array.isArray(v)&&v.every(t=>object(t)&&number(t.value)&&(t.value as number)>0&&(t.value as number)<=(t.unit==='F'?1000:538)&&['F','C'].includes(String(t.unit))&&['equipment','food','unknown'].includes(String(t.kind)));
const strings=(v:unknown)=>Array.isArray(v)&&v.every(text);
const record=(v:unknown,check:(v:unknown)=>boolean)=>object(v)&&Object.values(v).every(check);

export function isStoredTask(v:unknown):boolean{
  return object(v)&&['id','dishId','dishName','title','instructions'].every(k=>text(v[k]))
    &&nullableText(v.scheduledAt)&&typeof v.isCondition==='boolean'
    &&optional(v.durationMinutes,duration)&&optional(v.equipment,text)
    &&optional(v.targetTempF,x=>x===null||number(x));
}
function override(v:unknown):boolean{
  return object(v)&&['title','instructions','equipment'].every(k=>optional(v[k],text))
    &&['scheduledAt','recordedPlanAt'].every(k=>optional(v[k],nullableText))
    &&optional(v.durationMinutes,duration)&&optional(v.targetTempF,x=>x===null||number(x));
}
function inputs(v:unknown):boolean{
  return object(v)&&optional(v.weightLb,number)&&['trimmed','untrimmed'].includes(String(v.weightMeasured))
    &&['packer','flat'].includes(String(v.cut))&&['paper','foil','none'].includes(String(v.wrap))
    &&['meatchurch-staged-v1','traeger-225-v1'].includes(String(v.method))
    &&['pitTempF','prepMinutes','preheatMinutes','restMinutes','holdBufferMinutes'].every(k=>number(v[k]))
    &&typeof v.comparePersonal==='boolean';
}
function brisket(v:unknown):boolean{
  return object(v)&&inputs(v.inputs)&&['manual','estimate'].includes(String(v.mode))&&optional(v.applied,a=>
    object(a)&&a.version==='brisket-window-v1'&&inputs(a.inputs)&&strings(a.assumptions)&&strings(a.unknowns)
    &&['smokeMin','smokeMax'].every(k=>a[k]===null||number(a[k]))
    &&['recommendedStart','latestStart','prepStart'].every(k=>nullableText(a[k]))
    &&Array.isArray(a.sources)&&a.sources.every(s=>object(s)&&text(s.title)&&text(s.url)));
}

/** Validate before rendering or replacing stored data. Invalid date drafts remain
 * valid drafts; malformed shapes and unknown future formats are protected. */
export function isStoredMeal(v:unknown):v is Meal{
  if(!object(v)||v.version!==1||!text(v.id)||!v.id||!text(v.name)||!text(v.serveAt)
    ||!Array.isArray(v.dishes)||!record(v.completed,text)||!record(v.notes,text))return false;
  if(!v.dishes.every(d=>object(d)&&text(d.id)&&!!d.id&&text(d.name)&&text(d.equipment)
    &&['brisket','turkey','ribs','chicken','side','wings','brats','custom'].includes(String(d.preset))
    &&number(d.cookMinutes)&&(d.cookMinutes as number)>=0&&(d.cookMinutes as number)<=43200
    &&number(d.restMinutes)&&(d.restMinutes as number)>=0&&(d.restMinutes as number)<=43200
    &&optional(d.pitTempF,number)&&optional(d.weightLb,number)
    &&optional(d.steps,s=>Array.isArray(s)&&s.every(t=>object(t)&&text(t.id)&&text(t.title)&&duration(t.minutes)&&optional(t.instructions,text)&&optional(t.recipeTemperatures,temperatures)))
    &&optional(d.recipeSource,text)&&optional(d.recipeIngredients,strings)&&optional(d.recipeReference,text)
    &&optional(d.turkeyPrep,t=>object(t)&&['frozen','thawing','thawed'].includes(String(t.state))
      &&number(t.thawDays)&&(t.thawDays as number)>=0&&(t.thawDays as number)<=14
      &&['brineHours','dryHours'].every(k=>number(t[k])&&(t[k] as number)>=0&&(t[k] as number)<=48))
    &&optional(d.brisketPlan,brisket)))return false;
  return new Set(v.dishes.map(d=>(d as {id:string}).id)).size===v.dishes.length
    &&optional(v.mode,m=>m==='planning'||m==='cooking')&&optional(v.startedAt,text)
    &&optional(v.customTasks,t=>Array.isArray(t)&&t.every(isStoredTask))
    &&optional(v.taskOverrides,o=>record(o,override))
    &&optional(v.hiddenTaskIds,strings)&&optional(v.taskOrder,strings)
    &&optional(v.events,e=>Array.isArray(e)&&e.every(t=>object(t)&&text(t.id)&&text(t.taskId)&&text(t.occurredAt)
      &&['started','completed','reopened','temperature','equipment','removed'].includes(String(t.kind))
      &&optional(t.value,number)&&optional(t.note,text)&&optional(t.unit,u=>u==='°F'||u==='°C')));
}
