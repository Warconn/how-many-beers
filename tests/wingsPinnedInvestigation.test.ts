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
describe('owner #114 early-pinned wings investigation (unfixed scheduling defect)',()=>{
 it('an early pin alone does not make an otherwise unchanged wings plan late',()=>{
  const {m}=fixture(false);expect(planningReadiness(m,cookTimeline(m),now)?.lateMinutes).toBe(0);
 });
 it('reproduces 1:10 PM despite ample time after the early fixed first step, including reload',()=>{
  const {d,m}=fixture(),before=structuredClone(m);
  for(const candidate of [m,JSON.parse(JSON.stringify(m))]){
   const p=planningReadiness(candidate,cookTimeline(candidate),now)!;
   expect(p.readyAt).toBe('2026-11-14T18:10:00.000Z');expect(p.lateMinutes).toBe(10);
   expect(p.tasks.find(t=>t.id===d.id+':dry')?.scheduledAt).toBe(pin);
   expect(p.conflicts).toEqual([]);expect(candidate.serveAt).toBe(target);
  }
  const flexible={...m,taskOverrides:{...m.taskOverrides,[d.id+':dry']:{}}};
  expect(planningReadiness(flexible,cookTimeline(flexible),now)?.readyAt).toBe(target);
  expect(m).toEqual(before);expect(m.events).toEqual([]);expect(m.completed).toEqual({});
 });
 it.fails('KNOWN DEFECT: flexible suffix should meet 1 PM without moving the early fixed first step',()=>{
  const {d,m}=fixture(),p=planningReadiness(m,cookTimeline(m),now)!;
  expect(p.tasks.find(t=>t.id===d.id+':dry')?.scheduledAt).toBe(pin);
  expect(p.readyAt).toBe(target);expect(p.lateMinutes).toBe(0);
 });
});
