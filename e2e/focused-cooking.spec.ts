import {test,expect} from '@playwright/test';
import {newMeal,type PlannedTask} from '../src/domain/meal';
import {recordEvent,type ExtendedMeal} from '../src/domain/cookState';
test.use({timezoneId:'America/New_York'});
const now='2026-11-25T17:00:00Z';
function fixture():ExtendedMeal{
 const task=(id:string,title:string,time:string|null,isCondition=false):PlannedTask=>({id,title,scheduledAt:time,dishId:'custom',dishName:'General prep',instructions:'Follow your method and check actual conditions.',isCondition});
 const meal:ExtendedMeal={...newMeal(),name:'Overnight cook',mode:'cooking',startedAt:'2026-11-25T15:00:00Z',serveAt:'2026-11-25T18:00',customTasks:[
  task('done','Season food','2026-11-25T16:00:00Z'),task('due','Check the bark','2026-11-25T16:50:00Z',true),task('soon','Warm the sauce','2026-11-25T17:10:00Z'),task('later','Set the table','2026-11-25T20:00:00Z'),task('untimed','Choose a serving tray',null)
 ],taskOrder:['later','soon','due','untimed','done']};
 return recordEvent(meal,'done','completed','2026-11-25T16:15:00Z');
}
async function load(page:import('@playwright/test').Page){
 await page.clock.install({time:new Date(now)});await page.goto('/');const meal=fixture();
 await page.evaluate(m=>{localStorage.clear();localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m));},meal);await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();return meal;
}
const saved=(page:import('@playwright/test').Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!) as ExtendedMeal);

test('cooking prioritizes now, next and later, with history and setup kept secondary',async({page},info)=>{
 const original=await load(page);
 const current=page.getByRole('region',{name:'Now',exact:true});const next=page.getByRole('region',{name:'Next',exact:true});
 await expect(current.getByRole('article',{name:'Check the bark',exact:true})).toBeVisible();
 await expect(current.getByText(/Check conditions; timing is an estimate/)).toBeVisible();
 await expect(next.getByText('Warm the sauce',{exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Later',exact:true}).getByText('Set the table',{exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Untimed steps',exact:true})).toContainText('Choose a serving tray');
 await expect(page.getByRole('button',{name:'Remove',exact:true}).first()).toBeHidden();
 await expect(page.getByLabel('Step title',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('article',{name:'Season food',exact:true})).toHaveCount(0);
 expect((await saved(page)).events).toEqual(original.events);
 await page.screenshot({path:info.outputPath('focused-cooking.png'),fullPage:true});
 const row=current.getByRole('article',{name:'Check the bark',exact:true});
 const touch=await row.locator('.task-check-control').boundingBox();expect(touch!.width).toBeGreaterThanOrEqual(44);expect(touch!.height).toBeGreaterThanOrEqual(44);
 await row.getByRole('button',{name:'+ Log temperature',exact:true}).click();
 await row.getByLabel('Food temperature',{exact:true}).fill('165');await row.getByRole('button',{name:'Save timestamped reading',exact:true}).click();
 await row.getByLabel('Quick notes',{exact:true}).fill('Bark still soft');await row.getByRole('checkbox',{name:'Complete Check the bark',exact:true}).click();
 const after=await saved(page);expect(after.completed.due).toBeTruthy();expect(after.notes.due).toBe('Bark still soft');expect(after.events!.filter(e=>e.taskId==='due').some(e=>e.kind==='temperature'&&e.value===165)).toBe(true);
 await expect(current.getByText('Nothing due right now.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Completed \(2\)/}).click();await expect(page.getByRole('article',{name:'Check the bark',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'← Home',exact:true}).click();await page.getByRole('button',{name:'View cook',exact:true}).click();expect(await saved(page)).toEqual(after);
 await page.getByRole('button',{name:'Continue cooking',exact:true}).click();await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();expect(await saved(page)).toEqual(after);
 for(const width of [375,768,1280]){
  await page.setViewportSize({width,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
});

test('clock updates groups without auto-completion; future details and step options remain accessible',async({page})=>{
 await load(page);
 const upcoming=page.getByRole('region',{name:'Next',exact:true});
 await upcoming.locator('summary').filter({hasText:'Warm the sauce'}).click();
 const editorRow=upcoming.getByRole('article',{name:'Warm the sauce',exact:true});
 await editorRow.getByRole('button',{name:'Edit',exact:true}).click();
 await editorRow.getByLabel('Instructions',{exact:true}).fill('Unsaved draft stays here');
 await page.clock.fastForward(11*60*1000);
 await expect(editorRow.getByLabel('Instructions',{exact:true})).toHaveValue('Unsaved draft stays here');
 await editorRow.getByRole('button',{name:'Cancel',exact:true}).click();
 const current=page.getByRole('region',{name:'Now',exact:true});await expect(current.getByRole('article',{name:'Warm the sauce',exact:true})).toBeVisible();
 expect((await saved(page)).completed.soon).toBeUndefined();
 const later=page.getByRole('region',{name:'Later',exact:true});await later.locator('summary').filter({hasText:'Set the table'}).click();
 const row=later.getByRole('article',{name:'Set the table',exact:true});await expect(row.getByLabel('Quick notes')).toBeVisible();
 await row.getByRole('button',{name:'Edit',exact:true}).click();await expect(row.getByRole('form',{name:'Edit step',exact:true})).toBeVisible();await row.getByRole('button',{name:'Cancel',exact:true}).click();
 await row.getByText('Step options',{exact:true}).click();await expect(row.getByRole('button',{name:'Remove',exact:true})).toBeVisible();
 await row.getByRole('button',{name:'Edit',exact:true}).click();
 await later.locator('summary').filter({hasText:'Set the table'}).click();
 await page.clock.fastForward(4*60*60*1000);
 await expect(current.getByRole('article',{name:'Set the table',exact:true})).toBeVisible();
});
