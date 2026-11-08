import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {backend,user} from './fixtures';
import {newMeal,createDish} from '../../src/domain/meal';
import {parseRecipeText} from '../../src/domain/recipe';
import {cookTimeline,recordEvent,migrateMeal,type ExtendedMeal} from '../../src/domain/cookState';
import {archiveCook,emptyHistory} from '../../src/domain/cookHistory';
import type {SavedPlan} from '../../src/account/savedPlans';
const now='2026-11-05T12:00:00Z',rpc='https://auth.example.test/rest/v1/rpc/';
test.use({timezoneId:'UTC'});
function server(legacy=false){
 const dish=parseRecipeText('Pumpkin seeds','Preheat (10 minutes)\nClean (5 minutes)\nDry (10 minutes)\nSeason (2 minutes)\nCoat (2 minutes)\nRoast (15 minutes)\nCool (10 minutes)');
 let original:ExtendedMeal=migrateMeal({...newMeal(),name:legacy?'Legacy dinner':'Pumpkin Seeds',serveAt:'2026-11-05T13:00',dishes:[dish],...(!legacy?{mode:'cooking' as const,startedAt:now}:{})});if(!legacy)for(const task of cookTimeline(original).slice(0,5))original=recordEvent(original,task.id,'completed',now);
 const state={revision:1,writeId:null as string|null,active:{meal:original,serveInstant:new Date(original.serveAt).toISOString()} as {meal:ExtendedMeal;serveInstant:string}|null,history:archiveCook({...newMeal(),name:'Saved dinner',dishes:[createDish('side')]},emptyHistory(),'Keep saved history','2026-11-03T18:00Z').cooks.map(c=>({...c,serveInstant:c.meal.serveAt})),capabilities:{cancelCook:true,savedPlans:true}};
 const plans=new Map<string,SavedPlan>(),receipts=new Map<string,unknown>(),promotionRequests:string[]=[];let failSave=false,losePromotion=false;
 return {state,original,plans,promotionRequests,failSaving:(v:boolean)=>{failSave=v;},loseNextPromotion:()=>{losePromotion=true;},attach:async(context:BrowserContext)=>context.route(rpc+'**',async route=>{
  const b=route.request().postDataJSON(),name=route.request().url().slice(rpc.length);if(b.expected_owner!==user.id)return route.fulfill({status:403,json:{code:'42501'}});
  const conflict=()=>route.fulfill({status:409,json:{code:'40001',message:'Changed on another device'}});
  if(name==='list_saved_cook_plans')return route.fulfill({json:{plans:[...plans.values()]}});
  if(name==='read_saved_cook_plan')return route.fulfill({json:plans.get(b.target_plan_id)??null});
  if(name==='save_saved_cook_plan'){
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
async function signIn(page:Page){await backend(page);await page.goto('/');await page.getByRole('button',{name:'Sign in',exact:true}).click();const d=page.getByRole('dialog',{name:'Your account'});await d.getByLabel('Email address').fill(user.email);await d.getByRole('button',{name:'Send sign-in code',exact:true}).click();await d.getByLabel('Email code').fill('123456');await d.getByRole('button',{name:'Verify code',exact:true}).click();await expect(d.getByText('Signed in as '+user.email,{exact:true})).toBeVisible();await d.getByRole('button',{name:'Close account',exact:true}).click();}
async function createPlan(page:Page,name:string,serveAt?:string){
 await page.getByRole('button',{name:'Plan another cook',exact:true}).click();
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
 await page.getByLabel('Meal name',{exact:true}).fill(name);
 await expect(page.getByLabel('Meal name',{exact:true})).toHaveValue(name);
 await named;
 if(serveAt)await page.getByLabel('Serve date and time',{exact:true}).fill(serveAt);
 await page.getByRole('button',{name:'Save plan for later',exact:true}).click();
 await expect(page.getByRole('region',{name:'Upcoming cooks'}).getByRole('listitem',{name,exact:true})).toBeVisible();
}
test('future plans stay independent from an active 5-of-8 cook and reload on another device',async({page,context,browser},info)=>{
 const remote=server(),before=structuredClone(remote.state.active),history=structuredClone(remote.state.history);await remote.attach(context);await signIn(page);
 await createPlan(page,'Sunday Brats');await createPlan(page,'Next Friday','2026-11-06T18:00');expect(remote.plans.size).toBe(2);expect(remote.state.active).toEqual(before);expect(remote.state.history).toEqual(history);
 const upcoming=page.getByRole('region',{name:'Upcoming cooks'});await upcoming.getByRole('listitem',{name:'Sunday Brats',exact:true}).getByRole('button',{name:'Edit plan',exact:true}).click();await page.getByLabel('Meal name',{exact:true}).fill('Sunday Family Brats');await page.getByLabel('Serve date and time',{exact:true}).fill('2026-11-08T18:00');await expect(page.getByRole('button',{name:'Start cooking',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Continue current cook',exact:true})).toBeVisible();await page.getByRole('button',{name:'Save plan for later',exact:true}).click();
 await expect(upcoming.getByRole('heading',{level:4})).toHaveText(['Next Friday','Sunday Family Brats']);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
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
 const remote=server(),before=structuredClone(remote.state.active);await remote.attach(context);await signIn(page);await page.getByRole('button',{name:'Plan another cook',exact:true}).click();await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();await page.getByRole('button',{name:'Add to meal',exact:true}).click();await expect.poll(()=>remote.plans.size).toBe(1);remote.failSaving(true);await expect(page.getByLabel('Meal name',{exact:true})).toBeVisible();await page.getByLabel('Meal name',{exact:true}).fill('Keep this plan');await expect(page.locator('.account-save-indicator')).not.toHaveAttribute('data-state','saved');expect(remote.plans.size).toBe(1);expect(remote.state.active).toEqual(before);
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
 const remote=server(),before=structuredClone(remote.state.active);await remote.attach(context);await signIn(page);await createPlan(page,'Sunday Brats');const loaded=page.waitForResponse(r=>r.url().endsWith('read_saved_cook_plan'));await page.getByRole('listitem',{name:'Sunday Brats',exact:true}).getByRole('button',{name:'Edit plan',exact:true}).click();await loaded;await expect(page.locator('.cook-content')).not.toHaveAttribute('inert');const plan=[...remote.plans.values()][0];plan.revision++;plan.meal.name='Newer device plan';await page.getByLabel('Meal name',{exact:true}).fill('Protected local draft');await expect(page.locator('.account-save-indicator')).toHaveAttribute('data-state','conflict');
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
 const remote=server(),before=structuredClone(remote.state.active),history=structuredClone(remote.state.history);await remote.attach(context);await signIn(page);await page.goto('/');await page.getByRole('button',{name:'Plan another cook',exact:true}).click();await expect(page.getByLabel('Serve date and time')).toBeVisible();await page.getByLabel('Serve date and time').fill('2026-12-06T18:45');await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();const review=page.getByRole('region',{name:'Review your method',exact:true});await review.getByLabel('Recipe name',{exact:true}).fill('My future brats');expect(remote.state.active).toEqual(before);await review.getByRole('button',{name:'Add to meal',exact:true}).click();await expect(page.getByRole('button',{name:'Start cooking',exact:true})).toBeDisabled();await page.getByLabel('Meal name',{exact:true}).fill('Future recipe-first dinner');await page.getByRole('button',{name:'Save plan for later',exact:true}).click();await expect(page.getByRole('listitem',{name:'Future recipe-first dinner',exact:true})).toBeVisible();await page.getByRole('button',{name:/Continue cooking/}).click();await expect(page.getByText('5 of 8 steps done',{exact:true})).toBeVisible();expect(remote.state.active).toEqual(before);expect(remote.state.history).toEqual(history);expect([...remote.plans.values()][0].meal.dishes[0].name).toBe('My future brats');expect([...remote.plans.values()][0].meal.serveAt).toBe('2026-12-06T18:45');await page.screenshot({path:info.outputPath('recipe-first-current-preserved.png'),fullPage:false,scale:'css',style:'nextjs-portal{display:none}'});
});

test('recipe-first Cook again keeps the entire previous meal independent from active work',async({page,context})=>{
 const remote=server(),before=structuredClone(remote.state.active);const past={...newMeal(),name:'Brats and beans',dishes:[createDish('brats'),createDish('side')]};remote.state.history=archiveCook(past,emptyHistory(),'Keep this whole meal','2026-11-03T18:00Z').cooks.map(c=>({...c,serveInstant:c.meal.serveAt}));const history=structuredClone(remote.state.history);await remote.attach(context);await signIn(page);await page.goto('/');await page.getByRole('button',{name:/Past cooks/}).click();await page.getByRole('button',{name:'Cook again',exact:true}).click();await expect(page.getByRole('heading',{name:'2 dishes in this cook'})).toBeVisible();await expect(page.getByRole('region',{name:'Review your method',exact:true})).toHaveCount(0);expect(remote.state.active).toEqual(before);expect(remote.state.history).toEqual(history);await expect.poll(()=>[...remote.plans.values()][0]?.meal.dishes.length).toBe(2);expect([...remote.plans.values()][0].meal.completed).toEqual({});
});

test('recipe-first review retains edits across a failed add and resubmits without duplicate dishes',async({page,context})=>{
 const remote=server(),before=structuredClone(remote.state.active);await remote.attach(context);await signIn(page);await page.goto('/');await page.getByRole('button',{name:'Plan another cook',exact:true}).click();await page.getByRole('button',{name:'Choose a template',exact:true}).click();await page.getByRole('button',{name:'Add grilled beer-bath brats',exact:true}).click();const review=page.getByRole('region',{name:'Review your method',exact:true});remote.failSaving(true);await review.getByRole('button',{name:'Add to meal',exact:true}).click();await expect(review.getByRole('alert')).toContainText('Your edits are still here');await review.getByLabel('Recipe name',{exact:true}).fill('Latest edited brats');remote.failSaving(false);await review.getByRole('button',{name:'Add to meal',exact:true}).click();await expect(review).toHaveCount(0);expect([...remote.plans.values()][0].meal.dishes).toHaveLength(1);expect([...remote.plans.values()][0].meal.dishes[0].name).toBe('Latest edited brats');expect(remote.state.active).toEqual(before);
});
