import {legacyDish as createDish} from '../tests/fixtures/legacyDish';
import {test,expect,type Page} from '@playwright/test';
import {newMeal} from '../src/domain/meal';
import {parseRecipeText} from '../src/domain/recipe';
const now='2026-10-29T22:43:00Z';
async function load(page:Page,meal= {...newMeal(),name:'Sunday brisket',serveAt:'2026-11-01T13:00Z',dishes:[createDish('brisket')]}){
 await page.clock.install({time:new Date(Date.parse(now)-1000)});await page.clock.pauseAt(new Date(now));await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),meal);await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Start cooking',exact:true}).click();return meal;
}
test('Sunday brisket started Thursday uses execution work, with the original target preserved',async({page},info)=>{
 const meal=await load(page),meter=page.getByRole('region',{name:'Cook duration in beers'});
 await expect(meter).toContainText('16h 55m');await expect(meter).not.toContainText('62h');await expect(page.getByLabel('Cook estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-30T15:38:00.000Z');await expect(page.locator('.cook-target').filter({hasText:'Serving target'})).toContainText('Serving target');
 await meter.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('execution-brisket.png'),scale:'css',style:'nextjs-portal{display:none}'});
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(before.serveAt).toBe(meal.serveAt);expect(before.dishes).toEqual(meal.dishes);expect(before.events??[]).toHaveLength(0);
 await page.clock.fastForward(60000);await expect(meter).toContainText('16h 54m');await expect(meter).not.toContainText('Projected cook');await page.getByText('Cook details & tools',{exact:true}).click();await expect(page.getByRole('region',{name:'Cooking tools'})).toContainText('Session elapsed 1 min');await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(page.getByLabel('Cook estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-30T15:38:00.000Z');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!).startedAt)).toBe(before.startedAt);
});
test('5+15+10 live finish follows actual roast and cooling transitions without extra Start controls',async({page},info)=>{
 const dish=parseRecipeText('Seeds','Prepare (5 minutes)\nRoast (15 minutes)\nCool (10 minutes)'),meal={...newMeal(),name:'Seeds',serveAt:'2026-11-01T13:00Z',dishes:[dish]};await load(page,meal);const guide=page.getByRole('region',{name:'Current step',exact:true}),finish=page.getByLabel('Cook estimated finish',{exact:true}),meter=page.getByRole('region',{name:'Cook duration in beers'});
 await expect(finish).toHaveAttribute('datetime','2026-10-29T23:13:00.000Z');await page.clock.fastForward(60000);await guide.getByRole('checkbox').click({noWaitAfter:true});await expect(finish).toHaveAttribute('datetime','2026-10-29T23:09:00.000Z');
 await guide.getByRole('checkbox').click({noWaitAfter:true});await page.clock.fastForward(20*60000);await expect(meter).toContainText('Earliest serving');await expect(meter).toContainText('0h 10m+');
 await guide.getByRole('checkbox').click({noWaitAfter:true});await expect(finish).toHaveAttribute('datetime','2026-10-29T23:14:00.000Z');await page.clock.fastForward(2*60000);await expect(finish).toHaveAttribute('datetime','2026-10-29T23:14:00.000Z');await expect(meter).toContainText('0h 08m');await expect(meter).not.toContainText('Projected cook');
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('execution-seeds.png'),scale:'css',style:'nextjs-portal{display:none}'});
 const events=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!).events);await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(finish).toHaveAttribute('datetime','2026-10-29T23:14:00.000Z');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!).events)).toEqual(events);
});

test('changing the serving target leaves live quantities unchanged while updating the target difference',async({page},info)=>{
 await load(page);const meter=page.getByRole('region',{name:'Cook duration in beers'});await expect(meter).toContainText('16h 55m');
 const reading=await meter.locator('.beerometer-reading').textContent(),finish=await page.getByLabel('Cook estimated finish',{exact:true}).getAttribute('datetime');
 await page.evaluate(()=>{const meal=JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!);meal.serveAt='2026-10-29T23:00Z';localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(meal));});await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(meter.locator('.beerometer-reading')).toHaveText(reading!);await expect(page.getByLabel('Cook estimated finish',{exact:true})).toHaveAttribute('datetime',finish!);await expect(meter.locator('.beerometer-difference')).toBeVisible();
 await meter.screenshot({path:info.outputPath('meter-target-difference.png'),scale:'css'});
});

test('work added during a cook keeps its creation anchor on ticks and reload',async({page})=>{
 const dish=parseRecipeText('Seeds','Roast (15 minutes)\nCool (10 minutes)');await load(page,{...newMeal(),name:'Add while cooking',serveAt:'2026-11-01T13:00Z',dishes:[dish]});await page.clock.fastForward(5*60000);await page.getByRole('button',{name:'Edit plan',exact:true}).click();await page.getByRole('button',{name:'+ Add a dish',exact:true}).click();await page.getByRole('button',{name:'Add oven side dish',exact:true}).click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();await page.getByRole('button',{name:'Continue cooking',exact:true}).click();const finish=page.getByLabel('Cook estimated finish',{exact:true});await expect(finish).toHaveAttribute('datetime','2026-10-30T00:18:00.000Z');await page.clock.fastForward(60000);await expect(finish).toHaveAttribute('datetime','2026-10-30T00:18:00.000Z');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(saved.dishes[1].executionAddedAt).toBe('2026-10-29T22:48:00.000Z');expect(saved.events??[]).toEqual([]);await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(finish).toHaveAttribute('datetime','2026-10-30T00:18:00.000Z');
});
