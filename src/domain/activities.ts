import type {Dish, PlannedTask} from './meal';

export const activityStages = {preparing:'Preparing',preheating:'Preheating',cooking:'Cooking',holding:'Holding'} as const;
export type ActivityStage = keyof typeof activityStages;
export type RecipeActivity = {
  id:string; stage:ActivityStage; startStepId:string; endStepId:string|null;
  checkpointStepIds:string[]; provenance:'inferred'|'confirmed'|'template';
  durationStepId?:string;
};
export type ActivityMetadata = {version:1;definitions:RecipeActivity[];dismissedStartStepIds?:string[];templateVersion?:2};
export const ACTIVITY_PARAMETER = 'hmbActivitiesV1';
const key=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
export function isActivityMetadata(v:unknown):v is ActivityMetadata {
  if(!v||typeof v!=='object'||Array.isArray(v))return false;
  const m=v as ActivityMetadata;
  return m.version===1&&Array.isArray(m.definitions)&&m.definitions.length<=500
    &&new Set(m.definitions.map(d=>d?.id)).size===m.definitions.length
    &&m.definitions.every(d=>d&&Object.keys(d).every(k=>['id','stage','startStepId','endStepId','checkpointStepIds','provenance','durationStepId'].includes(k))
      &&key(d.id)&&Object.hasOwn(activityStages,d.stage)&&key(d.startStepId)&&(d.endStepId===null||key(d.endStepId))
      &&Array.isArray(d.checkpointStepIds)&&d.checkpointStepIds.length<=500&&d.checkpointStepIds.every(key)
      &&['inferred','confirmed','template'].includes(d.provenance)&&(d.durationStepId===undefined||key(d.durationStepId)))
    &&(m.dismissedStartStepIds===undefined||Array.isArray(m.dismissedStartStepIds)&&m.dismissedStartStepIds.length<=500&&m.dismissedStartStepIds.every(key))
    &&(m.templateVersion===undefined||m.templateVersion===2)
    &&Object.keys(m).every(k=>['version','definitions','dismissedStartStepIds','templateVersion'].includes(k));
}
export function decodeActivities(value:unknown):ActivityMetadata {
  if(typeof value!=='string'||value.length>500000)throw Error('Invalid recipe activities.');
  let metadata:unknown;
  try{metadata=JSON.parse(value);}catch{throw Error('Invalid recipe activities.');}
  if(!isActivityMetadata(metadata))throw Error('Invalid recipe activities.');
  return metadata;
}

type SourceStep={id:string;title:string;instructions?:string;minutes:number|null};
export type ActivitySuggestion={activity:RecipeActivity;issue?:string};
const text=(s:SourceStep)=>s.title+' '+(s.instructions??'');
const food=(s:string):string[]=>(s.toLowerCase().match(/\b(?:turkey|wings?|brisket|brats?|chicken|ribs?|seeds?|potatoes|beef|pork|fish)\b/g)??[]).map(f=>f==='potatoes'?'potato':f.replace(/s$/,''));
function matchesFood(a:string,b:string){const left=food(a),right=food(b);return !left.length||!right.length||left.some(f=>right.includes(f));}
function startStage(s:SourceStep):ActivityStage|undefined {
  const t=s.title.trim();
  if(/^(?:preheat|(?:begin|start)\s+(?:preheating|heating|warming)|heat\b.*\b(?:oil|fryer|oven|smoker|grill)|prepare fryer and heat oil)/i.test(t))return 'preheating';
  if(/^(?:(?:begin|start)\s+(?:refrigerated\s+)?(?:brin|thaw|dry)|brine\b|thaw\b|air[- ]dry\b)/i.test(t))return 'preparing';
  if(/^(?:rest|cool|hold|(?:begin|start)\s+(?:safe,?\s+)?(?:monitored\s+)?(?:rest|hold)|remove\b[^.!?]*\b(?:rest|cool)\b|leave\b[^.!?]*\b(?:rest|cool)\b)/i.test(t))return 'holding';
  if(/^(?:cook\b|roast|bake|smoke|grill|simmer|boil|fry|flash[- ]fry|(?:begin|start)\s+(?:roast|bak|smok|grill|cook)|(?:put|place|load|lower)\b.+\b(?:on|in|into)\b)/i.test(t))return 'cooking';
}
function preheatResource(s:string){return /\b(?:oil|fryer)\b/i.test(s)?'oil':s.toLowerCase().match(/\b(?:oven|smoker|grill|pan|pot)\b/)?.[0];}
function cookingResource(s:string){return /\b(?:oil|fryer|fry|frying|flash-fry)\b/i.test(s)?'fryer':/\b(?:smoker|smoke|smoking)\b/i.test(s)?'smoker':/\b(?:oven|roast|roasting|bake|baking)\b/i.test(s)?'oven':/\b(?:grill|grilling)\b/i.test(s)?'grill':undefined;}
function checkpointMatches(stage:ActivityStage,start:SourceStep,step:SourceStep){
 const a=text(start),b=text(step);
 if(stage==='preheating'){
  const resource=preheatResource(a),target=preheatResource(b);
  return (!food(b).length||!!resource&&target===resource)&&(!target||target===resource);
 }
 if(!matchesFood(a,b))return false;
 const source=cookingResource(a),target=cookingResource(b);
 return !target||source===target;
}
function isEnd(stage:ActivityStage,start:SourceStep,end:SourceStep):boolean {
  const a=text(start),b=text(end),t=end.title.trim();
  if(stage==='preheating'){
    const resource=preheatResource(a),target=preheatResource(b);
    if(resource&&target&&resource!==target||food(b).length&&!target)return false;
    return /^(?:verify|confirm|check)\b.*\bready\b|^(?:oil|oven|smoker|grill|fryer)\b.*\bready\b/i.test(t)
      ||startStage(end)==='cooking'&&(resource==='oil'?/\b(?:oil|fryer)\b/i.test(b):!!resource&&b.toLowerCase().includes(resource));
  }
  if(!matchesFood(a,b))return false;
  if(stage==='preparing')return /^(?:end\b.*\b(?:brine|thaw|dry)|remove\b.*\b(?:brine|refrigerator)|pat dry|drain\b|prepare\b|season\b)/i.test(t)||startStage(end)==='cooking';
  if(stage==='holding')return /^(?:serve|slice|carve|end\b.*\b(?:rest|hold)|remove\b.*\bhold)/i.test(t);
  const resource=cookingResource(a),target=cookingResource(b);
  if(/^(?:remove|lift|take)\b/i.test(t)&&resource&&target&&resource!==target)return false;
  const removal=/^(?:remove|lift)\b/i.test(t)||/^take\b.*\b(?:out|off|from)\b/i.test(t);
  if(removal&&/\b(?:lid|thermometer|probe|foil)\b/i.test(t))return false;
  return removal&&(food(b).length>0||!!resource&&target===resource)||startStage(end)==='holding';
}

/** Proposals are made only while authoring. No execution event is inferred. */
export function suggestActivities(steps:SourceStep[]):ActivitySuggestion[] {
  const result:ActivitySuggestion[]=[];
  for(let i=0;i<steps.length;i++){
    const start=steps[i],stage=startStage(start);if(!stage)continue;
    const end=steps.slice(i+1).find(s=>isEnd(stage,start,s));
    const ambiguous=stage==='cooking'&&(/\bthen\s+(?:roast|bake|smoke|grill|fry|cool|rest)\b/i.test(text(start))||!!end&&steps.slice(0,steps.indexOf(end)).some(s=>s!==start&&startStage(s)==='cooking'&&isEnd(stage,s,end)
      &&(!matchesFood(text(start),text(s))||!!cookingResource(text(start))&&!!cookingResource(text(s))&&cookingResource(text(start))!==cookingResource(text(s)))));
    // "Lower turkey" followed by "Fry turkey" describes one interval.
    // A later cooking instruction sharing that exact removal is a checkpoint.
    if(!ambiguous&&stage==='cooking'&&end&&result.some(r=>!r.issue&&r.activity.stage==='cooking'&&r.activity.endStepId===end.id))continue;
    const endIndex=end?steps.indexOf(end):steps.length;
    const checkpoints=steps.slice(i+1,endIndex).filter(s=>/^(?:check|verify|confirm|record|inspect|spritz|wrap|adjust|raise|fry\b.*until)/i.test(s.title)&&!isEnd(stage,start,s)&&checkpointMatches(stage,start,s));
    const duration=stage==='cooking'&&start.minutes===null?steps.slice(i+1,endIndex).find(s=>startStage(s)==='cooking'):undefined;
    const activity:RecipeActivity={id:'activity-'+start.id,stage,startStepId:start.id,endStepId:end?.id??null,
      checkpointStepIds:checkpoints.map(s=>s.id),provenance:'inferred',...(duration?{durationStepId:duration.id}:{})};
    result.push({activity,...(ambiguous?{issue:'Several activities could use this end step. Review the boundaries.'}:!end?{issue:'Choose an end step.'}:{})});
  }
  return result;
}
export function detectedActivities(steps:SourceStep[]):ActivityMetadata {
  return {version:1,definitions:suggestActivities(steps).filter(s=>!s.issue).map(s=>s.activity)};
}
export function activityStepKey(dishId:string,id:string){return id.startsWith(dishId+':')?id.slice(dishId.length+1):id;}
export function activityTask(dish:Dish,steps:PlannedTask[],key:string):PlannedTask|undefined {
  return steps.find(s=>s.dishId===dish.id&&(activityStepKey(dish.id,s.id)===key||activityStepKey(dish.id,s.id)==='added_'+key));
}
export function activityIssue(dish:Dish,steps:PlannedTask[],activity:RecipeActivity):string|undefined {
  const start=activityTask(dish,steps,activity.startStepId),end=activity.endStepId?activityTask(dish,steps,activity.endStepId):undefined;
  if(!start)return 'Start step was removed. Choose another start.';
  if(!end)return 'Choose an end step.';
  const own=steps.filter(s=>s.dishId===dish.id);
  if(own.indexOf(start)>=own.indexOf(end))return 'End step must follow the start step.';
}

export function phaseStage(p:{id:string;kind:'heating'|'passive';stage?:ActivityStage}):ActivityStage|undefined {
  if(p.stage)return p.stage;
  if(p.kind==='heating')return 'cooking';
  if(/:(?:thaw|brine|dry)$/.test(p.id))return 'preparing';
  if(/:rest$/.test(p.id))return 'holding';
}
export function activityStatus(p:{id:string;kind:'heating'|'passive';stage?:ActivityStage;actualStart:string|null;actualEnd:string|null;elapsed:number}){
  if(!p.actualStart)return null;
  const stage=phaseStage(p);if(!stage)return null;
  const minutes=Math.max(0,Math.floor(p.elapsed)),hours=Math.floor(minutes/60),rest=minutes%60;
  const duration=hours?`${hours}h${rest?' '+rest+'m':''}`:`${minutes}m`;
  return `${activityStages[stage]} · ${duration} ${p.actualEnd?'actual':'elapsed'}`;
}
