import {test,expect,type Page} from '@playwright/test';
import {createDish,newMeal} from '../src/domain/meal';
import {applyBrisketTiming,brisketDefaults} from '../src/domain/brisketEstimate';
import {cookTimeline,startCookSession,recordEvent,type ExtendedMeal} from '../src/domain/cookState';
test.use({timezoneId:'America/New_York'});
const now='2026-11-07T20:00:00Z',serve='2026-11-08T18:00:00Z';
function seed(){const dish=applyBrisketTiming({...createDish('brisket'),id:'brisket',brisketPlan:{mode:'manual',inputs:{...brisketDefaults,weightLb:7}}},serve);return {...newMeal(),name:'Browns Brisket',serveAt:serve,dishes:[dish,{...createDish('brats'),id:'brats'}]};}
async function open(page:Page,m:ExtendedMeal){await page.clock.install({time:new Date(now)});await page.goto('/');await page.evaluate(m=>{localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m));},m);await page.reload();await page.getByRole('button',{name:m.mode==='cooking'?/Continue cooking/:/Resume planning/}).click();}
const read=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
test('planning leads with steps, hides configuration, and edits time directly without duration',async({page},info)=>{
 const m=seed();await open(page,m);await page.getByRole('button',{name:'Edit Smoked brisket',exact:true}).click();
 const editor=page.getByRole('region',{name:'Dish editor',exact:true}),steps=page.getByRole('region',{name:'Smoked brisket steps',exact:true});
 await expect(editor.getByLabel('Brisket weight (lb)',{exact:true})).toBeHidden();await expect(editor.getByText('Timing applied',{exact:true})).toBeHidden();
 await expect(steps.getByRole('article')).toHaveCount(9);await expect(steps.getByRole('article',{name:'Trim brisket',exact:true})).toBeVisible();
 const load=steps.getByRole('article',{name:'Put brisket on smoker',exact:true});await expect(load.locator('.planned-time-button time')).toHaveCSS('font-size','16px');await load.getByRole('button',{name:'Change planned time: Put brisket on smoker',exact:true}).click();
 const form=load.getByRole('form',{name:'Edit planned time',exact:true});await expect(form.getByLabel('Planned date and time',{exact:true})).toBeVisible();await expect(form.getByLabel('Planned date and time',{exact:true})).toHaveCSS('font-size','16px');await expect(form.getByLabel('Estimated duration (minutes)',{exact:true})).toHaveCount(0);await expect(form.getByText(/^More options/)).toHaveCount(0);
 await form.getByLabel('Planned date and time',{exact:true}).fill('2026-11-08T00:30');await form.screenshot({path:info.outputPath('direct-time.png')});await form.getByRole('button',{name:'Save',exact:true}).click();
 const saved=await read(page);expect(saved.dishes).toEqual(m.dishes);expect(saved.serveAt).toBe(serve);expect(saved.taskOverrides['brisket:start']).toEqual({scheduledAt:'2026-11-08T05:30:00.000Z'});
 await load.getByRole('button',{name:'Change planned time: Put brisket on smoker',exact:true}).click();await form.getByRole('button',{name:'Use plan timing',exact:true}).click();await form.getByRole('button',{name:'Save',exact:true}).click();await expect(load.locator('time').first()).toHaveAttribute('datetime','2026-11-08T04:00:00.000Z');
 const beforeCancel=await read(page);await load.getByRole('button',{name:'Change planned time: Put brisket on smoker',exact:true}).click();await form.getByLabel('Planned date and time',{exact:true}).fill('2026-11-08T01:00');await form.getByRole('button',{name:'Cancel',exact:true}).click();expect(await read(page)).toEqual(beforeCancel);
 await steps.screenshot({path:info.outputPath('planning-steps.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();expect(cookTimeline(await read(page)).find(t=>t.id==='brisket:start')?.scheduledAt).toBe('2026-11-08T04:00:00.000Z');
});
test('full editor exposes planned time and keeps duration/equipment optional',async({page})=>{
 await open(page,seed());await page.getByRole('button',{name:'Edit Smoked brisket',exact:true}).click();
 const row=page.getByRole('region',{name:'Smoked brisket steps',exact:true}).getByRole('article',{name:'Trim brisket',exact:true});await row.getByRole('button',{name:'Edit Trim brisket',exact:true}).click();
 const form=row.getByRole('form',{name:'Edit step',exact:true});await expect(form.getByLabel('Planned date and time',{exact:true})).toBeVisible();await expect(form.getByLabel('Duration unit',{exact:true})).toBeHidden();await expect(form.getByLabel('Equipment for this step',{exact:true})).toBeHidden();
});
test('cooking time editor opens from collapsed card and preserves recorded prep',async({page},info)=>{
 let m:ExtendedMeal=startCookSession(seed(),now);for(const t of cookTimeline(m).filter(t=>t.templateStage?.kind==='preparation'&&t.dishId==='brisket'))m=recordEvent(m,t.id,'completed',now);
 await open(page,m);await page.getByRole('button',{name:'Full checklist',exact:true}).click();await page.getByRole('button',{name:'Open step: Put brisket on smoker for Smoked brisket',exact:true}).click();const current=page.getByRole('region',{name:'Current step',exact:true});await current.getByRole('button',{name:'Change planned time: Put brisket on smoker',exact:true}).click();
 const form=current.getByRole('form',{name:'Edit planned time',exact:true});await form.getByLabel('Planned date and time',{exact:true}).fill('2026-11-08T00:30');await form.getByRole('button',{name:'Save',exact:true}).click();
 const saved=await read(page);expect(saved.events).toEqual(m.events);expect(saved.completed).toEqual(m.completed);expect(saved.dishes).toEqual(m.dishes);await current.screenshot({path:info.outputPath('cooking-time.png')});
});
test('new reserve is adjustable in optional settings and never creates extra steps',async({page})=>{
 await open(page,seed());await page.getByRole('button',{name:'Edit Smoked brisket',exact:true}).click();const editor=page.getByRole('region',{name:'Dish editor',exact:true});await editor.getByText('Dish settings',{exact:true}).click();
 await editor.getByLabel('Extra hot-hold buffer (minutes)',{exact:true}).fill('360');await editor.getByRole('button',{name:'Use recommended timing',exact:true}).click();
 const saved=await read(page);expect(cookTimeline(saved).find(t=>t.id==='brisket:start')?.scheduledAt).toBe('2026-11-08T02:00:00.000Z');expect(saved.serveAt).toBe(serve);expect(cookTimeline(saved).filter(t=>t.dishId==='brisket')).toHaveLength(9);
});
