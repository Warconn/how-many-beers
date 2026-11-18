import {test,expect,type Page} from '@playwright/test';
import {cookTimeline,type ExtendedMeal} from '../src/domain/cookState';
import {phaseObservations} from '../src/domain/cookingPhases';
import {mealTime as at,timedMeal,holdingHandoffMeal,onTimeActions} from '../tests/fixtures/timedMealSchedule';
test.use({timezoneId:'America/New_York'});
test.setTimeout(90000);
const saved=(page:Page):Promise<ExtendedMeal>=>page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
async function open(page:Page,meal:ExtendedMeal,time:string){
 await page.clock.install({time:new Date(Date.parse(time)-1000)});await page.clock.pauseAt(new Date(time));
 await page.goto('/');await page.evaluate(m=>{localStorage.clear();localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m));},meal);await page.reload();
 await page.getByRole('button',{name:/Continue cooking/}).click();
 return page.getByRole('region',{name:'Current step',exact:true});
}
test('on-time doneness offers holding next without inventing an actual transition',async({page},info)=>{
 const meal=holdingHandoffMeal(),time=at(21,'12:00'),current=await open(page,meal,time),title=cookTimeline(meal).find(t=>t.id==='brisket:rest')!.title;
 await expect(current.getByRole('article')).toHaveAttribute('aria-label',title);
 await expect(current.getByLabel('Estimated start',{exact:true})).toHaveAttribute('datetime',time);
 await expect(page.getByLabel('Cook estimated finish',{exact:true})).toHaveAttribute('datetime',at(21,'18:00'));
 let stored=await saved(page);expect(stored.events).toEqual(meal.events);
 expect(phaseObservations(stored,'brisket:heat').end).toBeUndefined();expect(phaseObservations(stored,'brisket:rest').start).toBeUndefined();
 await page.screenshot({path:info.outputPath('holding-handoff.png'),scale:'css',style:'nextjs-portal{display:none}'});
 await current.getByRole('checkbox',{name:'Complete '+title,exact:true}).click();
 stored=await saved(page);expect(stored.events?.slice(0,meal.events?.length)).toEqual(meal.events);
 expect(stored.events?.slice(meal.events?.length)).toMatchObject([{kind:'completed',occurredAt:time,phaseObservations:[{phaseId:'brisket:heat',boundary:'end'},{phaseId:'brisket:rest',boundary:'start'}]}]);
 await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();
 expect((await saved(page)).events).toEqual(stored.events);
 expect(phaseObservations(await saved(page),'brisket:rest').start?.occurredAt).toBe(time);
});
test('the written twenty-action schedule keeps both holding handoffs and serves both dishes at 1 PM',async({page})=>{
 const meal=timedMeal(),current=await open(page,meal,at(20,'12:15')),titles=new Map(cookTimeline(meal).map(t=>[t.id,t.title]));
 let clock=Date.parse(at(20,'12:15'));
 for(const [id,time] of onTimeActions){
  const next=Date.parse(time);if(next>clock){await page.clock.fastForward(next-clock);clock=next;}
  await expect(current.getByRole('article')).toHaveAttribute('aria-label',titles.get(id)!);
  if(id==='brisket:rest'||id==='turkey:rest')await expect(current.getByLabel('Estimated start',{exact:true})).toHaveAttribute('datetime',time);
  await current.getByRole('checkbox',{name:'Complete '+titles.get(id),exact:true}).click();
 }
 const stored=await saved(page);expect(Object.keys(stored.completed)).toHaveLength(20);
 for(const id of ['brisket:rest','turkey:rest'])expect(phaseObservations(stored,id).end?.occurredAt).toBe(at(21,'18:00'));
 await expect(page.getByRole('region',{name:'Cook complete',exact:true})).toContainText('All steps checked');
});
