'use client';
import {useEffect,useState} from 'react';
import type {Meal,PlannedTask} from '@/domain/meal';
import {cookDuration} from '@/domain/cookDuration';
import {cookProjection,type CookProjection} from '@/domain/cookProjection';
const duration=(n:number)=>{const minutes=Math.max(0,Math.round(n));return `${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,'0')}m`;};
export default function Beerometer({meal,timeline,finishedAt,projection}:{meal:Meal;timeline:PlannedTask[];finishedAt?:string;projection?:CookProjection|null}){
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{if(meal.mode!=='cooking'||finishedAt)return;const timer=setInterval(()=>setNow(Date.now()),30000);return ()=>clearInterval(timer);},[meal.mode,finishedAt]);
  const running=meal.mode==='cooking'||!!meal.startedAt;
  const live=running&&!finishedAt?(projection??cookProjection(meal,timeline,now)):null;
  // History uses the frozen actual duration; it is not zero remaining work.
  // While cooking, the same projection supplies every displayed time/quantity.
  const result=live?{minutes:live.remaining,label:live.reason}:cookDuration(meal,timeline,now,finishedAt);
  // A fixed future smoker start can still yield a provisional nominal ETA
  // even when unfinished conditions make the conservative serving bound open-ended.
  const tentative=live?.provisionalTiming??null;
  const lowerBound=!!live&&live.remaining===null&&live.minimumRemaining!==undefined&&!tentative;
  const minutes=tentative?Math.max(0,(Date.parse(tentative.readyAfterRest)-now)/60000):lowerBound?live!.minimumRemaining!:result.minutes;
  const finish=tentative?.readyAfterRest??live?.finish??live?.earliestFinish;
  const difference=finish&&Number.isFinite(Date.parse(meal.serveAt))?Math.max(0,Math.round((Date.parse(finish)-Date.parse(meal.serveAt))/60000)):0;
  const hasImportedSteps=timeline.some(t=>t.recipeOrder!==undefined&&!t.id.endsWith(':serve'));
  const hasAnchor=Number.isFinite(Date.parse(meal.serveAt))||timeline.some(t=>t.timingMode==='fixed'&&t.scheduledAt);
  const planningHint=hasImportedSteps?(hasAnchor?'Add missing estimated durations on your recipe steps.':'Set serving time or a fixed start; add step durations.'):result.label.includes('Partial')?'Set serving time or a fixed start; confirm missing durations.':'Set a cook start and finish time.';
  return <section className={'beerometer'+(live?' beerometer-live':'')} aria-label="Cook duration in beers">
    <div className="beerometer-main">
      <div className="beerometer-emblem" aria-hidden="true"><img src={`${process.env.NEXT_PUBLIC_BASE_PATH??''}/brand/badge-mark.svg`} width="256" height="256" alt=""/></div>
      <div className="beerometer-copy"><p className="eyebrow">THE BEEROMETER</p><h2>How many beers?</h2>
        {!live&&<p>{finishedAt?'Your completed whole cook.':timeline.length?'The whole cook, from preparation to serving.':'Add a dish to fire up the Beerometer.'}</p>}
      </div>
    </div>
    <div className="beerometer-reading"><div className="beerometer-figure"><strong>{minutes===null?'—':(tentative?'~':'')+(minutes/90).toFixed(1)+(lowerBound?'+':'')}</strong><span>{live?'beers remaining':'beers'}</span></div>
      <p className="beerometer-clock">{minutes===null?(live?result.label:planningHint):tentative?`${duration(minutes)} · Provisional estimate`:`${duration(minutes)}${lowerBound?'+':''} · ${lowerBound?'Known remaining':result.label}`}</p>
    </div>
    {live&&<div className="beerometer-serving"><span>{tentative?'Est. ready after rest/hold':lowerBound?'Earliest serving':'Estimated serving'}</span><span className="beerometer-serving-value">{finish?<><time aria-label="Cook estimated finish" dateTime={finish}>{new Date(finish).toLocaleString([],new Date(finish).toDateString()===new Date(now).toDateString()?{hour:'numeric',minute:'2-digit'}:{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}{lowerBound?'+':''}</time>{difference>0&&<small className="beerometer-difference">(+{difference} min{lowerBound?' or more':''})</small>}</>:<span>Estimate unavailable</span>}</span></div>}
    {tentative&&<p className="beerometer-provisional-note">Est. off smoker <time aria-label="Estimated off smoker" dateTime={tentative.offSmoker}>{new Date(tentative.offSmoker).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</time> · Based on {tentative.basedOn==='planned'?'your planned load time':'your recorded load time'} and estimated cooking/rest time. Check tenderness; target serving time is unchanged.</p>}
  </section>;
}
