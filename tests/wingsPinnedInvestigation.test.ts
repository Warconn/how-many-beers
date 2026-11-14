import {describe,it,expect} from 'vitest';
import {newMeal,createDish} from '../src/domain/meal';
import {cookTimeline,editStep,setStepDuration,type ExtendedMeal} from '../src/domain/cookState';
import {planningReadiness} from '../src/domain/planningReadiness';

// Synthetic fixture for the reported early-first-step + 1 PM target pathway.
// The owner's exact saved durations are unavailable; 40-minute preparation makes
// the independent ten-minute constraint explicit rather than guessing their data.
const target='2026-11-14T18:00:00.000Z'; // 1 PM America/New_York.
const pin='2026-11-13T12:00:00.000Z';
const now=Date.parse('2026-11-12T12:00:00Z');
function fixture(extended=true){
 const d=createDish('wings');let m:ExtendedMeal={...newMeal(),serveAt:target,dishes:[d]};
 if(extended)m=setStepDuration(m,d.id+':prep',40);
 const first=cookTimeline(m).find(t=>t.id===d.id+':dry')!;
 m=editStep(m,first.id,first.title,first.instructions,{plannedTimeOnly:true,timingMode:'fixed',scheduledAt:pin,equipment:d.equipment,targetTempF:null});
 return {d,m};
}
describe('owner #114 early-pinned wings investigation regression',()=>{
 it('an early pin alone does not make an otherwise unchanged wings plan late',()=>{
  const {m}=fixture(false);expect(planningReadiness(m,cookTimeline(m),now)?.lateMinutes).toBe(0);
 });
 it('meets 1 PM with ample time after the early fixed first step, including reload',()=>{
  const {d,m}=fixture(),before=structuredClone(m);
  for(const candidate of [m,JSON.parse(JSON.stringify(m))]){
   const p=planningReadiness(candidate,cookTimeline(candidate),now)!;
   expect(p.readyAt).toBe(target);expect(p.lateMinutes).toBe(0);
   expect(p.tasks.find(t=>t.id===d.id+':dry')?.scheduledAt).toBe(pin);
   expect(p.conflicts).toEqual([]);expect(candidate.serveAt).toBe(target);
  }
  const flexible={...m,taskOverrides:{...m.taskOverrides,[d.id+':dry']:{}}};
  expect(planningReadiness(flexible,cookTimeline(flexible),now)?.readyAt).toBe(target);
  expect(m).toEqual(before);expect(m.events).toEqual([]);expect(m.completed).toEqual({});
 });
 it('keeps an insufficient fixed preparation anchor and reports remaining lateness',()=>{
  const {d,m}=fixture();const task=cookTimeline(m).find(t=>t.id===d.id+':prep')!;
  const pinned=editStep(m,task.id,task.title,task.instructions,{plannedTimeOnly:true,timingMode:'fixed',scheduledAt:task.scheduledAt,equipment:d.equipment,targetTempF:null});
  const p=planningReadiness(pinned,cookTimeline(pinned),now)!;
  expect(p.tasks.find(t=>t.id===task.id)?.scheduledAt).toBe(task.scheduledAt);
  expect(p.lateMinutes).toBe(10);
 });
 it('uses only available slack after fixed preparation rather than promising an impossible target',()=>{
  const {d,m}=fixture();const limited={...m,taskOverrides:{...m.taskOverrides,[d.id+':dry']:{scheduledAt:'2026-11-14T05:40:00.000Z'}}};
  // Drying ends 13:40Z, leaving only five minutes before the raw preparation.
  const p=planningReadiness(limited,cookTimeline(limited),now)!;
  expect(p.lateMinutes).toBe(5);expect(p.tasks.find(t=>t.id===d.id+':dry')?.scheduledAt).toBe('2026-11-14T05:40:00.000Z');
 });
 it('keeps independent dishes unchanged and never projects started cooking',()=>{
  const {m}=fixture();const other=createDish('brats'),combined={...m,dishes:[...m.dishes,other]},before=structuredClone(combined);
  const p=planningReadiness(combined,cookTimeline(combined),now)!;
  const baseline=planningReadiness({...m,dishes:[other]},cookTimeline({...m,dishes:[other]}),now)!;
  expect(p.tasks.filter(t=>t.dishId===other.id)).toEqual(baseline.tasks);expect(combined).toEqual(before);
  expect(planningReadiness({...combined,mode:'cooking'},cookTimeline(combined),now)).toBeNull();
 });
 it('keeps explicitly untimed template reminders untimed during backward adjustment',()=>{
  const d={...createDish('turkey'),turkeyPrep:{state:'thawed' as const,thawDays:0,brineHours:0,dryHours:0}};
  let m:ExtendedMeal={...newMeal(),serveAt:target,dishes:[d],taskOverrides:{[d.id+':thaw']:{scheduledAt:null}}};
  m=setStepDuration(m,d.id+':start',600);const before=structuredClone(m);
  const p=planningReadiness(m,cookTimeline(m),now)!;
  expect(p.tasks.find(t=>t.id===d.id+':thaw')?.scheduledAt).toBeNull();expect(m).toEqual(before);
 });

});
