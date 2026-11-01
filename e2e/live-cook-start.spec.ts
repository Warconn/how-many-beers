import {test,expect,type Page} from '@playwright/test';
import {newMeal,createDish} from '../src/domain/meal';
import {parseRecipeText} from '../src/domain/recipe';
const now='2026-10-29T22:43:00Z';
async function load(page:Page,meal= {...newMeal(),name:'Sunday brisket',serveAt:'2026-11-01T13:00Z',dishes:[createDish('brisket')]}){
 await page.clock.install({time:new Date(Date.parse(now)-1000)});await page.clock.pauseAt(new Date(now));await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),meal);await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Start cooking',exact:true}).click();return meal;
}
test('Sunday brisket started Thursday uses execution work, with the original target preserved',async({page},info)=>{
 const meal=await load(page),meter=page.getByRole('region',{name:'Cook duration in beers'});
 await expect(meter).toContainText('16h 55m');await expect(meter).not.toContainText('62h');await expect(page.getByLabel('Cook estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-30T15:38:00.000Z');await expect(page.locator('.cook-target').filter({hasText:'Original target'})).toContainText('Original target');
 await meter.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('execution-brisket.png'),scale:'css',style:'nextjs-portal{display:none}'});
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(before.serveAt).toBe(meal.serveAt);expect(before.dishes).toEqual(meal.dishes);expect(before.events??[]).toHaveLength(0);
 await page.clock.fastForward(60000);await expect(meter).toContainText('16h 54m');await expect(meter).toContainText('16h 55m · Projected cook');await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(page.getByLabel('Cook estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-30T15:38:00.000Z');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!).startedAt)).toBe(before.startedAt);
});
test('5+15+10 live finish moves earlier after quick prep, later after roast overrun, and survives actual starts',async({page},info)=>{
 const dish=parseRecipeText('Seeds','Prepare (5 minutes)\nRoast (15 minutes)\nCool (10 minutes)'),meal={...newMeal(),name:'Seeds',serveAt:'2026-11-01T13:00Z',dishes:[dish]};await load(page,meal);const guide=page.getByRole('region',{name:'Current step',exact:true}),finish=page.getByLabel('Cook estimated finish',{exact:true}),meter=page.getByRole('region',{name:'Cook duration in beers'});
 await expect(finish).toHaveAttribute('datetime','2026-10-29T23:13:00.000Z');await page.clock.fastForward(60000);await guide.getByRole('checkbox').click();await expect(finish).toHaveAttribute('datetime','2026-10-29T23:09:00.000Z');await guide.getByRole('button',{name:'Begin roasting',exact:true}).click();await page.clock.fastForward(20*60000);await expect(page.getByText('Estimated finish unavailable',{exact:true})).toBeVisible();await expect(meter).toContainText('Review overdue');await guide.getByRole('checkbox').click();await expect(finish).toHaveAttribute('datetime','2026-10-29T23:14:00.000Z');await guide.getByRole('button',{name:'Begin cooling',exact:true}).click();await page.clock.fastForward(2*60000);await expect(finish).toHaveAttribute('datetime','2026-10-29T23:14:00.000Z');await expect(meter).toContainText('0h 08m');await expect(meter).toContainText('0h 31m · Projected cook');
 await guide.getByRole('article').evaluate(el=>window.scrollBy(0,el.getBoundingClientRect().top-210));await page.screenshot({path:info.outputPath('execution-seeds.png'),scale:'css',style:'nextjs-portal{display:none}'});
 const events=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!).events);await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(finish).toHaveAttribute('datetime','2026-10-29T23:14:00.000Z');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!).events)).toEqual(events);
});

test('Beerometer screenshots are identical for an immediate versus distant original target',async({page},info)=>{
 await load(page);const meter=page.getByRole('region',{name:'Cook duration in beers'});await expect(meter).toContainText('16h 55m');
 const distant=await meter.screenshot({path:info.outputPath('meter-distant-target.png'),scale:'css'});
 await page.evaluate(()=>{const meal=JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!);meal.serveAt='2026-10-29T23:00Z';localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(meal));});await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(meter).toContainText('16h 55m');const immediate=await meter.screenshot({path:info.outputPath('meter-immediate-target.png'),scale:'css'});expect(distant.equals(immediate)).toBe(true);
});

test('work added during a cook keeps its creation anchor on ticks and reload',async({page})=>{
 const dish=parseRecipeText('Seeds','Roast (15 minutes)\nCool (10 minutes)');await load(page,{...newMeal(),name:'Add while cooking',serveAt:'2026-11-01T13:00Z',dishes:[dish]});await page.clock.fastForward(5*60000);await page.getByRole('button',{name:'Edit plan',exact:true}).click();await page.getByRole('button',{name:'+ Add a dish',exact:true}).click();await page.getByRole('button',{name:'Add oven side dish',exact:true}).click();await page.getByRole('button',{name:'Continue cooking',exact:true}).click();const finish=page.getByLabel('Cook estimated finish',{exact:true});await expect(finish).toHaveAttribute('datetime','2026-10-30T00:18:00.000Z');await page.clock.fastForward(60000);await expect(finish).toHaveAttribute('datetime','2026-10-30T00:18:00.000Z');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(saved.dishes[1].executionAddedAt).toBe('2026-10-29T22:48:00.000Z');expect(saved.events??[]).toEqual([]);await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(finish).toHaveAttribute('datetime','2026-10-30T00:18:00.000Z');
});
