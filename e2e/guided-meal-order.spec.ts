import {test,expect,type Page} from '@playwright/test';
import {createDish,newMeal} from '../src/domain/meal';
import {cookTimeline,startCookSession,type ExtendedMeal} from '../src/domain/cookState';
import {cookProjection} from '../src/domain/cookProjection';
test.use({timezoneId:'America/New_York'});
const start='2026-11-18T15:22:00.000Z';
const saved=(page:Page):Promise<ExtendedMeal>=>page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
async function open(page:Page){
 const meal={...newMeal(),name:'Brisket and Turkey',serveAt:'2026-11-21T18:00Z',dishes:[{...createDish('brisket'),id:'brisket'},{...createDish('turkey'),id:'turkey',turkeyPrep:{state:'thawed' as const,thawDays:6,brineHours:22,dryHours:2.25}}]};
 await page.clock.install({time:new Date(Date.parse(start)-1000)});await page.clock.pauseAt(new Date(start));
 await page.goto('/');await page.evaluate(m=>{localStorage.clear();localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m));},meal);await page.reload();
 await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Start cooking',exact:true}).click();
 return page.getByRole('region',{name:'Current step',exact:true});
}
test('early brisket prep completion retains the future window while turkey brines, including reload',async({page},info)=>{
 const current=await open(page);
 await expect(current).toContainText('Confirm turkey is fully thawed');await current.getByRole('checkbox',{name:'Complete Confirm turkey is fully thawed',exact:true}).click();
 await expect(current).toContainText('Start refrigerated brine');await current.getByRole('checkbox',{name:'Complete Start refrigerated brine',exact:true}).click();
 await expect(current).toContainText('Trim brisket');await current.getByRole('checkbox',{name:'Complete Trim brisket',exact:true}).click();
 await expect(current).toContainText('Season brisket');
 await expect(current.getByLabel('Estimated start',{exact:true})).toHaveAttribute('datetime','2026-11-19T01:27:00.000Z');
 const before=await saved(page);expect(Object.keys(before.completed).sort()).toEqual(['brisket:prep','turkey:brine','turkey:thaw']);const p=cookProjection(before,cookTimeline(before),Date.parse(start));
 expect(p.forecasts['brisket:rest'].finish).toBe(p.forecasts['turkey:rest'].finish);
 await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();
 await expect(current).toContainText('Season brisket');await expect(current.getByLabel('Estimated start',{exact:true})).toHaveAttribute('datetime','2026-11-19T01:27:00.000Z');
 expect((await saved(page)).events).toEqual(before.events);
 await page.screenshot({path:info.outputPath('brine-aligned-guidance.png'),fullPage:false,scale:'css',style:'nextjs-portal{display:none}'});
});
test('the meal guide reaches turkey brine end and roasting before brisket serving',async({page})=>{
 const current=await open(page),sequence:string[]=[];let clock=Date.parse(start);
 for(let i=0;i<25;i++){
  const meal=await saved(page),tasks=cookTimeline(meal),p=cookProjection(meal,tasks,clock);
  const {guidedCookingSteps}=await import('../src/domain/cookingFocus');
  const task=guidedCookingSteps(tasks,meal.completed,null,p.forecasts).current;if(!task)break;
  sequence.push(task.id);await expect(current.getByRole('article')).toHaveAttribute('aria-label',task.title);
  const at=Math.max(clock,Date.parse(p.forecasts[task.id]?.start??new Date(clock).toISOString()));
  if(at>clock){await page.clock.fastForward(at-clock);clock=at;}
  await current.getByRole('checkbox',{name:'Complete '+task.title,exact:true}).click();
 }
 expect(sequence.indexOf('turkey:dry')).toBeGreaterThan(-1);
 expect(sequence.indexOf('turkey:dry')).toBeLessThan(sequence.indexOf('brisket:finish'));
 expect(sequence.indexOf('turkey:start')).toBeLessThan(sequence.indexOf('brisket:serve'));
 const meal=await saved(page);expect(Object.keys(meal.completed)).toHaveLength(cookTimeline(meal).length);
});
