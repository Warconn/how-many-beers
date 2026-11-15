"use client";

import Icon from './Icon';
import Beerometer from './Beerometer';
import {useEffect,useRef,useState} from "react";
import type {ArchivedCook,HistoryLibrary} from "@/domain/cookHistory";
import type {CookEvent} from "@/domain/cookState";

type Props = {
  history:HistoryLibrary;
  onRepeat:(entry:ArchivedCook)=>void;
  onDelete:(entry:ArchivedCook)=>void;
};

function fmt(date:string):string {
  const d=new Date(date);
  return Number.isFinite(d.getTime()) ? d.toLocaleString([], {month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}) : date;
}

function eventDetail(e:CookEvent):string{
  const names={started:"Started",completed:"Completed",reopened:"Reopened",temperature:"Food temp",equipment:"Equipment change",removed:"Removed"};
  return names[e.kind]+(e.value===undefined?"":" "+e.value+(e.unit??""))+(e.note?" · "+e.note:"");
}

export default function CookHistoryPanel({history,onRepeat,onDelete}:Props){
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<string|null>(null);
  const detailHeading=useRef<HTMLHeadingElement>(null);
  const detailBack=useRef<HTMLButtonElement>(null);
  const shown=history.cooks.filter(c=>(c.meal.name+" "+c.meal.dishes.map(d=>d.name).join(" ")).toLowerCase().includes(search.trim().toLowerCase()));
  const detailed=history.cooks.find(c=>c.id===selected);
  const events=(detailed?.meal.events??[]).slice().sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt));
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
        <div className="between library-detail-heading">
          <div>
            <p className="eyebrow">COOK DETAILS</p>
            <h3 ref={detailHeading} tabIndex={-1}>{detailed.meal.name || "Saved cook"}</h3>
            <p className="muted small">{fmt(detailed.archivedAt)} · {detailed.meal.dishes.map(d=>d.name).join(", ")||"General prep"}</p>
          </div>
          <span className="history-count">{detailed.plannedTimeline.length} steps</span>
        </div>
        <div className="history-actions library-detail-actions">
          <button type="button" className="button primary" onClick={()=>onRepeat(detailed)}>Cook again</button>
          <button type="button" className="button history-delete" onClick={()=>onDelete(detailed)}>Delete</button>
        </div>
        <Beerometer meal={detailed.meal} timeline={detailed.plannedTimeline} finishedAt={detailed.archivedAt}/>
        <p className="muted small">Planned serving: {fmt(detailed.meal.serveAt)} · Saved: {fmt(detailed.archivedAt)}</p>
        <p className="muted small">{detailed.feedback || "No outcome notes recorded."}</p>
        <h4>Original checklist</h4>
        <ol className="history-tasks">
          {detailed.plannedTimeline.map(step=><li key={step.id}>
            <strong>{step.title}</strong><span>{step.dishName}</span>
            <small>Planned: {step.scheduledAt?fmt(step.scheduledAt):"Unscheduled"} · Actual completion: {detailed.meal.completed[step.id]?fmt(detailed.meal.completed[step.id]):"Not recorded"}</small>
            {detailed.meal.notes[step.id] && <p>{detailed.meal.notes[step.id]}</p>}
          </li>)}
        </ol>
        <h4>Recorded activity ({events.length})</h4>
        {events.length===0?<p className="muted small">No event readings or activity were recorded.</p>:<ol className="history-events">
          {events.map(event=><li key={event.id}><time>{fmt(event.occurredAt)}</time> · {eventDetail(event)}</li>)}
        </ol>}
      </section>
    </> : <>
      <p className="muted small">Your finished cooks, notes and actual times.</p>
      {history.cooks.length===0
        ? <p className="history-empty">No saved cooks yet. Finish a cook to see it here.</p>
        : <>
            <label htmlFor="history-search">Find a past cook</label>
            <input id="history-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search dish or meal"/>
            <div className="history-list">
              {shown.map(entry=><article className="history-item" key={entry.id}>
                <div className="between">
                  <div>
                    <strong>{entry.meal.name || "Saved cook"}</strong>
                    <p className="muted small">{fmt(entry.archivedAt)} · {entry.meal.dishes.map(d=>d.name).join(", ")||"General prep"}</p>
                  </div>
                  <span className="history-count">{entry.plannedTimeline.length} steps</span>
                </div>
                <div className="history-actions">
                  <button type="button" className="button primary" onClick={()=>setSelected(entry.id)}>View cook</button>
                  <button type="button" className="button secondary" onClick={()=>onRepeat(entry)}>Cook again</button>
                  <button type="button" className="button history-delete" onClick={()=>onDelete(entry)}>Delete</button>
                </div>
              </article>)}
              {!shown.length && <p className="muted small">No matching cooks.</p>}
            </div>
          </>}
    </>}
  </section>;
}
