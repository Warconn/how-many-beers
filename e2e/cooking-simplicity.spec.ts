import {test,expect,type Page} from '@playwright/test';
import {newMeal,createDish} from '../src/domain/meal';
import {cookTimeline,recordEvent,type ExtendedMeal} from '../src/domain/cookState';
import {parseRecipeText} from '../src/domain/recipe';
test.use({timezoneId:'UTC'});
const now='2026-10-29T21:04:00Z';
async function load(page:Page,m:ExtendedMeal){
 await page.clock.install({time:new Date(Date.parse(now)-1000)});await page.clock.pauseAt(new Date(now));await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),m);await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();
}
const brisket=():ExtendedMeal=>({...newMeal(),name:'Sunday brisket',mode:'cooking',startedAt:now,serveAt:'2026-11-01T18:00Z',dishes:[createDish('brisket')]});
test('rapid Sunday brisket check-offs leave a calm condition check and preserve physical cooking time',async({page},info)=>{
 const m=brisket();await load(page,m);const guide=page.getByRole('region',{name:'Current step',exact:true}),bar=page.getByRole('navigation',{name:'Cooking guide'});
 for(const t of cookTimeline(m).slice(0,7))await guide.getByRole('checkbox',{name:'Complete '+t.title,exact:true}).click();
 await expect(guide.getByRole('article')).toHaveAccessibleName('Decide whether to wrap');await expect(guide.getByText('Check when ready',{exact:true})).toBeVisible();
 await expect(guide.getByLabel('Estimated checkpoint',{exact:true})).not.toBeVisible();await expect(guide.getByText(/Planned start/)).not.toBeVisible();await expect(guide.getByText('Verify actual conditions',{exact:true})).not.toBeVisible();
 await expect(guide.getByRole('button',{name:'Edit',exact:true})).not.toBeVisible();await expect(guide.getByLabel('Quick notes',{exact:true})).not.toBeVisible();await expect(bar).toContainText('Check when ready');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(saved.events.filter((e:{kind:string;taskId:string})=>e.kind==='started'&&e.taskId===m.dishes[0].id+':start')).toHaveLength(0);
 await guide.getByRole('article').evaluate(el=>window.scrollBy(0,el.getBoundingClientRect().top-210));await page.screenshot({path:info.outputPath('simple-brisket.png'),scale:'css',style:'nextjs-portal{display:none}'});
 await guide.getByText('Step details',{exact:true}).click();await expect(guide.getByText(/The 2021 cook wrapped/)).toBeVisible();await expect(guide.getByLabel('Planned start',{exact:true})).toBeVisible();await guide.locator('.cooking-step-details').screenshot({path:info.outputPath('step-details.png'),scale:'css'});await guide.getByText('Step details',{exact:true}).click();
 await page.clock.fastForward(14*3600000);await expect(guide.getByRole('checkbox')).not.toBeChecked();await expect(guide.getByText('Check when ready',{exact:true})).toBeVisible();
});
test('record physical smoker and rest starts once; notes and readings do not start phases',async({page},info)=>{
 let m=brisket();for(const t of cookTimeline(m).slice(0,3))m=recordEvent(m,t.id,'completed',now);await load(page,m);const guide=page.getByRole('region',{name:'Current step',exact:true});
 await guide.getByRole('button',{name:'+ Log temperature',exact:true}).click();await guide.getByLabel('Food temperature',{exact:true}).fill('50');await guide.getByRole('button',{name:'Save timestamped reading',exact:true}).click();await guide.getByLabel('Quick notes',{exact:true}).fill('Smoker is ready');
 const beforeStart=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(beforeStart.events.filter((e:{kind:string;taskId:string})=>e.kind==='started'&&e.taskId===m.dishes[0].id+':start')).toHaveLength(0);await guide.getByText('Step details',{exact:true}).click();
 await expect(guide.getByRole('button',{name:'On smoker now',exact:true})).toBeVisible();await guide.getByRole('button',{name:'On smoker now',exact:true}).click();await page.clock.fastForward(60000);await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-30T10:04:00.000Z');await expect(guide.getByRole('button',{name:'On smoker now',exact:true})).toHaveCount(0);
 await guide.getByRole('article').evaluate(el=>window.scrollBy(0,el.getBoundingClientRect().top-210));await page.screenshot({path:info.outputPath('simple-cook-phase.png'),scale:'css',style:'nextjs-portal{display:none}'});
 await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-30T10:04:00.000Z');
 // Checking off the start action is not the end of a 13-hour physical phase.
 await guide.getByRole('checkbox').click();await expect(page.getByRole('region',{name:'Cook duration in beers'})).toContainText('15h 39m');
 await page.getByRole('button',{name:'Full checklist',exact:true}).click();const list=page.getByRole('region',{name:'Full cook checklist'});
 for(const key of ['raise225','spritz','check','wrap','raise250','finish'])await list.getByRole('checkbox',{name:'Complete '+cookTimeline(m).find(t=>t.id===m.dishes[0].id+':'+key)!.title+' for Smoked brisket',exact:true}).check();
 await list.getByRole('button',{name:'Open step: Begin safe, monitored rest or hold for Smoked brisket',exact:true}).click();await expect(guide.getByRole('button',{name:'Begin rest now',exact:true})).toBeVisible();await guide.getByRole('button',{name:'Begin rest now',exact:true}).click();await page.clock.fastForward(60000);await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-29T23:45:00.000Z');
 await expect(guide.locator('.task-top').getByText(/140°F/)).toBeVisible();await guide.getByRole('article').evaluate(el=>window.scrollBy(0,el.getBoundingClientRect().top-210));await page.screenshot({path:info.outputPath('simple-rest.png'),scale:'css',style:'nextjs-portal{display:none}'});
});
test('pumpkin roast and cooling show concise actions and one finish estimate with details preserved',async({page},info)=>{
 const dish=parseRecipeText('Pumpkin seeds','Prep (5 minutes)\nRoast on pellet smoker at 425 F (15 minutes). Stir halfway through. Pull when lightly golden; check early to avoid burning.\nCool uncovered (10 minutes). Remove from smoker and let cool completely on the pan.');let m:ExtendedMeal={...newMeal(),name:'Pumpkin seeds',mode:'cooking',startedAt:now,serveAt:'2026-10-29T22:00Z',dishes:[dish]};m=recordEvent(m,dish.id+':step-1','completed',now);await load(page,m);const guide=page.getByRole('region',{name:'Current step',exact:true}),bar=page.getByRole('navigation',{name:'Cooking guide'});
 await expect(guide.locator('strong').first()).toHaveText('Roast on pellet smoker at 425 F');await expect(guide.getByText('Estimated 15 min',{exact:true})).toBeVisible();await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-29T21:19:00.000Z');await expect(bar.getByLabel('Estimated start',{exact:true})).toHaveAttribute('datetime','2026-10-29T21:19:00.000Z');
 await guide.getByRole('button',{name:'Begin roasting',exact:true}).click();await page.clock.fastForward(60000);await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-29T21:19:00.000Z');await expect(guide.getByText(/Planned start/)).not.toBeVisible();await guide.getByRole('article').evaluate(el=>window.scrollBy(0,el.getBoundingClientRect().top-210));await page.screenshot({path:info.outputPath('simple-pumpkin.png'),scale:'css',style:'nextjs-portal{display:none}'});
 await guide.getByText('Step details',{exact:true}).click();await expect(guide.locator('.cooking-step-details').getByText(/Stir halfway through/).last()).toBeVisible();await guide.getByText('Step details',{exact:true}).click();await guide.getByRole('checkbox').click();await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-29T21:15:00.000Z');await expect(guide.getByRole('button',{name:'Begin cooling',exact:true})).toBeVisible();
});
