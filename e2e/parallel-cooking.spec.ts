import {test,expect,type Page,type Locator} from '@playwright/test';
import {newMeal,createDish as currentDish} from '../src/domain/meal';
import {legacyDish as createDish} from '../tests/fixtures/legacyDish';
import {startCookSession,recordEvent,type ExtendedMeal} from '../src/domain/cookState';
import {twoTurkeyPlan,recordedTurkeyBaseline,turkeyTime as at} from '../tests/fixtures/parallelCooking';
import {openOwnRecipe} from './helpers/recipeEntry';

test.use({timezoneId:'America/New_York'});
test.setTimeout(60_000);
async function checklist(page:Page){
  await page.getByRole('button',{name:'Full checklist',exact:true}).first().click();
  return page.getByRole('region',{name:'Full cook checklist'});
}
const row=(list:Locator,title:string)=>list.locator(':scope > ol > li').filter({has:list.page().getByRole('button',{name:new RegExp('^Open step: '+title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' for ')})});
async function reading(target:Locator,value:number,note?:string){
  await target.getByRole('button',{name:/^Record (?:another )?reading$/}).click();
  await target.getByLabel('Food temperature',{exact:true}).fill(String(value));
  if(note)await target.getByLabel('Location / details (optional)',{exact:true}).fill(note);
  await target.getByRole('button',{name:'Save timestamped reading',exact:true}).click();
}
async function open(page:Page,meal:ExtendedMeal) {
  await page.clock.install({time:new Date(at('13:10'))});
  await page.goto('/');
  await page.evaluate(meal=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(meal)),meal);
  await page.reload();
  await page.getByRole('button',{name:/Continue cooking/}).first().click();
  await checklist(page);
}

test('two turkeys show independent inline elapsed states while keeping the meal Beerometer and guide',async({page},info)=>{
  let meal=startCookSession(twoTurkeyPlan(),at('12:00'));
  meal=recordEvent(meal,'oven:start','completed',at('12:10'));
  await open(page,meal);
  const list=page.getByRole('region',{name:'Full cook checklist'});
  await list.getByRole('checkbox',{name:'Complete Preheat fryer to the manual setting (60 minutes). for Deep-Fried Turkey',exact:true}).check();
  await expect(page.getByRole('region',{name:'Cook duration in beers'})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Cooking guide'})).toBeVisible();
  await page.screenshot({path:info.outputPath('two-turkey-cooking.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});
  const oven=list.locator('li').filter({has:page.getByRole('button',{name:'Open step: Begin roasting turkey for Turkey (oven)',exact:true})});
  const oil=list.locator('li').filter({has:page.getByRole('button',{name:/Open step: Preheat fryer to the manual setting/})});
  await expect(oil).toContainText(/Preheating · .*elapsed/);
  await expect(oven).toContainText(/Cooking · .*elapsed/);
});

test('a checked brisket checkpoint keeps Record another reading directly available',async({page},info)=>{
  const dish={...createDish('brisket'),id:'brisket'};
  let meal=startCookSession({...newMeal(),name:'Browns Brisket',serveAt:at('20:00'),dishes:[dish]},at('12:00'));
  meal=recordEvent(meal,'brisket:start','completed',at('12:10'));
  meal=recordEvent(meal,'brisket:spritz','completed',at('13:00'));
  meal=recordEvent(meal,'brisket:spritz','temperature',at('13:01'),145,'°F');
  await open(page,meal);
  const list=page.getByRole('region',{name:'Full cook checklist'});
  const checkpoint=list.locator('li').filter({has:page.getByRole('button',{name:/Open step: .*spritz/i})});
  await expect(checkpoint.getByRole('checkbox')).toBeChecked();
  await page.screenshot({path:info.outputPath('checkpoint-repeat-reading.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});
  await expect(checkpoint.getByRole('button',{name:'Record another reading',exact:true})).toBeVisible();
  await reading(checkpoint,162);
  await page.clock.fastForward(15*60000);
  await page.reload();await page.getByRole('button',{name:/Continue cooking/}).first().click();await checklist(page);
  await reading(checkpoint,181,'Synthetic bark observation');
  await expect(checkpoint.getByRole('checkbox')).toBeChecked();
  await checkpoint.locator('summary').filter({hasText:'Readings (3)'}).click();
  for(const value of [145,162,181])await expect(checkpoint).toContainText(value+'°F');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
  expect(saved.events.filter((e:any)=>e.kind==='temperature').map((e:any)=>e.value)).toEqual([145,162,181]);
  expect(saved.events.filter((e:any)=>e.kind==='temperature').map((e:any)=>e.taskId)).toEqual(['brisket:spritz','brisket:spritz','brisket:spritz']);
  expect(saved.events.filter((e:any)=>e.kind==='temperature').every((e:any)=>e.activityId==='brisket:heat')).toBe(true);
  expect(saved.events.flatMap((e:any)=>e.phaseObservations??[]).filter((o:any)=>o.phaseId==='brisket:heat'&&o.boundary==='end')).toEqual([]);
  expect(new Set(saved.events.filter((e:any)=>e.kind==='temperature').map((e:any)=>e.occurredAt)).size).toBe(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('wings smoking, oil readiness and frying have independent physical boundaries',async({page},info)=>{
  const dish={...currentDish('wings'),id:'wings'};
  let meal=startCookSession({...newMeal(),name:'Smo-fried Wings',serveAt:at('20:00'),dishes:[dish]},at('11:00'));
  for(const key of ['dry','prep','preheat'])meal=recordEvent(meal,'wings:'+key,'completed',at('11:05'));
  meal=recordEvent(meal,'wings:start','completed',at('12:10'));
  await open(page,meal);
  const list=page.getByRole('region',{name:'Full cook checklist'}),oil=row(list,'Prepare fryer and heat oil'),smoke=row(list,'Start smoking wings'),ready=row(list,'Verify oil is ready');
  await oil.getByRole('checkbox').check();
  await expect(oil).toContainText('Preheating · 0m elapsed');await expect(smoke).toContainText('Cooking · 1h elapsed');
  await ready.getByRole('button',{name:'Record reading',exact:true}).click();await ready.getByLabel('Reading type',{exact:true}).selectOption('equipment');await ready.getByLabel('Equipment temperature (optional)',{exact:true}).fill('300');await ready.getByRole('button',{name:'Save timestamped reading',exact:true}).click();
  await expect(ready.getByRole('checkbox')).not.toBeChecked();await expect(oil).toContainText('elapsed');
  await page.screenshot({path:info.outputPath('wings-parallel-activities.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});
  await page.clock.fastForward(15*60000);await ready.getByRole('checkbox').check();await expect(oil).toContainText('Preheating · 15m actual');await expect(smoke).toContainText('elapsed');
  await row(list,'Remove wings from smoker').getByRole('checkbox').check();await expect(smoke).toContainText('Cooking · 1h 15m actual');
  await row(list,'Flash-fry wings for crisp skin').getByRole('checkbox').check();await page.clock.fastForward(3*60000);await row(list,'Drain and season or sauce').getByRole('checkbox').check();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
  const bounds=(id:string,boundary:string)=>saved.events.filter((e:any)=>e.phaseObservations?.some((o:any)=>o.phaseId===id&&o.boundary===boundary));
  expect(bounds('wings:heat','end')).toHaveLength(1);expect(bounds('wings:oil','end')).toHaveLength(1);expect(bounds('wings:fry','start')).toHaveLength(1);expect(bounds('wings:fry','end')).toHaveLength(1);
  expect(saved.events.find((e:any)=>e.kind==='equipment').activityId).toBe('wings:oil');
});

test('brats record 130, 150 and 165 on the same checked start row after resume',async({page})=>{
  const dish={...currentDish('brats'),id:'brats'};
  let meal=startCookSession({...newMeal(),name:'Brats',serveAt:at('20:00'),dishes:[dish]},at('12:00'));
  meal=recordEvent(meal,'brats:start','completed',at('12:10'));await open(page,meal);
  const target=row(page.getByRole('region',{name:'Full cook checklist'}),'Cover and cook the brat tray');
  for(const value of [130,150]){await reading(target,value);await page.clock.fastForward(10*60000);}
  await page.reload();await page.getByRole('button',{name:/Continue cooking/}).first().click();await checklist(page);await reading(target,165);
  await expect(target.getByRole('checkbox')).toBeChecked();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
  expect(saved.events.filter((e:any)=>e.kind==='temperature').map((e:any)=>[e.value,e.taskId,e.activityId])).toEqual([130,150,165].map(value=>[value,'brats:start','brats:heat']));
  expect(saved.events.flatMap((e:any)=>e.phaseObservations??[]).filter((o:any)=>o.phaseId==='brats:heat'&&o.boundary==='start')).toHaveLength(1);
});

test('resuming the stored turkey defect keeps eight events and upgrades only activity links',async({page})=>{
  const baseline=recordedTurkeyBaseline();await open(page,baseline);
  let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
  expect(saved.dishes.map((d:any)=>d.id)).toEqual(['oven','fryer']);expect(saved.events).toEqual(baseline.events);
  expect(saved.phasePlan.originalPlan).toEqual(baseline.phasePlan);expect(saved.phasePlan.phases.some((p:any)=>p.dishId==='replaced-fryer')).toBe(false);
  expect(saved.phasePlan.phases.find((p:any)=>p.startTaskId==='fryer:step-5').stage).toBe('preheating');
  await page.reload();await page.getByRole('button',{name:/Continue cooking/}).first().click();
  saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(saved.events).toEqual(baseline.events);expect(saved.phasePlan.originalPlan).toEqual(baseline.phasePlan);
});

test('recipe activity correction stays compact and carries stage, boundaries and No activity into cooking',async({page},info)=>{
  await page.goto('/');await page.getByRole('button',{name:/Plan a cook/}).click();await page.getByLabel('Serve date and time',{exact:true}).fill('2026-11-22T15:00');await openOwnRecipe(page);
  await page.getByLabel('Recipe title',{exact:true}).fill('Brining review');await page.getByLabel('Recipe instructions',{exact:true}).fill('Start refrigerated brine (30 minutes)\nEnd brine and pat dry\nRoast turkey (60 minutes)\nRemove turkey from oven');
  await page.getByRole('button',{name:'Preview recipe steps',exact:true}).click();
  const method=page.getByRole('region',{name:'Review your method',exact:true}),activities=method.locator('.activity-review');
  await activities.locator(':scope > summary').click();await activities.getByRole('button',{name:'Review activity',exact:true}).first().click();
  const editor=method.getByRole('group',{name:'Edit activity',exact:true});
  await editor.getByLabel('Activity stage',{exact:true}).selectOption('cooking');await editor.getByRole('button',{name:'Save activity',exact:true}).click();
  await activities.getByRole('button',{name:'Review activity',exact:true}).last().click();await editor.getByLabel('Activity stage',{exact:true}).selectOption('none');await editor.getByRole('button',{name:'Save activity',exact:true}).click();
  await activities.getByRole('button',{name:'Review activity',exact:true}).first().click();await editor.getByLabel('Activity stage',{exact:true}).selectOption('preparing');await editor.getByLabel('Start at',{exact:true}).selectOption('step-1');await editor.getByLabel('End at',{exact:true}).selectOption('step-2');
  await page.screenshot({path:info.outputPath('recipe-activity-correction.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await editor.getByRole('button',{name:'Save activity',exact:true}).click();await method.getByRole('button',{name:'Add to meal',exact:true}).click();
  await page.getByRole('button',{name:'Start cooking',exact:true}).click();
  await expect(page.getByRole('region',{name:'Cook duration in beers'})).toBeVisible();
  const list=await checklist(page),brine=row(list,'Start refrigerated brine (30 minutes)');
  await brine.getByRole('checkbox').check();await expect(brine).toContainText('Preparing · 0m elapsed');
  await row(list,'End brine and pat dry').getByRole('checkbox').check();await expect(brine).toContainText('actual');
  await row(list,'Roast turkey (60 minutes)').getByRole('checkbox').check();await expect(list).not.toContainText(/Cooking · .*elapsed/);
});
