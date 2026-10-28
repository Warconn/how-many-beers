import {test,expect} from '@playwright/test';
import {createDish,newMeal} from '../src/domain/meal';
import {migrateMeal,recordEvent,cookTimeline} from '../src/domain/cookState';
test('Home flows directly from brand to hero with a visible primary action',async({page},info)=>{
 await page.goto('/');
 await expect(page.getByText('A LITTLE LESS JUGGLING. A BETTER COOK.',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Saved on this device',{exact:true})).toHaveCount(0);
 expect(await page.locator('.site-header').evaluate(e=>e.nextElementSibling?.getAttribute('aria-label'))).toBe('Home');
 await expect(page.getByRole('button',{name:/Plan a new cook/})).toBeInViewport();
 const heading=await page.getByRole('heading',{name:'From First Beer to First Bite.',exact:true}).boundingBox(),header=await page.locator('.site-header').boundingBox();expect(heading!.y-header!.y-header!.height).toBeLessThan(80);
 await page.screenshot({path:info.outputPath('clean-home.png'),fullPage:true,style:'nextjs-portal{display:none}'});
});
test('returning Home keeps resume actions and actual cook data intact',async({page},info)=>{
 const base=migrateMeal({...newMeal(),name:'Tonight’s cook',dishes:[createDish('brisket')],mode:'cooking' as const,startedAt:'2026-10-27T23:00:00Z'});
 const meal=recordEvent(base,cookTimeline(base)[0].id,'completed','2026-10-27T23:01:00Z');
 await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),meal);await page.reload();
 await expect(page.getByRole('button',{name:/Continue cooking/})).toBeInViewport();await expect(page.getByText('Saved on this device',{exact:true})).toHaveCount(0);
 await page.screenshot({path:info.outputPath('clean-returning-home.png'),fullPage:true,style:'nextjs-portal{display:none}'});
 await page.getByRole('button',{name:/Continue cooking/}).click();await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!))).toEqual(meal);
});
