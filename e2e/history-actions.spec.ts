import {test,expect} from '@playwright/test';
import {newMeal,createDish} from '../src/domain/meal';
import {archiveCook,emptyHistory,ACTIVE_KEY,HISTORY_KEY} from '../src/domain/cookHistory';
test('history actions, backup and restore remain usable without overflow',async({page},info)=>{
 const meal={...newMeal(),name:'Family dinner',dishes:[createDish('brats')],startedAt:'2026-10-28T12:00Z'};
 const history=archiveCook(meal,emptyHistory(),'Good cook','2026-10-28T18:00Z');
 await page.goto('/');await page.evaluate(({meal,history,a,h})=>{localStorage.setItem(a,JSON.stringify(meal));localStorage.setItem(h,JSON.stringify(history));},{meal,history,a:ACTIVE_KEY,h:HISTORY_KEY});await page.reload();await page.getByRole('button',{name:/Past cooks and backups/}).click();
 const view=page.getByRole('button',{name:'View cook',exact:true});await expect(view).toHaveClass(/primary/);await view.click();await expect(page.getByRole('region',{name:'Saved cook details'})).toContainText('Good cook');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath('history-actions.png'),fullPage:true});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download backup',exact:true}).click();const file=await download;const path=(await file.path())!;
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Delete',exact:true}).click();await expect(page.getByRole('button',{name:'Delete',exact:true})).toHaveCount(1);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete',exact:true}).click();await expect(page.getByRole('button',{name:'Delete',exact:true})).toHaveCount(0);
 page.once('dialog',d=>d.accept());await page.getByLabel('Restore a backup',{exact:true}).setInputFiles(path);await expect(page.getByRole('button',{name:'Cook again',exact:true})).toBeVisible();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Cook again',exact:true}).click();await page.getByRole('button',{name:/Resume planning/}).click();await expect(page.getByRole('heading',{name:'1 dish in this cook'})).toBeVisible();
});
