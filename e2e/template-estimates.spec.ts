import {test,expect} from '@playwright/test';
import {newMeal,createDish} from '../src/domain/meal';
import {cookTimeline,recordEvent,type ExtendedMeal} from '../src/domain/cookState';
test.use({timezoneId:'UTC'});
const now='2026-10-30T21:00:00Z';
for(const preset of ['brisket','brats','turkey','wings','ribs','chicken','side'] as const){
 test(preset+' template exposes preparation and physical cooking estimates',async({page},info)=>{
  const dish=createDish(preset);let m:ExtendedMeal={...newMeal(),name:preset+' test',mode:'cooking',startedAt:now,serveAt:'2026-11-01T18:00Z',dishes:[dish]};
  if(preset==='turkey')dish.turkeyPrep={state:'thawed',thawDays:0,brineHours:0,dryHours:0};
  const tasks=cookTimeline(m);if(preset==='turkey')for(const key of ['thaw','brine','dry'])m=recordEvent(m,dish.id+':'+key,'completed',now);
  if(preset==='wings')m=recordEvent(m,dish.id+':dry','completed',now);
  await page.clock.install({time:new Date(Date.parse(now)-1000)});await page.clock.pauseAt(new Date(now));await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),m);await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();
  const guide=page.getByRole('region',{name:'Current step',exact:true}),bar=page.getByRole('navigation',{name:'Cooking guide'});
  await expect(guide.locator('.cooking-step-timing')).toContainText('Estimated ');await expect(guide.getByLabel('Estimated finish',{exact:true})).toBeVisible();
  await bar.getByRole('button',{name:'Full checklist',exact:true}).click();const list=page.getByRole('region',{name:'Full cook checklist'});if(preset==='brats')for(const key of ['prep','preheat'])await list.getByRole('checkbox',{name:'Complete '+tasks.find(t=>t.id===dish.id+':'+key)!.title+' for '+dish.name,exact:true}).check();await list.getByRole('button',{name:'Open step: '+tasks.find(t=>t.id===dish.id+':start')!.title+' for '+dish.name,exact:true}).click();
  await expect(guide.locator('.cooking-step-timing')).toContainText('Estimated ');await expect(guide.getByLabel('Estimated finish',{exact:true})).toBeVisible();
  if(preset==='brats'){
   await expect(guide.locator('.cooking-step-timing')).toContainText('Estimated 2 hr');await guide.getByRole('button',{name:'Begin cooking now',exact:true}).click();await guide.getByRole('checkbox').click();await page.clock.fastForward(119*60000);
   await bar.getByRole('button',{name:'Full checklist',exact:true}).click();await list.getByRole('checkbox',{name:'Complete Check brats and bubbling tray for '+dish.name,exact:true}).check();await list.getByRole('button',{name:'Open step: Drain and sear on the Blackstone for '+dish.name,exact:true}).click();
   await expect(guide.locator('.cooking-step-timing')).toContainText('Estimated 15 min');await guide.getByRole('button',{name:'Begin searing',exact:true}).click();await page.clock.fastForward(60000);await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-30T23:14:00.000Z');
   await guide.getByRole('article').evaluate(el=>window.scrollBy(0,el.getBoundingClientRect().top-210));await page.screenshot({path:info.outputPath('brats-searing.png'),scale:'css',style:'nextjs-portal{display:none}'});
   const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(stored.dishes).toEqual(m.dishes);expect(stored.serveAt).toBe(m.serveAt);
   await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await page.getByRole('button',{name:'Full checklist',exact:true}).click();await list.getByRole('button',{name:'Open step: Drain and sear on the Blackstone for '+dish.name,exact:true}).click();await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-30T23:14:00.000Z');
  }
 });
}
