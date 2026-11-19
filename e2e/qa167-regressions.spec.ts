import {test,expect,type Page} from '@playwright/test';
test.use({timezoneId:'America/New_York'});
test.setTimeout(90000);
const time='2026-11-18T22:04:00.000Z';
async function fresh(page:Page){await page.clock.install({time:new Date(Date.parse(time)-1000)});await page.clock.pauseAt(new Date(time));await page.goto('/');await page.getByRole('button',{name:/Plan a cook/}).click();await page.getByLabel('Serve date and time').fill('2026-11-19T18:00');await page.getByRole('button',{name:'Choose a template',exact:true}).click();}
async function add(page:Page,name:string){await page.getByRole('button',{name,exact:true}).click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();}
async function current(page:Page,title:string){await page.getByRole('button',{name:'Full checklist',exact:true}).click();await page.getByRole('button',{name:`Open step: ${title} for Smo-fried wings`,exact:true}).click();return page.getByRole('region',{name:'Current step',exact:true});}
async function recordStart(page:Page,title:string){const row=await current(page,title);await row.getByText('Step details',{exact:true}).click();await row.getByRole('button',{name:'Record actual start',exact:true}).click();await row.getByRole('button',{name:'Save actual start',exact:true}).click();}
async function complete(page:Page,title:string){const row=await current(page,title);await row.getByRole('checkbox',{name:'Complete '+title,exact:true}).click();}
for(const thawed of [false,true])test(`fresh templates retain readiness on start, fully thawed=${thawed}`,async({page},info)=>{
 await fresh(page);await add(page,'Add smoked brisket');await page.getByRole('button',{name:'+ Add a dish',exact:true}).click();await add(page,'Add turkey (oven)');
 if(thawed){await page.getByRole('button',{name:'Edit Turkey (oven)',exact:true}).click();await page.getByText('Dish settings',{exact:true}).click();await page.getByLabel('Turkey thawing status',{exact:true}).selectOption('thawed');}
 const expected=thawed?'2026-11-20T03:49:00.000Z':'2026-11-26T03:49:00.000Z';
 await expect(page.getByLabel('Estimated meal ready',{exact:true})).toHaveAttribute('datetime',expected);
 const schedule=page.getByRole('complementary',{name:'Live schedule'});await page.getByRole('button',{name:'Show full schedule',exact:true}).click();
 const dates=await schedule.locator('time').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('datetime')));expect(dates.map(d=>Date.parse(d!))).toEqual(dates.map(d=>Date.parse(d!)).sort((a,b)=>a-b));
 await expect(schedule.locator('time').first()).toContainText('Nov');
 const beers=page.getByRole('region',{name:'Cook duration in beers'});const before=await beers.locator('.beerometer-figure strong').textContent();
 await page.screenshot({path:info.outputPath(`planning-${thawed?'thawed':'frozen'}.png`),scale:'css',style:'nextjs-portal{display:none}'});
 await page.getByRole('button',{name:'Start cooking',exact:true}).click();await expect(page.getByLabel('Cook estimated finish',{exact:true})).toHaveAttribute('datetime',expected);
 await page.screenshot({path:info.outputPath(`cooking-${thawed?'thawed':'frozen'}.png`),scale:'css',style:'nextjs-portal{display:none}'});
 await expect(beers.locator('.beerometer-figure strong')).toHaveText(before!);
 await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(page.getByLabel('Cook estimated finish',{exact:true})).toHaveAttribute('datetime',expected);
});
test('actual-start tools retire ended activities, checked conditions stay calm, and corrections agree after reload',async({page},info)=>{
 await fresh(page);await add(page,'Add smo-fried wings');await page.getByRole('button',{name:'Start cooking',exact:true}).click();
 // Only the activity start tools are used for smoking, oil and frying.
 await recordStart(page,'Start smoking wings');await recordStart(page,'Prepare fryer and heat oil');await complete(page,'Verify oil is ready');
 const bar=page.getByRole('navigation',{name:'Cooking guide'});await expect(bar).not.toContainText('Prepare fryer and heat oil');
 await complete(page,'Confirm wings are cooked through');await complete(page,'Remove wings from smoker');await recordStart(page,'Flash-fry wings for crisp skin');await complete(page,'Drain and season or sauce');
 await expect(bar).not.toContainText('Start smoking wings');await expect(bar).not.toContainText('Prepare fryer and heat oil');await expect(bar).not.toContainText('Flash-fry wings');
 const checked=await current(page,'Confirm wings are cooked through');await expect(checked).toContainText('Completed check');await expect(checked).not.toContainText('Review now');
 const smoke=await current(page,'Start smoking wings');await expect(smoke.getByRole('checkbox')).toBeChecked();await expect(smoke.getByRole('checkbox')).toBeDisabled();
 await smoke.getByText('Step details',{exact:true}).click();await smoke.getByRole('button',{name:'Correct actual start time',exact:true}).click();await smoke.getByLabel('Actual start date and time',{exact:true}).fill('2026-11-18T16:04');await smoke.getByRole('button',{name:'Save actual start',exact:true}).click();
 await smoke.getByText('Step details',{exact:true}).click();await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:info.outputPath('ended-smoking.png'),scale:'css',style:'nextjs-portal{display:none}'});
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(stored.events.filter((e:{kind:string})=>e.kind==='started')).toHaveLength(4);
 await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(bar).not.toContainText('Start smoking wings');
 const resumed=await current(page,'Start smoking wings');await expect(resumed.getByLabel('Actual start',{exact:true})).toHaveAttribute('datetime','2026-11-18T21:04:00.000Z');
 await page.getByRole('button',{name:'Edit plan',exact:true}).click();
 await expect(page.getByRole('region',{name:'Meal plan preview'}).getByRole('article',{name:'Start smoking wings',exact:true})).toContainText(/Started Nov 18.*4:04 PM/);
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(after.events).toEqual(stored.events);
});
test('opening Cooking early preserves a future preparation window',async({page})=>{
 await fresh(page);await add(page,'Add grilled beer-bath brats');
 await page.getByRole('button',{name:'Start cooking',exact:true}).click();
 await expect(page.getByLabel('Cook estimated finish',{exact:true})).toHaveAttribute('datetime','2026-11-19T23:00:00.000Z');
 const step=page.getByRole('region',{name:'Current step',exact:true});
 await expect(step.getByLabel('Estimated start',{exact:true})).toHaveAttribute('datetime','2026-11-19T20:15:00.000Z');
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!));expect(stored.startedAt).toBe(time);expect(stored.events??[]).toEqual([]);
});
