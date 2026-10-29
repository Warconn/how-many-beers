import {test,expect} from '@playwright/test';
import {newMeal,createDish} from '../src/domain/meal';
test('Beerometer decreases with remaining work and reaches zero before Finish cook',async({page},info)=>{
 await page.clock.install({time:new Date('2026-11-25T10:00Z')});
 const meal={...newMeal(),serveAt:'2026-11-26T18:00Z',dishes:[createDish('brisket'),createDish('brats')]};
 await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),meal);await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Start cooking',exact:true}).click();
 const meter=page.getByRole('region',{name:'Cook duration in beers'});const before=Number(await meter.locator('strong').innerText());
 await page.getByRole('button',{name:'Full checklist',exact:true}).click();
 const checks=page.getByRole('region',{name:'Full cook checklist'}).getByRole('checkbox');await checks.first().check();
 await expect.poll(async()=>Number(await meter.locator('strong').innerText())).toBeLessThan(before);
 for(let i=1;i<await checks.count();i++)await checks.nth(i).check();
 await expect(meter.locator('strong')).toHaveText('0.0');await expect(meter).toContainText('All steps checked');await expect(meter).not.toContainText('Projected cook');
 await page.getByRole('button',{name:'Back to step',exact:true}).click();await meter.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('remaining-zero.png'),fullPage:false});
 await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(meter.locator('strong')).toHaveText('0.0');
});
