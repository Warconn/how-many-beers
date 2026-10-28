import {test,expect} from '@playwright/test';
import {newMeal,createDish} from '../src/domain/meal';
import {migrateMeal,cookTimeline,recordEvent} from '../src/domain/cookState';
import {archiveCook,emptyHistory,exportBackup,ACTIVE_KEY,HISTORY_KEY} from '../src/domain/cookHistory';
import {RECOVERY_KEY} from '../src/domain/localPersistence';
import {readFile} from 'node:fs/promises';

const fixture=()=>migrateMeal({...newMeal(),name:'Overnight cook',dishes:[createDish('brisket'),createDish('brats')]});
test('unreadable saved data is preserved across reload and can be exported',async({page},info)=>{
  await page.goto('/');await page.evaluate(({active,history})=>{
    localStorage.clear();localStorage.setItem(active,'{unreadable cook');localStorage.setItem(history,'{"version":2,"cooks":[]}');
  },{active:ACTIVE_KEY,history:HISTORY_KEY});await page.reload();
  await expect(page.locator('#storage-warning')).toBeVisible();
  expect(await page.evaluate(k=>localStorage.getItem(k),ACTIVE_KEY)).toBe('{unreadable cook');
  await page.reload();
  expect(await page.evaluate(k=>localStorage.getItem(k),ACTIVE_KEY)).toBe('{unreadable cook');
  expect(await page.evaluate(k=>localStorage.getItem(k),HISTORY_KEY)).toBe('{"version":2,"cooks":[]}');
  await page.screenshot({path:info.outputPath('protected-recovery.png'),fullPage:true,style:'nextjs-portal{display:none}'});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download recovery data',exact:true}).click();
  const file=await download;expect(file.suggestedFilename()).toContain('recovery');
  const recovered=JSON.parse(await readFile((await file.path())!,'utf8'));
  expect(recovered.active).toBe('{unreadable cook');expect(recovered.history).toBe('{"version":2,"cooks":[]}');
});

test('failed backup restore never leaves imported history paired with the old active cook',async({page})=>{
  const active=fixture();const history=archiveCook(active,emptyHistory(),'Original archive','2026-10-25T18:00:00Z');
  await page.goto('/');await page.evaluate(({active,history,a,h})=>{localStorage.clear();localStorage.setItem(a,JSON.stringify(active));localStorage.setItem(h,JSON.stringify(history));},{active,history,a:ACTIVE_KEY,h:HISTORY_KEY});await page.reload();
  await page.getByRole('button',{name:/Past cooks and backups/}).click();
  const before=await page.evaluate(({a,h})=>[localStorage.getItem(a),localStorage.getItem(h)],{a:ACTIVE_KEY,h:HISTORY_KEY});
  await page.evaluate(k=>{const original=Storage.prototype.setItem;let failed=false;Storage.prototype.setItem=function(key,value){if(key===k&&!failed){failed=true;throw new DOMException('Full','QuotaExceededError');}return original.call(this,key,value);};},ACTIVE_KEY);
  page.once('dialog',d=>d.accept());
  await page.getByLabel('Restore a backup').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(exportBackup({...fixture(),name:'Imported'},emptyHistory(),'2026-10-27T12:00:00Z'))});
  await expect(page.getByRole('alert').filter({hasText:'Could not restore backup'})).toContainText('Could not restore backup');
  expect(await page.evaluate(({a,h})=>[localStorage.getItem(a),localStorage.getItem(h)],{a:ACTIVE_KEY,h:HISTORY_KEY})).toEqual(before);
  await page.reload();expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).name,ACTIVE_KEY)).toBe('Overnight cook');
});

test('failed critical writes remain visibly unsaved, exportable and retryable',async({page},info)=>{
  const active=fixture();active.mode='cooking';active.startedAt='2026-10-26T21:00:00Z';
  await page.goto('/');await page.evaluate(({active,k})=>{localStorage.clear();localStorage.setItem(k,JSON.stringify(active));},{active,k:ACTIVE_KEY});await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();
  await page.evaluate(k=>{const original=Storage.prototype.setItem;(window as unknown as {restoreWrites:()=>void}).restoreWrites=()=>{Storage.prototype.setItem=original;};Storage.prototype.setItem=function(key,value){if(key===k)throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};},ACTIVE_KEY);
  await page.getByRole('region',{name:'Current step',exact:true}).getByRole('checkbox').click();
  await expect(page.getByRole('alert').filter({hasText:'not saved'})).toContainText('not saved');
  await expect(page.getByRole('alert').filter({hasText:'not saved'})).toBeInViewport();
  await page.screenshot({path:info.outputPath('unsaved-cook.png'),fullPage:false,style:'nextjs-portal{display:none}'});
  expect(Object.keys(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).completed,ACTIVE_KEY))).toHaveLength(0);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download backup',exact:true}).click();
  const backup=JSON.parse(await readFile((await (await download).path())!,'utf8'));expect(Object.keys(backup.active.completed)).toHaveLength(1);
  await page.evaluate(()=>(window as unknown as {restoreWrites:()=>void}).restoreWrites());
  await page.getByRole('button',{name:'Retry saving',exact:true}).click();
  await expect(page.getByText('Saved on this device',{exact:true})).toHaveCount(0);
  await page.reload();
  expect(Object.keys(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).completed,ACTIVE_KEY))).toHaveLength(1);
});

test('reset requires confirmation and keeps recovery bytes; valid backup can restore protected data',async({page})=>{
 await page.goto('/');await page.evaluate(k=>localStorage.setItem(k,'{original protected cook'),ACTIVE_KEY);await page.reload();
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Reset saved cooks',exact:true}).click();
 expect(await page.evaluate(k=>localStorage.getItem(k),ACTIVE_KEY)).toBe('{original protected cook');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Reset saved cooks',exact:true}).click();
 await expect(page.getByRole('region',{name:'Home',exact:true})).toBeVisible();
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).active,RECOVERY_KEY)).toBe('{original protected cook');
 await page.evaluate(k=>localStorage.setItem(k,'{another protected cook'),ACTIVE_KEY);await page.reload();
 const active=fixture();const history=archiveCook(active,emptyHistory(),'Restored','2026-10-25T12:00:00Z');
 page.once('dialog',d=>d.accept());
 await page.getByLabel('Restore a backup').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(active,history,'2026-10-27T12:00:00Z'))});
 await expect(page.getByRole('region',{name:'Saved cook recovery'})).toHaveCount(0);
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),ACTIVE_KEY)).toEqual(active);
 expect((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),HISTORY_KEY)).cooks).toHaveLength(1);
});

test('unavailable storage does not overwrite existing cooks or claim a successful save',async({page})=>{
 await page.goto('/');const active=fixture();await page.evaluate(({k,active})=>localStorage.setItem(k,JSON.stringify(active)),{k:ACTIVE_KEY,active});
 await page.addInitScript(()=>{const original=Storage.prototype.getItem;(window as unknown as {originalRead:(key:string)=>string|null}).originalRead=key=>original.call(localStorage,key);Storage.prototype.getItem=function(key){if(key.startsWith('how-many-beers:'))throw new DOMException('Blocked','SecurityError');return original.call(this,key);};});
 await page.reload();await expect(page.getByRole('region',{name:'Saved cook recovery'})).toBeVisible();
 await expect(page.getByText('Saved on this device',{exact:true})).toHaveCount(0);
 expect(await page.evaluate(k=>JSON.parse((window as unknown as {originalRead:(key:string)=>string}).originalRead(k)),ACTIVE_KEY)).toEqual(active);
});

test('failed finish/archive keeps the original active cook and history together',async({page})=>{
 const active={...fixture(),mode:'cooking' as const,startedAt:'2026-10-25T20:00:00Z'};
 const history=archiveCook(fixture(),emptyHistory(),'Earlier dinner','2026-10-25T12:00:00Z');
 await page.goto('/');await page.evaluate(({active,history,a,h})=>{localStorage.clear();localStorage.setItem(a,JSON.stringify(active));localStorage.setItem(h,JSON.stringify(history));},{active,history,a:ACTIVE_KEY,h:HISTORY_KEY});await page.reload();await page.getByRole('button',{name:/Continue cooking/}).click();
 const before=await page.evaluate(({a,h})=>[localStorage.getItem(a),localStorage.getItem(h)],{a:ACTIVE_KEY,h:HISTORY_KEY});
 await page.evaluate(k=>{const original=Storage.prototype.setItem;let failed=false;Storage.prototype.setItem=function(key,value){if(key===k&&!failed){failed=true;throw new DOMException('Full','QuotaExceededError');}return original.call(this,key,value);};},ACTIVE_KEY);
 await page.getByRole('navigation',{name:'Cook navigation'}).getByRole('button',{name:'Finish cook',exact:true}).click();await page.getByRole('button',{name:'Save finished cook',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Could not save this cook'})).toBeVisible();
 expect(await page.evaluate(({a,h})=>[localStorage.getItem(a),localStorage.getItem(h)],{a:ACTIVE_KEY,h:HISTORY_KEY})).toEqual(before);
});

test('a stale tab cannot silently replace a newer cook',async({page,context})=>{
  await page.goto('/');await page.getByRole('button',{name:/Plan a new cook/}).click();await page.getByRole('button',{name:'Add smoked brisket',exact:true}).click();
  const other=await context.newPage();await other.goto(page.url());await other.getByRole('button',{name:/Resume planning/}).click();
  await page.getByLabel('Meal name',{exact:true}).fill('Newer plan');
  await expect(other.getByRole('alert').filter({hasText:'Another tab'})).toContainText('Another tab');
  await other.getByLabel('Meal name',{exact:true}).fill('Stale edit');
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).name,ACTIVE_KEY)).toBe('Newer plan');
});
