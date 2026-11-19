import type {Meal} from './meal';
import type {ExtendedMeal} from './cookState';
import {cookTimeline} from './cookState';
import {activityStepKey,detectedActivities} from './activities';
import {buildPhasePlan,effectivePhasePlan,type PhaseAction} from './cookingPhases';

/** Versioned, idempotent relationship upgrade on the independent active snapshot.
 * Keep the original plan for rollback. Never reinterpret checklist completions,
 * modify events, or infer an observation from a duration or recipe instruction. */
export function upgradeActivityLinks(meal:Meal):ExtendedMeal {
 const plan=meal.phasePlan;
 if(!plan||plan.activityVersion===1)return meal;
 const tasks=cookTimeline(meal),events=(meal as ExtendedMeal).events??[];
 const authored={...meal,dishes:meal.dishes.map(d=>d.activities||d.preset!=='custom'?d:{...d,activities:detectedActivities(tasks.filter(t=>t.dishId===d.id).map(t=>({id:activityStepKey(d.id,t.id),title:t.title,instructions:t.instructions,minutes:t.durationMinutes??null})))})};
 const rebuilt=buildPhasePlan(authored,tasks);
 const observed=new Set(events.flatMap(e=>[...(e.phaseObservations??[]).map(o=>o.phaseId),...(e.activityId?[e.activityId]:[]),...(e.phaseEstimate?[e.phaseEstimate.phaseId]:[])]));
 const retained=plan.phases.filter(p=>observed.has(p.id)&&meal.dishes.some(d=>d.id===p.dishId));
 const retainedIds=new Set(retained.map(p=>p.id));
 rebuilt.phases=[...rebuilt.phases.filter(p=>!retainedIds.has(p.id)&&!retained.some(old=>old.startTaskId===p.startTaskId)),...retained];
 const strip=(a:PhaseAction):PhaseAction=>({...a,starts:a.starts?.filter(id=>!retainedIds.has(id)),ends:a.ends?.filter(id=>!retainedIds.has(id)),observes:a.observes?.filter(id=>!retainedIds.has(id)),checkpoint:a.checkpoint&&!retainedIds.has(a.checkpoint.phaseId)?a.checkpoint:undefined});
 rebuilt.actions=Object.fromEntries(Object.entries(rebuilt.actions).map(([id,a])=>[id,strip(a)]));
 for(const [id,a] of Object.entries(plan.actions)){
  const before=rebuilt.actions[id]??{};
  rebuilt.actions[id]={...before,
   starts:[...(before.starts??[]),...(a.starts??[]).filter(p=>retainedIds.has(p))],
   ends:[...(before.ends??[]),...(a.ends??[]).filter(p=>retainedIds.has(p))],
   observes:[...(before.observes??[]),...(a.observes??[]).filter(p=>retainedIds.has(p))],
   ...(a.checkpoint&&retainedIds.has(a.checkpoint.phaseId)?{checkpoint:a.checkpoint}:{})};
 }
 const originalPlan=structuredClone(plan);delete originalPlan.originalPlan;
 const next={...meal,phasePlan:{...rebuilt,activityVersion:1 as const,originalPlan}};
 return {...next,phasePlan:{...effectivePhasePlan(next,tasks)!,activityVersion:1,originalPlan}};
}

/** Rollback is lossless before recording any new-model activity. After that,
 * retain the upgrade and use corrections rather than orphan newly recorded facts. */
export function rollbackActivityLinks(meal:ExtendedMeal):ExtendedMeal {
 const original=meal.phasePlan?.originalPlan;if(!original)return meal;
 const known=new Set(original.phases.map(p=>p.id));
 if(meal.events?.some(e=>e.activityId&&!known.has(e.activityId)||e.phaseObservations?.some(o=>!known.has(o.phaseId))))throw Error('New activity has been recorded. Keep its relationships and correct the actual times instead.');
 return {...meal,phasePlan:structuredClone(original)};
}
