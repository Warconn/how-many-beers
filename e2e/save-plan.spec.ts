import {test,expect} from '@playwright/test';
import {parseRecipeText} from '../src/domain/recipe';
import {newMeal,createDish} from '../src/domain/meal';
import {archiveCook,emptyHistory,HISTORY_KEY} from '../src/domain/cookHistory';
import {addStep,cookTimeline,migrateMeal,recordEvent,type ExtendedMeal} from '../src/domain/cookState';
test.use({timezoneId:'America/New_York'});
const key='how-many-beers:meal:v1';
const saved=(page:import('@playwright/test').Page)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)!) as ExtendedMeal,key);
async function load(page:import('@playwright/test').Page,meal:ExtendedMeal){
 const history=archiveCook(fixture(),emptyHistory(),'Previous cook','2026-10-24T18:00:00Z');
 await page.goto('/');await page.evaluate(({meal,key,history,historyKey})=>{localStorage.clear();localStorage.setItem(key,JSON.stringify(meal));localStorage.setItem(historyKey,JSON.stringify(history));}, {meal,key,history,historyKey:HISTORY_KEY});await page.reload();await page.getByRole('button',{name:/Resume planning|View cook/}).click();
}
function fixture():ExtendedMeal{
 const meal={...newMeal(),name:'Saturday cookout',serveAt:'2026-11-25T15:00',dishes:[createDish('brisket'),createDish('brats')]};
 const id=meal.dishes[0].id;
 return {...migrateMeal(meal),notes:{[id+':prep']:'My rub'},taskOverrides:{[id+':start']:{scheduledAt:'2026-11-25T06:00:00.000Z'}},taskOrder:cookTimeline(meal).map(t=>t.id).reverse()};
}
test('save for later returns Home without starting, survives reopening and starts the same cook',async({page,context},info)=>{
 const meal=fixture();await load(page,meal);
 const oldHistory=await page.evaluate(k=>localStorage.getItem(k),HISTORY_KEY);
 await page.getByRole('button',{name:'Edit Smoked brisket',exact:true}).click();
 const step=page.getByRole('region',{name:'Smoked brisket steps',exact:true}).getByRole('article').first();await step.getByRole('button',{name:'Edit',exact:true}).click();
 await step.getByLabel('Instructions',{exact:true}).fill('Unsaved step draft');await expect(page.getByRole('button',{name:'Save plan for later',exact:true})).toBeDisabled();
 await step.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Save plan for later',exact:true}).click();
 await expect(page.getByRole('region',{name:'Home',exact:true})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('Plan saved on this device');
 expect(await saved(page)).toEqual(meal);expect((await saved(page)).startedAt).toBeUndefined();
 const summary=page.getByRole('region',{name:'Planned start',exact:true});await expect(summary).toContainText('Trim and season the brisket');
 await expect(summary.locator('time[datetime="2026-11-25T06:00:00.000Z"]')).toBeVisible();await expect(summary).toContainText('EST');
 await page.screenshot({path:info.outputPath('saved-plan.png'),fullPage:true});
 const url=page.url();const reopened=await context.newPage();await page.close();await reopened.goto(url);
 await expect(reopened.getByRole('region',{name:'Planned start',exact:true})).toBeVisible();expect(await saved(reopened)).toEqual(meal);
 reopened.once('dialog',d=>d.dismiss());await reopened.getByRole('button',{name:/Plan a new cook/}).click();expect(await saved(reopened)).toEqual(meal);
 await reopened.getByRole('button',{name:'Start cooking',exact:true}).click();await expect(reopened.getByText("Today's checklist")).toBeVisible();
 const active=await saved(reopened);expect(active.mode).toBe('cooking');expect(active.startedAt).toBeTruthy();
 expect({...active,mode:meal.mode,startedAt:undefined}).toEqual({...meal,startedAt:undefined});
 await reopened.getByRole('button',{name:'← Home',exact:true}).click();await expect(reopened.getByRole('button',{name:'Start cooking',exact:true})).toHaveCount(0);
 await reopened.getByRole('button',{name:/Continue cooking/}).click();expect(await saved(reopened)).toEqual(active);expect(await reopened.evaluate(k=>localStorage.getItem(k),HISTORY_KEY)).toBe(oldHistory);
});

test('storage failure stays in planning and retry saves without a false success',async({page})=>{
 await load(page,fixture());const before=await saved(page);
 await page.evaluate(k=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===k)throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};},key);
 await page.getByRole('button',{name:'Save plan for later',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Could not save the plan'})).toBeInViewport();
 await expect(page.getByRole('region',{name:'Cooking actions'})).toBeVisible();await expect(page.getByText(/Plan saved on this device/)).toHaveCount(0);expect(await saved(page)).toEqual(before);
 await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Save plan for later',exact:true}).click();await expect(page.getByRole('status')).toContainText('Plan saved on this device');
 await page.evaluate(k=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===k)throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};},key);
 await page.getByRole('button',{name:'Start cooking',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Could not save the cook start'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Home',exact:true})).toBeVisible();expect((await saved(page)).startedAt).toBeUndefined();
 await page.reload();await page.getByRole('button',{name:'Start cooking',exact:true}).click();await expect(page.getByText("Today's checklist")).toBeVisible();expect((await saved(page)).startedAt).toBeTruthy();
});

test('invalid and untimed drafts can be saved; active cooks keep their history',async({page})=>{
 let meal=fixture();meal.serveAt='';meal.taskOverrides={};await load(page,meal);
 await page.getByRole('button',{name:'Save plan for later',exact:true}).click();await expect(page.getByRole('button',{name:'Start cooking',exact:true})).toBeDisabled();await expect(page.getByRole('region',{name:'Planned start',exact:true})).toContainText('No confirmed start time');
 await page.getByRole('button',{name:/Resume planning/}).click();await page.getByLabel('Serve date and time').fill('2026-11-25T15:00');await page.getByRole('button',{name:'Save plan for later',exact:true}).click();await expect(page.getByRole('button',{name:'Start cooking',exact:true})).toBeEnabled();
 const untimed={...newMeal(),dishes:[parseRecipeText('Sauce','Mix\nSimmer')]};await load(page,untimed);await page.getByRole('button',{name:'Save plan for later',exact:true}).click();await expect(page.getByRole('region',{name:'Planned start',exact:true})).toContainText('No confirmed start time');
 const base=fixture();const active=recordEvent({...base,mode:'cooking',startedAt:'2026-11-24T20:00:00Z'},base.dishes[0].id+':prep','completed','2026-11-24T20:00:00Z');
 await load(page,active);await expect(page.getByRole('button',{name:'Save plan for later',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Continue cooking',exact:true}).click();expect(await saved(page)).toEqual(active);
 await load(page,{...active,mode:undefined});await page.getByRole('button',{name:'← Home',exact:true}).click();await page.getByRole('button',{name:/Continue cooking/}).click();expect(await saved(page)).toEqual(active);
});

test('a general-prep-only plan stays discoverable and can be saved untimed',async({page})=>{
 const meal=addStep(newMeal(),'Set the table');await load(page,meal);
 await page.getByRole('button',{name:'Save plan for later',exact:true}).click();
 await expect(page.getByRole('region',{name:'Planned start',exact:true})).toContainText('No confirmed start time');
 expect(await saved(page)).toEqual(meal);
 await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Review checklist',exact:true}).click();await expect(page.getByRole('article',{name:'Set the table',exact:true})).toBeVisible();
});

test('planning actions align consistently on desktop and stack cleanly on phones',async({page},info)=>{
 await load(page,fixture());const actions=page.getByRole('region',{name:'Cooking actions',exact:true});const initial=page.viewportSize()!;
 const buttons=[actions.getByRole('button',{name:'Start cooking',exact:true}),actions.getByRole('button',{name:'Save plan for later',exact:true}),actions.getByRole('button',{name:'Review checklist',exact:true})];
 for(const width of [375,768,1280]){
  await page.setViewportSize({width,height:900});const boxes=await Promise.all(buttons.map(b=>b.boundingBox()));
  for(const box of boxes)expect(box!.height).toBeGreaterThanOrEqual(48);
  if(width>600){for(const box of boxes){expect(Math.abs(box!.y-boxes[0]!.y)).toBeLessThanOrEqual(1);expect(Math.abs(box!.height-boxes[0]!.height)).toBeLessThanOrEqual(1);}}
  else{expect(boxes[1]!.y-boxes[0]!.y-boxes[0]!.height).toBeGreaterThanOrEqual(8);expect(Math.abs(boxes[0]!.width-boxes[1]!.width)).toBeLessThanOrEqual(1);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
 await page.setViewportSize(initial);await actions.screenshot({path:info.outputPath('planning-actions.png')});
});
