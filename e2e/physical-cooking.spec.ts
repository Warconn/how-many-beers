import {test,expect,type Page} from '@playwright/test';
import {newMeal,createDish,type Dish} from '../src/domain/meal';
import {startCookSession,recordEvent,type ExtendedMeal} from '../src/domain/cookState';
import {parseRecipeText} from '../src/domain/recipe';
test.use({timezoneId:'UTC'});
const at=(t:string)=>`2026-11-08T${t}:00Z`;
function concurrent(recorded='16:00'){
 const brats: Dish={...createDish('side'),name:'Brats',id:'brats',cookMinutes:45,restMinutes:10};
 const potatoes: Dish={...createDish('side'),name:'Potatoes',id:'potatoes',cookMinutes:40,restMinutes:0};
 let m=startCookSession({...newMeal(),name:'Sunday dinner',serveAt:at('17:00'),dishes:[brats,potatoes]},at('15:45'));
 m.taskOverrides={...m.taskOverrides,'brats:check':{title:'Flip brats'}};
 m.phasePlan!.actions['brats:check'].checkpoint!.fraction=1/3;
 for(const d of m.dishes)for(const key of ['prep','preheat'])m=recordEvent(m,d.id+':'+key,'completed',at('15:46'));
 m=recordEvent(m,'brats:start','completed',at(recorded));m=recordEvent(m,'potatoes:start','completed',at('16:10'));return m;
}
async function open(page:Page,m:ExtendedMeal,time='16:20'){
 await page.clock.install({time:new Date(Date.parse(at(time))-1000)});await page.clock.pauseAt(new Date(at(time)));
 await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),m);await page.reload();await page.getByRole('button',{name:/Continue cooking/,exact:false}).first().click();
}
const meter=(page:Page)=>page.getByRole('region',{name:'Cook duration in beers'});
test('global next action, concurrent remaining work and quiet beers-first presentation',async({page},info)=>{
 await open(page,concurrent());const guide=page.getByRole('region',{name:'Current step',exact:true});
 await expect(meter(page)).toContainText('0.4');await expect(meter(page)).toContainText('0h 35m');await expect(page.getByLabel('Cook estimated finish',{exact:true})).toHaveAttribute('datetime',at('16:55').replace('Z','.000Z'));
 await expect(meter(page)).not.toContainText('Projected');await expect(meter(page)).not.toContainText('elapsed');
 await expect(guide).toContainText('Also cooking: Potatoes');await expect(guide.getByRole('button',{name:/start/i})).toHaveCount(0);
 await guide.getByRole('checkbox',{name:'Complete Flip brats',exact:true}).click({noWaitAfter:true});await expect(meter(page)).toContainText('0h 35m');
 await page.clock.fastForward(60000);await expect(meter(page)).toContainText('0h 34m');
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({style:'nextjs-portal{display:none}',path:info.outputPath('concurrent-cooking.png'),fullPage:true,scale:'css'});
 await page.reload();await page.getByRole('button',{name:/Continue cooking/}).first().click();await expect(meter(page)).toContainText('0h 34m');
 await page.clock.fastForward(37000);await expect(page.getByRole('region',{name:'Current step',exact:true}).locator('.task-dish')).not.toContainText(/\d+\.\d+ min/);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(saved.completed['brats:check']).toBe(at('16:20').replace('Z','.000Z'));expect(saved.events.find((e:any)=>e.phaseObservations?.some((o:any)=>o.phaseId==='brats:heat'&&o.boundary==='end'))).toBeUndefined();
});
test('overrun remains active; real removal/rest updates serving and inline target difference',async({page},info)=>{
 let m=concurrent();m=recordEvent(m,'brats:check','completed',at('16:15'));m=recordEvent(m,'potatoes:rest','completed',at('16:45'));
 await open(page,m,'16:46');await expect(meter(page)).toContainText('0.1+');await expect(meter(page)).toContainText('Earliest serving');await expect(page.getByLabel('Cook estimated finish',{exact:true})).toHaveAttribute('datetime',at('16:56').replace('Z','.000Z'));
 await page.clock.fastForward(9*60000);await page.getByRole('button',{name:'Full checklist',exact:true}).first().click();
 await page.getByRole('region',{name:'Full cook checklist'}).getByRole('checkbox',{name:'Complete Begin monitored rest/hold for Brats',exact:true}).click({noWaitAfter:true});
 await expect(meter(page)).toContainText('0h 10m');await expect(page.getByLabel('Cook estimated finish',{exact:true})).toHaveAttribute('datetime',at('17:05').replace('Z','.000Z'));await expect(meter(page)).toContainText('(+5 min)');
 const sameLine=await page.locator('.beerometer-serving-value').evaluate(el=>{const t=el.querySelector('time')!.getBoundingClientRect(),d=el.querySelector('small')!.getBoundingClientRect();return Math.abs(t.top-d.top)<10;});expect(sameLine).toBe(true);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({style:'nextjs-portal{display:none}',path:info.outputPath('rest-and-serving.png'),fullPage:true,scale:'css'});
});
test('optional actual-start correction updates linked checkpoints, not potato observations',async({page})=>{
 const m=concurrent('16:12');await open(page,m);await expect(meter(page)).toContainText('0h 47m');
 await page.getByRole('button',{name:'Full checklist',exact:true}).first().click();await page.getByRole('button',{name:'Open step: Start cooking for Brats',exact:true}).click();
 const step=page.getByRole('region',{name:'Current step',exact:true});await step.getByText('Step details',{exact:true}).click();await step.getByRole('button',{name:'Correct actual start time',exact:true}).click();
 await step.getByLabel('Actual start date and time',{exact:true}).fill('2026-11-08T16:00');await step.getByRole('button',{name:'Save actual start',exact:true}).click();await expect(meter(page)).toContainText('0h 35m');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(saved.events.slice(0,m.events!.length)).toEqual(JSON.parse(JSON.stringify(m.events)));expect(saved.events.filter((e:any)=>e.phaseObservations?.some((o:any)=>o.phaseId==='potatoes:heat')).map((e:any)=>e.occurredAt)).toEqual([at('16:10')]);expect(saved.serveAt).toBe(at('17:00'));
});
test('imported roast/cool uses one transition and reaches zero without Serve or auto-finish',async({page},info)=>{
 const d=parseRecipeText('Pumpkin seeds','Prepare seeds (5 minutes)\nRoast seeds (15 minutes)\nRemove seeds and leave to cool (10 minutes)');
 let m=startCookSession({...newMeal(),name:'Pumpkin seeds',serveAt:at('16:30'),dishes:[d]},at('15:55'));
 m=recordEvent(m,d.id+':step-1','completed',at('16:00'));m=recordEvent(m,d.id+':step-2','completed',at('16:00'));
 await open(page,m,'16:15');await expect(meter(page)).toContainText('Earliest serving');
 await page.getByRole('region',{name:'Current step',exact:true}).getByRole('checkbox',{name:/Complete Remove seeds/}).click({noWaitAfter:true});
 await expect(meter(page)).toContainText('0h 10m');await expect(page.getByRole('heading',{name:'Resting or cooling underway'})).toBeVisible();
 await expect(page.getByRole('checkbox',{name:/Complete Serve/})).toHaveCount(0);
 await page.clock.fastForward(10*60000);await expect(meter(page)).toContainText('0.0');await expect(page.getByRole('button',{name:'Finish cook',exact:true})).toBeVisible();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({style:'nextjs-portal{display:none}',path:info.outputPath('cooling-elapsed.png'),fullPage:true,scale:'css'});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(saved.mode).toBe('cooking');expect(saved.completed[d.id+':serve']).toBeUndefined();expect(saved.events.flatMap((e:any)=>e.phaseObservations??[]).filter((o:any)=>o.phaseId===d.id+':phase-step-3'&&o.boundary==='end')).toEqual([]);
});
test('starting a fresh template enables phases without changing a saved legacy cook',async({page})=>{
 const m={...newMeal(),name:'New brats',dishes:[createDish('brats')],serveAt:at('17:00')};
 await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),m);await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();await page.getByRole('button',{name:'Start cooking',exact:true}).click();
 await expect(meter(page)).toBeVisible();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(saved.phasePlan.version).toBe(1);expect(saved.events).toEqual([]);
});
test('a supported longer estimate updates serving with an inline positive difference',async({page},info)=>{
 const m=concurrent();m.phasePlan!.phases.find(p=>p.id==='brats:heat')!.upperMinutes=65;
 await open(page,m,'16:46');await expect(meter(page)).toContainText('0h 29m');await expect(meter(page)).toContainText('(+15 min)');await expect(meter(page)).not.toContainText('late');await expect(page.getByLabel('Cook estimated finish',{exact:true})).toHaveAttribute('datetime',at('17:15').replace('Z','.000Z'));
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('revised-serving.png'),fullPage:true,style:'nextjs-portal{display:none}'});
});
test('Sunday brisket keeps full cooking/rest work after rapid preparation and condition checks',async({page})=>{
 const d=createDish('brisket');let m=startCookSession({...newMeal(),name:'Sunday brisket',serveAt:at('18:00'),dishes:[d]},at('16:00'));
 for(const key of ['prep','season','preheat','start','raise225','spritz','check','wrap'])m=recordEvent(m,d.id+':'+key,'completed',at('16:01'));
 await open(page,m,'16:02');await expect(meter(page)).toContainText('15h 39m');
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(stored.events.flatMap((e:any)=>e.phaseObservations??[]).filter((o:any)=>o.boundary==='end')).toHaveLength(0);expect(stored.serveAt).toBe(at('18:00'));await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('optional remaining estimate can be canceled, saved and reloaded without extending itself',async({page})=>{
 let m=concurrent();m=recordEvent(m,'potatoes:rest','completed',at('16:45'));await open(page,m,'16:46');
 const step=page.getByRole('region',{name:'Current step',exact:true});await step.getByText('Step details',{exact:true}).click();
 const input=step.getByLabel('Remaining estimate (minutes, optional)',{exact:true});await input.fill('8');await expect(page.getByRole('button',{name:'Full checklist',exact:true})).toBeDisabled();
 await step.getByRole('button',{name:'Cancel estimate',exact:true}).click();await expect(page.getByRole('button',{name:'Full checklist',exact:true})).toBeEnabled();
 await input.fill('8');await step.getByRole('button',{name:'Update estimate',exact:true}).click();await expect(meter(page)).toContainText('0h 18m');await expect(page.getByLabel('Cook estimated finish',{exact:true})).toHaveAttribute('datetime',at('17:04').replace('Z','.000Z'));
 await page.reload();await page.getByRole('button',{name:/Continue cooking/}).first().click();await expect(meter(page)).toContainText('0h 18m');await page.clock.fastForward(8*60000);await expect(meter(page)).toContainText('Earliest serving');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(saved.events.filter((e:any)=>e.phaseEstimate)).toHaveLength(1);expect(saved.events.some((e:any)=>e.phaseObservations?.some((o:any)=>o.phaseId==='brats:heat'&&o.boundary==='end'))).toBe(false);
});
