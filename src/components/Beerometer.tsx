'use client';
import {useEffect,useState} from 'react';
import type {Meal,PlannedTask} from '@/domain/meal';
import {cookDuration} from '@/domain/cookDuration';
const duration=(n:number)=>{const minutes=Math.max(0,Math.round(n));return `${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,'0')}m`;};
export default function Beerometer({meal,timeline,finishedAt}:{meal:Meal;timeline:PlannedTask[];finishedAt?:string}){
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{if(meal.mode!=='cooking'||finishedAt)return;const timer=setInterval(()=>setNow(Date.now()),30000);return ()=>clearInterval(timer);},[meal.mode,finishedAt]);
  const result=cookDuration(meal,timeline,now,finishedAt);
  return <section className="beerometer" aria-label="Cook duration in beers">
    <div className="beerometer-main">
      <div className="beerometer-emblem" aria-hidden="true"><img src={`${process.env.NEXT_PUBLIC_BASE_PATH??''}/brand/badge-mark.svg`} width="256" height="256" alt=""/></div>
      <div className="beerometer-copy"><p className="eyebrow">THE BEEROMETER</p><h2>How many beers?</h2>
        <p>{timeline.length?'The whole cook, from preparation to serving.':'Add a dish to fire up the Beerometer.'}</p>
      </div>
    </div>
    <div className="beerometer-reading"><div className="beerometer-figure"><strong>{result.minutes===null?'—':(result.minutes/90).toFixed(1)}</strong><span>beers</span></div>
      <p className="beerometer-clock">{result.minutes===null?'Set a cook start and finish time.':`${duration(result.minutes)} · ${result.label}`}</p>
      {result.elapsed!==null && <p className="small">{duration(result.elapsed)} elapsed</p>}
    </div>
  </section>;
}
