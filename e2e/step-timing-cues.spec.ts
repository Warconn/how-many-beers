import {test,expect,type Page} from '@playwright/test';
import {newMeal,createDish,type Dish} from '../src/domain/meal';
import {startCookSession,recordEvent,cookTimeline,type ExtendedMeal} from '../src/domain/cookState';
test.use({timezoneId:'America/New_York'});
const now='2026-11-08T03:00:00Z';
function seed(extra:Dish[]=[]){
 const dish={...createDish('brisket'),id:'brisket',cookMinutes:480,restMinutes:180};
 let meal:ExtendedMeal={...newMeal(),name:'Sunday brisket',serveAt:'2026-11-08T18:00:00Z',dishes:[dish,...extra],taskOverrides:{'brisket:start':{scheduledAt:'2026-11-08T04:30:00Z'}}};
 meal=startCookSession(meal,now);
 for(const task of cookTimeline(meal).filter(t=>t.templateStage?.kind==='preparation'))meal=recordEvent(meal,task.id,'completed',now);
 return meal;
}
async function open(page:Page,m:ExtendedMeal,time=now){
 await page.clock.install({time:new Date(time)});await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),m);await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();
}
test('collapsed current card shows planned load before duration and matches the checklist',async({page},info)=>{
 const m=seed();await open(page,m);const current=page.getByRole('region',{name:'Current step',exact:true});
 await expect(current.getByLabel('Planned start',{exact:true})).toBeVisible();
 await expect(current.getByLabel('Planned start',{exact:true})).toHaveAttribute('datetime','2026-11-08T04:30:00Z');
 expect((await current.getByLabel('Planned start',{exact:true}).boundingBox())!.y).toBeLessThan((await current.getByText('Estimated 8 hr',{exact:true}).boundingBox())!.y);
 await current.screenshot({path:info.outputPath('planned-collapsed.png'),scale:'css'});
 await page.getByRole('button',{name:'Full checklist',exact:true}).click();
 const load=page.getByRole('button',{name:'Open step: Put brisket on smoker for Smoked brisket',exact:true});
 await expect(load.getByLabel('Planned start',{exact:true})).toHaveAttribute('datetime','2026-11-08T04:30:00Z');
 expect((await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!))).events).toEqual(m.events);
});
test('actual load anchors approximate cues across current and Up next; elapsed checkpoints remain unchecked',async({page},info)=>{
 let m=seed();m=recordEvent(m,'brisket:start','completed','2026-11-08T04:34:00Z');
 await open(page,m,'2026-11-08T04:35:00Z');
 const current=page.getByRole('region',{name:'Current step',exact:true}),bar=page.getByRole('navigation',{name:'Cooking guide'});
 await expect(current.getByLabel('Check around',{exact:true})).toBeVisible();
 await expect(current).toContainText('bark');
 await expect(bar.getByLabel('Check around',{exact:true})).toBeVisible();
 const originalCheck=await current.getByLabel('Check around',{exact:true}).getAttribute('datetime');
 await current.getByText('Step details',{exact:true}).click();
 await current.getByRole('button',{name:'Correct actual start time',exact:true}).click();
 await current.getByLabel('Actual start date and time',{exact:true}).fill('2026-11-07T23:24');
 await current.getByRole('button',{name:'Save actual start',exact:true}).click();
 await expect(current.getByLabel('Check around',{exact:true})).toHaveAttribute('datetime',new Date(Date.parse(originalCheck!)-10*60000).toISOString());
 await current.getByText('Step details',{exact:true}).click();
 const listTime=await bar.getByLabel('Check around',{exact:true}).getAttribute('datetime');
 await current.screenshot({path:info.outputPath('approximate-check.png'),scale:'css'});
 await bar.screenshot({path:info.outputPath('up-next-check.png'),scale:'css'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.getByRole('button',{name:'Full checklist',exact:true}).click();
 const next=page.getByRole('button',{name:/Open step: Inspect and spritz if needed/});
 await expect(next.getByLabel('Check around',{exact:true})).toHaveAttribute('datetime',listTime!);
 await page.getByRole('button',{name:'Back to step',exact:true}).click();
 await page.clock.fastForward(3*3600000);
 await expect(current).toContainText('Review now');await expect(current.getByRole('checkbox')).not.toBeChecked();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
 expect(saved.events.slice(0,m.events!.length)).toEqual(m.events);expect(saved.events.some((e:{kind:string;occurredAt:string})=>e.kind==='started'&&e.occurredAt==='2026-11-08T04:24:00.000Z')).toBe(true);expect(saved.serveAt).toBe(m.serveAt);
 await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(current).toContainText('Review now');
});


test('editing only the planned load updates the collapsed cue without changing duration or actual events',async({page})=>{
 const m=seed();await open(page,m);const current=page.getByRole('region',{name:'Current step',exact:true});
 await current.getByText('Step details',{exact:true}).click();await current.getByRole('button',{name:'Edit',exact:true}).click();
 const form=current.getByRole('form',{name:'Edit step',exact:true});await form.getByText(/^More options/).click();
 await form.getByLabel('Planned date and time',{exact:true}).fill('2026-11-07T23:45');
 await form.getByRole('button',{name:'Save',exact:true}).click();
 await expect(current.getByLabel('Planned start',{exact:true})).toHaveAttribute('datetime','2026-11-08T04:45:00.000Z');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));
 expect(saved.events).toEqual(m.events);expect(saved.taskOverrides['brisket:start'].durationMinutes).toBeUndefined();expect(saved.dishes).toEqual(m.dishes);expect(saved.serveAt).toBe(m.serveAt);
});


test('brats in an overlapping cook share the actual-anchored checkpoint cue',async({page})=>{
 const brats={...createDish('brats'),id:'brats'};let m=seed([brats]);
 m=recordEvent(m,'brats:start','completed','2026-11-08T04:20:00Z');m=recordEvent(m,'brisket:start','completed','2026-11-08T04:34:00Z');
 await open(page,m,'2026-11-08T04:35:00Z');await page.getByRole('button',{name:'Full checklist',exact:true}).click();
 const check=page.getByRole('button',{name:'Open step: Check brats and bubbling tray for Grilled beer-bath brats',exact:true});
 const at=await check.getByLabel('Check around',{exact:true}).getAttribute('datetime');await check.click();
 const current=page.getByRole('region',{name:'Current step',exact:true});
 await expect(current.getByLabel('Check around',{exact:true})).toHaveAttribute('datetime',at!);await expect(current).toContainText('Also cooking: Smoked brisket');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(saved.events).toEqual(m.events);
});
test('a condition-only step has an observable cue without an invented clock',async({page})=>{
 const m:ExtendedMeal={...newMeal(),mode:'cooking',startedAt:now,customTasks:[{id:'bark',dishId:'custom',dishName:'General prep',title:'Review bark',instructions:'When bark is set, continue.',isCondition:true,scheduledAt:null}]};
 await open(page,m);const current=page.getByRole('region',{name:'Current step',exact:true});await expect(current).toContainText('When bark is set, continue.');await expect(current.locator('time:visible')).toHaveCount(0);await expect(current.getByRole('checkbox')).not.toBeChecked();
});
