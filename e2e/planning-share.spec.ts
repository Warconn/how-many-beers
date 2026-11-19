import {test,expect} from '@playwright/test';

test('planner shows a natural full checklist, reachable Add to meal, and a read-only share snapshot',async({page})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'share',{configurable:true,value:async(data:unknown)=>{(window as typeof window & {__sharedPlan?:unknown}).__sharedPlan=data;}});
 });
 await page.goto('/');
 await page.getByRole('button',{name:/Plan a cook/}).click();
 await page.getByLabel('Serve date and time',{exact:true}).fill('2026-11-22T18:00');
 await page.getByRole('button',{name:'Choose a template',exact:true}).click();
 await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();
 const review=page.getByRole('region',{name:'Review your method',exact:true});
 const primary=review.getByRole('button',{name:'Add to meal',exact:true});
 const [primaryBox,stepsBox]=await Promise.all([primary.boundingBox(),review.locator('.method-review-steps').boundingBox()]);
 expect(primaryBox).not.toBeNull();expect(stepsBox).not.toBeNull();
 expect(primaryBox!.y+primaryBox!.height).toBeLessThanOrEqual(stepsBox!.y);
 await primary.click();
 const preview=page.getByRole('region',{name:'Meal plan preview'});
 await expect(preview).toBeVisible();
 await expect(page.getByRole('button',{name:'Review Meal Plan',exact:true})).toHaveCount(0);
 expect(await preview.locator('.preview-task-list').evaluate(el=>getComputedStyle(el).overflowY)).toBe('visible');
 const before=await page.evaluate(()=>localStorage.getItem('how-many-beers:meal:v1'));
 const share=page.getByRole('button',{name:'Share plan',exact:true});
 await expect(share).toBeVisible();
 await share.click();
 const payload=await page.evaluate(()=>(window as typeof window & {__sharedPlan?:{text:string}}).__sharedPlan);
 expect(payload?.text).toContain('🍺 ~');
 expect(payload?.text).toContain('Grilled beer-bath brats');
 expect(payload?.text).toContain('Dinner:');
 expect(payload?.text).toContain('🕒 Game plan');
 expect(await page.evaluate(()=>localStorage.getItem('how-many-beers:meal:v1'))).toBe(before);
 await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();
 await expect(page.getByRole('region',{name:'Meal plan preview'})).toBeVisible();
});
