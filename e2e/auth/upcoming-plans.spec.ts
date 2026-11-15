import {planningReadiness} from '../../src/domain/planningReadiness';
import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {backend,user} from './fixtures';
import {newMeal,createDish} from '../../src/domain/meal';
import {parseRecipeText} from '../../src/domain/recipe';
import {cookTimeline,recordEvent,migrateMeal,type ExtendedMeal} from '../../src/domain/cookState';
import {archiveCook,emptyHistory} from '../../src/domain/cookHistory';
import {savedPlanCacheKey} from '../../src/account/SavedPlanStore';
import {pendingPlansKey} from '../../src/account/useUpcomingPlans';
import {planDocument} from '../../src/account/savedPlans';
import type {SavedPlan} from '../../src/account/savedPlans';
const now='2026-11-05T12:00:00Z',rpc='https://auth.example.test/rest/v1/rpc/';
test.use({timezoneId:'UTC'});
function server(legacy=false){
 const dish=parseRecipeText('Pumpkin seeds','Preheat (10 minutes)\nClean (5 minutes)\nDry (10 minutes)\nSeason (2 minutes)\nCoat (2 minutes)\nRoast (15 minutes)\nCool (10 minutes)');
 let original:ExtendedMeal=migrateMeal({...newMeal(),name:legacy?'Legacy dinner':'Pumpkin Seeds',serveAt:'2026-11-05T13:00',dishes:[dish],...(!legacy?{mode:'cooking' as const,startedAt:now}:{})});if(!legacy)for(const task of cookTimeline(original).slice(0,5))original=recordEvent(original,task.id,'completed',now);
 const state={revision:1,writeId:null as string|null,active:{meal:original,serveInstant:new Date(original.serveAt).toISOString()} as {meal:ExtendedMeal;serveInstant:string}|null,history:archiveCook({...newMeal(),name:'Saved dinner',dishes:[createDish('side')]},emptyHistory(),'Keep saved history','2026-11-03T18:00Z').cooks.map(c=>({...c,serveInstant:c.meal.serveAt})),capabilities:{cancelCook:true,savedPlans:true}};
 const discarded=new Map<string,SavedPlan>(),discardRequests:string[]=[],saveRequests:string[]=[];
 const plans=new Map<string,SavedPlan>(),receipts=new Map<string,unknown>(),promotionRequests:string[]=[];let failSave=false,losePromotion=false,failDiscard=false,holdDiscardReplies=false;
 return {state,original,plans,discarded,discardRequests,saveRequests,promotionRequests,failDiscarding:(v:boolean)=>{failDiscard=v;},holdDiscardReplies:(v:boolean)=>{holdDiscardReplies=v;},failSaving:(v:boolean)=>{failSave=v;},loseNextPromotion:()=>{losePromotion=true;},attach:async(context:BrowserContext)=>context.route(rpc+'**',async route=>{
  const b=route.request().postDataJSON(),name=route.request().url().slice(rpc.length);if(b.expected_owner!==user.id)return route.fulfill({status:403,json:{code:'42501'}});
  const conflict=()=>route.fulfill({status:409,json:{code:'40001',message:'Changed on another device'}});
  if(name==='list_saved_cook_plans')return route.fulfill({json:{plans:[...plans.values()]}});
  if(name==='read_saved_cook_plan')return route.fulfill({json:plans.get(b.target_plan_id)??null});
  if(name==='save_saved_cook_plan'){
   saveRequests.push(b.write_id);if(discarded.has(b.target_plan_id))return conflict();
   if(failSave)return route.fulfill({status:503,json:{code:'unavailable'}});
   const old=plans.get(b.target_plan_id);if(old?.writeId===b.write_id)return route.fulfill({json:old});if((old?.revision??0)!==b.expected_revision)return conflict();
   const plan={id:b.target_plan_id,revision:(old?.revision??0)+1,meal:b.document.meal,serveInstant:b.document.serveInstant,timeZone:b.time_zone,createdAt:old?.createdAt??now,updatedAt:now,writeId:b.write_id,writeReceipt:{operationId:b.write_id,planId:b.target_plan_id}};plans.set(plan.id,plan);return route.fulfill({json:plan});
  }
  if(name==='promote_saved_cook_plan'){
   promotionRequests.push(b.write_id);
   if(receipts.has(b.write_id))return route.fulfill({json:{...state,promotion:receipts.get(b.write_id)}});
   const plan=plans.get(b.target_plan_id);if(!plan||state.revision!==b.expected_workspace_revision||plan.revision!==b.expected_plan_revision||state.active?.meal.mode==='cooking'||state.active?.meal.startedAt)return conflict();
   if(state.active&&state.active.meal.dishes.length){const m=state.active.meal;plans.set(m.id,{id:m.id,meal:m,serveInstant:state.active.serveInstant,timeZone:'UTC',revision:1,createdAt:now,updatedAt:now,writeId:null});}
   state.active={meal:{...plan.meal,mode:'cooking',startedAt:now},serveInstant:plan.serveInstant!};plans.delete(plan.id);state.revision++;state.writeId=b.write_id;const receipt={operationId:b.write_id,planId:plan.id,cookId:plan.id};receipts.set(b.write_id,receipt);if(losePromotion){losePromotion=false;return route.abort('failed');}return route.fulfill({json:{...state,promotion:receipt}});
  }
  if(name==='discard_saved_cook_plan'){
   discardRequests.push(b.write_id);if(failDiscard)return route.fulfill({status:503,json:{code:'unavailable'}});
   const receipt=receipts.get(b.write_id);if(receipt)return holdDiscardReplies?route.abort('failed'):route.fulfill({json:receipt});
   const plan=plans.get(b.target_plan_id);if(!plan||plan.revision!==b.expected_revision)return conflict();
   discarded.set(plan.id,structuredClone(plan));plans.delete(plan.id);
   const result={operationId:b.write_id,planId:plan.id,discarded:true};receipts.set(b.write_id,result);
   return holdDiscardReplies?route.abort('failed'):route.fulfill({json:result});
  }
  if(name==='cancel_cook'){if(state.active?.meal.id!==b.target_cook_id||b.expected_revision!==state.revision)return conflict();state.active=null;state.revision++;state.writeId=b.write_id;return route.fulfill({json:{...state,cancellation:{operationId:b.write_id,cookId:b.target_cook_id,canceledAt:now}}});}
  if(name==='save_cook_workspace'){
   if(state.writeId!==b.write_id){if(state.revision!==b.expected_revision)return conflict();state.active=b.document.active;state.history=b.document.history;state.revision++;state.writeId=b.write_id;}
  }
  if(name==='import_saved_cook_plans'){
   for(const p of b.documents){const old=plans.get(p.id);if(old&&JSON.stringify(old.meal)!==JSON.stringify(p.meal))return conflict();}
   for(const p of b.documents)if(!plans.has(p.id))plans.set(p.id,{...p,revision:1,createdAt:now,updatedAt:now,writeId:b.write_id});return route.fulfill({json:{plans:[...plans.values()],importReceipt:{operationId:b.write_id,planIds:b.documents.map((p:{id:string})=>p.id)}}});
  }
  return route.fulfill({json:state});
 })};
}
async function signIn(page:Page,profile=user){await backend(page,{profile});await page.goto('/');await page.getByRole('button',{name:'Sign in',exact:true}).click();const d=page.getByRole('dialog',{name:'Your account'});await d.getByLabel('Email address').fill(profile.email);await d.getByRole('button',{name:'Send sign-in code',exact:true}).click();await d.getByLabel('Email code').fill('123456');await d.getByRole('button',{name:'Verify code',exact:true}).click();await expect(d.getByText('Signed in as '+profile.email,{exact:true})).toBeVisible();await d.getByRole('button',{name:'Close account',exact:true}).click();}
async function createPlan(page:Page,name:string,serveAt?:string){
 await page.getByRole('button',{name:'Plan a cook',exact:true}).click();
 await page.getByRole('button',{name:'Choose a template',exact:true}).click();
 await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();
 const savedPlan=(response:import('@playwright/test').Response)=>response.url().endsWith('save_saved_cook_plan')&&response.ok();
 // Set up a saved plan before testing conflicts/promotion. Wait for the dish
 // save's acknowledgment so WebKit does not fill during the initial re-render.
 const added=page.waitForResponse(response=>savedPlan(response)&&response.request().postDataJSON().document.meal.dishes.length>0);
 await page.getByRole('button',{name:'Add to meal',exact:true}).click();
 await added;
 await expect(page.locator('.account-save-indicator')).toHaveAttribute('data-state','saved');
 const named=page.waitForResponse(response=>savedPlan(response)&&response.request().postDataJSON().document.meal.name===name);
 const nameField=page.getByLabel('Meal name',{exact:true});
 // Use real key events: WebKit's synthetic fill can be reset without an input
 // update during this controlled-field setup. Keep the exact value/save checks.
 await nameField.click();
 await nameField.press('ControlOrMeta+A');
 await nameField.press('Backspace');
 await nameField.pressSequentially(name);
 await expect(nameField).toHaveValue(name);
 await named;
 if(serveAt)await page.getByLabel('Serve date and time',{exact:true}).fill(serveAt);
 await page.getByRole('button',{name:'Save plan for later',exact:true}).click();
 await expect(page.getByRole('region',{name:'Upcoming cooks'}).getByRole('listitem',{name,exact:true})).toBeVisible();
}
test('future plans stay independent from an active 5-of-8 cook and reload on another device',async({page,context,browser},info)=>{
 await page.clock.install({time:new Date(now)});
 const remote=server(),before=structuredClone(remote.state.active),history=structuredClone(remote.state.history);await remote.attach(context);await signIn(page);
 await createPlan(page,'Sunday Brats');await createPlan(page,'Next Friday','2026-11-06T18:00');expect(remote.plans.size).toBe(2);expect(remote.state.active).toEqual(before);expect(remote.state.history).toEqual(history);
 const upcoming=page.getByRole('region',{name:'Upcoming cooks'});await upcoming.getByRole('listitem',{name:'Sunday Brats',exact:true}).getByRole('button',{name:'Edit plan',exact:true}).click();await page.getByLabel('Meal name',{exact:true}).fill('Sunday Family Brats');await page.getByLabel('Serve date and time',{exact:true}).fill('2026-11-08T18:00');await expect(page.getByRole('button',{name:'Start cooking',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Continue current cook',exact:true})).toBeVisible();await page.getByRole('button',{name:'Save plan for later',exact:true}).click();
 await expect(upcoming.getByRole('heading',{level:4})).toHaveText(['Next Friday','Sunday Family Brats']);
 for(const plan of remote.plans.values()){
  const card=upcoming.getByRole('listitem',{name:plan.meal.name,exact:true});
  const expected=planningReadiness(plan.meal,cookTimeline(plan.meal),await page.evaluate(()=>Date.now()))?.startAt;
  if(expected){await expect(card.getByText('Start preparing',{exact:false})).toBeVisible();const displayed=await card.locator('time').first().getAttribute('datetime');expect(Math.abs(Date.parse(displayed!)-Date.parse(expected))).toBeLessThan(5000);}
  await expect(card.getByText(/^Serve /)).toBeVisible();
 }
expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath('upcoming-with-active.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});await upcoming.screenshot({path:info.outputPath('upcoming-list.png'),scale:'css'});await page.getByRole('button',{name:/Continue cooking/}).click();await expect(page.getByText('5 of 8 steps done',{exact:true})).toBeVisible();expect(remote.state.active).toEqual(before);expect(remote.state.history).toEqual(history);
 const second=await browser.newContext({timezoneId:'UTC'});await remote.attach(second);const other=await second.newPage();await signIn(other);await expect(other.getByRole('listitem',{name:'Sunday Family Brats',exact:true})).toBeVisible();await expect(other.getByRole('listitem',{name:'Next Friday',exact:true})).toBeVisible();expect(remote.state.active).toEqual(before);await second.close();
});
test('cancel the active cook, atomically start a saved plan, then finish it into history',async({page,context})=>{
 const remote=server();await remote.attach(context);await signIn(page);await createPlan(page,'Sunday Brats');const plan=[...remote.plans.values()][0];await page.getByRole('button',{name:'Cancel cook',exact:true}).click();
 const cancelDialog=page.getByRole('dialog',{name:'Cancel this cook?'});
 await expect(cancelDialog.getByText(/existing record and cooking activity/)).toHaveCount(0);
 await expect(cancelDialog.getByText(/won’t appear in Past cooks/)).toBeVisible();
 await cancelDialog.getByRole('button',{name:'Cancel cook',exact:true}).click();
 await expect(page.getByText('Cook canceled.',{exact:true})).toHaveCount(0);
 await expect(page.getByText(/Plan saved\. Come back here/)).toHaveCount(0);
 await page.getByRole('listitem',{name:'Sunday Brats',exact:true}).getByRole('button',{name:'Start cooking',exact:true}).click();await expect(page.getByRole('region',{name:'Current step',exact:true})).toBeVisible();expect(remote.state.active?.meal.id).toBe(plan.id);expect(remote.state.active?.meal.phasePlan?.version).toBe(1);expect(remote.plans.size).toBe(0);
 await page.getByRole('button',{name:'Full checklist',exact:true}).click();const list=page.getByRole('region',{name:'Full cook checklist'});for(const checkbox of await list.getByRole('checkbox').all())await checkbox.check();await page.getByRole('button',{name:'Finish cook',exact:true}).click();await page.getByRole('button',{name:'Save finished cook',exact:true}).click();await page.getByRole('button',{name:/Past cooks/}).click();await expect(page.getByText('Sunday Brats',{exact:true})).toBeVisible();expect(remote.state.history.some(h=>h.id===plan.id)).toBe(true);const completed=remote.state.history.find(h=>h.id===plan.id)!;expect(completed.meal.phasePlan?.version).toBe(1);expect(completed.meal.events?.some(e=>e.phaseObservations?.some(o=>o.boundary==='start'))).toBe(true);expect(completed.meal.events?.some(e=>e.phaseObservations?.some(o=>o.boundary==='end'))).toBe(true);
});
test('a legacy upcoming plan transfers once when another saved plan starts',async({page,context})=>{const remote=server(true),original=structuredClone(remote.state.active);await remote.attach(context);await signIn(page);await expect(page.getByRole('listitem',{name:'Legacy dinner',exact:true})).toHaveCount(1);await createPlan(page,'New dinner');await page.getByRole('listitem',{name:'New dinner',exact:true}).getByRole('button',{name:'Start cooking',exact:true}).click();await expect(page.getByRole('region',{name:'Current step',exact:true})).toBeVisible();expect(remote.plans.get(remote.original.id)?.meal).toEqual(original!.meal);await page.getByRole('button',{name:'Home',exact:true}).click();await expect(page.getByRole('listitem',{name:'Legacy dinner',exact:true})).toHaveCount(1);});

test('temporary plan save failures retry quietly after reload without changing the cook',async({page,context},info)=>{
 const remote=server(),before=structuredClone(remote.state.active);await remote.attach(context);await signIn(page);await page.getByRole('button',{name:'Plan a cook',exact:true}).click();await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();await expect.poll(()=>remote.plans.size).toBe(1);await expect(page.getByRole('region',{name:'Review your method',exact:true})).toHaveCount(0);await expect.poll(()=>[...remote.plans.values()][0]?.meal.dishes.length).toBe(1);remote.failSaving(true);await expect(page.getByLabel('Meal name',{exact:true})).toBeVisible();await page.getByLabel('Meal name',{exact:true}).fill('Keep this plan');await expect(page.locator('.account-save-indicator')).not.toHaveAttribute('data-state','saved');expect(remote.plans.size).toBe(1);expect(remote.state.active).toEqual(before);
 await expect(page.getByRole('button',{name:/Retry plan|Download plan draft|Resume draft/})).toHaveCount(0);await page.screenshot({path:info.outputPath('plan-automatic-saving.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});
 await page.reload();await expect(page.getByRole('listitem',{name:'Keep this plan',exact:true}).getByRole('button',{name:'Edit plan',exact:true})).toBeVisible();remote.failSaving(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect.poll(()=>[...remote.plans.values()].map(p=>p.meal.name)).toContain('Keep this plan');
 await page.getByRole('listitem',{name:'Keep this plan',exact:true}).getByRole('button',{name:'Edit plan',exact:true}).click();await expect(page.getByLabel('Meal name',{exact:true})).toHaveValue('Keep this plan');await page.getByRole('button',{name:'+ Add a dish',exact:true}).click();await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();await page.getByRole('button',{name:'Save plan for later',exact:true}).click();await expect(page.getByRole('listitem',{name:'Keep this plan',exact:true})).toBeVisible();expect(remote.state.active).toEqual(before);
});
test('routine cooking pages hide backup controls without changing saved account data',async({page,context})=>{
 const remote=server(),before=structuredClone(remote.state.active),history=structuredClone(remote.state.history);await remote.attach(context);await signIn(page);await createPlan(page,'Sunday Brats');
 await expect(page.getByText('Upcoming plan backups',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Download upcoming plans',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Past cooks',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Past cooks',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Cook backups'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Download cook and history|Restore a backup/})).toHaveCount(0);
 expect(remote.plans.size).toBe(1);expect(remote.state.active).toEqual(before);expect(remote.state.history).toEqual(history);
});
test('a failed future-plan save protects edits while allowing the active cook to continue',async({page,context})=>{
 const remote=server(),before=structuredClone(remote.state.active);await remote.attach(context);await signIn(page);await createPlan(page,'Sunday Brats');await page.getByRole('listitem',{name:'Sunday Brats',exact:true}).getByRole('button',{name:'Edit plan',exact:true}).click();remote.failSaving(true);await page.getByLabel('Meal name',{exact:true}).fill('Unsaved family brats');await page.getByRole('button',{name:'Home',exact:true}).click();await expect(page.getByRole('button',{name:/Continue cooking/})).toBeVisible();await expect(page.locator('.account-save-indicator')).not.toHaveAttribute('data-state','saved');await page.getByRole('button',{name:/Continue cooking/}).click();await expect(page.getByText('5 of 8 steps done',{exact:true})).toBeVisible();expect(remote.state.active).toEqual(before);remote.failSaving(false);await expect.poll(()=>[...remote.plans.values()][0]?.meal.name,{timeout:10000}).toBe('Unsaved family brats');await expect(page.locator('.account-save-indicator')).toHaveAttribute('data-state','saved');
});

test('a stale future-plan conflict protects both cooks without a recovery workflow',async({page,context},info)=>{
 const remote=server(),before=structuredClone(remote.state.active);await remote.attach(context);await signIn(page);await createPlan(page,'Sunday Brats');const loaded=page.waitForResponse(r=>r.url().endsWith('read_saved_cook_plan'));await page.getByRole('listitem',{name:'Sunday Brats',exact:true}).getByRole('button',{name:'Edit plan',exact:true}).click();await loaded;await expect(page.locator('.cook-content')).not.toHaveAttribute('inert');const plan=[...remote.plans.values()][0];plan.revision++;plan.meal.name='Newer device plan';await page.getByLabel('Meal name',{exact:true}).fill('Protected local draft');await expect(page.locator('.account-save-indicator')).toHaveAttribute('data-state','conflict');await expect(page.getByRole('button',{name:'Home',exact:true})).toHaveCount(1);await expect(page.getByRole('navigation',{name:'Main navigation',exact:true})).toHaveCount(0);await expect(page.getByRole('navigation',{name:'Plan navigation',exact:true}).getByRole('button',{name:'Home',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Upcoming plan recovery',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:/Retry plan|Download plan draft|Load saved plan|Resume draft/})).toHaveCount(0);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('plan-protected-conflict.png'),fullPage:false,scale:'css',style:'nextjs-portal{display:none}'});
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));expect(remote.plans.get(plan.id)?.meal.name).toBe('Newer device plan');await page.getByRole('button',{name:'Home',exact:true}).click();await expect(page.getByRole('button',{name:/Continue cooking/})).toBeVisible();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(page.getByText('5 of 8 steps done',{exact:true})).toBeVisible();expect(remote.state.active).toEqual(before);expect(remote.plans.get(plan.id)?.meal.name).toBe('Newer device plan');
});

for(const reload of [false,true])test(`lost promotion acknowledgment retries the original start${reload?' after reload':''}`,async({page,context})=>{
 const remote=server();await remote.attach(context);await signIn(page);await createPlan(page,'Sunday Brats');await page.getByRole('button',{name:'Cancel cook',exact:true}).click();await page.getByRole('dialog',{name:'Cancel this cook?'}).getByRole('button',{name:'Cancel cook',exact:true}).click();remote.loseNextPromotion();await page.getByRole('listitem',{name:'Sunday Brats',exact:true}).getByRole('button',{name:'Start cooking',exact:true}).click();await expect.poll(()=>remote.promotionRequests.length).toBeGreaterThan(0);const started=remote.state.active?.meal.startedAt;if(reload)await page.reload();await expect(page.getByRole('region',{name:'Account cook recovery',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:/Continue cooking/})).toBeVisible();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(page.getByRole('region',{name:'Current step',exact:true})).toBeVisible();expect(remote.state.active?.meal.startedAt).toBe(started);expect(new Set(remote.promotionRequests).size).toBe(1);expect(remote.plans.size).toBe(0);
});

test('legacy guests keep their existing planning/resume behavior without upcoming account controls',async({page})=>{
 const meal=migrateMeal({...newMeal(),name:'Legacy guest plan',dishes:[createDish('brats')]});meal.completed[cookTimeline(meal)[0].id]=now;
 await page.goto('/');await page.evaluate(m=>localStorage.setItem('how-many-beers:meal:v1',JSON.stringify(m)),meal);await page.reload();await expect(page.getByRole('button',{name:/Resume planning/})).toBeVisible();await expect(page.getByRole('button',{name:'Start cooking',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'Upcoming cooks',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('how-many-beers:meal:v1')!))).toEqual(JSON.parse(JSON.stringify(meal)));
});

test('recipe-first review changes a future meal without changing the active cook or history',async({page,context},info)=>{
 const remote=server(),before=structuredClone(remote.state.active),history=structuredClone(remote.state.history);await remote.attach(context);await signIn(page);await page.goto('/');await page.getByRole('button',{name:'Plan a cook',exact:true}).click();await expect(page.getByLabel('Serve date and time')).toBeVisible();await page.getByLabel('Serve date and time').fill('2026-12-06T18:45');await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();const review=page.getByRole('region',{name:'Review your method',exact:true});await review.getByLabel('Recipe name',{exact:true}).fill('My future brats');expect(remote.state.active).toEqual(before);await review.getByRole('button',{name:'Add to meal',exact:true}).click();await expect(page.getByRole('button',{name:'Start cooking',exact:true})).toBeDisabled();await expect(page.locator('.account-save-indicator')).toHaveAttribute('data-state','saved');const nameField=page.getByLabel('Meal name',{exact:true});await nameField.click();await nameField.press('ControlOrMeta+A');await nameField.pressSequentially('Future recipe-first dinner');await expect(nameField).toHaveValue('Future recipe-first dinner');await expect.poll(()=>[...remote.plans.values()][0]?.meal.name).toBe('Future recipe-first dinner');await page.getByRole('button',{name:'Save plan for later',exact:true}).click();await expect(page.getByRole('listitem',{name:'Future recipe-first dinner',exact:true})).toBeVisible();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(page.getByText('5 of 8 steps done',{exact:true})).toBeVisible();expect(remote.state.active).toEqual(before);expect(remote.state.history).toEqual(history);expect([...remote.plans.values()][0].meal.dishes[0].name).toBe('My future brats');expect([...remote.plans.values()][0].meal.serveAt).toBe('2026-12-06T18:45');await page.screenshot({path:info.outputPath('recipe-first-current-preserved.png'),fullPage:false,scale:'css',style:'nextjs-portal{display:none}'});
});

test('recipe-first Cook again keeps the entire previous meal independent from active work',async({page,context})=>{
 const remote=server(),before=structuredClone(remote.state.active);const past={...newMeal(),name:'Brats and beans',dishes:[createDish('brats'),createDish('side')]};remote.state.history=archiveCook(past,emptyHistory(),'Keep this whole meal','2026-11-03T18:00Z').cooks.map(c=>({...c,serveInstant:c.meal.serveAt}));const history=structuredClone(remote.state.history);await remote.attach(context);await signIn(page);await page.goto('/');await page.getByRole('button',{name:/Past cooks/}).click();await page.getByRole('button',{name:'Cook again',exact:true}).click();await expect(page.getByRole('heading',{name:'2 dishes in this cook'})).toBeVisible();await expect(page.getByRole('region',{name:'Review your method',exact:true})).toHaveCount(0);expect(remote.state.active).toEqual(before);expect(remote.state.history).toEqual(history);await expect.poll(()=>[...remote.plans.values()][0]?.meal.dishes.length).toBe(2);expect([...remote.plans.values()][0].meal.completed).toEqual({});
});

test('recipe-first review retains edits across a failed add and resubmits without duplicate dishes',async({page,context})=>{
 const remote=server(),before=structuredClone(remote.state.active);await remote.attach(context);await signIn(page);await page.goto('/');await page.getByRole('button',{name:'Plan a cook',exact:true}).click();await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();const review=page.getByRole('region',{name:'Review your method',exact:true});remote.failSaving(true);await review.getByRole('button',{name:'Add to meal',exact:true}).click();await expect(review.getByRole('alert')).toContainText('Your edits are still here');await review.getByLabel('Recipe name',{exact:true}).fill('Latest edited brats');remote.failSaving(false);await review.getByRole('button',{name:'Add to meal',exact:true}).click();await expect(review).toHaveCount(0);expect([...remote.plans.values()][0].meal.dishes).toHaveLength(1);expect([...remote.plans.values()][0].meal.dishes[0].name).toBe('Latest edited brats');expect(remote.state.active).toEqual(before);
});


test('discard an accidentally created empty upcoming plan from its editor without touching the active cook',async({page,context},info)=>{
 const remote=server(),active=structuredClone(remote.state.active),history=structuredClone(remote.state.history);
 await remote.attach(context);await signIn(page);
 await page.getByRole('button',{name:'Plan a cook',exact:true}).click();
 await expect(page.getByRole('heading',{name:'What do you want to cook?',exact:true})).toBeVisible();
 await expect(page.getByLabel('Meal name',{exact:true})).toHaveValue('Next cook');
 expect(remote.plans.size).toBe(0);expect(remote.saveRequests).toEqual([]);
 const discard=page.getByRole('button',{name:'Discard plan',exact:true});
 expect((await discard.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 await page.screenshot({path:info.outputPath('empty-plan-discard-control.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});
 page.on('dialog',()=>{throw Error('An empty plan should not require confirmation');});
 await page.getByRole('button',{name:'Discard plan',exact:true}).click();
 await expect(page.getByRole('region',{name:'Home',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Plan a cook',exact:true})).toHaveClass(/secondary/);
 await expect(page.getByRole('listitem',{name:'Next cook',exact:true})).toHaveCount(0);
 expect(remote.discarded.size).toBe(0);expect(remote.saveRequests).toEqual([]);expect(remote.state.active).toEqual(active);expect(remote.state.history).toEqual(history);
 await page.reload();await expect(page.getByRole('listitem',{name:'Next cook',exact:true})).toHaveCount(0);
 expect(remote.state.active).toEqual(active);expect(remote.state.history).toEqual(history);
 await page.screenshot({path:info.outputPath('discard-empty-plan.png'),fullPage:true,scale:'css'});
});

test('an upcoming plan with dishes can be kept or discarded from Home while preserving other meals',async({page,context})=>{
 const remote=server(),active=structuredClone(remote.state.active),history=structuredClone(remote.state.history);
 await remote.attach(context);await signIn(page);await createPlan(page,'Keep this dinner');await createPlan(page,'Accidental dinner');
 const other=structuredClone([...remote.plans.values()].find(p=>p.meal.name==='Keep this dinner'));
 const card=page.getByRole('listitem',{name:'Accidental dinner',exact:true});
 page.once('dialog',dialog=>dialog.dismiss());await card.getByRole('button',{name:'Discard plan',exact:true}).click();
 await expect(card).toBeVisible();expect(remote.discarded.size).toBe(0);
 page.once('dialog',dialog=>dialog.accept());await card.getByRole('button',{name:'Discard plan',exact:true}).click();
 await expect(card).toHaveCount(0);expect(remote.discarded.size).toBe(1);
 expect(remote.plans.get(other!.id)).toEqual(other);expect(remote.state.active).toEqual(active);expect(remote.state.history).toEqual(history);
 await page.reload();await expect(card).toHaveCount(0);await expect(page.getByRole('listitem',{name:'Keep this dinner',exact:true})).toBeVisible();
});


test('a lost discard response is acknowledged after reload without resurrecting the plan or changing active progress',async({page,context})=>{
 const remote=server(),active=structuredClone(remote.state.active),history=structuredClone(remote.state.history);
 await remote.attach(context);await signIn(page);await createPlan(page,'Discard once');
 remote.holdDiscardReplies(true);page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('listitem',{name:'Discard once',exact:true}).getByRole('button',{name:'Discard plan',exact:true}).click();
 await expect.poll(()=>remote.discarded.size).toBe(1);expect(remote.plans.size).toBe(0);
 remote.holdDiscardReplies(false);await page.reload();
 await expect(page.getByRole('listitem',{name:'Discard once',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Plan a cook',exact:true})).toBeVisible();
 await expect.poll(()=>remote.discardRequests.length).toBeGreaterThanOrEqual(2);
 expect(new Set(remote.discardRequests).size).toBe(1);
 await page.reload();await expect(page.getByRole('listitem',{name:'Discard once',exact:true})).toHaveCount(0);
 expect(remote.discarded.size).toBe(1);expect(remote.state.active).toEqual(active);expect(remote.state.history).toEqual(history);
});

test('a failed discard keeps the saved plan and reports failure without changing another cook',async({page,context})=>{
 const remote=server(),active=structuredClone(remote.state.active),history=structuredClone(remote.state.history);
 await remote.attach(context);await signIn(page);await createPlan(page,'Still saved');const saved=structuredClone([...remote.plans.values()][0]);
 remote.failDiscarding(true);page.once('dialog',dialog=>dialog.accept());
 const card=page.getByRole('listitem',{name:'Still saved',exact:true});await card.getByRole('button',{name:'Discard plan',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:/Could not save or load this plan|changed on another device/i})).toBeVisible();
 expect(remote.plans.get(saved.id)).toEqual(saved);expect(remote.discarded.size).toBe(0);
 expect(remote.state.active).toEqual(active);expect(remote.state.history).toEqual(history);
 await page.reload();await expect(card).toBeVisible();expect(remote.plans.get(saved.id)).toEqual(saved);
});


test('a legacy upcoming planning record can be discarded without adding completed history',async({page,context},info)=>{
 const remote=server(true),history=structuredClone(remote.state.history);await remote.attach(context);await signIn(page);
 await page.screenshot({path:info.outputPath('upcoming-plan-discard-card.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('listitem',{name:'Legacy dinner',exact:true}).getByRole('button',{name:'Discard plan',exact:true}).click();
 await expect(page.getByRole('listitem',{name:'Legacy dinner',exact:true})).toHaveCount(0);
 expect(remote.state.active).toBeNull();expect(remote.state.history).toEqual(history);
 await page.reload();await expect(page.getByRole('listitem',{name:'Legacy dinner',exact:true})).toHaveCount(0);
});


test('discarding a stale Home card never silently discards a newer-device plan',async({page,context})=>{
 const remote=server(),active=structuredClone(remote.state.active),history=structuredClone(remote.state.history);
 await remote.attach(context);await signIn(page);await createPlan(page,'Original dinner');
 const old=[...remote.plans.values()][0],newer={...old,revision:old.revision+1,meal:{...old.meal,name:'Changed on another device'}};remote.plans.set(old.id,newer);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('listitem',{name:'Original dinner',exact:true}).getByRole('button',{name:'Discard plan',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:/Could not save or load this plan|changed on another device/i})).toBeVisible();
 await expect(page.getByRole('listitem',{name:'Changed on another device',exact:true})).toBeVisible();
 expect(remote.plans.get(old.id)).toEqual(newer);expect(remote.discardRequests).toEqual([]);
 expect(remote.state.active).toEqual(active);expect(remote.state.history).toEqual(history);
});


test('fresh Home leads with Plan a cook and an empty planner keeps discard inside the serving card',async({page,context},info)=>{
 const remote=server();remote.state.active=null;await remote.attach(context);await signIn(page);
 await expect(page.getByRole('button',{name:'Plan a cook',exact:true})).toBeInViewport();
 await expect(page.getByRole('button',{name:'Plan a cook',exact:true})).toHaveClass(/primary/);
 await expect(page.getByRole('region',{name:'Upcoming cooks',exact:true})).toHaveCount(0);
 await expect(page.getByText('Your saved future meals will appear here.',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Plan another cook',exact:true})).toHaveCount(0);
 await page.screenshot({path:info.outputPath('fresh-home-plan-a-cook.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});
 await page.getByRole('button',{name:'Plan a cook',exact:true}).click();
 const serving=page.getByRole('region',{name:'Serving plan',exact:true}),trash=serving.getByRole('button',{name:'Discard plan',exact:true});
 await expect(trash.locator('[data-icon="trash"]')).toBeVisible();await expect(trash).toHaveText('');
 const box=await trash.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);
 await page.screenshot({path:info.outputPath('empty-planner-trash.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});
 await trash.click();await expect(page.getByRole('region',{name:'Home',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Upcoming cooks',exact:true})).toHaveCount(0);
 expect(remote.plans.size).toBe(0);expect(remote.discarded.size).toBe(0);
});


async function seedPending(page:Page,meal:ExtendedMeal,base:SavedPlan|null,operation=false){
 const key=savedPlanCacheKey(user.id,meal.id),indexKey=pendingPlansKey(user.id);
 const draft={id:meal.id,revision:0,...planDocument(meal),timeZone:'UTC',createdAt:now,updatedAt:now,writeId:null,pending:true,sourceRevision:base?.revision??0,needsRecovery:true};
 const cache={version:1,owner:user.id,planId:meal.id,base,desired:meal,desiredServeInstant:draft.serveInstant,desiredTimeZone:'UTC',operation:operation?{id:crypto.randomUUID(),revision:base?.revision??0,document:planDocument(meal),timeZone:'UTC',snapshot:meal}:null};
 await page.evaluate(async({key,indexKey,draft,cache,owner})=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('how-many-beers-accounts-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspaces');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('workspaces','readwrite'),s=tx.objectStore('workspaces');s.put(JSON.stringify(cache),key);s.put(JSON.stringify({version:1,owner,plans:[draft]}),indexKey);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
 },{key,indexKey,draft,cache,owner:user.id});
}
test('orphaned Next cook recovery can be discarded after reload when no remote upcoming plan exists',async({page,context},info)=>{
 const remote=server(),active=structuredClone(remote.state.active),history=structuredClone(remote.state.history);await remote.attach(context);await signIn(page);
 const meal=migrateMeal({...newMeal(),name:'Next cook',serveAt:'2026-11-15T18:00'}),base:SavedPlan={id:meal.id,revision:1,...planDocument(meal),timeZone:'UTC',createdAt:now,updatedAt:now,writeId:null};remote.discarded.set(meal.id,base);await seedPending(page,meal,base);await page.reload();
 const card=page.getByRole('listitem',{name:'Next cook',exact:true});await expect(card).toBeVisible();await expect(card.getByRole('button',{name:'Start cooking',exact:true})).toHaveCount(0);await expect(page.locator('.account-save-indicator')).toHaveAttribute('data-state',/unsaved|conflict/);expect(remote.plans.size).toBe(0);
 await card.getByRole('button',{name:'Discard plan',exact:true}).click();await expect(card).toHaveCount(0);await expect(page.locator('.account-save-indicator')).toHaveAttribute('data-state','saved');expect(remote.saveRequests).toEqual([]);expect(remote.discardRequests).toEqual([]);expect(remote.state.active).toEqual(active);expect(remote.state.history).toEqual(history);
 await page.reload();await expect(card).toHaveCount(0);await expect(page.locator('.account-save-indicator')).toHaveAttribute('data-state','saved');expect(remote.plans.size).toBe(0);expect(remote.discarded.size).toBe(1);await page.screenshot({path:info.outputPath('orphan-discard-reconciled.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});
});


test('a new planner stays tab-local through serving edits and recipe review until first Add to meal',async({page,context},info)=>{
 const remote=server(),active=structuredClone(remote.state.active),history=structuredClone(remote.state.history);await remote.attach(context);await signIn(page);await page.getByRole('button',{name:'Plan a cook',exact:true}).click();await expect(page.getByRole('region',{name:'Serving plan',exact:true})).toBeVisible();await page.getByLabel('Serve date and time',{exact:true}).fill('2026-11-15T18:00');await page.getByLabel('Meal name',{exact:true}).fill('Sunday wings');await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();await expect(page.getByRole('region',{name:'Review your method',exact:true})).toBeVisible();expect(remote.saveRequests).toEqual([]);expect(remote.plans.size).toBe(0);await expect(page.locator('.account-save-indicator')).toHaveAttribute('data-state','draft');await page.reload();await expect(page.getByRole('region',{name:'Review your method',exact:true})).toBeVisible();await page.getByRole('button',{name:'Back to choices',exact:true}).click();await expect(page.getByLabel('Meal name',{exact:true})).toHaveValue('Sunday wings');await expect(page.getByLabel('Serve date and time',{exact:true})).toHaveValue('2026-11-15T18:00');expect(remote.saveRequests).toEqual([]);await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();
 await expect(page.getByRole('region',{name:'Review your method',exact:true})).toBeVisible();await page.getByRole('button',{name:'Add to meal',exact:true}).click();await expect.poll(()=>remote.plans.size).toBe(1);await expect(page.locator('.account-save-indicator')).toHaveAttribute('data-state','saved');const plan=[...remote.plans.values()][0];expect(plan.meal.name).toBe('Sunday wings');expect(plan.meal.dishes).toHaveLength(1);expect(plan.meal.serveAt).toBe('2026-11-15T18:00');expect(remote.state.active).toEqual(active);expect(remote.state.history).toEqual(history);await page.getByRole('button',{name:'Save plan for later',exact:true}).click();await expect(page.getByRole('listitem',{name:'Sunday wings',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('listitem',{name:'Sunday wings',exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('first-dish-committed.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});
});


for(const operation of [false,true])test(`local-only pending recovery can be explicitly discarded without a save (operation ${operation})`,async({page,context})=>{
 const remote=server();await remote.attach(context);await signIn(page);const meal=migrateMeal({...newMeal(),serveAt:'2026-11-15T18:00'});await seedPending(page,meal,null,operation);if(operation)remote.discarded.set(meal.id,{id:meal.id,revision:1,...planDocument(meal),timeZone:'UTC',createdAt:now,updatedAt:now,writeId:null});await page.reload();const card=page.getByRole('listitem',{name:'Next cook',exact:true});await expect(card).toBeVisible();await card.getByRole('button',{name:'Discard plan',exact:true}).click();await expect(card).toHaveCount(0);await expect(page.locator('.account-save-indicator')).toHaveAttribute('data-state','saved');expect(remote.saveRequests).toEqual([]);expect(remote.discardRequests).toEqual([]);await page.reload();await expect(card).toHaveCount(0);expect(remote.plans.size).toBe(0);
});
test('a failed initial plan save retains the dish and explicit discard can be canceled or confirmed without saving first',async({page,context})=>{
 const remote=server(),active=structuredClone(remote.state.active),history=structuredClone(remote.state.history);await remote.attach(context);await signIn(page);remote.failSaving(true);await page.getByRole('button',{name:'Plan a cook',exact:true}).click();await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();await expect(page.getByRole('region',{name:'Review your method',exact:true}).getByRole('alert')).toBeVisible();expect(remote.plans.size).toBe(0);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Home',exact:true}).click();const card=page.getByRole('listitem',{name:'Next cook',exact:true});await expect(card).toBeVisible();page.once('dialog',d=>d.dismiss());await card.getByRole('button',{name:'Discard plan',exact:true}).click();await expect(card).toBeVisible();page.once('dialog',d=>d.accept());await card.getByRole('button',{name:'Discard plan',exact:true}).click();await expect(card).toHaveCount(0);await expect(page.locator('.account-save-indicator')).toHaveAttribute('data-state','saved');expect(remote.plans.size).toBe(0);expect(remote.discardRequests).toEqual([]);expect(remote.state.active).toEqual(active);expect(remote.state.history).toEqual(history);await page.reload();await expect(card).toHaveCount(0);
});
test('another tab cannot discard a locked saved plan and can retry after the writer closes',async({page,context})=>{
 const remote=server();await remote.attach(context);await signIn(page);await createPlan(page,'Tab-protected plan');const before=structuredClone([...remote.plans.values()][0]);const other=await context.newPage();await backend(other);await other.goto('/');const card=other.getByRole('listitem',{name:'Tab-protected plan',exact:true});await expect(other.getByRole('region',{name:'Account cook recovery',exact:true})).toContainText('This cook is open in another tab.');await expect(other.getByRole('button',{name:'Discard plan',exact:true})).toHaveCount(0);expect(remote.discardRequests).toEqual([]);expect([...remote.plans.values()][0]).toEqual(before);await page.close();await other.reload();page=other;await expect(card.getByRole('button',{name:'Discard plan',exact:true})).toBeEnabled();other.once('dialog',d=>d.accept());await card.getByRole('button',{name:'Discard plan',exact:true}).click();await expect(card).toHaveCount(0);expect(remote.discarded.get(before.id)).toEqual(before);
});
test('a pre-dish private draft survives sign-out but is isolated from a different signed-in owner',async({page,context})=>{
 const remote=server();await remote.attach(context);await signIn(page);await page.getByRole('button',{name:'Plan a cook',exact:true}).click();await page.getByLabel('Meal name',{exact:true}).fill('Private first-owner draft');await page.getByRole('button',{name:'Account',exact:true}).click();await page.getByRole('button',{name:'Sign out on this device',exact:true}).click();await expect(page.getByRole('dialog',{name:'Your account',exact:true})).toHaveCount(0);const other={...user,id:'00000000-0000-4000-8000-000000000002',email:'second@example.test'};
 await context.route(rpc+'**',route=>{if(route.request().postDataJSON().expected_owner!==other.id)return route.fallback();const name=route.request().url().slice(rpc.length);return route.fulfill({json:name==='list_saved_cook_plans'?{plans:[]}:name==='list_personal_recipes'?{recipes:[]}:{revision:0,writeId:null,active:null,history:[],capabilities:{cancelCook:true,savedPlans:true}}});});
 await signIn(page,other);await expect(page.getByText('Private first-owner draft',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Plan a cook',exact:true}).click();await expect(page.getByLabel('Meal name',{exact:true})).toHaveValue('Next cook');await page.getByRole('button',{name:'Account',exact:true}).click();await page.getByRole('button',{name:'Sign out on this device',exact:true}).click();await expect(page.getByRole('dialog',{name:'Your account',exact:true})).toHaveCount(0);await signIn(page);await expect(page.getByLabel('Meal name',{exact:true})).toHaveValue('Private first-owner draft');expect(remote.plans.size).toBe(0);expect(remote.saveRequests).toEqual([]);
});


test('saving a personal recipe during a pre-dish review does not commit an upcoming meal',async({page,context})=>{
 const remote=server(),active=structuredClone(remote.state.active),history=structuredClone(remote.state.history),recipes=new Map<string,any>();await remote.attach(context);await context.route(rpc+'list_personal_recipes',route=>route.fulfill({json:{recipes:[...recipes.values()]}}));await context.route(rpc+'mutate_personal_recipe',route=>{const b=route.request().postDataJSON();expect(b.expected_owner).toBe(user.id);const row={id:b.target_recipe_id,state:'active',document:b.document,revision:1,createdAt:now,updatedAt:now,deletedAt:null};recipes.set(row.id,row);return route.fulfill({json:{...row,receipt:{operationId:b.write_id,recipeId:row.id,operation:'save'}}});});await signIn(page);await page.getByRole('button',{name:'Plan a cook',exact:true}).click();await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();const review=page.getByRole('region',{name:'Review your method',exact:true});await review.getByLabel('Recipe name',{exact:true}).fill('My recipe only');await review.getByRole('button',{name:'Save to My recipes',exact:true}).click();await expect(review.getByText('Saved recipe',{exact:true})).toBeVisible();expect(recipes.size).toBe(1);expect(remote.plans.size).toBe(0);expect(remote.saveRequests).toEqual([]);expect(remote.state.active).toEqual(active);expect(remote.state.history).toEqual(history);await review.getByRole('button',{name:'Back to choices',exact:true}).click();await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('button',{name:'Home',exact:true}).click();await expect(page.getByRole('region',{name:'Upcoming cooks',exact:true})).toHaveCount(0);await page.reload();await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('button',{name:'My recipes',exact:true}).click();await expect(page.getByRole('button',{name:'Edit My recipe only',exact:true})).toBeVisible();expect(remote.plans.size).toBe(0);
});
test('delayed account loading keeps the normal brand and real loading placeholders before showing cooks',async({page,context},info)=>{
 const remote=server();await remote.attach(context);await signIn(page);let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});await context.route(rpc+'load_cook_workspace',async route=>{await gate;return route.fulfill({json:remote.state});});
 try{await page.reload();await expect(page.getByRole('region',{name:'Loading cook',exact:true})).toBeVisible();await expect(page.locator('.account-save-indicator')).toHaveAttribute('data-state','loading');await expect(page.locator('.site-header .brand-icon img')).toBeVisible();await expect(page.getByText('From First Beer to First Bite.',{exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('stable-account-loading.png'),fullPage:true,scale:'css',style:'nextjs-portal{display:none}'});release();await expect(page.getByRole('region',{name:'Home',exact:true})).toBeVisible();}finally{release();}
});


test('an older genuinely saved empty plan still discards through its versioned server record',async({page,context})=>{
 const remote=server(),meal=migrateMeal({...newMeal(),serveAt:'2026-11-15T18:00'}),saved:SavedPlan={id:meal.id,revision:1,...planDocument(meal),timeZone:'UTC',createdAt:now,updatedAt:now,writeId:null},active=structuredClone(remote.state.active),history=structuredClone(remote.state.history);remote.plans.set(saved.id,saved);await remote.attach(context);await signIn(page);const card=page.getByRole('listitem',{name:'Next cook',exact:true});await expect(card).toBeVisible();await card.getByRole('button',{name:'Discard plan',exact:true}).click();await expect(card).toHaveCount(0);expect(remote.discardRequests).toHaveLength(1);expect(remote.saveRequests).toEqual([]);expect(remote.discarded.get(saved.id)).toEqual(saved);expect(remote.state.active).toEqual(active);expect(remote.state.history).toEqual(history);await page.reload();await expect(card).toHaveCount(0);
});


test('discarding stale recovery with a promoted active cook ID preserves every physical event',async({page,context})=>{
 const remote=server(),active=structuredClone(remote.state.active),history=structuredClone(remote.state.history);await remote.attach(context);await signIn(page);const meal=migrateMeal({...newMeal(),id:active!.meal.id,serveAt:'2026-11-15T18:00'}),base:SavedPlan={id:meal.id,revision:1,...planDocument(meal),timeZone:'UTC',createdAt:now,updatedAt:now,writeId:null};await seedPending(page,meal,base);await page.reload();const card=page.getByRole('listitem',{name:'Next cook',exact:true});await expect(card).toBeVisible();await card.getByRole('button',{name:'Discard plan',exact:true}).click();await expect(card).toHaveCount(0);await expect(page.locator('.account-save-indicator')).toHaveAttribute('data-state','saved');expect(remote.state.active).toEqual(active);expect(remote.state.history).toEqual(history);expect(remote.saveRequests).toEqual([]);expect(remote.discardRequests).toEqual([]);await page.reload();await expect(card).toHaveCount(0);await page.getByRole('button',{name:'Continue cooking',exact:true}).click();await expect(page.getByText('5 of 8 steps done',{exact:true})).toBeVisible();expect(remote.state.active).toEqual(active);
});
