import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import {backend,user} from './fixtures';
import {newMeal,createDish} from '../../src/domain/meal';
import {migrateMeal,recordEvent,cookTimeline,type ExtendedMeal} from '../../src/domain/cookState';
import {archiveCook,emptyHistory} from '../../src/domain/cookHistory';
const rpc='https://auth.example.test/rest/v1/rpc/';
function remote(){
 let meal:ExtendedMeal=migrateMeal({...newMeal(),name:'Weekend brats',mode:'cooking',startedAt:'2026-11-04T12:00Z',dishes:[createDish('brats')]});meal=recordEvent(meal,cookTimeline(meal)[0].id,'completed','2026-11-04T12:01Z');
 const state={revision:1,writeId:null as string|null,active:{meal,serveInstant:meal.serveAt} as {meal:ExtendedMeal;serveInstant:string}|null,history:archiveCook({...newMeal(),name:'Previous dinner',dishes:[createDish('side')]},emptyHistory(),'Keep history','2026-11-03T18:00Z').cooks.map(c=>({...c,serveInstant:c.meal.serveAt})),capabilities:{cancelCook:true}};
 const canceled:unknown[]=[],requests:{write_id:string}[]=[],receipts=new Map<string,unknown>();let lose=false;
 return {state,meal,canceled,requests,loseNext:()=>{lose=true;},attach:async(context:BrowserContext)=>{await context.route(rpc+'**',async route=>{
  const body=route.request().postDataJSON();if(body.expected_owner!==user.id)return route.fulfill({status:403,json:{code:'42501'}});
  if(route.request().url().endsWith('cancel_cook')){
   requests.push(body);if(receipts.has(body.write_id))return route.fulfill({json:{...state,cancellation:receipts.get(body.write_id)}});
   if(body.expected_revision!==state.revision||state.active?.meal.id!==body.target_cook_id)return route.fulfill({status:409,json:{code:'40001'}});
   canceled.push(structuredClone(state.active));state.active=null;state.revision++;state.writeId=body.write_id;
   const receipt={operationId:body.write_id,cookId:body.target_cook_id,canceledAt:new Date().toISOString()};receipts.set(body.write_id,receipt);
   if(lose){lose=false;return route.abort('failed');}return route.fulfill({json:{...state,cancellation:receipt}});
  }
  if(route.request().url().endsWith('save_cook_workspace')){if(body.write_id!==state.writeId){if(body.expected_revision!==state.revision)return route.fulfill({status:409,json:{code:'40001'}});state.active=body.document.active;state.history=body.document.history;state.revision++;state.writeId=body.write_id;}}
  return route.fulfill({json:state});
 });}};
}
async function signIn(page:Page){await backend(page);await page.goto('/');await page.getByRole('button',{name:'Sign in',exact:true}).click();const d=page.getByRole('dialog',{name:'Your account'});await d.getByLabel('Email address').fill(user.email);await d.getByRole('button',{name:'Send sign-in code',exact:true}).click();await d.getByLabel('Email code').fill('123456');await d.getByRole('button',{name:'Verify code',exact:true}).click();await expect(d.getByText('Signed in as '+user.email,{exact:true})).toBeVisible();await d.getByRole('button',{name:'Close account',exact:true}).click();}
test('acknowledged account cancellation retains actual records and history and permits a new cook',async({page,context},info)=>{
 const server=remote(),history=structuredClone(server.state.history);await server.attach(context);await signIn(page);await page.getByRole('button',{name:'Cancel cook',exact:true}).click();const d=page.getByRole('dialog',{name:'Cancel this cook?'});await expect(d.getByRole('button',{name:'Keep cooking',exact:true})).toBeFocused();await page.screenshot({path:info.outputPath('account-cancel.png'),scale:'css'});await page.keyboard.press('Escape');expect(server.canceled).toHaveLength(0);
 await page.getByRole('button',{name:'Cancel cook',exact:true}).click();await d.getByRole('button',{name:'Cancel cook',exact:true}).click();await expect(page.getByText('Cook canceled.',{exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'Home',exact:true})).toBeVisible();expect(server.canceled).toEqual([{meal:server.meal,serveInstant:server.meal.serveAt}]);expect(server.state.history).toEqual(history);
 await page.reload();await expect(page.getByRole('button',{name:/Continue cooking/})).toHaveCount(0);await page.getByRole('button',{name:/Plan a cook/}).click();await expect(page.getByRole('heading',{name:'What do you want to cook?',exact:true})).toBeVisible();expect(server.state.history).toEqual(history);
});
test('lost cancellation response survives reload and reuses the operation without duplicating records',async({page,context})=>{
 const server=remote();await server.attach(context);await signIn(page);server.loseNext();await page.getByRole('button',{name:'Cancel cook',exact:true}).click();const d=page.getByRole('dialog',{name:'Cancel this cook?'});await d.getByRole('button',{name:'Cancel cook',exact:true}).click();await expect(d.getByRole('alert')).toBeVisible();expect(server.canceled).toHaveLength(1);await d.getByRole('button',{name:'Keep cooking',exact:true}).click();
 await page.reload();await expect(page.getByRole('region',{name:'Account cook recovery'})).toBeVisible();await page.getByText('Save details',{exact:true}).click();
await page.getByRole('button',{name:'Retry account saving',exact:true}).click();await expect(page.getByRole('button',{name:/Continue cooking/})).toHaveCount(0);expect(server.canceled).toHaveLength(1);expect(new Set(server.requests.map(r=>r.write_id)).size).toBe(1);
});
test('cancellation is gated on server capability',async({page,context})=>{const server=remote();server.state.capabilities.cancelCook=false;await server.attach(context);await signIn(page);await expect(page.getByRole('button',{name:/Continue cooking/})).toBeVisible();await expect(page.getByRole('button',{name:'Cancel cook',exact:true})).toHaveCount(0);});
test('guest trial cancellation permits a fresh cook without persistent tracking',async({page})=>{await page.goto('/');await page.getByRole('button',{name:/Plan a cook/}).click();await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();await page.getByRole('button',{name:'Start cooking',exact:true}).click();await page.getByText('Cook details & tools',{exact:true}).click();await page.getByRole('button',{name:'Cancel cook',exact:true}).click();await page.getByRole('dialog',{name:'Cancel this cook?'}).getByRole('button',{name:'Cancel cook',exact:true}).click();await expect(page.getByText('Cook canceled.',{exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'Home',exact:true})).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('how-many-beers:meal:v1'))).toBeNull();expect(await page.evaluate(()=>localStorage.getItem('how-many-beers:canceled:v1'))).toBeNull();});
