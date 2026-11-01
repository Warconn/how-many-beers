import {test,expect} from '@playwright/test';
test.use({timezoneId:'UTC'});
test('upload offers durations on each step and keeps Serve after recipe work',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:/Plan a new cook/}).click();
 await page.getByLabel('Serve date and time').fill('2026-11-26T00:05');
 await page.getByRole('button',{name:'Upload a recipe',exact:true}).click();
 await page.getByLabel('Upload .txt or .md',{exact:true}).setInputFiles({name:'Pumpkin seeds.txt',mimeType:'text/plain',buffer:Buffer.from('Preheat pellet smoker to 425 F (about 10 minutes). Set a rimmed baking sheet aside for the seeds.\nClean pumpkin seeds\nRoast seeds\nCool completely')});
 await page.getByRole('button',{name:'Preview recipe steps'}).click();await page.getByRole('button',{name:'Add to this cook'}).click();
 const steps=page.getByRole('region',{name:'Pumpkin seeds steps',exact:true}),rows=steps.getByRole('article');
 await expect(rows.first()).toHaveAccessibleName('Preheat pellet smoker to 425 F (about 10 minutes). Set a rimmed baking sheet aside for the seeds.');await expect(rows.last()).toHaveAccessibleName('Serve');
 await expect(page.getByRole('complementary',{name:'Live schedule'}).getByRole('listitem').first()).toContainText('Preheat pellet smoker to 425 F (about 10 minutes). Set a rimmed baking sheet aside for the seeds.');
 await expect(page.getByRole('region',{name:'Cook duration in beers'})).toContainText('Add missing estimated durations');
 const field=rows.first().getByRole('spinbutton',{name:'Estimated duration (minutes)',exact:true});const box=await field.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(96);expect(box!.height).toBeGreaterThanOrEqual(44);
 await rows.first().screenshot({path:info.outputPath('step-duration-unknown.png'),scale:'css'});await page.screenshot({path:info.outputPath('upload-unknown.png'),fullPage:true});
 for(const [name,minutes] of [['Preheat pellet smoker to 425 F (about 10 minutes). Set a rimmed baking sheet aside for the seeds.','10'],['Clean pumpkin seeds','5'],['Roast seeds','15'],['Cool completely','10']]){
  await steps.getByRole('article',{name,exact:true}).getByRole('spinbutton',{name:'Estimated duration (minutes)',exact:true}).fill(minutes);
  await expect(rows.first()).toHaveAccessibleName('Preheat pellet smoker to 425 F (about 10 minutes). Set a rimmed baking sheet aside for the seeds.');await expect(rows.last()).toHaveAccessibleName('Serve');
 }
 const clean=steps.getByRole('article',{name:'Clean pumpkin seeds',exact:true}),duration=clean.getByRole('spinbutton',{name:'Estimated duration (minutes)',exact:true});
 const meter=page.getByRole('region',{name:'Cook duration in beers'});
 await expect(meter.locator('strong')).toHaveText('0.4');await expect(clean.locator('time')).toHaveAttribute('datetime',/23:35/);
 await duration.fill('20');await expect(meter.locator('strong')).toHaveText('0.6');await expect(clean.locator('time')).toHaveAttribute('datetime',/23:20/);
 await duration.fill('5');await clean.getByRole('button',{name:'Edit',exact:true}).click();
 const editor=page.getByRole('form',{name:'Edit step',exact:true});await expect(editor.getByLabel('Estimated duration (minutes)',{exact:true})).toHaveValue('5');await editor.getByLabel('Estimated duration (minutes)',{exact:true}).fill('8');await editor.getByRole('button',{name:'Save',exact:true}).click();await expect(duration).toHaveValue('8');await duration.fill('5');
 await page.getByRole('button',{name:'Review checklist',exact:true}).click();
 const preview=page.getByRole('region',{name:'Cooking checklist preview',exact:true});await preview.getByRole('article',{name:'Clean pumpkin seeds',exact:true}).getByRole('button',{name:'Edit',exact:true}).click();await expect(duration).toBeDisabled();await page.getByRole('form',{name:'Edit step',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();await expect(duration).toBeEnabled();await expect(duration).toHaveValue('5');
 await page.getByText('Dish settings',{exact:true}).click();await expect(page.getByLabel('Minutes for Clean pumpkin seeds',{exact:true})).toHaveCount(0);await page.getByText('Dish settings',{exact:true}).click();
 await rows.first().screenshot({path:info.outputPath('step-duration-timed.png'),scale:'css'});await page.screenshot({path:info.outputPath('upload-timed.png'),fullPage:true});
 await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Edit Pumpkin seeds',exact:true}).click();await expect(duration).toHaveValue('5');await expect(rows.last()).toHaveAccessibleName('Serve');
 await steps.getByRole('article',{name:'Cool completely',exact:true}).getByRole('spinbutton',{name:'Estimated duration (minutes)',exact:true}).fill('');await expect(meter.locator('strong')).toHaveText('—');await expect(rows.first()).toHaveAccessibleName('Preheat pellet smoker to 425 F (about 10 minutes). Set a rimmed baking sheet aside for the seeds.');await expect(rows.last()).toHaveAccessibleName('Serve');
 await page.getByRole('button',{name:'Start cooking',exact:true}).click();
 await expect(page.locator('.guided-step').getByRole('article')).toHaveAccessibleName('Preheat pellet smoker to 425 F (about 10 minutes). Set a rimmed baking sheet aside for the seeds.');
 await expect(page.getByRole('button',{name:'Preview next step: Clean pumpkin seeds'})).toBeVisible();
});
