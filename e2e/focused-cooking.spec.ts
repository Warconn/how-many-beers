import {test,expect} from '@playwright/test';
import {createDish,newMeal,type PlannedTask} from '../src/domain/meal';
import {cookTimeline,recordEvent,type ExtendedMeal} from '../src/domain/cookState';
import {HISTORY_KEY} from '../src/domain/cookHistory';
test.use({timezoneId:'America/New_York'});
const now='2026-11-25T17:00:00Z';
function fixture():ExtendedMeal{
 const task=(id:string,title:string,time:string|null,isCondition=false):PlannedTask=>({id,title,scheduledAt:time,dishId:'custom',dishName:'General prep',instructions:'Follow your method and check actual conditions.',isCondition});
 const meal:ExtendedMeal={...newMeal(),name:'Overnight cook',mode:'cooking',startedAt:'2026-11-25T15:00:00Z',serveAt:'2026-11-25T18:00',customTasks:[task('done','Season food','2026-11-25T16:00:00Z'),task('due','Check the bark','2026-11-25T16:50:00Z',true),task('soon','Warm the sauce','2026-11-25T17:10:00Z'),task('later','Set the table','2026-11-25T20:00:00Z'),task('untimed','Choose a serving tray',null)],taskOrder:['later','soon','due','untimed','done']};
 return recordEvent(meal,'done','completed','2026-11-25T16:15:00Z');
}
async function load(page:import('@playwright/test').Page,meal=fixture()){
 await page.clock.install({time:new Date(now)});await page.goto('/');await page.evaluate(m=>{localStorage.clear();localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m));},meal);await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();return meal;
}
const saved=(page:import('@playwright/test').Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!) as ExtendedMeal);

test('one guided step, next-step footer and a flat whole-cook checklist preserve navigation state',async({page},info)=>{
 const original=await load(page);const guide=page.getByRole('region',{name:'Current step',exact:true});const bar=page.getByRole('navigation',{name:'Cooking guide',exact:true});
 await expect(guide.getByRole('article',{name:'Check the bark',exact:true})).toBeVisible();await expect(page.getByRole('article')).toHaveCount(1);
 await expect(bar.getByRole('button',{name:'Preview next step: Warm the sauce',exact:true})).toBeVisible();await expect(bar.getByRole('button',{name:/Save Cook|View plan/i})).toHaveCount(0);
 const box=await bar.boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(page.viewportSize()!.height+1);
 await page.screenshot({path:info.outputPath('guided-cooking.png'),fullPage:false});
 await bar.getByRole('button',{name:'Preview next step: Warm the sauce',exact:true}).click();await expect(guide.getByRole('article',{name:'Warm the sauce',exact:true})).toBeVisible();expect(await saved(page)).toEqual(original);
 await bar.getByRole('button',{name:'Full checklist',exact:true}).click();const checklist=page.getByRole('region',{name:'Full cook checklist',exact:true});
 await expect(checklist.getByRole('listitem')).toHaveCount(5);await expect(checklist.getByRole('article')).toHaveCount(0);await expect(checklist.getByRole('checkbox',{name:'Complete Season food for General prep',exact:true})).toBeChecked();
 expect(await checklist.getByRole('button',{name:/^Open step:/}).allTextContents()).toEqual(expect.arrayContaining([expect.stringContaining('Check the bark'),expect.stringContaining('Warm the sauce')]));
 await page.screenshot({path:info.outputPath('flat-cook-checklist.png'),fullPage:true});
 await checklist.getByRole('button',{name:'Open step: Choose a serving tray for General prep',exact:true}).click();await expect(guide).toContainText('Timing TBD');expect(await saved(page)).toEqual(original);
 await page.getByRole('button',{name:'Edit plan',exact:true}).click();expect(await saved(page)).toEqual(original);await page.getByRole('button',{name:'Continue cooking',exact:true}).click();
 await page.getByRole('button',{name:'← Home',exact:true}).click();await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(guide.getByRole('article',{name:'Check the bark',exact:true})).toBeVisible();expect(await saved(page)).toEqual(original);
 for(const width of [375,768,1280]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
});

test('editing and readings stay protected; completing advances guidance and retains actual activity',async({page})=>{
 const original=await load(page);const guide=page.getByRole('region',{name:'Current step',exact:true});const bar=page.getByRole('navigation',{name:'Cooking guide',exact:true});const row=guide.getByRole('article',{name:'Check the bark',exact:true});
 await row.getByRole('button',{name:'Edit',exact:true}).click();await row.getByLabel('Instructions',{exact:true}).fill('Unsaved draft stays here');await expect(bar.getByRole('button',{name:'Full checklist',exact:true})).toBeDisabled();
 await page.clock.fastForward(11*60*1000);await expect(row.getByLabel('Instructions',{exact:true})).toHaveValue('Unsaved draft stays here');await row.getByRole('button',{name:'Cancel',exact:true}).click();
 await row.getByRole('button',{name:'Edit',exact:true}).click();await row.getByLabel('Planned date and time',{exact:true}).fill('2026-11-25T23:00');await row.getByRole('button',{name:'Save & Close',exact:true}).click();await expect(row).toBeVisible();expect((await saved(page)).taskOverrides!.due.scheduledAt).toBe('2026-11-26T04:00:00.000Z');expect((await saved(page)).events).toEqual(original.events);
 await row.getByRole('button',{name:'+ Log temperature',exact:true}).click();await row.getByLabel('Food temperature',{exact:true}).fill('165');await expect(bar.getByRole('button',{name:/Preview next step/})).toBeDisabled();
 await row.getByRole('button',{name:'Save timestamped reading',exact:true}).click();await row.getByLabel('Quick notes',{exact:true}).fill('Bark still soft');await row.getByRole('checkbox',{name:'Complete Check the bark',exact:true}).click();
 await expect(guide.getByRole('article',{name:'Warm the sauce',exact:true})).toBeVisible();const after=await saved(page);expect(after.completed.due).toBeTruthy();expect(after.notes.due).toBe('Bark still soft');expect(after.startedAt).toBe(original.startedAt);expect(after.events!.filter(e=>e.taskId==='due').some(e=>e.kind==='temperature'&&e.value===165)).toBe(true);
 await bar.getByRole('button',{name:'Full checklist',exact:true}).click();const checklist=page.getByRole('region',{name:'Full cook checklist',exact:true});await expect(checklist.getByRole('checkbox',{name:'Complete Check the bark for General prep',exact:true})).toBeChecked();await checklist.getByRole('button',{name:'Open step: Check the bark for General prep',exact:true}).click();await row.locator('.task-activity summary').click();await expect(row.getByRole('listitem').filter({hasText:'165°F'})).toBeVisible();
 await expect(row.getByRole('button',{name:'Remove step: Check the bark',exact:true})).toBeVisible();await expect(row.getByText('Step options',{exact:true})).toHaveCount(0);await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();expect(await saved(page)).toEqual(after);
});

test('finish is separate from navigation and archives only after explicit confirmation',async({page})=>{
 const meal=fixture();meal.customTasks=meal.customTasks!.filter(t=>['done','due'].includes(t.id));meal.taskOrder=['due','done'];await load(page,meal);
 await page.getByRole('button',{name:'Finish cook',exact:true}).click();const finish=page.getByRole('region',{name:'Finish cook',exact:true});await expect(finish).toContainText('1 unchecked');await finish.getByRole('button',{name:'Keep cooking',exact:true}).click();expect(await saved(page)).toEqual(meal);
 await page.getByRole('checkbox',{name:'Complete Check the bark',exact:true}).click();await expect(page.getByText('All steps checked',{exact:true}).first()).toBeVisible();const complete=await saved(page);
 await page.getByRole('navigation',{name:'Cooking guide',exact:true}).getByRole('button',{name:'Finish cook',exact:true}).click();await finish.getByLabel('How did it turn out? (optional)').fill('Good bark');await finish.getByRole('button',{name:'Save finished cook',exact:true}).click();
 await expect(page.getByRole('region',{name:'Home',exact:true})).toBeVisible();const archive=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),HISTORY_KEY);expect(archive.cooks).toHaveLength(1);expect(archive.cooks[0].meal).toEqual(complete);expect(archive.cooks[0].feedback).toBe('Good bark');expect((await saved(page)).id).not.toBe(complete.id);
 const legacy:ExtendedMeal={...newMeal(),mode:'cooking',dishes:[createDish('brisket')],startedAt:'2026-11-24T20:00:00Z'};
 legacy.hiddenTaskIds=cookTimeline(legacy).map(t=>t.id);legacy.events=[{id:'old-start',taskId:legacy.dishes[0].id+':prep',kind:'started',occurredAt:'2026-11-24T20:00:00Z'}];
 await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),legacy);await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();
 await page.getByRole('navigation',{name:'Cook navigation',exact:true}).getByRole('button',{name:'Finish cook',exact:true}).click();await finish.getByRole('button',{name:'Save finished cook',exact:true}).click();
 const retained=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),HISTORY_KEY);expect(retained.cooks.find((c:{id:string})=>c.id===legacy.id).meal.events).toEqual(legacy.events);

});

test('Cancel adding is a compact quiet action with a phone-sized hit area',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:/Plan a new cook/}).click();const cancel=page.getByRole('button',{name:'Cancel adding',exact:true});
 const box=await cancel.boundingBox();expect(box!.width).toBeLessThanOrEqual(100);expect(box!.height).toBeGreaterThanOrEqual(44);expect(await cancel.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
 const before=await saved(page);await cancel.evaluate(el=>el.scrollIntoView({block:'center'}));await page.screenshot({path:info.outputPath('compact-cancel.png'),fullPage:false});await cancel.click();expect(await saved(page)).toEqual(before);await expect(page.getByRole('button',{name:'+ Add a dish',exact:true})).toBeVisible();
});


test('current step uses aligned content and consistent compact actions',async({page},info)=>{
 const meal=fixture();Object.assign(meal.customTasks!.find(t=>t.id==='due')!,{title:'Put brisket on smoker',dishName:'Smoked brisket',instructions:'Place the brisket on a stable cooking grate. Log the actual start time and initial smoker temperature.'});
 const original=await load(page,meal);const row=page.getByRole('region',{name:'Current step',exact:true}).getByRole('article');
 const actions=row.locator('.task-actions');const note=row.getByLabel('Quick notes',{exact:true});const instructions=row.getByText('Place the brisket on a stable cooking grate. Log the actual start time and initial smoker temperature.',{exact:true});
 const buttons=[row.getByRole('button',{name:'Edit',exact:true}),row.getByRole('button',{name:'+ Log temperature',exact:true}),row.getByRole('button',{name:'Remove step: Put brisket on smoker',exact:true})];
 const boxes=await Promise.all(buttons.map(b=>b.boundingBox()));
 for(const box of boxes){expect(box!.height).toBeGreaterThanOrEqual(44);expect(Math.abs(box!.height-boxes[0]!.height)).toBeLessThanOrEqual(1);expect(Math.abs(box!.y-boxes[0]!.y)).toBeLessThanOrEqual(1);}
 const noteBox=await note.boundingBox();const actionBox=await actions.boundingBox();const instructionBox=await instructions.boundingBox();
 expect(Math.abs(noteBox!.x-actionBox!.x)).toBeLessThanOrEqual(1);expect(Math.abs(instructionBox!.x-noteBox!.x)).toBeLessThanOrEqual(1);
 expect(await buttons[2].evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');await expect(buttons[2].locator('svg')).toBeVisible();
 for(const width of [375,390,768,1280]){const initial=page.viewportSize()!;await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);const controls=await Promise.all(buttons.map(b=>b.boundingBox()));expect(Math.abs(controls[0]!.y-controls[2]!.y)).toBeLessThanOrEqual(1);await page.setViewportSize(initial);}
 await row.evaluate(el=>el.scrollIntoView({block:'start'}));await row.screenshot({path:info.outputPath('standard-step-card.png')});expect(await saved(page)).toEqual(original);
});


test('step trash action confirms removal and retains recorded activity',async({page})=>{
 const meal=fixture();await load(page,meal);const remove=page.getByRole('button',{name:'Remove step: Check the bark',exact:true});
 page.once('dialog',d=>d.dismiss());await remove.click();expect(await saved(page)).toEqual(meal);
 page.once('dialog',d=>d.accept());await remove.click();const after=await saved(page);expect(after.hiddenTaskIds).toContain('due');expect(after.events!.filter(e=>e.kind!=='removed')).toEqual(meal.events);expect(after.startedAt).toEqual(meal.startedAt);await expect(page.getByRole('article',{name:'Warm the sauce',exact:true})).toBeVisible();
});
