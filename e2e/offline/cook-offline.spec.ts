import {test,expect,type Page} from '@playwright/test';
import {createDish,newMeal} from '../../src/domain/meal';
import {migrateMeal,cookTimeline,recordEvent} from '../../src/domain/cookState';
import {ACTIVE_KEY,HISTORY_KEY} from '../../src/domain/cookHistory';

test.use({timezoneId:'America/New_York'});
async function ready(page:Page){
 await expect.poll(()=>page.evaluate(async()=>{
  const worker=navigator.serviceWorker.controller;if(!worker)return false;
  return new Promise<boolean>(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=e=>{channel.port1.close();resolve(e.data?.ready===true);};worker.postMessage({type:'CHECK_OFFLINE'},[channel.port2]);});
 })).toBe(true);
}

test.beforeEach(async({request})=>{await request.post('/__test__/worker-mode?mode=original');});

test('installed shell resumes an overnight cook offline, including notes, readings and archive',async({page,context},info)=>{
 await page.clock.install({time:new Date('2026-11-01T00:30:00-04:00')});
 await page.goto('/');await ready(page);
 const original=migrateMeal({...newMeal(),name:'Overnight cook',serveAt:'2026-11-01T15:00',mode:'cooking',startedAt:'2026-10-31T20:00:00Z',dishes:[createDish('brisket'),createDish('brats')]});
 const id=cookTimeline(original)[0].id;
 const active=recordEvent(original,id,'temperature','2026-10-31T23:00:00Z',165,'°F');active.notes[id]='Bark set';
 await page.evaluate(({active,key})=>localStorage.setItem(key,JSON.stringify(active)),{active,key:ACTIVE_KEY});await page.reload();await ready(page);
 await context.setOffline(true);await page.clock.fastForward(8*60*60*1000);await page.reload();
 await page.getByRole('button',{name:/Continue cooking/}).click();
 await page.getByRole('region',{name:'Current step',exact:true}).getByRole('checkbox').click();
 const current=page.getByRole('region',{name:'Current step',exact:true});
 await current.getByRole('button',{name:'+ Log temperature',exact:true}).click();await current.getByLabel('Food temperature',{exact:true}).fill('173');await current.getByRole('button',{name:'Save timestamped reading',exact:true}).click();
 await current.getByLabel('Quick notes',{exact:true}).fill('Keep heat steady');
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),ACTIVE_KEY);
 expect(saved.startedAt).toBe(active.startedAt);expect(saved.notes[id]).toBe('Bark set');expect(saved.events).toEqual(expect.arrayContaining(active.events!));
 expect(saved.events.some((event:{kind:string;value?:number})=>event.kind==='temperature'&&event.value===173)).toBe(true);expect(Object.values(saved.notes)).toContain('Keep heat steady');
 expect(Object.keys(saved.completed)).toHaveLength(1);
 await page.screenshot({path:info.outputPath('offline-cooking.png'),fullPage:true,style:'nextjs-portal{display:none}'});
 const url=page.url(),now=await page.evaluate(()=>Date.now());const reopened=await context.newPage();await reopened.clock.install({time:new Date(now)});await page.close();await reopened.goto(url);
 await reopened.getByRole('button',{name:/Continue cooking/}).click();expect(await reopened.evaluate(k=>JSON.parse(localStorage.getItem(k)!),ACTIVE_KEY)).toEqual(saved);
 await reopened.getByRole('navigation',{name:'Cook navigation'}).getByRole('button',{name:'Finish cook',exact:true}).click();
 await reopened.getByRole('button',{name:'Save finished cook',exact:true}).click();
 expect((await reopened.evaluate(k=>JSON.parse(localStorage.getItem(k)!),HISTORY_KEY)).cooks[0].meal).toEqual(saved);
 await context.setOffline(false);await reopened.reload();await ready(reopened);
});

test('manifest and icons describe a standalone app with the correct scope',async({page,request},info)=>{
 await page.goto('/');await ready(page);
 const response=await request.get('/manifest.webmanifest');expect(response.ok()).toBe(true);
 const manifest=await response.json();expect(manifest.start_url).toBe('/');expect(manifest.scope).toBe('/');expect(manifest.display).toBe('standalone');
 for(const icon of manifest.icons){expect((await request.get(icon.src)).ok()).toBe(true);}
 await expect(page.getByRole('button',{name:/Plan a new cook/})).toBeInViewport();
 await page.screenshot({path:info.outputPath('offline-home.png'),fullPage:true});
 await expect(page.getByText('Install and offline help',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Install app',exact:true})).toHaveCount(0);
});

test('failed worker update leaves the saved cook and previous offline shell usable',async({page,request,context})=>{
 await page.goto('/');await ready(page);await page.getByRole('button',{name:/Plan a new cook/}).click();
  await page.getByRole('button',{name:'Start with a template',exact:true}).click();await page.getByRole('button',{name:'Add smoked brisket',exact:true}).click();
 const before=await page.evaluate(k=>localStorage.getItem(k),ACTIVE_KEY);
 await request.post('/__test__/worker-mode?mode=fail');
 await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg!.update();});
 await expect.poll(()=>page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();return !reg?.installing;})).toBe(true);
 expect(await page.evaluate(k=>localStorage.getItem(k),ACTIVE_KEY)).toBe(before);
 await context.setOffline(true);await page.reload();await page.getByRole('button',{name:/Resume planning/}).click();
 expect(await page.evaluate(k=>localStorage.getItem(k),ACTIVE_KEY)).toBe(before);
});

test('ready updates never reload a cook automatically and protect open forms',async({page,request})=>{
 await page.goto('/');await ready(page);await page.getByRole('button',{name:/Plan a new cook/}).click();
  await page.getByRole('button',{name:'Start with a template',exact:true}).click();await page.getByRole('button',{name:'Add smoked brisket',exact:true}).click();
 // Close the Add Dish surface and open a real step draft.
 const cancel=page.getByRole('button',{name:'Cancel adding',exact:true});if(await cancel.count())await cancel.click();
 await page.getByRole('complementary',{name:'Live schedule',exact:true}).getByRole('button').first().click();
 const step=page.getByRole('region',{name:'Smoked brisket steps',exact:true}).getByRole('article').first();
 await step.getByLabel('Instructions',{exact:true}).fill('Keep my unsaved draft');
 const before=await page.evaluate(k=>localStorage.getItem(k),ACTIVE_KEY);
 await request.post('/__test__/worker-mode?mode=update');await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration())!.update();});
 await expect(page.getByRole('button',{name:'Update app',exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Menu',exact:true}).click();
 await expect(page.getByRole('button',{name:'Update app',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Close account',exact:true}).click();
 await expect(step.getByLabel('Instructions',{exact:true})).toHaveValue('Keep my unsaved draft');
 expect(await page.evaluate(k=>localStorage.getItem(k),ACTIVE_KEY)).toBe(before);
 await step.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Menu',exact:true}).click();
 const update=page.getByRole('button',{name:'Update app',exact:true});await expect(update).toBeEnabled();
 await update.click();await page.waitForLoadState('domcontentloaded');
 await expect(page.getByRole('button',{name:/Resume planning/})).toBeVisible();
 expect(await page.evaluate(k=>localStorage.getItem(k),ACTIVE_KEY)).toBe(before);
});

test('an unsaved custom-step draft also blocks app updates until cancelled',async({page,request})=>{
 await page.goto('/');await ready(page);await page.getByRole('button',{name:/Plan a new cook/}).click();
  await page.getByRole('button',{name:'Start with a template',exact:true}).click();await page.getByRole('button',{name:'Add smoked brisket',exact:true}).click();await page.getByRole('button',{name:'Start cooking',exact:true}).click();
 await page.getByRole('button',{name:/Add a checklist step/}).click();await page.getByLabel('Step title',{exact:true}).fill('Do not discard my sauce step');
 await request.post('/__test__/worker-mode?mode=custom-draft');await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration())!.update();});
 await expect(page.getByRole('button',{name:'Update app',exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Menu',exact:true}).click();
 await expect(page.getByRole('button',{name:'Update app',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Close account',exact:true}).click();
 await expect(page.getByLabel('Step title',{exact:true})).toHaveValue('Do not discard my sauce step');
 await page.getByRole('button',{name:'Cancel step',exact:true}).click();
 await page.getByRole('button',{name:'Menu',exact:true}).click();
 await expect(page.getByRole('button',{name:'Update app',exact:true})).toBeEnabled();
});


test('Home has no install or offline help while preparation stays functional',async({page},info)=>{
 await page.goto('/');await ready(page);
 expect(await page.locator('.site-header').evaluate(e=>{const next=e.nextElementSibling;return (next?.matches('.cook-content')?next.firstElementChild:next)?.getAttribute('aria-label');})).toBe('Home');
 await expect(page.getByText('Saved on this device',{exact:true})).toHaveCount(0);
 await expect(page.getByText('A LITTLE LESS JUGGLING. A BETTER COOK.',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Install and offline help',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Install app',exact:true})).toHaveCount(0);
 await expect(page.getByText(/Safari’s Share menu/)).toHaveCount(0);
 await expect(page.getByText('Offline ready on this device',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Plan a new cook/})).toBeInViewport();
 await page.screenshot({path:info.outputPath('clean-home-production.png'),fullPage:true});
 await page.getByRole('button',{name:/Plan a new cook/}).click();
  await page.getByRole('button',{name:'Start with a template',exact:true}).click();await ready(page);await expect(page.getByText('Saved on this device',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Install and offline help',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Install app',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Add smoked brisket',exact:true}).click();await page.getByRole('button',{name:'Start cooking',exact:true}).click();
 await expect(page.getByText('Install and offline help',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Install app',exact:true})).toHaveCount(0);
 await expect(page.getByText('Offline ready on this device',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'← Home',exact:true}).click();await page.getByRole('button',{name:/Past cooks and backups/}).click();
 await expect(page.getByText('Install and offline help',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Install app',exact:true})).toHaveCount(0);
});
