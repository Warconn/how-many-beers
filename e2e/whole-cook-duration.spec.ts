import {test,expect} from '@playwright/test';
import {createDish,newMeal} from '../src/domain/meal';
test('whole-cook brining, live progress and frozen history readings',async({page},info)=>{
 const b=createDish('brisket'),t={...createDish('turkey'),turkeyPrep:{state:'frozen' as const,thawDays:5,brineHours:22,dryHours:8}};
 const meal={...newMeal(),serveAt:'2026-11-25T18:00Z',dishes:[b,t]};
 await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),meal);await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();
 const meter=page.getByRole('region',{name:'Cook duration in beers'});await expect(meter).toContainText('23.7');await expect(meter).toContainText('Planned cook');await expect(meter).not.toContainText('90 min');
 await page.screenshot({path:info.outputPath('whole-cook-planning.png')});
 await page.clock.install({time:new Date('2026-11-25T10:00Z')});await page.getByRole('button',{name:'Start cooking',exact:true}).click();await expect(meter).toContainText('Projected cook');await expect(meter).toContainText('0h 00m elapsed');
 await page.clock.fastForward(60000);await expect(meter).toContainText('0h 01m elapsed');await page.getByRole('region',{name:'Current step',exact:true}).getByRole('checkbox').click();await expect(meter).toContainText('0h 01m elapsed');
 await page.screenshot({path:info.outputPath('whole-cook-active.png')});
 await page.getByRole('button',{name:'Finish cook',exact:true}).first().click();await page.getByRole('button',{name:'Save finished cook',exact:true}).click();await page.getByRole('button',{name:/Past cooks and backups/}).click();await page.getByRole('button',{name:'View cook',exact:true}).click();
 const saved=page.getByRole('region',{name:'Saved cook details'}).getByRole('region',{name:'Cook duration in beers'});await expect(saved).toContainText('Actual cook');await expect(saved).toContainText('0h 01m');await page.clock.fastForward(60000);await expect(saved).toContainText('0h 01m');
 await page.screenshot({path:info.outputPath('whole-cook-history.png')});
});
