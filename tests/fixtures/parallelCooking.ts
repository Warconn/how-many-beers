import {createDish, newMeal} from '../../src/domain/meal';
import {startCookSession, type ExtendedMeal} from '../../src/domain/cookState';
import {parseRecipeText} from '../../src/domain/recipe';

// Synthetic reproduction from issue #3's published actions. No account records,
// owner IDs, private notes, measured bird weights or historical timestamps.
export const turkeyTime = (time:string) => `2026-11-22T${time}:00Z`;
export function twoTurkeyPlan():ExtendedMeal {
  const oven = {...createDish('turkey'), id:'oven', name:'Turkey (oven)'};
  const fryer = {...parseRecipeText('Deep-Fried Turkey', [
    'Confirm turkey is fully thawed, unstuffed and dry.',
    'Check measured turkey weight and fryer capacity.',
    'Season turkey.',
    'Prepare electric fryer within its oil-fill limits.',
    'Preheat fryer to the manual setting (60 minutes).',
    'Verify oil is ready.',
    'Lower turkey slowly into oil.',
    'Fry turkey until internal temperature reaches 165°F.',
    'Lift turkey to drain.',
    'Rest turkey (20 minutes).',
    'Carve and serve turkey.',
  ].join('\n')), id:'fryer', equipment:'Electric Fryer'};
  return {...newMeal(), id:'synthetic-two-turkey', name:'Thanksgiving Turkey',
    serveAt:turkeyTime('20:00'), // Nov 22, 3 PM America/New_York.
    dishes:[oven,fryer], events:[]};
}

export function recordedTurkeyBaseline():ExtendedMeal {
  const meal = startCookSession(twoTurkeyPlan(),turkeyTime('12:00'));
  delete meal.phasePlan!.activityVersion;
  // The reported baseline has eight checklist events and no physical evidence.
  meal.events = Array.from({length:8}, (_,i)=>({id:`synthetic-completion-${i}`,
    taskId:`fryer:step-${i+1}`, kind:'completed' as const,
    occurredAt:turkeyTime(`12:${String(i).padStart(2,'0')}`)}));
  meal.completed = Object.fromEntries(meal.events.map(e=>[e.taskId,e.occurredAt]));
  // Freeze the reported stored-plan defect: five oven activities, no effective
  // current fryer relationships, and one stale activity from a replaced dish.
  meal.phasePlan!.phases=meal.phasePlan!.phases.filter(p=>p.dishId!=='fryer');
  meal.phasePlan!.actions=Object.fromEntries(Object.entries(meal.phasePlan!.actions)
    .filter(([id])=>!id.startsWith('fryer:')));
  meal.phasePlan!.phases.push({id:'replaced-fryer:rest', dishId:'replaced-fryer',
    kind:'passive',startTaskId:'replaced-fryer:step-9',endTaskIds:[],
    durationTaskId:'replaced-fryer:step-9',minutes:20});
  meal.phasePlan!.actions['replaced-fryer:step-9']={starts:['replaced-fryer:rest']};
  meal.phasePlan!.order['replaced-fryer']=['replaced-fryer:step-9'];
  return meal;
}
