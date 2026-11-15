import {test,expect} from '@playwright/test';
import {newMeal,createDish} from '../src/domain/meal';
import {archiveCook,emptyHistory,HISTORY_KEY} from '../src/domain/cookHistory';

test('an older past cook opens at the top rather than after the full list',async({page},info)=>{
  let history=emptyHistory();
  for(let index=0;index<8;index++){
    const meal={...newMeal(),name:'Dinner '+(index+1),dishes:[createDish('brats')],startedAt:'2026-11-08T12:00:00Z'};
    history=archiveCook(meal,history,'Cook '+(index+1)+' notes','2026-11-08T18:00:00Z');
  }
  await page.goto('/');
  await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:HISTORY_KEY,value:history});
  await page.reload();
  await page.getByRole('button',{name:'Past cooks',exact:true}).click();

  const list=page.locator('.history-list');
  await expect(list.locator('.history-item')).toHaveCount(8);
  await page.getByRole('button',{name:'View cook',exact:true}).last().click();
  const detail=page.getByRole('region',{name:'Saved cook details'});
  await expect(detail).toBeVisible();
  await expect(detail).toContainText('Original checklist');
  await expect(page.getByRole('button',{name:'All past cooks',exact:true})).toBeInViewport();
  await expect(list).toHaveCount(0);
  await page.screenshot({path:info.outputPath('past-cook-detail.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});

  await page.getByRole('button',{name:'All past cooks',exact:true}).click();
  await expect(list.locator('.history-item')).toHaveCount(8);
  await page.getByLabel('Find a past cook').fill('Dinner 5');
  await expect(list.locator('.history-item')).toHaveCount(1);
  await expect(list).toContainText('Dinner 5');
});
