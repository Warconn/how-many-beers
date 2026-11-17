"use client";

import Icon from './Icon';
import Beerometer from './Beerometer';
import {useEffect,useRef,useState} from "react";
import type {ArchivedCook,HistoryLibrary} from "@/domain/cookHistory";
import {archivedActivity} from "@/domain/historyActivity";
import LibraryList,{LibraryItemHeading} from './LibraryList';
import {activityStatus,activityStages,phaseStage} from '@/domain/activities';
import {phaseObservations} from '@/domain/cookingPhases';

type Props = {
  history:HistoryLibrary;
  onRepeat:(entry:ArchivedCook)=>void;
  onDelete:(entry:ArchivedCook)=>void;
};

function fmt(date:string):string {
  const d=new Date(date);
  return Number.isFinite(d.getTime()) ? d.toLocaleString([], {month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}) : date;
}

export default function CookHistoryPanel({history,onRepeat,onDelete}:Props){
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<string|null>(null);
  const detailHeading=useRef<HTMLHeadingElement>(null);
  const detailBack=useRef<HTMLButtonElement>(null);
  const shown=history.cooks.filter(c=>(c.meal.name+" "+c.meal.dishes.map(d=>d.name).join(" ")).toLowerCase().includes(search.trim().toLowerCase()));
  const detailed=history.cooks.find(c=>c.id===selected);
  const events=detailed?.meal.events??[];
  const notes=Object.entries(detailed?.meal.notes??{}).filter(([,note])=>note.trim());
  useEffect(()=>{
    if(!detailed)return;
    detailHeading.current?.focus({preventScroll:true});
    detailBack.current?.scrollIntoView({block:"start",behavior:"instant"});
  },[detailed?.id]);
  return <section className="panel cook-history" id="cook-history">
    <div className="section-title">
      <span className="section-icon" aria-hidden="true"><Icon name="history"/></span>
      <div><p className="eyebrow">PAST SESSIONS</p><h2>Past cooks</h2></div>
    </div>
    {detailed ? <>
      <button type="button" className="back-link library-detail-back" ref={detailBack} onClick={()=>setSelected(null)}><Icon name="arrow-left"/>All past cooks</button>
      <section className="history-detail library-detail" aria-label="Saved cook details">
        <LibraryItemHeading title={<>
            <p className="eyebrow">COOK DETAILS</p>
            <h3 ref={detailHeading} tabIndex={-1}>{detailed.meal.name || "Saved cook"}</h3>
          </>} metadata={<>{fmt(detailed.archivedAt)} · {detailed.meal.dishes.map(d=>d.name).join(", ")||"General prep"}</>}
          count={detailed.plannedTimeline.length} remove={{label:'Delete '+(detailed.meal.name||'Saved cook'),onClick:()=>onDelete(detailed)}}/>
        <div className="history-actions library-detail-actions">
          <button type="button" className="button primary" onClick={()=>onRepeat(detailed)}>Cook again</button>
        </div>
        <Beerometer meal={detailed.meal} timeline={detailed.plannedTimeline} finishedAt={detailed.archivedAt}/>
        <p className="muted small">Planned serving: {fmt(detailed.meal.serveAt)}</p>
        {detailed.feedback&&<p className="muted small">{detailed.feedback}</p>}
        <h4>Original checklist</h4>
        <ol className="history-tasks">
          {detailed.plannedTimeline.map(step=><li key={step.id}>
            <strong>{step.title}</strong><span>{step.dishName}</span>
            {detailed.meal.phasePlan?.phases.filter(p=>p.startTaskId===step.id).map(p=>{
              const actual=phaseObservations(detailed.meal,p.id),stage=phaseStage(p);
              if(!actual.start||!stage)return null;
              return <small key={p.id}>{actual.end?activityStatus({...p,actualStart:actual.start.occurredAt,actualEnd:actual.end.occurredAt,elapsed:(Date.parse(actual.end.occurredAt)-Date.parse(actual.start.occurredAt))/60000}):activityStages[stage]+' · End not recorded'}</small>;
            })}
            {detailed.meal.completed[step.id]
              ? <small>Completed <time dateTime={detailed.meal.completed[step.id]}>{fmt(detailed.meal.completed[step.id])}</time></small>
              : step.scheduledAt&&<small>Planned <time dateTime={step.scheduledAt}>{fmt(step.scheduledAt)}</time></small>}
          </li>)}
        </ol>
        {(events.length>0||notes.length>0)&&<details className="history-recorded-activity">
        <summary>Recorded activity ({events.length+notes.length})</summary>
        <ol className="history-events">
          {events.map(event=>{
            const activity=archivedActivity(event,detailed.plannedTimeline);
            return <li key={event.id} data-event-id={event.id}>
              <div><strong>{activity.action}</strong><span className="history-event-context">{activity.context}</span>{event.note&&<p className="history-event-note">{event.note}</p>}</div>
              <time dateTime={event.occurredAt}>{fmt(event.occurredAt)}</time>
            </li>;
          })}
          {notes.map(([taskId,note])=>{
            const matches=detailed.plannedTimeline.filter(step=>step.id===taskId),step=matches.length===1?matches[0]:undefined;
            return <li key={'note:'+taskId} data-note-task-id={taskId}><div>
              <strong>Step note</strong><span className="history-event-context">{step?[step.dishName,step.title].filter(Boolean).join(' · '):'Archived step unavailable'}</span>
              <p className="history-event-note">{note}</p>
            </div></li>;
          })}
        </ol>
        </details>}
      </section>
    </> : <>
      <p className="muted small">Your finished cooks, notes and actual times.</p>
      {history.cooks.length===0
        ? <p className="history-empty">No saved cooks yet. Finish a cook to see it here.</p>
        : <>
            <label htmlFor="history-search">Find a past cook</label>
            <input id="history-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search dish or meal"/>
            <LibraryList label="Past cooks" emptyMessage="No matching cooks." items={shown.map(entry=>({
              id:entry.id,title:<strong>{entry.meal.name||'Saved cook'}</strong>,
              metadata:<>{fmt(entry.archivedAt)} · {entry.meal.dishes.map(d=>d.name).join(", ")||"General prep"}</>,
              count:entry.plannedTimeline.length,remove:{label:'Delete '+(entry.meal.name||'Saved cook'),onClick:()=>onDelete(entry)},
              actions:<>
                  <button type="button" className="button primary" onClick={()=>setSelected(entry.id)}>View cook</button>
                  <button type="button" className="button secondary" onClick={()=>onRepeat(entry)}>Cook again</button>
              </>
            }))}/>
          </>}
    </>}
  </section>;
}
