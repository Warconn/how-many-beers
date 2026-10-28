"use client";

import {useState} from "react";
import type {ArchivedCook,HistoryLibrary} from "@/domain/cookHistory";
import type {CookEvent} from "@/domain/cookState";

type Props = {
  history:HistoryLibrary;
  onRepeat:(entry:ArchivedCook)=>void;
  onDelete:(entry:ArchivedCook)=>void;
  onExport:()=>void;
  onImport:(file:File)=>Promise<void>;
};

function fmt(date:string):string {
  const d=new Date(date);
  return Number.isFinite(d.getTime()) ? d.toLocaleString([], {month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}) : date;
}

function eventDetail(e:CookEvent):string{
  const names={started:"Started",completed:"Completed",reopened:"Reopened",temperature:"Food temp",equipment:"Equipment change",removed:"Removed"};
  return names[e.kind]+(e.value===undefined?"":" "+e.value+(e.unit??""))+(e.note?" · "+e.note:"");
}

export default function CookHistoryPanel({history,onRepeat,onDelete,onExport,onImport}:Props){
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const shown=history.cooks.filter(c=>(c.meal.name+" "+c.meal.dishes.map(d=>d.name).join(" ")).toLowerCase().includes(search.trim().toLowerCase()));
  const detailed=history.cooks.find(c=>c.id===selected);
  const events=(detailed?.meal.events??[]).slice().sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt));
  return <section className="panel cook-history" id="cook-history">
    <div className="section-title">
      <span className="section-icon" aria-hidden="true">📖</span>
      <div><p className="eyebrow">PAST SESSIONS</p><h2>Cook History</h2></div>
    </div>
    <p className="muted small">Open a completed cook for its actual times, temperatures and notes, or cook it again.</p>
    <div className="history-toolbar">
      <button type="button" className="button secondary" onClick={onExport}>Download backup</button>
      <label className="history-import">Restore a backup
        <input type="file" accept=".json,application/json" disabled={busy} onChange={async e=>{
          const file=e.target.files?.[0];
          if(!file)return;
          setBusy(true);
          try{await onImport(file);}finally{setBusy(false);e.target.value="";}
        }}/>
      </label>
    </div>
    {history.cooks.length===0
      ? <p className="history-empty">No saved cooks yet. After your next brisket, select <strong>Finish & Save Cook</strong>.</p>
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
                <button type="button" onClick={()=>setSelected(selected===entry.id?null:entry.id)}>{selected===entry.id?"Hide details":"View cook"}</button>
                <button type="button" onClick={()=>onRepeat(entry)}>Cook again</button>
                <button type="button" className="danger" onClick={()=>onDelete(entry)}>Delete</button>
              </div>
            </article>)}
            {!shown.length && <p className="muted small">No matching cooks.</p>}
          </div>
        </>}
    {detailed && <section className="history-detail" aria-label="Saved cook details">
      <h3>{detailed.meal.name}</h3>
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
    </section>}
  </section>;
}
