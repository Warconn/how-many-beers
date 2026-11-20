import {test,expect} from '@playwright/test';
import {newMeal} from '../src/domain/meal';
import {parseRecipeText} from '../src/domain/recipe';
import {startCookSession,recordEvent,cookTimeline} from '../src/domain/cookState';
import {homeActiveCook} from '../tests/fixtures/homeActiveCook';
test.use({timezoneId:'UTC'});

test('Home next action updates at minute boundaries, preserves the compact actions and uses the existing clock',async({page},info)=>{
 test.setTimeout(60_000);const {meal,first}=homeActiveCook();await page.clock.install({time:new Date('2026-11-22T11:59:00Z')});await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),meal);await page.reload();await page.clock.pauseAt(new Date('2026-11-22T12:00:00Z'));
 const card=page.locator('.home-current'),summary=card.getByRole('group',{name:'Next up',exact:true});await expect(summary).toContainText('Heat oil');await expect(summary).toContainText('Wings');await expect(summary).toContainText('In 1 min');await expect(summary.locator('time')).toHaveAttribute('datetime','2026-11-22T12:01:00.000Z');
 const initial=await page.evaluate(()=>localStorage.getItem('how-many-beers:meal:v1'));
 const buttons=card.getByRole('button');await expect(buttons).toHaveCount(3);const primary=await card.getByRole('button',{name:'Continue cooking',exact:true}).boundingBox(),view=await card.getByRole('button',{name:'View cook',exact:true}).boundingBox(),cancel=await card.getByRole('button',{name:'Cancel cook',exact:true}).boundingBox();
 expect(primary!.y+primary!.height).toBeLessThan(view!.y);expect(Math.abs(view!.y-cancel!.y)).toBeLessThan(2);for(const r of [primary,view,cancel])expect(r!.height).toBeGreaterThanOrEqual(44);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await card.screenshot({path:info.outputPath('home-next-up.png'),scale:'css',style:'nextjs-portal{display:none}'});
 // Track timers after hydration. Cooking already has the Beerometer's own clock;
 // returning Home must retain exactly one page clock, without accumulating timers.
 await page.evaluate(()=>{
  const live=new Set<number>(),set=window.setInterval.bind(window),clear=window.clearInterval.bind(window);(window as any).__homeIntervals=live;
  window.setInterval=((handler:TimerHandler,delay?:number,...args:any[])=>{const id=set(handler,delay,...args);if(delay===30000)live.add(id);return id;}) as typeof window.setInterval;
  window.clearInterval=((id?:number)=>{if(id!==undefined)live.delete(id);clear(id);}) as typeof window.clearInterval;
 });
 for(let i=0;i<2;i++){await card.getByRole('button',{name:'Continue cooking',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).__homeIntervals.size)).toBe(2);await page.getByRole('button',{name:'Home',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).__homeIntervals.size)).toBe(1);}
 await page.clock.fastForward(60000);await expect(summary).toContainText('Now');await page.clock.fastForward(60000);await expect(summary).toContainText('1 min overdue');expect(await page.evaluate(()=>localStorage.getItem('how-many-beers:meal:v1'))).toBe(initial);
 await card.getByRole('button',{name:'Continue cooking',exact:true}).click();await page.getByRole('region',{name:'Current step',exact:true}).getByRole('checkbox',{name:'Complete Heat oil',exact:true}).click();await page.getByRole('button',{name:'Home',exact:true}).click();await expect(summary).toContainText('Check potatoes');await expect(summary).not.toContainText('Heat oil');await card.screenshot({path:info.outputPath('home-next-after-check.png'),scale:'css',style:'nextjs-portal{display:none}'});
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));let saved=await read();expect(saved.completed[first]).toBe('2026-11-22T12:02:00.000Z');expect(saved.taskOverrides[first].scheduledAt).toBe('2026-11-22T12:01:00.000Z');expect(saved.serveAt).toBe(meal.serveAt);
 await card.getByRole('button',{name:'Continue cooking',exact:true}).click();await page.getByRole('button',{name:'Full checklist',exact:true}).click();await page.getByRole('button',{name:'Open step: Heat oil for Wings',exact:true}).click();await page.getByRole('checkbox',{name:'Complete Heat oil',exact:true}).click();await page.getByRole('button',{name:'Home',exact:true}).click();await expect(summary).toContainText('Heat oil');saved=await read();expect(saved.events.at(-1).kind).toBe('reopened');const events=structuredClone(saved.events);
 await card.getByRole('button',{name:'View cook',exact:true}).click();await page.getByRole('button',{name:'Edit Wings',exact:true}).click();await page.getByRole('region',{name:'Wings steps',exact:true}).getByRole('article',{name:'Heat oil',exact:true}).getByRole('button',{name:'Change planned time: Heat oil',exact:true}).click();const time=page.getByRole('form',{name:'Edit planned time',exact:true});await time.getByLabel('Planned date and time',{exact:true}).fill('2026-11-22T12:10');await time.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'Home',exact:true}).click();await expect(summary).toContainText('Check potatoes');expect((await read()).events).toEqual(events);expect((await read()).serveAt).toBe(meal.serveAt);

});

test('planning and empty Home do not display a cooking next action',async({page})=>{
 await page.goto('/');await expect(page.getByRole('group',{name:'Next up',exact:true})).toHaveCount(0);const {meal}=homeActiveCook();await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify({...m,mode:'planning',startedAt:undefined})),meal);await page.reload();await expect(page.getByRole('button',{name:/Resume planning/})).toBeVisible();await expect(page.getByRole('group',{name:'Next up',exact:true})).toHaveCount(0);
});


test('Home stays quietly waiting during an actual rest and never auto-finishes an elapsed estimate',async({page},info)=>{
 const dish=parseRecipeText('Brisket','Rest brisket (120 minutes)');let meal=startCookSession({...newMeal(),name:'Brisket hold',serveAt:'2026-11-22T15:00:00Z',dishes:[dish]},'2026-11-22T11:00:00Z');meal=recordEvent(meal,dish.id+':step-1','completed','2026-11-22T11:00:00Z');
 await page.clock.install({time:new Date('2026-11-22T12:00:00Z')});await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),meal);await page.reload();const card=page.locator('.home-current');await expect(card.getByLabel('Cook progress',{exact:true})).toHaveText('Cooking or holding in progress.');await expect(card.getByRole('group',{name:'Next up',exact:true})).toHaveCount(0);const original=await page.evaluate(()=>localStorage.getItem('how-many-beers:meal:v1'));await page.clock.fastForward(2*60*60000);await expect(card.getByLabel('Cook progress',{exact:true})).toHaveText('Cooking or holding in progress.');expect(await page.evaluate(()=>localStorage.getItem('how-many-beers:meal:v1'))).toBe(original);await card.screenshot({path:info.outputPath('home-waiting.png'),scale:'css',style:'nextjs-portal{display:none}'});
});


test('a remaining conditional action shows what to watch for without a false ETA',async({page})=>{
 const {meal}=homeActiveCook();meal.completed=Object.fromEntries(cookTimeline(meal).map(t=>[t.id,'2026-11-22T12:00:00Z']));meal.customTasks=[{id:'browning',dishId:meal.dishes[0].id,dishName:'Wings',title:'Check browning',instructions:'When skin is crisp, continue.',scheduledAt:null,isCondition:true}];
 await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),meal);await page.reload();const next=page.getByRole('group',{name:'Next up',exact:true});await expect(next).toContainText('Check browning');await expect(next).toContainText('When skin is crisp, continue.');await expect(next.locator('time')).toHaveCount(0);await expect(next).not.toContainText('overdue');
});
