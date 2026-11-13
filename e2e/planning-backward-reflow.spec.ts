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

test('early fixed drying allows flexible preparation to meet 1 PM after reload',async({page},info)=>{
  // Early fixed preparation must not freeze the entire flexible remainder.
  // Forty-minute preparation is a synthetic explicit constraint; the owner's
  // exact persisted durations are not available in this investigation.
  await page.clock.install({time:new Date('2026-11-12T05:00:00Z')});
  const dish=createDish('wings');
  await page.goto('/');await page.evaluate(meal=>{
    localStorage.clear();localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(meal));
  },{...newMeal(),serveAt:'2026-11-14T13:00',dishes:[dish]});
  await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();
  await page.getByRole('button',{name:'Edit Smo-fried wings',exact:true}).click();
  const region=page.getByRole('region',{name:'Smo-fried wings steps',exact:true});
  const dry=region.getByRole('article',{name:'Optional: air-dry wings ahead of time',exact:true});
  await dry.getByRole('button',{name:/^Change planned time:/}).click();
  const timeForm=dry.getByRole('form',{name:'Edit planned time',exact:true});
  await timeForm.getByLabel('Planned date and time',{exact:true}).fill('2026-11-13T07:00');
  await timeForm.getByRole('button',{name:'Save',exact:true}).click();
  const prep=region.getByRole('article',{name:'Season and set out cooking equipment',exact:true});
  await prep.getByRole('button',{name:/^Edit(?: |$)/}).click();
  const form=page.getByRole('form',{name:'Edit step',exact:true});
  await form.getByText(/^More options/).click();
  await form.getByLabel('Estimated duration (minutes)',{exact:true}).fill('40');
  await form.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('region',{name:'Plan notes'})).not.toContainText('10 min past');
  await expect(page.getByRole('region',{name:'Serving plan'})).not.toContainText('Estimated meal ready');
  await expect(region.getByRole('article',{name:'Serve wings',exact:true}).locator('time').first()).toHaveAttribute('datetime','2026-11-14T18:00:00.000Z');
  await page.screenshot({path:info.outputPath('early-fixed-wings-on-time.png'),fullPage:false,style:'nextjs-portal{display:none}'});
  await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();
  await expect(page.getByRole('region',{name:'Serving plan'})).not.toContainText('Estimated meal ready');
  await page.getByRole('button',{name:'Edit Smo-fried wings',exact:true}).click();
  await expect(region.getByRole('article',{name:'Serve wings',exact:true}).locator('time').first()).toHaveAttribute('datetime','2026-11-14T18:00:00.000Z');
  await expect(page.getByLabel('Serve date and time')).toHaveValue('2026-11-14T13:00');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
  expect(saved.taskOverrides[dish.id+':dry'].scheduledAt).toBe('2026-11-13T12:00:00.000Z');
  expect(saved.events??[]).toEqual([]);expect(saved.completed).toEqual({});
});
