import {changeStepDuration} from './helpers/stepEditing';
import {test,expect} from '@playwright/test';
test.use({timezoneId:'UTC'});
test('serving target is the first planning decision and survives recipe review',async({page},info)=>{
 await page.clock.install({time:new Date('2026-11-08T16:00:00Z')});await page.clock.setFixedTime(new Date('2026-11-08T16:00:00Z'));await page.goto('/');await page.getByRole('button',{name:/Plan a new cook/}).click();
 const serving=page.getByLabel('Serve date and time',{exact:true});await expect(serving).toBeVisible();await serving.fill('2026-11-08T18:00');await page.screenshot({path:info.outputPath('serving-first-empty.png'),fullPage:false,scale:'css',style:'nextjs-portal{display:none}'});
 await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();await expect(serving).toHaveValue('2026-11-08T18:00');
 await page.getByRole('region',{name:'Review your method',exact:true}).getByRole('button',{name:'Add to meal',exact:true}).click();await expect(serving).toHaveValue('2026-11-08T18:00');
 await page.screenshot({path:info.outputPath('serving-first-plan.png'),fullPage:true,style:'nextjs-portal{display:none}'});
});

import type {Page,Locator} from '@playwright/test';
import {newMeal,type Meal} from '../src/domain/meal';
import {parseRecipeText} from '../src/domain/recipe';
import {recipeReview} from '../src/domain/recipeReview';
import {cookTimeline,recordEvent,startCookSession,type ExtendedMeal} from '../src/domain/cookState';
const at=(time:string)=>`2026-11-08T${time}:00.000Z`;
const dish=(name:string,text:string)=>recipeReview({...parseRecipeText(name,text),equipment:name},at('18:00')).dishes[0];
const meal=(...dishes:Meal['dishes']):ExtendedMeal=>({...newMeal(),serveAt:'2026-11-08T18:00',dishes});
const stored=(page:Page):Promise<ExtendedMeal>=>page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
async function open(page:Page,m:Meal,now='16:00'){
 await page.clock.install({time:new Date(at(now))});await page.clock.setFixedTime(new Date(at(now)));await page.goto('/');
 await page.evaluate(m=>{localStorage.clear();localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m));},m);await page.reload();await page.getByRole('button',{name:/Resume planning|View cook/}).click();
}
const ready=async(page:Page,time:string)=>{
 const region=page.getByRole('region',{name:'Serving plan'}),target=await page.getByLabel('Serve date and time').inputValue();
 const late=Date.parse(at(time))>Date.parse(target);
 if(late)await expect(region.getByLabel('Estimated meal ready',{exact:true})).toHaveAttribute('datetime',at(time));
 else{await expect(region.getByLabel('Estimated meal ready',{exact:true})).toHaveCount(0);await expect(region.getByLabel('Estimated start',{exact:true})).toBeVisible();}
};
const row=(page:Page,name:string)=>page.getByRole('region',{name:'Meal plan preview'}).getByRole('article',{name,exact:true});
async function combined(page:Page){await page.getByRole('button',{name:'Review Meal Plan',exact:true}).click();}
async function starts(row:Locator,time:string){await expect(row.locator('time').first()).toHaveAttribute('datetime',at(time));}
async function edit(page:Page,name:string,minutes?:string,fixed?:string){
 await row(page,name).getByRole('button',{name:`Edit ${name}`,exact:true}).click();const form=page.getByRole('form',{name:'Edit step',exact:true});
 if(minutes!==undefined){if(!await form.locator('details').evaluate(el=>(el as HTMLDetailsElement).open))await form.getByText(/^More options/).click();await form.getByLabel('Duration unit',{exact:true}).selectOption('minutes');await form.getByLabel('Estimated duration (minutes)',{exact:true}).fill(minutes);}
 if(fixed!==undefined){await form.locator('summary').click();await form.getByLabel('Planned date and time',{exact:true}).fill(`2026-11-08T${fixed}`);}
 await form.getByRole('button',{name:'Save',exact:true}).click();
}
const pair=()=>meal(dish('Potatoes','Roast potatoes (75 minutes)'),dish('Brats','Grill brats (45 minutes)'));
const grill=()=>meal(dish('Brats','Preheat grill (15 minutes)\nGrill brats (35 minutes)\nRest brats (10 minutes)'));

test('independent dish windows overlap; target changes and short sauce preserve durations',async({page})=>{
 const m=pair();await open(page,m);await ready(page,'18:00');await expect(page.getByLabel('Estimated start',{exact:true})).toHaveAttribute('datetime',at('16:45'));await combined(page);await starts(row(page,'Roast potatoes (75 minutes)'),'16:45');await starts(row(page,'Grill brats (45 minutes)'),'17:15');
 await expect(page.getByRole('region',{name:'Cook duration in beers'})).toContainText('1h 15m');
 await page.getByRole('button',{name:'+ Add a dish',exact:true}).click();await page.getByRole('button',{name:'Add your own recipe',exact:true}).click();await page.getByLabel('Recipe title').fill('Sauce');await page.getByLabel('Recipe instructions').fill('Simmer sauce (15 minutes)');await page.getByRole('button',{name:'Preview recipe steps'}).click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();
 await ready(page,'18:00');await starts(row(page,'Simmer sauce (15 minutes)'),'17:45');await starts(row(page,'Roast potatoes (75 minutes)'),'16:45');
 await page.getByLabel('Serve date and time').fill('2026-11-08T18:45');await ready(page,'18:45');await starts(row(page,'Roast potatoes (75 minutes)'),'17:30');await starts(row(page,'Grill brats (45 minutes)'),'18:00');await starts(row(page,'Simmer sauce (15 minutes)'),'18:30');
 const saved=await stored(page);expect(saved.dishes[0]).toEqual(m.dishes[0]);expect(saved.dishes[1]).toEqual(m.dishes[1]);expect(saved.events).toEqual(m.events??[]);expect(saved.completed).toEqual({});
 await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await expect(page.getByLabel('Serve date and time')).toHaveValue('2026-11-08T18:45');await ready(page,'18:45');
});

test('impossible target stays requested until its explicit suggestion is accepted',async({page},info)=>{
 const m=pair();await open(page,m,'17:15');await ready(page,'18:30');const serving=page.getByRole('region',{name:'Serving plan'});await expect(serving).toContainText('(+30 min)');await expect(page.getByLabel('Serve date and time')).toHaveValue('2026-11-08T18:00');await combined(page);await starts(row(page,'Roast potatoes (75 minutes)'),'17:15');await starts(row(page,'Grill brats (45 minutes)'),'17:15');await expect(page.getByRole('region',{name:'Cook duration in beers'})).toContainText('1h 15m');
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('serving-late-meal.png'),fullPage:false,style:'nextjs-portal{display:none}'});
 await serving.getByRole('button',{name:/Use /}).click();await expect(page.getByLabel('Serve date and time')).toHaveValue('2026-11-08T18:30');await starts(row(page,'Grill brats (45 minutes)'),'17:45');await ready(page,'18:30');expect((await stored(page)).events).toEqual(m.events??[]);expect((await stored(page)).completed).toEqual({});
});

test('three-hour turkey cannot create activity before the current clock',async({page})=>{
 const m=meal(dish('Turkey','Prepare turkey (30 minutes)\nRoast turkey (120 minutes)\nRest turkey (30 minutes)'));await open(page,m);await ready(page,'19:00');await expect(page.getByRole('region',{name:'Serving plan'})).toContainText('(+60 min)');await expect(page.getByLabel('Serve date and time')).toHaveValue('2026-11-08T18:00');await combined(page);await starts(row(page,'Prepare turkey (30 minutes)'),'16:00');await starts(row(page,'Roast turkey (120 minutes)'),'16:30');await starts(row(page,'Rest turkey (30 minutes)'),'18:30');await expect(page.getByRole('region',{name:'Cook duration in beers'})).toContainText('3h 00m');expect((await stored(page)).startedAt).toBeUndefined();expect((await stored(page)).completed).toEqual({});
});

test('fixed preheat propagates through grill and rest without moving the requested target',async({page},info)=>{
 await open(page,grill());await combined(page);await edit(page,'Preheat grill (15 minutes)',undefined,'17:20');await starts(row(page,'Preheat grill (15 minutes)'),'17:20');await starts(row(page,'Grill brats (35 minutes)'),'17:35');await starts(row(page,'Rest brats (10 minutes)'),'18:10');await ready(page,'18:20');await expect(page.getByRole('region',{name:'Serving plan'})).toContainText('(+20 min)');await expect(page.getByLabel('Serve date and time')).toHaveValue('2026-11-08T18:00');
 await page.getByLabel('Serve date and time').fill('2026-11-08T18:45');await starts(row(page,'Preheat grill (15 minutes)'),'17:20');await ready(page,'18:20');await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('serving-fixed-start.png'),fullPage:false,style:'nextjs-portal{display:none}'});
});

test('longer preheat reflows earlier when flexible and later when fixed',async({page})=>{
 await open(page,grill());await combined(page);await edit(page,'Preheat grill (15 minutes)','25');await starts(row(page,'Preheat grill (15 minutes)'),'16:50');await starts(row(page,'Grill brats (35 minutes)'),'17:15');await ready(page,'18:00');await edit(page,'Preheat grill (15 minutes)',undefined,'17:00');await starts(row(page,'Grill brats (35 minutes)'),'17:25');await starts(row(page,'Rest brats (10 minutes)'),'18:00');await ready(page,'18:10');await expect(page.getByRole('region',{name:'Cook duration in beers'})).toContainText('1h 10m');
});

test('independent duration edits and keyboard reordering leave another dish intact',async({page})=>{
 const potatoes=dish('Potatoes','Prepare potatoes (10 minutes)\nRoast potatoes (65 minutes)'),brats=dish('Brats','Grill brats (45 minutes)'),m=meal(potatoes,brats);await open(page,m);await combined(page);await edit(page,'Prepare potatoes (10 minutes)','20');await starts(row(page,'Prepare potatoes (10 minutes)'),'16:35');await starts(row(page,'Roast potatoes (65 minutes)'),'16:55');await starts(row(page,'Grill brats (45 minutes)'),'17:15');await ready(page,'18:00');
 const grip=row(page,'Roast potatoes (65 minutes)').getByRole('button',{name:'Move Roast potatoes (65 minutes)',exact:true});await grip.focus();await page.keyboard.press('ArrowUp');await starts(row(page,'Roast potatoes (65 minutes)'),'16:35');await starts(row(page,'Prepare potatoes (10 minutes)'),'17:40');await starts(row(page,'Grill brats (45 minutes)'),'17:15');await ready(page,'18:00');expect((await stored(page)).dishes[1]).toEqual(brats);
 await row(page,'Prepare potatoes (10 minutes)').getByRole('button',{name:'Edit Prepare potatoes (10 minutes)',exact:true}).click();page.once('dialog',dialog=>dialog.accept());await page.getByRole('form',{name:'Edit step'}).getByRole('button',{name:'Remove step: Prepare potatoes (10 minutes)',exact:true}).click();await starts(row(page,'Roast potatoes (65 minutes)'),'16:55');await ready(page,'18:00');await expect(row(page,'Prepare potatoes (10 minutes)')).toHaveCount(0);
});

test('planning target edits preserve recorded activity and active session identity',async({page})=>{
 const m=grill(),task=cookTimeline(m)[0],active=recordEvent(startCookSession(m,at('16:00')),task.id,'completed',at('16:02'));
 await open(page,active);await page.getByLabel('Serve date and time').fill('2026-11-08T18:45');const after=await stored(page);expect(after.events).toEqual(active.events);expect(after.completed).toEqual(active.completed);expect(after.startedAt).toBe(active.startedAt);expect(after.id).toBe(active.id);expect(after.mode).toBe('cooking');
 await page.reload();await page.getByRole('button',{name:/View cook/}).click();await expect(page.getByLabel('Serve date and time')).toHaveValue('2026-11-08T18:45');expect((await stored(page)).events).toEqual(active.events);
});

test('new unknown work needs an estimate; adding and removing its duration recalculates readiness',async({page})=>{
 await open(page,grill(),'17:00');await page.getByRole('button',{name:'Edit Brats',exact:true}).click();await page.getByRole('button',{name:'Add a step to Brats',exact:true}).click();const adding=page.getByRole('form',{name:'Add dish step'});await adding.getByLabel('Step title',{exact:true}).fill('Make glaze');await adding.getByRole('button',{name:'Save step',exact:true}).click();
 await expect(page.getByRole('region',{name:'Serving plan'})).toContainText('Timing needed');const steps=page.getByRole('region',{name:'Brats steps',exact:true});await changeStepDuration(steps.getByRole('article',{name:'Make glaze',exact:true}),'15');await ready(page,'18:15');
 const grip=steps.getByRole('button',{name:'Move Make glaze',exact:true});await grip.focus();await page.keyboard.press('ArrowUp');await ready(page,'18:15');await combined(page);await starts(row(page,'Make glaze'),'18:00');await expect(page.getByRole('region',{name:'Cook duration in beers'})).toContainText('1h 15m');
 await row(page,'Make glaze').getByRole('button',{name:'Edit Make glaze',exact:true}).click();page.once('dialog',dialog=>dialog.accept());await page.getByRole('form',{name:'Edit step'}).getByRole('button',{name:'Remove step: Make glaze',exact:true}).click();await ready(page,'18:00');await expect(page.getByLabel('Serve date and time')).toHaveValue('2026-11-08T18:00');await expect(page.getByRole('region',{name:'Cook duration in beers'})).toContainText('1h 00m');
});

test.describe('actual brisket and ribs templates',()=>{
 test.use({timezoneId:'America/New_York'});
 test('start preparing is primary and both dishes serve Sunday at 1 PM after their own rests',async({page},info)=>{
  await page.clock.install({time:new Date('2026-11-07T14:00:00Z')});await page.clock.setFixedTime(new Date('2026-11-07T14:00:00Z'));await page.goto('/');await page.getByRole('button',{name:/Plan a new cook/}).click();await page.getByLabel('Serve date and time',{exact:true}).fill('2026-11-08T13:00');
  await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add smoked brisket',exact:true}).click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();
  await expect(page.getByLabel('Estimated start',{exact:true})).toHaveAttribute('datetime','2026-11-07T21:45:00.000Z');await expect(page.getByLabel('Estimated meal ready',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Estimated start',{exact:true})).toContainText(/Sat.*Nov 7.*4:45/);
  await page.getByRole('button',{name:'+ Add a dish',exact:true}).click();await page.getByRole('button',{name:'Add smoked ribs',exact:true}).click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();await combined(page);
  const time=async(name:string,iso:string)=>expect(row(page,name).locator('time').first()).toHaveAttribute('datetime',iso);
  await time('Put brisket on smoker','2026-11-07T23:00:00.000Z');await time('Hold until serving','2026-11-08T12:00:00.000Z');await time('Start cooking','2026-11-08T12:10:00.000Z');await time('Begin monitored rest/hold','2026-11-08T17:40:00.000Z');await time('Slice and serve','2026-11-08T18:00:00.000Z');await time('Serve','2026-11-08T18:00:00.000Z');await time('Preheat Smoker','2026-11-08T11:40:00.000Z');
  await expect(page.getByLabel('Serve date and time',{exact:true})).toHaveValue('2026-11-08T13:00');await expect(page.getByLabel('Estimated start',{exact:true})).toHaveAttribute('datetime','2026-11-07T21:45:00.000Z');await expect(page.getByRole('region',{name:'Cook duration in beers'})).toContainText('20h 15m');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('brisket-ribs-planning.png'),fullPage:false,scale:'css',style:'nextjs-portal{display:none}'});
  await page.getByRole('button',{name:'Edit Smoked brisket',exact:true}).click();const editor=page.getByRole('region',{name:'Dish editor',exact:true});await editor.locator('summary').filter({hasText:'Dish settings'}).click();await editor.getByLabel('Rest/hold (hours)',{exact:true}).fill('3.6666666666666665');await editor.getByLabel('Rest/hold (hours)',{exact:true}).press('Tab');
  await time('Hold until serving','2026-11-08T14:20:00.000Z');await time('Begin monitored rest/hold','2026-11-08T17:40:00.000Z');await time('Slice and serve','2026-11-08T18:00:00.000Z');await time('Serve','2026-11-08T18:00:00.000Z');expect((await stored(page)).events).toEqual([]);
 });
});
