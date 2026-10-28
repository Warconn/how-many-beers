import {test,expect} from '@playwright/test';
import {createDish,newMeal} from '../src/domain/meal';
import {cookTimeline} from '../src/domain/cookState';
test('Beerometer is prominent and stays visible while planning and cooking',async({page},info)=>{
 const dish=createDish('brisket'),meal={...newMeal(),serveAt:'2026-11-25T15:00',dishes:[dish]};
 await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),meal);await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();
 const meter=page.getByRole('region',{name:'Cook duration in beers',exact:true});await expect(meter).toBeVisible();await expect(meter).toBeInViewport();await expect(meter).toContainText('8.7');await expect(meter).toContainText('90 min');
 await page.getByRole('button',{name:'Edit Smoked brisket',exact:true}).click();await page.getByText('Dish settings',{exact:true}).click();await page.getByLabel('Estimated cook (hours)',{exact:true}).fill('9');await page.getByLabel('Estimated cook (hours)',{exact:true}).press('Tab');await expect(meter).toContainText('6.0');await page.getByRole('region',{name:'Smoked brisket steps',exact:true}).getByRole('article').last().scrollIntoViewIfNeeded();await expect(meter).toBeInViewport();
 await page.screenshot({path:info.outputPath('beerometer-planning.png'),fullPage:false,style:'nextjs-portal{display:none}'});await page.getByRole('button',{name:'Start cooking',exact:true}).click();await expect(meter).toBeVisible();await expect(meter).toBeInViewport();
 const step=page.getByRole('region',{name:'Current step',exact:true});await step.getByRole('checkbox').click();await expect(meter).toBeInViewport();await expect(page.getByRole('navigation',{name:'Cooking guide',exact:true})).toBeInViewport();
 for(const width of [375,768,1280]){await page.setViewportSize({width,height:844});await step.scrollIntoViewIfNeeded();await expect(meter).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
 await page.setViewportSize({width:393,height:851});await page.screenshot({path:info.outputPath('beerometer-cooking.png'),fullPage:false,style:'nextjs-portal{display:none}'});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(cookTimeline(saved).map(t=>t.id)).toEqual(cookTimeline(meal).map(t=>t.id));expect(Object.keys(saved.completed)).toHaveLength(1);
});
test('empty or untimed plans never display a made-up beer count',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Plan a new cook/}).click();const meter=page.getByRole('region',{name:'Cook duration in beers'});await expect(meter).toBeVisible();await expect(meter).toContainText('Add a dish');await expect(meter.locator('strong')).toHaveText('—');await page.getByRole('button',{name:'Add smoked brisket',exact:true}).click();await page.getByLabel('Serve date and time',{exact:true}).fill('');await expect(meter.locator('strong')).toHaveText('—');
});
