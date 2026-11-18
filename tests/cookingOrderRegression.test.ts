import {it,expect} from 'vitest';
import {createDish,newMeal} from '../src/domain/meal';
import {cookTimeline,startCookSession,recordEvent,type ExtendedMeal} from '../src/domain/cookState';
import {cookProjection} from '../src/domain/cookProjection';
import {guidedCookingSteps} from '../src/domain/cookingFocus';
const start='2026-11-18T15:22:00.000Z';
function fixture(state:'frozen'|'thawed'='thawed',startedAt=start):ExtendedMeal{
 const dishes=[{...createDish('brisket'),id:'brisket'},{...createDish('turkey'),id:'turkey',turkeyPrep:{state,thawDays:6,brineHours:22,dryHours:2.25}}];
 return startCookSession({...newMeal(),serveAt:'2026-11-21T18:00Z',dishes},startedAt);
}
function project(meal:ExtendedMeal,at=start){return cookProjection(meal,cookTimeline(meal),Date.parse(at));}
function next(meal:ExtendedMeal,at=start){const tasks=cookTimeline(meal),p=project(meal,at);return guidedCookingSteps(tasks.filter(t=>!meal.phasePlan?.suppressed.includes(t.id)),meal.completed,null,p.forecasts).current;}
for(const completed of [['prep'],['prep','season'],['prep','season','preheat']])it(`keeps the brisket window after early completion of ${completed.join(', ')}`,()=>{
 let meal=recordEvent(fixture(),'turkey:thaw','completed',start);
 meal=recordEvent(meal,'turkey:brine','completed',start);
 for(const key of completed)meal=recordEvent(meal,'brisket:'+key,'completed',start);
 const before=structuredClone(meal),p=project(meal);
 expect(p.forecasts['brisket:rest'].finish).toBe(p.forecasts['turkey:rest'].finish);
 expect(Date.parse(p.forecasts['brisket:start'].start!)).toBeGreaterThan(Date.parse(start));
 if(!completed.includes('season'))expect(Date.parse(p.forecasts['brisket:season'].start!)).toBeGreaterThan(Date.parse(start));
 expect(meal).toEqual(before);
 const restored=JSON.parse(JSON.stringify(meal));expect(project(restored)).toEqual(p);expect(next(restored)?.id).toBe(next(meal)?.id);
});
it('interleaves a real-clock brisket/turkey guide through brining, cooking, rest and serving',()=>{
 let meal=fixture(),clock=Date.parse(start);const sequence:string[]=[];
 for(let i=0;i<30;i++){
  const at=new Date(clock).toISOString(),current=next(meal,at);if(!current)break;
  const forecast=project(meal,at).forecasts[current.id];
  clock=Math.max(clock,Date.parse(forecast?.start??at));
  sequence.push(current.id);meal=recordEvent(meal,current.id,'completed',new Date(clock).toISOString());
 }
 expect(sequence).toContain('turkey:dry');expect(sequence).toContain('brisket:serve');
 expect(sequence.indexOf('turkey:dry')).toBeLessThan(sequence.indexOf('brisket:finish'));
 expect(sequence.indexOf('turkey:start')).toBeLessThan(sequence.indexOf('brisket:serve'));
 expect(Object.keys(meal.completed)).toHaveLength(cookTimeline(meal).length);
});
it('preserves an actually early brisket cooking start instead of inventing later actuals',()=>{
 let meal=recordEvent(fixture(),'turkey:brine','completed',start);
 for(const key of ['prep','season','preheat','start'])meal=recordEvent(meal,'brisket:'+key,'completed',start);
 const before=structuredClone(meal),p=project(meal);
 expect(p.forecasts['brisket:start'].start).toBe(start);expect(meal).toEqual(before);
});

it('retains the brisket window after six days of recorded turkey thawing and early prep',()=>{
 const thawStart='2026-11-12T15:22:00.000Z';
 let meal=recordEvent(fixture('frozen',thawStart),'turkey:thaw','completed',thawStart);
 meal=recordEvent(meal,'turkey:brine','completed',start);
 meal=recordEvent(meal,'brisket:prep','completed',start);
 const before=structuredClone(meal),p=project(meal);
 expect(p.forecasts['brisket:season'].start).toBe('2026-11-19T01:27:00.000Z');
 expect(p.forecasts['brisket:rest'].finish).toBe(p.forecasts['turkey:rest'].finish);
 expect(p.phases!.find(phase=>phase.id==='turkey:thaw')).toMatchObject({actualStart:thawStart,actualEnd:start});
 expect(meal).toEqual(before);
});
