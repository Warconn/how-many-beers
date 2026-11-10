import {test,expect} from '@playwright/test';
test.use({timezoneId:'UTC'});
const source='# Smoky BBQ Pumpkin Seeds\n## Ingredients\n1 cup pumpkin seeds\n2 tsp olive oil\n## Instructions\n1. Preheat pellet smoker to 425 F (about 10 minutes).\n2. Clean pumpkin seeds (5 minutes).\n3. Dry pumpkin seeds (10 minutes).\n4. Mix seasoning (2 minutes).\n5. Coat seeds (2 minutes).\n6. Roast on pellet smoker (10 to 15 minutes). Stir halfway through.\n7. Cool uncovered (10 minutes).';
test('upload review extracts timings without duration re-entry',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:/Plan a cook/}).click();await page.getByRole('button',{name:'Add your own recipe',exact:true}).click();
 await page.getByLabel('Upload .txt or .md',{exact:true}).setInputFiles({name:'Smoky BBQ Pumpkin Seeds.txt',mimeType:'text/plain',buffer:Buffer.from(source)});await page.getByRole('button',{name:'Preview recipe steps'}).click();
 const review=page.getByRole('region',{name:'Review your method',exact:true});await expect(review.getByRole('heading')).toBeFocused();await expect(review.getByRole('listitem')).toHaveCount(8);
 const roast=review.getByRole('listitem').filter({hasText:'Roast on pellet smoker'});await expect(roast).toContainText('15 min');await roast.getByRole('button',{name:/^Edit /}).click();await expect(review.getByLabel('Minutes',{exact:true})).toHaveValue('15');await review.getByRole('button',{name:'Cancel edit',exact:true}).click();
 await page.screenshot({path:info.outputPath('recipe-preview.png'),fullPage:true,scale:'css'});await review.getByRole('button',{name:'Add to meal',exact:true}).click();await page.getByLabel('Serve date and time').fill('2026-11-26T00:05');await page.getByRole('button',{name:'Edit Smoky BBQ Pumpkin Seeds',exact:true}).click();
 const steps=page.getByRole('region',{name:'Smoky BBQ Pumpkin Seeds steps',exact:true});await expect(steps.getByRole('article')).toHaveCount(8);await expect(steps.getByRole('article').last()).toHaveAccessibleName('Serve');await expect(page.getByRole('region',{name:'Cook duration in beers'}).locator('strong')).toHaveText('0.6');await expect(steps.getByRole('article').first()).toContainText('Estimated 10 min');
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(stored.dishes[0].steps.map((s:{minutes:number})=>s.minutes)).toEqual([10,5,10,2,2,15,10]);
 await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await expect(page.getByRole('region',{name:'Cook duration in beers'}).locator('strong')).toHaveText('0.6');
});
test('review permits corrections and unknown times before adding',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Plan a cook/}).click();await page.getByRole('button',{name:'Add your own recipe',exact:true}).click();await page.getByLabel('Recipe title').fill('Seeds');await page.getByLabel('Recipe instructions').fill('Roast seeds for 10–15 minutes.\nCool completely.');await page.getByRole('button',{name:'Preview recipe steps'}).click();
 const review=page.getByRole('region',{name:'Review your method',exact:true});await expect(review).toContainText('Time unknown');
 for(const [name,minutes] of [['Roast seeds for 10–15 minutes.','12'],['Cool completely.','8']]){await review.getByRole('button',{name:'Edit '+name,exact:true}).click();const input=review.getByLabel('Minutes',{exact:true});await expect(input).toHaveValue(minutes==='12'?'15':'');await input.fill(minutes);await review.getByRole('button',{name:'Save step',exact:true}).click();}
 await review.getByRole('button',{name:'Add to meal',exact:true}).click();await expect(page.getByRole('region',{name:'Cook duration in beers'})).toContainText('0h 20m');
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(Object.values(stored.taskOverrides).map((s:any)=>s.durationMinutes)).toEqual([12,8]);
});
