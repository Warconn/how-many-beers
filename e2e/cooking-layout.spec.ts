import {legacyDish as createDish} from '../tests/fixtures/legacyDish';
import {test,expect,type Page} from '@playwright/test';
import {newMeal} from '../src/domain/meal';
import {cookTimeline} from '../src/domain/cookState';
const at='2026-10-29T22:43:00Z';
async function load(page:Page,done:number){
 const meal={...newMeal(),name:'Sunday brisket',serveAt:'2026-11-01T13:00',mode:'cooking' as const,startedAt:at,dishes:[createDish('brisket')]},tasks=cookTimeline(meal);meal.completed=Object.fromEntries(tasks.slice(0,done).map(t=>[t.id,at]));
 await page.clock.install({time:new Date(Date.parse(at)-1000)});await page.clock.pauseAt(new Date(at));await page.goto('/');await page.evaluate(m=>{localStorage.clear();localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m));},meal);await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();return meal;
}
for(const done of [0,5,12])test(`cooking layout at ${done} completed steps is compact and keeps one finish action`,async({page},info)=>{
 const meal=await load(page,done);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath(`cooking-layout-${done}.png`),scale:'css',style:'nextjs-portal{display:none}'});await page.getByRole('region',{name:'Cook duration in beers'}).screenshot({path:info.outputPath(`meter-${done}.png`),scale:'css'});
 expect(await page.locator('.cook-layout').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1);await expect(page.locator('.cook-progress-chip')).toHaveCount(0);
 if(done===12){
  await expect(page.getByRole('button',{name:'Finish cook',exact:true})).toHaveCount(1);await expect(page.getByText('Showing the next unchecked step.',{exact:false})).toHaveCount(0);await expect(page.getByRole('navigation',{name:'Cooking guide',exact:true})).toHaveCount(0);
  const completion=page.getByRole('region',{name:'Cook complete',exact:true});await expect(completion).toBeVisible();expect((await completion.boundingBox())!.height).toBeLessThan(260);await expect(completion.getByRole('button',{name:'Full checklist',exact:true})).toBeVisible();
 }else{await expect(page.getByRole('region',{name:'Current step',exact:true})).toBeVisible();await expect(page.getByRole('navigation',{name:'Cooking guide',exact:true}).getByRole('button',{name:'Full checklist',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Finish cook early',exact:true})).toBeHidden();}
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!).completed)).toEqual(meal.completed);
});
test('completion can be reviewed and reopened without stale next-step messaging or premature archive',async({page})=>{
 await load(page,11);const current=page.getByRole('region',{name:'Current step',exact:true});await current.getByRole('checkbox').click();await expect(page.getByRole('region',{name:'Cook complete',exact:true})).toBeVisible();await expect(page.getByText(/Showing the next unchecked step/)).toHaveCount(0);await page.getByRole('button',{name:'Full checklist',exact:true}).click();const list=page.getByRole('region',{name:'Full cook checklist',exact:true});await list.getByRole('checkbox').last().click();await expect(current.getByRole('checkbox')).not.toBeChecked();await expect(page.getByRole('region',{name:'Cook complete',exact:true})).toHaveCount(0);await expect(page.getByRole('navigation',{name:'Cooking guide',exact:true})).toBeVisible();
});
test('finish early stays in tools and cancelling confirmation preserves the cook and returns focus',async({page})=>{
 const meal=await load(page,5);await page.getByText('Cook details & tools',{exact:true}).click();const trigger=page.getByRole('button',{name:'Finish cook early',exact:true});await trigger.click();const finish=page.getByRole('region',{name:'Finish cook',exact:true});await expect(finish).toContainText('7 unchecked');await finish.getByRole('button',{name:'Keep cooking',exact:true}).click();await page.clock.runFor(50);await expect(trigger).toBeFocused();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!).completed)).toEqual(meal.completed);
});
