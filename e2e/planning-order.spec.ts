import {test,expect} from '@playwright/test';
import {createDish,newMeal} from '../src/domain/meal';
import {parseRecipeText} from '../src/domain/recipe';
import {cookTimeline} from '../src/domain/cookState';
test.use({timezoneId:'UTC'});
for(const kind of ['brats','recipe'] as const)test(kind+' planning move updates times and survives reload and cooking',async({page},info)=>{
 const dish=kind==='brats'?createDish('brats'):parseRecipeText('Soup','Chop for 5 minutes\nMix for 10 minutes\nSimmer for 15 minutes');
 const meal={...newMeal(),serveAt:'2026-11-08T18:00',dishes:[dish,parseRecipeText('Salad','Toss for 1 minute')]};
 await page.goto('/');await page.evaluate(m=>{localStorage.clear();localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m));},meal);await page.reload();
 await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:`Edit ${dish.name}`,exact:true}).click();
 const region=page.getByRole('region',{name:dish.name+' steps'}),rows=region.getByRole('article');
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
 const second=cookTimeline(before).filter(t=>t.dishId===dish.id)[1];
 await rows.nth(1).getByRole('button',{name:'Move '+second.title+' up',exact:true}).click();
 await expect(rows.first()).toHaveAttribute('aria-label',second.title);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
 const tasks=cookTimeline(saved).filter(t=>t.dishId===dish.id);
 expect(Date.parse(tasks[0].scheduledAt!)).toBeLessThan(Date.parse(tasks[1].scheduledAt!));expect(tasks[0].scheduledAt).not.toBe(second.scheduledAt);
 expect(saved.dishes[1]).toEqual(meal.dishes[1]);
 await rows.first().evaluate(el=>window.scrollBy(0,el.getBoundingClientRect().top-230));await page.screenshot({path:info.outputPath('reordered-plan.png'),scale:'css',style:'nextjs-portal{display:none}'});
 await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:`Edit ${dish.name}`,exact:true}).click();await expect(rows.first()).toHaveAttribute('aria-label',second.title);
 await page.getByRole('button',{name:'Start cooking',exact:true}).click();await expect(page.getByRole('region',{name:'Current step',exact:true})).toContainText(second.title);
});
test('cooking steps can move before other preparation and their timing follows the chosen order',async({page})=>{
 const dish=createDish('brats'),meal={...newMeal(),dishes:[dish]};await page.goto('/');await page.evaluate(m=>{localStorage.clear();localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m));},meal);await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:`Edit ${dish.name}`,exact:true}).click();
 const region=page.getByRole('region',{name:dish.name+' steps'});await region.getByRole('button',{name:'Move Cover and cook the brat tray up',exact:true}).click();await expect(region.getByRole('article').nth(1)).toHaveAttribute('aria-label','Cover and cook the brat tray');await expect(page.getByText(/Only preparation steps/)).toHaveCount(0);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!)),tasks=cookTimeline(saved).filter(t=>t.dishId===dish.id);expect(Date.parse(tasks[2].scheduledAt!)-Date.parse(tasks[1].scheduledAt!)).toBe(120*60000);
});
