import {test,expect} from '@playwright/test';
test('empty planner invites template or upload, preserves serving time and adds dishes',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:/Plan a new cook/}).click();
 await expect(page.getByRole('heading',{name:'What do you want to cook?'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Cook duration in beers'})).toHaveCount(0);await expect(page.getByRole('complementary',{name:'Live schedule'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Start cooking',exact:true})).toHaveCount(0);
 await page.getByLabel('Serve date and time').fill('2026-12-25T18:00');
 await expect(page.getByRole('region',{name:'Add dish',exact:true})).toHaveCount(0);
 await page.screenshot({path:info.outputPath('empty-planner.png'),fullPage:true});
 await page.getByRole('button',{name:'Upload a recipe',exact:true}).click();
 await page.getByLabel('Upload .txt or .md', {exact:true}).setInputFiles({name:'recipe.pdf',mimeType:'application/pdf',buffer:Buffer.from('bad')});await expect(page.getByRole('status').filter({hasText:'accepts .txt'})).toBeVisible();
 await page.getByRole('button',{name:'Cancel adding',exact:true}).click();await expect(page.getByLabel('Serve date and time')).toHaveValue('2026-12-25T18:00');
 await page.getByRole('button',{name:'Start with a template',exact:true}).click();await page.getByRole('button',{name:'Add smoked brisket',exact:true}).click();await expect(page.getByRole('heading',{name:'1 dish in this cook'})).toBeVisible();
 await page.getByRole('button',{name:'+ Add a dish',exact:true}).click();await page.getByRole('button',{name:'Import a recipe',exact:true}).click();await page.getByLabel('Recipe title').fill('Beans');await page.getByLabel('Recipe instructions').fill('Simmer 30 minutes');await page.getByRole('button',{name:'Preview recipe steps'}).click();await page.getByRole('button',{name:'Add to this cook'}).click();await expect(page.getByRole('heading',{name:'2 dishes in this cook'})).toBeVisible();
 await page.screenshot({path:info.outputPath('first-and-second-dish.png'),fullPage:false});
});
