import {test,expect} from '@playwright/test';
import {newMeal,createDish} from '../src/domain/meal';
import {archiveCook,emptyHistory,HISTORY_KEY} from '../src/domain/cookHistory';
import {migrateMeal,type CookEvent} from '../src/domain/cookState';
import {compactLibraryCard} from './helpers/libraryCard';

test('Past cooks cards stay compact and recorded activity uses only immutable archived steps',async({page},info)=>{
 const dishes=[createDish('brisket'),createDish('brats')],meal=migrateMeal({...newMeal(),name:'Browns Brisket',dishes,serveAt:'2026-11-08T13:00',startedAt:'2026-11-07T23:34Z'});
 const history=archiveCook(meal,emptyHistory(),'Great overall','2026-11-08T18:00Z'),cook=history.cooks[0];
 cook.plannedTimeline[0]={...cook.plannedTimeline[0],title:'Archived temperature check',dishName:'Smoked brisket'};
 const other=cook.plannedTimeline.find(t=>t.dishId===dishes[1].id)!;other.title='Archived temperature check';other.dishName='Brats';
 cook.meal.events=Array.from({length:16},(_,i):CookEvent=>({id:'saved-event-'+i,taskId:i===15?'missing-archived-step':i===14?'':i%2?other.id:cook.plannedTimeline[0].id,kind:([ 'temperature','started','completed','reopened','equipment','removed'] as const)[i%6],occurredAt:`2026-11-08T${String(8-Math.floor(i/2)).padStart(2,'0')}:03:00.000Z`,...(i%6===0?{value:([166,180,195] as const)[Math.floor(i/6)],unit:'°F' as const}:{}),...(i===4?{note:'Changed to pellet smoker'}:{})}));
 cook.meal.completed[cook.plannedTimeline[0].id]='2026-11-08T08:19:00.000Z';
 cook.meal.notes[cook.plannedTimeline[0].id]='Keep this archived step note';cook.meal.notes['missing-note-step']='Keep this orphan note';
 const original=JSON.stringify(history);await page.goto('/');await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:HISTORY_KEY,raw:original});await page.reload();await page.getByRole('button',{name:'Past cooks',exact:true}).click();
 const card=page.locator('.cook-history .history-item').first(),summary=card.locator('.between').first(),actions=card.locator('.history-actions');
 await expect(card).toBeVisible();await compactLibraryCard(card,'Delete Browns Brisket');await page.screenshot({path:info.outputPath('history-cards.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});
 const box=await summary.boundingBox(),buttons=await actions.getByRole('button').all();for(const b of buttons){const r=await b.boundingBox();expect(r!.height).toBeGreaterThanOrEqual(44);}
 const first=await buttons[0].boundingBox();expect(first!.y-(box!.y+box!.height)).toBeLessThanOrEqual(13);expect(first!.y-(box!.y+box!.height)).toBeGreaterThanOrEqual(7);
 const count=await card.locator('.history-count').boundingBox();expect(count!.x+count!.width).toBeLessThanOrEqual((await card.boundingBox())!.x+(await card.boundingBox())!.width);
 await card.getByRole('button',{name:'View cook',exact:true}).click();const detail=page.getByRole('region',{name:'Saved cook details',exact:true}),rows=detail.locator('.history-events > li[data-event-id]');
 const activity=detail.locator('.history-recorded-activity'),summaryToggle=activity.locator('summary');await expect(summaryToggle).toHaveText('Recorded activity (18)');await expect(activity).not.toHaveAttribute('open');await expect(rows.first()).not.toBeVisible();await expect(detail.getByText('Keep this archived step note',{exact:true})).not.toBeVisible();
 const checklist=detail.locator('.history-tasks');await expect(checklist).toBeVisible();await expect(checklist.locator('li').first()).toContainText('Completed');await expect(checklist.locator('li').first().locator('time')).toHaveAttribute('datetime','2026-11-08T08:19:00.000Z');await expect(checklist).not.toContainText('Not recorded');await expect(detail).not.toContainText('Saved:');
 await page.screenshot({path:info.outputPath('past-cook-collapsed.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});
 await summaryToggle.focus();await page.keyboard.press('Enter');await expect(activity).toHaveAttribute('open','');
 await expect(rows).toHaveCount(16);await expect(rows.nth(0)).toContainText('Smoked brisket · Archived temperature check');await expect(rows.nth(1)).toContainText('Brats · Archived temperature check');
 await expect(activity.locator('[data-note-task-id]').first()).toContainText('Smoked brisket · Archived temperature check');await expect(activity).toContainText('Keep this archived step note');await expect(activity.locator('[data-note-task-id]').last()).toContainText('Archived step unavailable');await expect(activity).toContainText('Keep this orphan note');
 for(const value of [166,180,195])await expect(detail.locator('.history-events')).toContainText(`${value}°F`);await expect(rows.nth(4)).toContainText('Changed to pellet smoker');await expect(rows.nth(14)).toContainText('No step recorded');await expect(rows.nth(15)).toContainText('Archived step unavailable');
 expect(await rows.locator('time').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('datetime')))).toEqual(cook.meal.events.map(e=>e.occurredAt));expect(await rows.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-event-id')))).toEqual(cook.meal.events.map(e=>e.id));
 await page.screenshot({path:info.outputPath('archived-activity.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});expect(await page.evaluate(k=>localStorage.getItem(k),HISTORY_KEY)).toBe(original);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await summaryToggle.click();await expect(rows.first()).not.toBeVisible();expect(await page.evaluate(k=>localStorage.getItem(k),HISTORY_KEY)).toBe(original);
 await page.getByRole('button',{name:'All past cooks',exact:true}).click();await page.getByLabel('Find a past cook').fill('Browns');await expect(card).toBeVisible();
});
