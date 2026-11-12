import {test,expect} from '@playwright/test';
import {createDish,newMeal} from '../src/domain/meal';
test.use({timezoneId:'America/New_York'});

test('planning wings oil duration reflows earlier while keeping the serving target',async({page})=>{
  await page.clock.install({time:new Date('2026-11-12T05:00:00Z')});
  const dish=createDish('wings');
  const m={...newMeal(),serveAt:'2026-11-14T13:00',dishes:[dish]};
  await page.goto('/');
  await page.evaluate(meal=>{
    localStorage.clear();
    localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(meal));
  },m);
  await page.reload();
  await page.getByRole('button',{name:/Resume planning/}).click();
  await page.getByRole('button',{name:'Edit Smo-fried wings',exact:true}).click();
  const region=page.getByRole('region',{name:'Smo-fried wings steps',exact:true});
  const dry=region.getByRole('article',{name:'Optional: air-dry wings ahead of time',exact:true});
  const first=Date.parse((await dry.locator('time[datetime]').first().getAttribute('datetime'))!);
  const oil=region.getByRole('article',{name:'Prepare fryer and heat oil',exact:true});
  await oil.getByRole('button',{name:/^Edit(?: |$)/}).click();
  const form=page.getByRole('form',{name:'Edit step',exact:true});
  await form.getByText(/^More options/).click();
  await form.getByLabel('Estimated duration (minutes)',{exact:true}).fill('45');
  await form.getByRole('button',{name:'Save',exact:true}).click();
  const earlier=Date.parse((await dry.locator('time[datetime]').first().getAttribute('datetime'))!);
  expect(earlier).toBeLessThan(first);
  await expect(page.getByLabel('Serve date and time')).toHaveValue('2026-11-14T13:00');
  await expect(page.getByRole('region',{name:'Plan notes'})).not.toContainText(/plan runs .* after the serving target/i);
  await expect(page.getByRole('region',{name:'Serving plan'})).not.toContainText('Estimated meal ready');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
  expect(saved.taskOverrides[dish.id+':oil'].durationMinutes).toBe(45);
});
