import {test,expect,type Page} from '@playwright/test';
import {newMeal,createDish} from '../src/domain/meal';
import {cookTimeline,recordEvent,type ExtendedMeal} from '../src/domain/cookState';
import {parseRecipeText} from '../src/domain/recipe';
import {physicalStartedEvent} from '../src/domain/physicalPhase';
import {cookProjection} from '../src/domain/cookProjection';
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
 await expect(guide.getByRole('button',{name:/^Edit(?: |$)/})).not.toBeVisible();await expect(guide.getByLabel('Quick notes',{exact:true})).not.toBeVisible();await expect(bar).toContainText('Check when ready');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(saved.events.filter((e:{kind:string;taskId:string})=>e.kind==='started'&&e.taskId===m.dishes[0].id+':start')).toHaveLength(0);
 await guide.getByRole('article').evaluate(el=>window.scrollBy(0,el.getBoundingClientRect().top-210));await page.screenshot({path:info.outputPath('simple-brisket.png'),scale:'css',style:'nextjs-portal{display:none}'});
 await guide.getByText('Step details',{exact:true}).click();await expect(guide.getByText(/The 2021 cook wrapped/)).toBeVisible();await expect(guide.getByLabel('Planned start',{exact:true})).toBeVisible();await guide.locator('.cooking-step-details').screenshot({path:info.outputPath('step-details.png'),scale:'css'});await guide.getByText('Step details',{exact:true}).click();
 await page.clock.fastForward(14*3600000);await expect(guide.getByRole('checkbox')).not.toBeChecked();await expect(guide.getByText('Check when ready',{exact:true})).toBeVisible();
});
test('record physical smoker and rest starts once; notes and readings do not start phases',async({page},info)=>{
 let m=brisket();for(const t of cookTimeline(m).slice(0,3))m=recordEvent(m,t.id,'completed',now);await load(page,m);const guide=page.getByRole('region',{name:'Current step',exact:true});
 await expect(guide.getByRole('button',{name:'+ Log temperature',exact:true})).not.toBeVisible();await guide.getByText('Step details',{exact:true}).click();await guide.getByRole('button',{name:'+ Log temperature',exact:true}).click();await guide.getByLabel('Food temperature',{exact:true}).fill('50');await guide.getByRole('button',{name:'Save timestamped reading',exact:true}).click();await guide.getByRole('button',{name:'Notes',exact:true}).click();await guide.getByLabel('Quick notes',{exact:true}).fill('Smoker is ready');
 const beforeStart=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(beforeStart.events.filter((e:{kind:string;taskId:string})=>e.kind==='started'&&e.taskId===m.dishes[0].id+':start')).toHaveLength(0);
 await expect(guide.getByRole('button',{name:'Record actual start',exact:true})).toBeVisible();await guide.getByRole('button',{name:'Record actual start',exact:true}).click();await guide.getByRole('button',{name:'Save actual start',exact:true}).click();await page.clock.fastForward(60000);await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-30T10:04:00.000Z');await expect(guide.getByRole('button',{name:'Record actual start',exact:true})).toHaveCount(0);
 await guide.getByRole('article').evaluate(el=>window.scrollBy(0,el.getBoundingClientRect().top-210));await page.screenshot({path:info.outputPath('simple-cook-phase.png'),scale:'css',style:'nextjs-portal{display:none}'});
 await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-30T10:04:00.000Z');
 // Checking off the start action is not the end of a 13-hour physical phase.
 await guide.getByRole('checkbox').click();await expect(page.getByRole('region',{name:'Cook duration in beers'})).toContainText('15h 39m');
 await page.getByRole('button',{name:'Full checklist',exact:true}).click();const list=page.getByRole('region',{name:'Full cook checklist'});
 for(const key of ['raise225','spritz','check','wrap','raise250','finish'])await list.getByRole('checkbox',{name:'Complete '+cookTimeline(m).find(t=>t.id===m.dishes[0].id+':'+key)!.title+' for Smoked brisket',exact:true}).check();
 await list.getByRole('button',{name:'Open step: Begin safe, monitored rest or hold for Smoked brisket',exact:true}).click();const restStart=guide.getByRole('button',{name:'Record actual start',exact:true});if(!await restStart.isVisible())await guide.getByText('Step details',{exact:true}).click();await restStart.click();await guide.getByRole('button',{name:'Save actual start',exact:true}).click();await page.clock.fastForward(60000);await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-29T23:45:00.000Z');
 await expect(guide.locator('.task-top').getByText(/140°F/)).toBeVisible();await guide.getByRole('article').evaluate(el=>window.scrollBy(0,el.getBoundingClientRect().top-210));await page.screenshot({path:info.outputPath('simple-rest.png'),scale:'css',style:'nextjs-portal{display:none}'});
});
test('pumpkin roast and cooling show concise actions and one finish estimate with details preserved',async({page},info)=>{
 const dish=parseRecipeText('Pumpkin seeds','Prep (5 minutes)\nRoast on pellet smoker at 425 F (15 minutes). Stir halfway through. Pull when lightly golden; check early to avoid burning.\nCool uncovered (10 minutes). Remove from smoker and let cool completely on the pan.');let m:ExtendedMeal={...newMeal(),name:'Pumpkin seeds',mode:'cooking',startedAt:now,serveAt:'2026-10-29T22:00Z',dishes:[dish]};m=recordEvent(m,dish.id+':step-1','completed',now);await load(page,m);const guide=page.getByRole('region',{name:'Current step',exact:true}),bar=page.getByRole('navigation',{name:'Cooking guide'});
 await expect(guide.locator('strong').first()).toHaveText('Roast on pellet smoker at 425 F');await expect(guide.getByText('Estimated 15 min',{exact:true})).toBeVisible();await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-29T21:19:00.000Z');await expect(bar.getByLabel('Estimated start',{exact:true})).toHaveAttribute('datetime','2026-10-29T21:19:00.000Z');
 {const roast=guide.getByRole('button',{name:'Record actual start',exact:true});if(!await roast.isVisible())await guide.getByText('Step details',{exact:true}).click();await roast.click();await guide.getByRole('button',{name:'Save actual start',exact:true}).click();}await page.clock.fastForward(60000);await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-29T21:19:00.000Z');await guide.getByText('Step details',{exact:true}).click();await expect(guide.getByText(/Planned start/)).not.toBeVisible();await guide.getByRole('article').evaluate(el=>window.scrollBy(0,el.getBoundingClientRect().top-210));await page.screenshot({path:info.outputPath('simple-pumpkin.png'),scale:'css',style:'nextjs-portal{display:none}'});
 await guide.getByText('Step details',{exact:true}).click();await expect(guide.getByText(/Stir halfway through/)).toHaveCount(1);await expect(guide.getByText(/Stir halfway through/)).toBeVisible();await guide.getByText('Step details',{exact:true}).click();await guide.getByRole('checkbox').click();await expect(guide.getByLabel('Estimated finish',{exact:true})).toHaveAttribute('datetime','2026-10-29T21:15:00.000Z');const cooling=guide.getByRole('button',{name:'Record actual start',exact:true});if(!await cooling.isVisible())await guide.getByText('Step details',{exact:true}).click();await expect(cooling).toBeVisible();
});

test('brat cook stays checkbox-first with opt-in actual start and append-only corrections',async({page})=>{
 const dish=createDish('brats'),taskId=dish.id+':start';
 let meal:ExtendedMeal={...newMeal(),name:'Brat tray',mode:'cooking',startedAt:now,serveAt:'2026-10-29T23:30Z',dishes:[dish]};
 for(const key of ['prep','preheat'])meal=recordEvent(meal,dish.id+':'+key,'completed',now);
 await load(page,meal);
 const guide=page.getByRole('region',{name:'Current step',exact:true});
 const current=guide.getByRole('article',{name:'Cover and cook the brat tray',exact:true});
 await expect(current).toBeVisible();
 await expect(current.getByRole('button',{name:'Record actual start',exact:true})).not.toBeVisible();
 await expect(current.getByRole('button',{name:'+ Log temperature',exact:true})).not.toBeVisible();
 await current.getByRole('checkbox',{name:'Complete Cover and cook the brat tray',exact:true}).click();
 const checked=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!) as ExtendedMeal);
 expect(checked.completed[taskId]).toBeTruthy();
 expect(physicalStartedEvent(checked.events??[],taskId)).toBeUndefined();
 const projected=cookProjection(checked,cookTimeline(checked),Date.parse(now));
 expect(projected.remaining===null||projected.remaining>0).toBe(true);
 await expect(guide.getByRole('article',{name:'Check brats and bubbling tray',exact:true})).toBeVisible();
 await expect(guide.getByRole('button',{name:'+ Log temperature',exact:true})).not.toBeVisible();
 await page.getByRole('button',{name:'Full checklist',exact:true}).click();
 await page.getByRole('region',{name:'Full cook checklist'}).getByRole('button',{name:'Open step: Cover and cook the brat tray for Grilled beer-bath brats',exact:true}).click();
 await guide.getByText('Step details',{exact:true}).click();
 await guide.getByRole('button',{name:'Record actual start',exact:true}).click();await guide.getByRole('button',{name:'Save actual start',exact:true}).click();
 const correct=guide.getByRole('button',{name:'Correct actual start time',exact:true});
 await correct.click();
 await guide.getByLabel('Actual start date and time',{exact:true}).fill('2026-10-29T21:05');
 await guide.getByRole('button',{name:'Save actual start',exact:true}).click();
 await expect(guide.getByRole('alert')).toContainText('not in the future');
 expect((await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!) as ExtendedMeal)).events?.filter(e=>e.taskId===taskId&&e.kind==='started')).toHaveLength(1);
 await guide.getByLabel('Actual start date and time',{exact:true}).fill('2026-10-29T21:02');
 await guide.getByRole('button',{name:'Save actual start',exact:true}).click();
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!) as ExtendedMeal);
 const physical=(after.events??[]).filter(e=>e.taskId===taskId&&e.kind==='started'&&e.startSource==='physical');
 expect(physical).toHaveLength(2);
 expect(physicalStartedEvent(after.events??[],taskId)?.occurredAt).toBe('2026-10-29T21:02:00.000Z');
 expect(after.completed[taskId]).toEqual(checked.completed[taskId]);
 await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!) as ExtendedMeal);
 expect(physicalStartedEvent(restored.events??[],taskId)?.occurredAt).toBe('2026-10-29T21:02:00.000Z');
});

test('step tools are opt-in, flat and preserve drafts while details close',async({page},info)=>{
 let m=brisket();for(const t of cookTimeline(m).slice(0,3))m=recordEvent(m,t.id,'completed',now);
 await load(page,m);const guide=page.getByRole('region',{name:'Current step',exact:true});
 await guide.getByText('Step details',{exact:true}).click();
 await guide.screenshot({path:info.outputPath('details-before-tools.png'),scale:'css'});
 await expect(guide.getByLabel('Remaining estimate (minutes, optional)',{exact:true})).not.toBeVisible();
 await expect(guide.getByLabel('Quick notes',{exact:true})).not.toBeVisible();
 await expect(guide.getByRole('button',{name:'Update estimate',exact:true})).not.toBeVisible();
 await expect(guide.locator('details details')).toHaveCount(0);
 await guide.getByRole('button',{name:'Record actual start',exact:true}).click();
 await guide.getByLabel('Actual start date and time',{exact:true}).fill('2026-10-29T21:02');
 await guide.getByText('Step details',{exact:true}).click();
 await guide.getByText('Step details',{exact:true}).click();
 await expect(guide.getByLabel('Actual start date and time',{exact:true})).toHaveValue('2026-10-29T21:02');
 await guide.getByRole('button',{name:'Cancel start time edit',exact:true}).click();
 await guide.getByRole('button',{name:'+ Log temperature',exact:true}).click();
 await guide.getByLabel('Food temperature',{exact:true}).fill('165');
 await guide.getByText('Step details',{exact:true}).click();
 await guide.getByText('Step details',{exact:true}).click();
 await expect(guide.getByLabel('Food temperature',{exact:true})).toHaveValue('165');
 await guide.getByRole('button',{name:'Save timestamped reading',exact:true}).click();
 await guide.getByRole('button',{name:'Notes',exact:true}).click();await guide.getByLabel('Quick notes',{exact:true}).fill('Bark ready');
 await guide.getByRole('button',{name:/^Activity \(/}).click();
 await expect(guide.getByText(/Food temp.*165/)).toBeVisible();
 await guide.screenshot({path:info.outputPath('details-history.png'),scale:'css'});
 await guide.locator('.task-activity').screenshot({path:info.outputPath('activity.png'),scale:'css'});
});

test('an active brisket hold still finishes through the existing flow',async({page},info)=>{
 let m=brisket();const tasks=cookTimeline(m),rest=tasks.find(t=>t.id.endsWith(':rest'))!;
 for(const task of tasks){if(task.id===rest.id)break;m=recordEvent(m,task.id,'completed',now);}
 m=recordEvent(m,rest.id,'started',now);
 await load(page,m);const guide=page.getByRole('region',{name:'Current step',exact:true});
 await expect(guide.getByRole('article')).toHaveAccessibleName(rest.title);
 await expect(guide.getByRole('checkbox')).not.toBeChecked();
 await guide.screenshot({path:info.outputPath('hold-current.png'),scale:'css'});
 await page.getByText('Cook details & tools',{exact:true}).click();
 await page.getByRole('button',{name:'Finish cook early',exact:true}).click();
 const finish=page.getByRole('region',{name:'Finish cook',exact:true});
 await finish.getByRole('button',{name:'Keep cooking',exact:true}).click();
 await expect(guide.getByRole('article')).toHaveAccessibleName(rest.title);
 await page.getByRole('button',{name:'Finish cook early',exact:true}).click();
 await finish.getByRole('button',{name:'Save finished cook',exact:true}).click();
 const archived=await page.evaluate(()=>localStorage.getItem('how-many-beers:history:v1'));
 expect(archived).toContain('Sunday brisket');
});
