import {test,expect} from '@playwright/test';
import {newMeal,createDish} from '../src/domain/meal';
import {archiveCook,emptyHistory,exportBackup,ACTIVE_KEY,HISTORY_KEY} from '../src/domain/cookHistory';
test('history stays uncluttered and protected recovery can restore retained records',async({page},info)=>{
 const meal={...newMeal(),name:'Family dinner',dishes:[createDish('brats')],startedAt:'2026-10-28T12:00Z'};
 const history=archiveCook(meal,emptyHistory(),'Good cook','2026-10-28T18:00Z');
 await page.goto('/');await page.evaluate(({meal,history,a,h})=>{localStorage.setItem(a,JSON.stringify(meal));localStorage.setItem(h,JSON.stringify(history));},{meal,history,a:ACTIVE_KEY,h:HISTORY_KEY});await page.reload();await page.getByRole('button',{name:/Past cooks/}).click();
 const view=page.getByRole('button',{name:'View cook',exact:true});await expect(view).toHaveClass(/primary/);await view.click();await expect(page.getByRole('region',{name:'Saved cook details'})).toContainText('Good cook');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath('history-actions.png'),fullPage:true});
 await expect(page.getByRole('button',{name:'Download backup',exact:true})).toHaveCount(0);await expect(page.getByLabel('Restore a backup',{exact:true})).toHaveCount(0);
 const backup=exportBackup(meal,history,'2026-10-28T18:00Z');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Delete',exact:true}).click();await expect(page.getByRole('button',{name:'Delete',exact:true})).toHaveCount(1);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete',exact:true}).click();await expect(page.getByRole('button',{name:'Delete',exact:true})).toHaveCount(0);
 await page.evaluate(k=>localStorage.setItem(k,'{unreadable after deletion'),ACTIVE_KEY);await page.reload();await expect(page.getByRole('region',{name:'Saved cook recovery',exact:true})).toBeVisible();
 page.once('dialog',d=>d.accept());await page.getByLabel('Restore a backup',{exact:true}).setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});await page.getByRole('button',{name:'Past cooks',exact:true}).click();await expect(page.getByRole('button',{name:'Cook again',exact:true})).toBeVisible();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Cook again',exact:true}).click();await page.getByRole('button',{name:/Resume planning/}).click();await expect(page.getByRole('heading',{name:'1 dish in this cook'})).toBeVisible();
});
