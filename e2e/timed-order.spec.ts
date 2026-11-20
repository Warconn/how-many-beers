import {test,expect,type Locator} from '@playwright/test';
import {newMeal,createDish} from '../src/domain/meal';
import {cookTimeline} from '../src/domain/cookState';

test.use({timezoneId:'UTC'});
async function timedOrder(rows:Locator){
 const dates=await rows.evaluateAll(nodes=>nodes.map(n=>n.querySelector('time[datetime]')?.getAttribute('datetime')).filter((s):s is string=>!!s));
 expect(dates.length).toBeGreaterThan(3);
 expect(dates.map(Date.parse)).toEqual(dates.map(Date.parse).sort((a,b)=>a-b));
}
test('all planning lists interleave multi-day dishes by time despite saved dish grouping, including after edits and reload',async({page},info)=>{
 await page.clock.install({time:new Date('2026-11-13T08:00:00Z')});
 const brisket=createDish('brisket'),turkey=createDish('turkey');
 const meal={...newMeal(),serveAt:'2026-11-21T18:00:00Z',dishes:[brisket,turkey]};
 const tasks=cookTimeline(meal);
 const grouped={...meal,taskOrder:[...tasks.filter(t=>t.dishId===brisket.id),...tasks.filter(t=>t.dishId===turkey.id)].map(t=>t.id)};
 await page.goto('/');await page.evaluate(m=>{localStorage.clear();localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m));},grouped);await page.reload();
 await page.getByRole('button',{name:/Resume planning/}).click();
 const list=page.locator('[data-step-list="meal-plan"]'),rows=list.getByRole('article');
 await timedOrder(rows);
 await expect(rows.first()).toHaveAttribute('aria-label','Start refrigerator thawing');
 await page.getByRole('button',{name:'Show full schedule',exact:true}).click();await timedOrder(page.locator('.schedule-list > li'));
 await rows.first().scrollIntoViewIfNeeded();await rows.first().evaluate(el=>window.scrollBy(0,el.getBoundingClientRect().top-150));await page.screenshot({path:info.outputPath('chronological-plan-before-edit.png'),scale:'css',style:'nextjs-portal{display:none}'});
 const row=rows.filter({has:page.getByRole('button',{name:'Change planned time: Slice and serve',exact:true})});
 await row.getByRole('button',{name:'Change planned time: Slice and serve',exact:true}).click();
 await row.getByLabel('Planned date and time',{exact:true}).fill('2026-11-13T09:00');
 await row.getByRole('button',{name:'Save',exact:true}).click();
 await expect(rows.first()).toHaveAttribute('aria-label','Slice and serve');await timedOrder(rows);
 await page.getByRole('button',{name:'Edit '+brisket.name,exact:true}).click();
 await timedOrder(page.getByRole('region',{name:brisket.name+' steps',exact:true}).getByRole('article'));
 await list.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('chronological-plan.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
 expect(saved.taskOrder).toEqual(grouped.taskOrder);expect(saved.events??[]).toEqual([]);
 await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();
 await expect(rows.first()).toHaveAttribute('aria-label','Slice and serve');await timedOrder(rows);
});

test('Cooking checklist follows live start times across dishes and reload without rewriting saved sequence',async({page},info)=>{
 const {parseRecipeText}=await import('../src/domain/recipe');
 const {recipeReview}=await import('../src/domain/recipeReview');
 const at='2026-11-21T18:00:00Z';
 const dishes=[recipeReview(parseRecipeText('Potatoes','Roast potatoes (75 minutes)\nRemove potatoes from oven (0 minutes)'),at).dishes[0],recipeReview(parseRecipeText('Brats','Grill brats (45 minutes)\nRemove brats from grill (0 minutes)'),at).dishes[0]];
 const meal={...newMeal(),serveAt:at,dishes};const tasks=cookTimeline(meal);
 const grouped={...meal,taskOrder:dishes.flatMap(d=>tasks.filter(t=>t.dishId===d.id).map(t=>t.id))};
 await page.clock.install({time:new Date('2026-11-21T16:45:00Z')});await page.clock.setFixedTime(new Date('2026-11-21T16:45:00Z'));
 await page.goto('/');await page.evaluate(m=>{localStorage.clear();localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m));},grouped);await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Start cooking',exact:true}).click();await page.getByRole('button',{name:'Full checklist',exact:true}).click();
 const rows=page.locator('.flat-cook-list > li');await timedOrder(rows);
 await expect(rows.nth(1)).toContainText('Grill brats');
 await page.getByRole('region',{name:'Full cook checklist',exact:true}).getByRole('checkbox',{name:'Complete Roast potatoes (75 minutes) for Potatoes',exact:true}).check();await timedOrder(rows);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
 expect(saved.taskOrder).toEqual(grouped.taskOrder);
 await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await page.getByRole('button',{name:'Full checklist',exact:true}).click();await timedOrder(rows);
 expect((await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!))).events).toEqual(saved.events);
 await page.screenshot({path:info.outputPath('chronological-cooking.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});
});

test('Past cook steps and recorded activity use their displayed times without modifying the archive',async({page})=>{
 const {archiveCook,emptyHistory,HISTORY_KEY}=await import('../src/domain/cookHistory');
 const meal={...newMeal(),name:'Timed history',serveAt:'2026-11-21T18:00Z',dishes:[createDish('brats')]};
 const history=archiveCook(meal,emptyHistory(),'','2026-11-21T19:00Z'),entry=history.cooks[0];
 entry.plannedTimeline.reverse();
 entry.meal.completed[entry.plannedTimeline[0].id]='2026-11-21T08:00:00Z';
 entry.meal.events=[{id:'late',taskId:entry.plannedTimeline[1].id,kind:'completed',occurredAt:'2026-11-21T18:00:00Z'},{id:'early',taskId:entry.plannedTimeline[0].id,kind:'completed',occurredAt:'2026-11-21T08:00:00Z'}];
 const raw=JSON.stringify(history);
 await page.goto('/');await page.evaluate(({key,raw})=>{localStorage.clear();localStorage.setItem(key,raw);},{key:HISTORY_KEY,raw});await page.reload();await page.getByRole('button',{name:'Past cooks',exact:true}).click();await page.getByRole('button',{name:'View cook',exact:true}).click();
 await timedOrder(page.locator('.history-tasks > li'));await page.locator('.history-recorded-activity > summary').click();
 await expect(page.locator('.history-events > li[data-event-id]').first()).toHaveAttribute('data-event-id','early');
 expect(await page.evaluate(key=>localStorage.getItem(key),HISTORY_KEY)).toBe(raw);
});
