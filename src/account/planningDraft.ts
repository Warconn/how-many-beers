import type {Meal} from '../domain/meal';
import {validatePlanMeal} from './savedPlans';
import type {ExtendedMeal} from '../domain/cookState';
export const planningDraftKey=(owner:string)=>`how-many-beers:planning-draft:v1:${owner}`;
export type PlanningDraft={version:1;owner:string;meal:ExtendedMeal;edited:boolean};
/** Tab-local pre-dish authoring. Never a saved plan or a pending server write. */
export function readPlanningDraft(storage:Pick<Storage,'getItem'>,owner:string):PlanningDraft|null{
 const raw=storage.getItem(planningDraftKey(owner));if(!raw)return null;
 const value=JSON.parse(raw) as PlanningDraft;
 if(value.version!==1||value.owner!==owner||typeof value.edited!=='boolean')throw Error('This planning draft could not be read safely.');
 validatePlanMeal(value.meal);return value;
}
export function protectPlanningDraft(storage:Pick<Storage,'setItem'>,owner:string,meal:Meal,edited=false):PlanningDraft{
 const draft:PlanningDraft={version:1,owner,meal:validatePlanMeal(meal),edited};
 storage.setItem(planningDraftKey(owner),JSON.stringify(draft));return draft;
}
