import {test,expect} from '@playwright/test';
test.use({timezoneId:'UTC'});
test('uploaded recipe duration edits update timeline and Beerometer through reload',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:/Plan a new cook/}).click();await page.getByLabel('Serve date and time').fill('2026-11-26T00:05');await page.getByRole('button',{name:'Upload a recipe',exact:true}).click();
 await page.getByLabel('Upload .txt or .md',{exact:true}).setInputFiles({name:'Pumpkin seeds.txt',mimeType:'text/plain',buffer:Buffer.from('Clean seeds\nRoast seeds\nCool completely')});await page.getByRole('button',{name:'Preview recipe steps'}).click();await page.getByRole('button',{name:'Add to this cook'}).click();
 const steps=page.getByRole('region',{name:'Pumpkin seeds steps',exact:true});
 const edit=async(title:string,minutes:string)=>{const row=steps.getByRole('article',{name:title,exact:true});await row.getByRole('button',{name:'Edit',exact:true}).click();const form=page.getByRole('form',{name:'Edit step',exact:true});await form.getByLabel('Estimated duration (minutes)',{exact:true}).fill(minutes);await form.getByRole('button',{name:'Save & Close',exact:true}).click();return row;};
 const clean=await edit('Clean seeds','5');await expect(clean).not.toContainText('Timing needed:');await expect(clean).not.toContainText('Verify actual conditions');await expect(clean.getByRole('spinbutton',{name:'Estimated duration (minutes)',exact:true})).toHaveValue('5');
 await expect(steps.getByRole('article',{name:'Cool completely',exact:true}).getByRole('spinbutton',{name:'Estimated duration (minutes)',exact:true})).toHaveValue('');
 await edit('Roast seeds','15');await edit('Cool completely','10');const meter=page.getByRole('region',{name:'Cook duration in beers'});await expect(meter.locator('strong')).toHaveText('0.3');await expect(clean.locator('time')).toHaveAttribute('datetime',/23:35/);
 await edit('Clean seeds','10');await expect(meter.locator('strong')).toHaveText('0.4');await expect(clean.locator('time')).toHaveAttribute('datetime',/23:30/);await page.screenshot({path:info.outputPath('imported-timing.png'),fullPage:true});
 await edit('Clean seeds','5');await expect(meter.locator('strong')).toHaveText('0.3');
 await clean.getByRole('spinbutton',{name:'Estimated duration (minutes)',exact:true}).fill('8');await expect(clean.locator('time')).toHaveAttribute('datetime',/23:32/);await clean.getByRole('spinbutton',{name:'Estimated duration (minutes)',exact:true}).fill('5');await expect(meter.locator('strong')).toHaveText('0.3');
 await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Edit Pumpkin seeds',exact:true}).click();await expect(meter.locator('strong')).toHaveText('0.3');
 await page.getByLabel('Serve date and time').fill('');await expect(meter.locator('strong')).toHaveText('—');await expect(meter).toContainText('Set serving time or a fixed start');

});
