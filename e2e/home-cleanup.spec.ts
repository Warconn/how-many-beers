import {test,expect} from '@playwright/test';
import {createDish,newMeal} from '../src/domain/meal';
import {migrateMeal,recordEvent,cookTimeline} from '../src/domain/cookState';
test('Home flows directly from brand to hero with a visible primary action',async({page},info)=>{
 await page.goto('/');
 await expect(page.getByText('A LITTLE LESS JUGGLING. A BETTER COOK.',{exact:true})).toHaveCount(0);
 await expect(page.getByText(/^Saved on this device/)).toHaveCount(0);
 expect(await page.locator('.site-header').evaluate(e=>{const next=e.nextElementSibling;return (next?.matches('.cook-content')?next.firstElementChild:next)?.getAttribute('aria-label');})).toBe('Home');
 await expect(page.getByRole('button',{name:/Plan a cook/})).toBeInViewport();
 const heading=await page.getByRole('heading',{name:'From First Beer to First Bite.',exact:true}).boundingBox(),header=await page.locator('.site-header').boundingBox();expect(heading!.y-header!.y-header!.height).toBeLessThan(80);
 await page.screenshot({path:info.outputPath('clean-home.png'),fullPage:true,style:'nextjs-portal{display:none}'});
});
test('returning Home keeps resume actions and actual cook data intact',async({page},info)=>{
 const base=migrateMeal({...newMeal(),name:'Tonight’s cook',dishes:[createDish('brisket')],mode:'cooking' as const,startedAt:'2026-10-27T23:00:00Z'});
 const meal=recordEvent(base,cookTimeline(base)[0].id,'completed','2026-10-27T23:01:00Z');
 await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),meal);await page.reload();
 await expect(page.getByRole('button',{name:/Continue cooking/})).toBeInViewport();await expect(page.getByText(/^Saved on this device/)).toHaveCount(0);
 await page.screenshot({path:info.outputPath('clean-returning-home.png'),fullPage:true,style:'nextjs-portal{display:none}'});
 await page.getByRole('button',{name:/Continue cooking/}).click();await expect(page.getByText(/^Saved on this device/)).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!))).toEqual(meal);
});


test('mobile active cook keeps one prominent action and two compact supporting actions',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});
 const meal=migrateMeal({...newMeal(),name:'Sunday wings',dishes:[createDish('brats')],mode:'cooking' as const,startedAt:'2026-11-14T22:00:00Z'});
 await page.goto('/');
 await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),meal);
 await page.reload();
 const card=page.locator('.home-current');
 const primary=card.getByRole('button',{name:/Continue cooking/});
 const view=card.getByRole('button',{name:'View cook',exact:true});
 const cancel=card.getByRole('button',{name:'Cancel cook',exact:true});
 await expect(primary).toBeVisible();
 await expect(view).toBeVisible();
 await expect(cancel).toBeVisible();
 const first=await primary.boundingBox(),second=await view.boundingBox(),third=await cancel.boundingBox(),panel=await card.boundingBox();
 expect(first&&second&&third&&panel).toBeTruthy();
 expect(first!.width).toBeGreaterThan(panel!.width-90);
 expect(second!.y).toBeGreaterThanOrEqual(first!.y+first!.height-1);
 expect(Math.abs(second!.y-third!.y)).toBeLessThan(3);
 expect(second!.x+second!.width).toBeLessThanOrEqual(third!.x+1);
 expect(second!.height).toBeGreaterThanOrEqual(44);
 expect(third!.height).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await card.screenshot({path:info.outputPath('compact-current-cook-actions.png'),scale:'css'});
 await cancel.click();
 const dialog=page.getByRole('dialog',{name:'Cancel this cook?',exact:true});
 await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'Keep cooking',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 await expect(primary).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!))).toEqual(meal);
});
