import {test,expect} from '@playwright/test';
import {newMeal} from '../src/domain/meal';
import {parseRecipeText} from '../src/domain/recipe';
import {cookTimeline} from '../src/domain/cookState';

test('minimal step editor keeps timing together and preserves hidden metadata and actuals',async({page},info)=>{
 const dish=parseRecipeText('Sunday turkey','Brine turkey for 22 hours\nPrepare turkey for 45 minutes\nRest turkey for 90 minutes\nCarve turkey');
 const id=dish.id+':'+dish.steps![0].id,meal={...newMeal(),serveAt:'2026-11-22T15:00',dishes:[dish],taskOverrides:{[id]:{equipment:'Refrigerator',targetTempF:165}},events:[{id:'original-reading',taskId:id,kind:'temperature',value:40,unit:'°F',occurredAt:'2026-11-20T18:00:00.000Z'}]};
 await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),meal);await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Edit Sunday turkey',exact:true}).click();
 const row=page.getByRole('region',{name:'Sunday turkey steps'}).getByRole('article',{name:dish.steps![0].title,exact:true});await row.getByRole('button',{name:/^Edit /}).click();const form=row.getByRole('form',{name:'Edit step',exact:true});
 await expect(form.getByText(/^More options/)).toHaveCount(0);await expect(form.getByLabel('Equipment for this step')).toHaveCount(0);await expect(form.getByLabel('Target food temperature')).toHaveCount(0);await expect(form.getByText(/^(Plan timing|Fixed start|Auto|Pinned)$/)).toHaveCount(0);
 await expect(form.getByLabel('Estimated duration (hours)',{exact:true})).toHaveValue('22');await expect(form.getByRole('button',{name:'Use plan timing',exact:true})).toHaveCount(0);
 const start=form.getByLabel('Planned date and time',{exact:true}),duration=form.getByLabel('Estimated duration (hours)',{exact:true}),a=await start.boundingBox(),b=await duration.boundingBox();
 if(page.viewportSize()!.width>650){expect(Math.abs(a!.y-b!.y)).toBeLessThan(2);expect(a!.width).toBeGreaterThan(b!.width);}else expect(b!.y).toBeGreaterThan(a!.y);
 for(const button of await form.locator('.step-editor-actions button').all())expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 await form.screenshot({path:info.outputPath('minimal-step-editor.png'),scale:'css'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await form.getByLabel('Duration unit').selectOption('minutes');await expect(form.getByLabel('Estimated duration (minutes)',{exact:true})).toHaveValue('1320');await form.getByLabel('Duration unit').selectOption('hours');await duration.fill('23');await form.getByRole('button',{name:'Save',exact:true}).click();
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));let saved=await read();expect(saved.taskOverrides[id]).toMatchObject({equipment:'Refrigerator',targetTempF:165,durationMinutes:1380});expect(saved.taskOverrides[id].scheduledAt).toBeUndefined();expect(saved.events).toEqual(meal.events);expect(saved.serveAt).toBe(meal.serveAt);
 await row.getByRole('button',{name:/^Edit /}).click();await start.fill('2026-11-21T08:00');await form.getByRole('button',{name:'Save',exact:true}).click();saved=await read();expect(cookTimeline(saved).find(t=>t.id===id)?.timingMode).toBe('fixed');await row.getByRole('button',{name:/^Edit /}).click();await form.getByRole('button',{name:'Use plan timing',exact:true}).click();await form.getByRole('button',{name:'Save',exact:true}).click();expect((await read()).taskOverrides[id].scheduledAt).toBeUndefined();
 await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Edit Sunday turkey',exact:true}).click();await row.getByRole('button',{name:/^Edit /}).click();expect((await read()).taskOverrides[id]).toMatchObject({equipment:'Refrigerator',targetTempF:165,durationMinutes:1380});
});

test('duration units round-trip 22 hours, 45 and 90 minutes, fractional minutes and unknown without pinning',async({page})=>{
 const values=[1320,45,90,123.456789123,null],dish=parseRecipeText('Durations','First\nSecond\nThird\nFourth\nFifth');dish.steps!.forEach((step,i)=>step.minutes=values[i]);
 const meal={...newMeal(),serveAt:'2026-11-22T15:00',dishes:[dish]};
 await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),meal);await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Edit Durations',exact:true}).click();
 const region=page.getByRole('region',{name:'Durations steps',exact:true});
 for(let i=0;i<values.length;i++){
  const row=region.getByRole('article',{name:dish.steps![i].title,exact:true});await row.getByRole('button',{name:/^Edit /}).click();const form=row.getByRole('form',{name:'Edit step',exact:true});
  const initial=i===0?'hours':'minutes';await expect(form.getByLabel(`Estimated duration (${initial})`,{exact:true})).toHaveValue(values[i]===null?'':String(values[i]!/(initial==='hours'?60:1)));
  await form.getByLabel('Duration unit').selectOption('hours');await form.getByLabel('Duration unit').selectOption('minutes');await form.getByRole('button',{name:'Save',exact:true}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!)),id=dish.id+':'+dish.steps![i].id;
  expect(cookTimeline(saved).find(t=>t.id===id)?.durationMinutes).toBe(values[i]);expect(saved.taskOverrides[id].scheduledAt).toBeUndefined();expect(saved.taskOverrides[id].durationMinutes).toBeUndefined();
 }
});
