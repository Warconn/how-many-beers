import {describe,it,expect} from 'vitest';
import {homeNextAction} from '../src/domain/homeNextAction';
import {cookTimeline,recordEvent} from '../src/domain/cookState';
import {cookProjection,type CookProjection} from '../src/domain/cookProjection';
import {guidedCookingSteps} from '../src/domain/cookingFocus';
import {homeActiveCook} from './fixtures/homeActiveCook';
import type {PlannedTask} from '../src/domain/meal';
const now=Date.parse('2026-11-22T12:00:00Z'),iso=(n:number)=>new Date(n).toISOString();
const fixture=()=>{const f=homeActiveCook();return {...f,tasks:cookTimeline(f.meal).filter(t=>[f.first,f.second].includes(t.id))};};
function projection(tasks:PlannedTask[]):CookProjection{return {forecasts:Object.fromEntries(tasks.map(t=>[t.id,{start:t.scheduledAt,finish:t.scheduledAt,status:'fixed'}])),finish:null,remaining:60,projected:120,elapsed:60,provisional:false,reason:''};}
function action(...args:Parameters<typeof homeNextAction>){const result=homeNextAction(...args);expect(result?.kind).toBe('action');if(result?.kind!=='action')throw Error('Expected an action');return result;}
describe('read-only Home next action',()=>{
 it.each([[60001,'In 2 min'],[60000,'In 1 min'],[1,'In 1 min'],[0,'Now'],[-59999,'Now'],[-60000,'1 min overdue'],[-120000,'2 min overdue']] as const)('formats the exact %sms boundary', (delta,cue)=>{
  const {meal,tasks}=fixture(),task={...tasks[0],scheduledAt:iso(now+delta)},p=projection([task]);
  expect(action(meal,[task],p,now)).toMatchObject({cue,at:task.scheduledAt,timeLabel:'Planned start'});
 });
 it('matches canonical guidance, excludes completion and restores a reopened action',()=>{
  const {meal,tasks,first,second}=fixture(),p=projection(tasks);
  expect(action(meal,tasks,p,now).task.id).toBe(guidedCookingSteps(tasks,meal.completed).current?.id);
  const completed={...meal,completed:{[first]:iso(now)}};
  expect(action(completed,tasks,p,now).task.id).toBe(second);
  const reopened=recordEvent(completed,first,'reopened',iso(now+1000));
  expect(action(reopened,tasks,p,now).task.id).toBe(first);expect(reopened.events?.at(-1)?.kind).toBe('reopened');
 });
 it('keeps simultaneous dishes at the same canonical time without serializing the second action',()=>{
  const {meal,tasks,first,second}=fixture(),p=projection(tasks),a=action(meal,tasks,p,now),b=action({...meal,completed:{[first]:iso(now)}},tasks,p,now);
  expect(a.task.id).toBe(first);expect(b.task.id).toBe(second);expect(b.at).toBe(a.at);expect(p.forecasts[second].start).toBe(tasks[1].scheduledAt);
 });
 it('uses supported live priority and labels an estimated time separately from the original plan',()=>{
  const {meal,tasks,second}=fixture(),planned=tasks.map(t=>t.scheduledAt),flexible=tasks.map(t=>({...t,timingMode:'plan' as const})),p=projection(flexible);
  p.forecasts[tasks[0].id]={start:iso(now+5*60000),finish:null,status:'estimated'};p.forecasts[second]={start:iso(now+2*60000),finish:null,status:'estimated'};
  const active={...meal,phasePlan:{version:1 as const,phases:[],actions:{},order:{},suppressed:[]}},next=action(active,flexible,p,now);
  expect(next.task.id).toBe(second);expect(next.at).toBe(iso(now+2*60000));expect(next.timeLabel).toBe('Estimated start');expect(flexible.map(t=>t.scheduledAt)).toEqual(planned);
 });
 it('shows an observable condition even when an estimated checkpoint clock exists',()=>{
  const {meal,tasks}=fixture(),task={...tasks[0],isCondition:true,instructions:'When bark is ready, wrap.'},p=projection([task]);p.forecasts[task.id].template={kind:'checkpoint',basis:'estimated',at:task.scheduledAt};
  const next=action(meal,[task],p,now);expect(next.cue).toBe('When bark is ready, wrap.');expect(next.at).toBeUndefined();
 });
 it('handles untimed, missing and uncertain projections without fabricated precision',()=>{
  const {meal,tasks}=fixture(),p=projection(tasks),untimed={...tasks[0],scheduledAt:null,timingMode:'unscheduled' as const};
  expect(action(meal,[untimed],p,now)).toMatchObject({cue:'Time not set.'});expect(action(meal,tasks,null,now).at).toBeUndefined();
  p.forecasts={};expect(action(meal,tasks,p,now)).toMatchObject({cue:'Timing needs review.'});
  p.forecasts[tasks[0].id]={start:iso(now),finish:null,status:'unknown',lowerBound:true};expect(action(meal,tasks,p,now).at).toBeUndefined();
 });
 it('skips an already running start while keeping checkpoints inside that phase actionable',()=>{
  const {meal,tasks,first,second}=fixture(),p=projection(tasks),active={...meal,phasePlan:{version:1 as const,phases:[],actions:{[first]:{starts:['heat']}},order:{},suppressed:[]}};
  p.forecasts[first].physicalActive=true;expect(action(active,tasks,p,now).task.id).toBe(second);
  active.phasePlan.actions[first]={starts:[]};p.forecasts[first].template={kind:'checkpoint',basis:'estimated',at:tasks[0].scheduledAt};expect(action(active,tasks,p,now).task.id).toBe(first);
 });
 it('labels blocked work for review and keeps passive waiting quiet',()=>{
  const {meal,tasks,first,second}=fixture(),p=projection(tasks);p.forecasts[first].status='blocked';expect(action(meal,tasks,p,now)).toMatchObject({task:tasks[0],cue:'Timing needs review.'});expect(action(meal,tasks,p,now).at).toBeUndefined();
  const checked={...meal,completed:{[first]:iso(now),[second]:iso(now)}};
  expect(homeNextAction(checked,tasks,p,now)).toEqual({kind:'waiting',cue:'Cooking or holding in progress.'});p.remaining=0;expect(homeNextAction(checked,tasks,p,now)).toEqual({kind:'checked',cue:'All steps checked.'});
 });
 it('does not appear for inactive/no cook or change canonical inputs on resume/clock ticks',()=>{
  const {meal,tasks}=fixture(),p=cookProjection(meal,cookTimeline(meal),now),before=JSON.stringify({meal,tasks,p});
  expect(homeNextAction(null,tasks,p,now)).toBeNull();expect(homeNextAction({...meal,mode:'planning',startedAt:undefined},tasks,p,now)).toBeNull();
  action(meal,tasks,p,now);homeNextAction(meal,tasks,p,now+2*60000);expect(JSON.stringify({meal,tasks,p})).toBe(before);
 });
});

it('retains real canonical guidance after a fixed action is completed and reopened late',()=>{
 const {meal,first}=homeActiveCook(),done=recordEvent(meal,first,'completed',iso(now+120000)),reopened=recordEvent(done,first,'reopened',iso(now+120000)),tasks=cookTimeline(reopened),p=cookProjection(reopened,tasks,now+120000);
 const next=action(reopened,tasks,p,now+120000);expect(next.task.id).toBe(first);expect(next.cue).toBe('Timing needs review.');expect(next.at).toBeUndefined();
});

it('does not relabel an actual observation as a planned or estimated start',()=>{
 const {meal,tasks}=fixture(),p=projection(tasks);p.forecasts[tasks[0].id].template={kind:'activity',basis:'actual',at:tasks[0].scheduledAt};
 const next=action(meal,tasks,p,now);expect(next.cue).toBe('Review progress.');expect(next.at).toBeUndefined();expect(next.timeLabel).toBeUndefined();
});
