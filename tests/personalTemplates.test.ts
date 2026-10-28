import {describe,it,expect} from 'vitest';
import {createDish,newMeal} from '../src/domain/meal';
import {cookTimeline} from '../src/domain/cookState';
import {buildDishTimeline} from '../src/domain/schedule';
import {applyBrisketTiming,brisketDefaults} from '../src/domain/brisketEstimate';
import {isStoredMeal} from '../src/domain/storageValidation';
import {validateBackup,exportBackup,emptyHistory} from '../src/domain/cookHistory';
const serve='2026-11-26T15:00:00-05:00';
const plan=(preset:'brisket'|'turkey'|'brats')=>{const d=createDish(preset);return {d,steps:buildDishTimeline(d,serve)};};
const at=(steps:ReturnType<typeof buildDishTimeline>,id:string)=>Date.parse(steps.find(t=>t.id.endsWith(':'+id))!.scheduledAt!);
describe('personal cooking templates',()=>{
 it('uses the two-hour covered tray before draining/searing and makes the extra allowance explicit',()=>{
  const {d,steps}=plan('brats');expect(d.pitTempF).toBe(250);expect(at(steps,'bath')-at(steps,'start')).toBe(120*60000);
  expect(at(steps,'serve')-at(steps,'bath')).toBe(15*60000);expect(steps.find(t=>t.id.endsWith(':bath'))!.instructions).toContain('not a measured duration');
  expect(steps.find(t=>t.id.endsWith(':hold'))!.instructions).toContain('140°F');
 });
 it('preserves estimated brisket provenance without seeding a guessed weight or modifying the source estimator',()=>{
  const {d,steps}=plan('brisket');expect(d.weightLb).toBeUndefined();expect(d.pitTempF).toBe(180);expect(steps.find(t=>t.id.endsWith(':prep'))!.instructions).toContain('not a measured weight');
  expect(at(steps,'season')).toBeLessThan(at(steps,'start'));expect(at(steps,'raise225')).toBeLessThan(at(steps,'wrap'));expect(at(steps,'wrap')).toBeLessThan(at(steps,'raise250'));
  const applied=applyBrisketTiming({...d,brisketPlan:{mode:'manual',inputs:{...brisketDefaults,weightLb:15}}},serve);
  const updated=buildDishTimeline(applied,serve);expect(updated.find(t=>t.id.endsWith(':preheat'))!.instructions).toContain('200°F');expect(updated.find(t=>t.id.endsWith(':raise225'))!.instructions).toContain('165°F');
 });
 it('plans thawing, brining and drying ahead of oven roasting, with an entire hour before serving',()=>{
  const {d,steps}=plan('turkey');expect(d.weightLb).toBe(22);expect(d.pitTempF).toBe(350);
  expect(at(steps,'brine')-at(steps,'thaw')).toBe(6*86400000);expect(at(steps,'dry')-at(steps,'brine')).toBe(22*3600000);expect(at(steps,'start')-at(steps,'dry')).toBe(2.25*3600000);
  expect(at(steps,'serve')-at(steps,'rest')).toBe(3600000);
  const thawed=buildDishTimeline({...d,turkeyPrep:{state:'thawed',thawDays:6,brineHours:22,dryHours:2.25}},serve);expect(at(thawed,'thaw')).toBe(at(thawed,'brine'));
  const remaining=buildDishTimeline({...d,turkeyPrep:{state:'thawing',thawDays:2,brineHours:12,dryHours:3}},serve);expect(at(remaining,'brine')-at(remaining,'thaw')).toBe(2*86400000);expect(at(remaining,'dry')-at(remaining,'brine')).toBe(12*3600000);
 });
 it('round trips prep settings and rejects malformed prep before restore',()=>{
  const meal={...newMeal(),serveAt:serve,dishes:[{...createDish('turkey'),turkeyPrep:{state:'thawing' as const,thawDays:2,brineHours:22,dryHours:2.25}}]};
  const backup=validateBackup(exportBackup(meal,emptyHistory(),serve));expect(cookTimeline(backup.active)).toEqual(cookTimeline(meal));
  expect(isStoredMeal({...meal,dishes:[{...meal.dishes[0],turkeyPrep:{...meal.dishes[0].turkeyPrep,thawDays:-1}}]})).toBe(false);
 });
});
