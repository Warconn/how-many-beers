"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dish, Meal, PlannedTask, PresetId } from "@/domain/meal";
import { createDish, newMeal, presets } from "@/domain/meal";
import { chronologicalTasks, formatDuration } from "@/domain/stepTiming";
import { equipmentWarnings } from "@/domain/schedule";
import { addStep, cookTimeline, stepTimingWarnings, editStep, migrateMeal, moveStep, recordEvent, removeStep, updateTaskNote } from "@/domain/cookState";
import type { CookEventKind, ExtendedMeal } from "@/domain/cookState";
import TaskRow from "@/components/TaskRow";
import AddStepForm from "@/components/AddStepForm";
import { parseRecipeText } from "@/domain/recipe";
import { commitCompletedCook, emptyHistory, exportBackup, HISTORY_KEY, readHistory, removeArchivedCook, repeatArchivedCook, validateBackup } from "@/domain/cookHistory";
import type { ArchivedCook, HistoryLibrary } from "@/domain/cookHistory";
import CookHistoryPanel from "@/components/CookHistoryPanel";

const STORAGE_KEY = "how-many-beers:meal:v1";
type BuiltIn = Exclude<PresetId, "custom">;

function when(iso: string | null): string {
  if (!iso) return "Timing TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Set a serving time";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(d);
}


type DurationUnit = "hours" | "minutes";

function DurationInput({
  id, minutes, unit, minMinutes, maxMinutes, onChange
}: {
  id: string;
  minutes: number;
  unit: DurationUnit;
  minMinutes: number;
  maxMinutes: number;
  onChange: (minutes: number) => void;
}) {
  const displayed = unit === "hours" ? String(Number((minutes / 60).toFixed(2))) : String(minutes);
  const [draft, setDraft] = useState(displayed);

  useEffect(() => setDraft(displayed), [displayed]);

  const commit = () => {
    if (!draft.trim()) {
      setDraft(displayed);
      return;
    }
    const entered = Number(draft);
    const nextMinutes = Math.round(entered * (unit === "hours" ? 60 : 1));
    if (!Number.isFinite(entered) || nextMinutes < minMinutes || nextMinutes > maxMinutes) {
      setDraft(displayed);
      return;
    }
    onChange(nextMinutes);
    setDraft(unit === "hours" ? String(Number((nextMinutes / 60).toFixed(2))) : String(nextMinutes));
  };

  return <input
    id={id}
    type="number"
    inputMode="decimal"
    min={unit === "hours" ? minMinutes / 60 : minMinutes}
    max={unit === "hours" ? maxMinutes / 60 : maxMinutes}
    step={unit === "hours" ? "0.25" : "5"}
    value={draft}
    onChange={e => setDraft(e.target.value)}
    onBlur={commit}
    onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
  />;
}

function BeerEstimator({ meal, timeline }: { meal: Meal; timeline: PlannedTask[] }) {
  const dish = meal.dishes.find(item => item.preset === "brisket") ?? meal.dishes[0];
  const startTask = dish ? timeline.find(task => task.id === dish.id + ":start") : undefined;
  const finishTask = dish ? timeline.find(task => task.id === dish.id + ":finish")
    ?? timeline.find(task => task.id === dish.id + ":check")
    ?? timeline.find(task => task.id === dish.id + ":serve") : undefined;
  const events = (meal as ExtendedMeal).events ?? [];
  const startedAt = startTask && events.find(e => e.taskId === startTask.id && e.kind === "started")?.occurredAt;
  const completedAt = finishTask ? meal.completed[finishTask.id] : undefined;
  const from = startedAt ?? startTask?.scheduledAt;
  const to = completedAt ?? finishTask?.scheduledAt;
  const durationMinutes = from && to ? Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000)) : NaN;
  const valid = Number.isFinite(durationMinutes);
  const totalBeers = valid ? durationMinutes / 90 : 0;
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return <section className="beerometer" aria-label="Cook duration in beers">
    <div className="beerometer-main">
      <div className="beerometer-emblem" aria-hidden="true">🍺</div>
      <div className="beerometer-copy">
        <p className="eyebrow">THE BEEROMETER</p>
        <h2>How many beers till it&apos;s done?</h2>
        <p>{dish ? (completedAt ? "Actual " : "Planned ") + dish.name.toLowerCase() + " start-to-finish duration." : "Add a dish to fire up the Beerometer."}</p>
      </div>
    </div>
    <div className="beerometer-reading">
      <div className="beerometer-figure">
        <strong>{dish && valid ? totalBeers.toFixed(1) : "—"}</strong>
        <span>beers</span>
      </div>
      <p className="beerometer-clock">{dish && valid
        ? `${hours}h ${String(minutes).padStart(2, "0")}m ${completedAt ? "actual" : "planned"} cook`
        : "Set a cook start and finish time."}</p>
    </div>
  </section>;
}

export default function Home() {
  const [meal, setMeal] = useState<Meal | null>(null);
  const [view, setView] = useState<"home" | "planning" | "cooking" | "history">("home");
  const [showDishSetup, setShowDishSetup] = useState(false);
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const [showChecklistPreview, setShowChecklistPreview] = useState(false);
  const [editingStep, setEditingStep] = useState<{id:string;context:"dish"|"checklist"|"cooking"}|null>(null);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [newStepDishId,setNewStepDishId] = useState<string | null>(null);
  const [newStepTitle,setNewStepTitle] = useState("");
  const [addMethod, setAddMethod] = useState<"template" | "recipe">("template");
  const [preset, setPreset] = useState<BuiltIn>("brisket");
  const [recipeName, setRecipeName] = useState("");
  const [recipeText, setRecipeText] = useState("");
  const [draft, setDraft] = useState<Dish | null>(null);
  const [message, setMessage] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [history,setHistory] = useState<HistoryLibrary>(emptyHistory());
  const [outcome,setOutcome] = useState("");
  const [showFinish,setShowFinish] = useState(false);
  const [storageError,setStorageError] = useState("");

  useEffect(() => {
    try{
      const savedHistory=localStorage.getItem(HISTORY_KEY);
      if(savedHistory)setHistory(readHistory(JSON.parse(savedHistory)));
    }catch{
      setStorageError("Saved cook history could not be read. Export or inspect your browser data before replacing it.");
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: Meal = JSON.parse(saved);
        if (parsed?.version === 1 && Array.isArray(parsed.dishes) && parsed.completed && parsed.notes) {
          setMeal(migrateMeal(parsed));
          return;
        }
      }
    } catch {
      setStorageError("Could not recover the current cook from browser storage. Avoid replacing data until it is backed up.");
    }
    setMeal(newMeal());
  }, []);

  useEffect(() => {
    if (!meal) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(meal));
    } catch {
      setStorageError("Browser storage is unavailable or full. Your latest cook edits may not survive a refresh.");
    }
  }, [meal]);

  const timeline = useMemo(() => meal ? cookTimeline(meal) : [], [meal]);
  const liveSchedule = useMemo(() => chronologicalTasks(timeline), [timeline]);
  const warnings = useMemo(() => meal ? [...equipmentWarnings(meal),...stepTimingWarnings(meal)] : [], [meal]);
  const complete = meal ? timeline.filter(task => !!meal.completed[task.id]).length : 0;
  const next = meal ? timeline.find(task => !meal.completed[task.id]) : null;
  const remaining = meal ? timeline.filter(task => !meal.completed[task.id]) : [];
  const finished = meal ? timeline.filter(task => !!meal.completed[task.id]) : [];

  const patch = (fn:(m:Meal)=>Meal) => setMeal(current => current ? fn(current) : current);

  const onTextFile = async (file?:File) => {
    if (!file) return;
    if (file.size > 100_000) {
      setMessage("Please choose a text recipe under 100 KB.");
      return;
    }
    if (!/\.(txt|md)$/i.test(file.name)) {
      setMessage("This first version accepts .txt and .md files. Photo/PDF upload is on the roadmap.");
      return;
    }
    setRecipeName(file.name.replace(/\.(txt|md)$/i, "").replace(/[_-]+/g," "));
    setRecipeText(await file.text());
    setDraft(null);
    setMessage("Recipe loaded. Review the text and select Preview recipe.");
  };

  if (!meal) return <main className="shell"><div className="panel">Loading your cook...</div></main>;


  const cooking = view === "cooking";
  const cookInProgress = meal.mode === "cooking" || !!meal.startedAt;
  const startBlockReason = timeline.length === 0 ? "Add a dish or prep step to start."
    : !Number.isFinite(new Date(meal.serveAt).getTime()) ? "Set a valid serving date and time to start." : "";
  const hasActiveWork = meal.dishes.length > 0 || Object.keys(meal.completed).length > 0 || !!meal.startedAt || ((meal as ExtendedMeal).events?.length ?? 0) > 0 || (meal.name !== "Next cook") || (meal.mode === "cooking");
  const beginNewCook = () => {
    if (hasActiveWork && !window.confirm("Start a new cook? This replaces the unfinished cook saved on this device. Export a backup first if you want to keep it.")) return;
    try {
      const fresh = newMeal();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      setMeal(fresh);
      setView("planning");
      setShowDishSetup(true);
      setEditingDishId(null);
      setEditingStep(null);
      setAddMethod("template");
      setShowCompleted(false);
      setMessage("");
    } catch { setStorageError("Unable to save a new cook. Your current cook is unchanged."); }
  };
  const safelyPatch = (fn:(m:Meal)=>Meal) => {
    try { patch(fn); setMessage(""); }
    catch(error) { setMessage(error instanceof Error ? error.message : "Could not update checklist."); }
  };
  const persistNewMeal = (next:Meal) => {
    localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
    setMeal(next);
    setShowFinish(false);
    setOutcome("");
    setView("home");
    window.scrollTo({top:0,behavior:"instant"});
  };
  const finishCook = () => {
    if(!meal) return;
    try{
      const committed=commitCompletedCook(meal,history,outcome,new Date().toISOString(),localStorage);
      const nextArchive=committed.history;
      const nextMeal=committed.next;
      setHistory(nextArchive);
      setStorageError("");
      persistNewMeal(nextMeal);
      setMessage("Cook saved to history. Ready for the next one!");
    }catch(error){
      setStorageError("Could not save this cook. It is still available in your active checklist. "+(error instanceof Error?error.message:""));
    }
  };
  const repeatCook = (entry:ArchivedCook) => {
    if(!window.confirm("Start a new cook using this saved plan? Any unsaved current plan will be replaced."))return;
    try{persistNewMeal(repeatArchivedCook(entry));setMessage("Copied your previous cook. Set a new serving time before starting.");setStorageError("");}
    catch{setStorageError("Could not create a repeat cook. Your current plan was not replaced.");}
  };
  const deleteCook = (entry:ArchivedCook) => {
    if(!window.confirm("Delete this saved cook permanently from this device? Consider downloading a backup first."))return;
    try{
      const next=removeArchivedCook(history,entry.id);
      localStorage.setItem(HISTORY_KEY,JSON.stringify(next));
      setHistory(next);setStorageError("");
    }catch{setStorageError("Could not delete the saved cook. Browser storage may be unavailable.");}
  };
  const downloadBackup = () => {
    if(!meal)return;
    try{
      const blob=new Blob([exportBackup(meal,history,new Date().toISOString())],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement("a");
      anchor.href=url;
      anchor.download="how-many-beers-backup-"+new Date().toISOString().slice(0,10)+".json";
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),500);
    }catch{setStorageError("Could not export the cook backup.");}
  };
  const importBackup = async (file:File) => {
    if(file.size>4_000_000){setStorageError("Backup is too large (4 MB maximum).");return;}
    try{
      const data=validateBackup(await file.text());
      if(!window.confirm("Restore this backup? It replaces the active cook and saved history on this device."))return;
      localStorage.setItem(HISTORY_KEY,JSON.stringify(data.history));
      localStorage.setItem(STORAGE_KEY,JSON.stringify(data.active));
      setHistory(data.history);setMeal(data.active);setStorageError("");
      setMessage("Your cook history has been restored.");
    }catch(error){setStorageError("Could not restore backup: "+(error instanceof Error?error.message:"unrecognized file"));}
  };

  const removeDish = (dishId:string) => {
    const dish=meal.dishes.find(d=>d.id===dishId);
    if(!dish || !window.confirm("Remove "+dish.name+" and its planned steps? Recorded activity is retained."))return;
    patch(m=>({...m,dishes:m.dishes.filter(d=>d.id!==dishId),customTasks:(m as ExtendedMeal).customTasks?.filter(t=>t.dishId!==dishId)}));
    if(editingDishId===dishId)setEditingDishId(null);
    if(newStepDishId===dishId){setNewStepDishId(null);setNewStepTitle("");}
    const focusId=editingDishId && editingDishId!==dishId ? editingDishId : meal.dishes.find(d=>d.id!==dishId)?.id;
    requestAnimationFrame(()=>document.getElementById(focusId?"dish-toggle-"+focusId:"add-dish-button")?.focus());
  };

  const addDishStep = (dishId:string) => {
    const dish=meal?.dishes.find(d=>d.id===dishId);
    if(!dish || !newStepTitle.trim())return;
    safelyPatch(m=>{
      const next=addStep(m,newStepTitle,"",null);
      const created=next.customTasks?.[next.customTasks.length-1]?.id;
      return {...next,customTasks:next.customTasks?.map(t=>t.id===created?{...t,dishId:dish.id,dishName:dish.name}:t)};
    });
    setNewStepTitle("");
    setNewStepDishId(null);
  };
  const addCustom = (title:string,instructions:string,scheduledAt:string|null) => {
    safelyPatch(m=>addStep(m,title,instructions,scheduledAt));
  };
  const taskCard = (task: PlannedTask, mode:"planning"|"cooking", isNext = false, compact = false) => {
    const visibleTasks = compact ? timeline.filter(t=>t.dishId===task.dishId) : timeline;
    const index = visibleTasks.findIndex(t => t.id === task.id);
    const taskEvents = (meal as ExtendedMeal).events ?? [];
    const context = compact ? "dish" : mode === "cooking" ? "cooking" : "checklist";
    return <TaskRow
      key={task.id}
      task={task}
      index={index}
      count={visibleTasks.length}
      compact={compact}
      editorId={context+"-step-"+task.id}
      editing={editingStep?.id===task.id && editingStep.context===context}
      onEditingChange={open=>setEditingStep(open?{id:task.id,context}:null)}
      isNext={isNext}
      mode={mode}
      completedAt={meal.completed[task.id]}
      events={taskEvents}
      note={meal.notes[task.id] || ""}
      onNote={value=>patch(m=>updateTaskNote(m,task.id,value,new Date().toISOString()))}
      onEdit={(title,instructions,details)=>safelyPatch(m=>{
        const changed=title!==task.title || instructions!==task.instructions;
        const updated=editStep(m,task.id,title,instructions,details);
        if(!changed || m.mode!=="cooking") return updated;
        const history=(m as ExtendedMeal).events??[];
        const taskEvents=history.filter(e=>e.taskId===task.id);
        const reopen=taskEvents.map(e=>e.kind).lastIndexOf("reopened");
        if(taskEvents.slice(reopen+1).some(e=>e.kind==="started"||e.kind==="completed")) return updated;
        return recordEvent(updated,task.id,"started",new Date().toISOString());
      })}
      onMove={direction=>safelyPatch(m=>moveStep(m,task.id,direction,compact?task.dishId:undefined))}
      onRemove={()=>safelyPatch(m=>removeStep(m,task.id,new Date().toISOString()))}
      onEvent={(kind:CookEventKind,value,unit,note)=>safelyPatch(m=>recordEvent(m,task.id,kind,new Date().toISOString(),value,unit,note))}
    />;
  };

  const editScheduleStep = (task:PlannedTask) => {
    setShowDishSetup(false);
    if(meal.dishes.some(d=>d.id===task.dishId)){
      setEditingDishId(task.dishId);setEditingStep({id:task.id,context:"dish"});
    }else{
      setShowChecklistPreview(true);setEditingStep({id:task.id,context:"checklist"});
    }
  };

  return (
    <main className={"shell " + (cooking ? "cooking-screen" : "planning-screen")}>
      {storageError && <div className="warning" role="alert">⚠️ {storageError}</div>}
      <header className="site-header">
        <div className="brand-icon" aria-hidden>🍺</div>
        <div>
          <p className="eyebrow">PLAN · COOK · REPEAT</p>
          <h1>How Many Beers?</h1>
          <p className="subtitle">Dinner has a deadline. Brisket does not.</p>
        </div>
        
      </header>

      {view === "home" ? (
        <section className="home-layout" aria-label="Home">
          <div className="home-primary">
          <div className="home-intro"><h2>What&apos;s cooking?</h2><p className="muted">Pick up where you left off or plan something new.</p></div>
          {hasActiveWork && <section className="panel home-current">
            <div className="between"><p className="eyebrow">YOUR CURRENT COOK</p><span className="home-status">{meal.mode === "cooking" ? "In progress" : "Planning"}</span></div>
            <h3>{meal.name || "Your cook"}</h3>
            <p className="muted">{when(meal.serveAt || null)} · {meal.dishes.length} {meal.dishes.length === 1 ? "dish" : "dishes"}</p>
            {meal.dishes.length > 0 && <p className="home-dishes">{meal.dishes.map(d=>d.name).join(" · ")}</p>}
            <div className="home-actions">
              {meal.mode === "cooking" ? <>
                <button type="button" className="button primary" onClick={()=>setView("cooking")}>Continue cooking →</button>
                <button type="button" className="button secondary" onClick={()=>setView("planning")}>View cook</button>
              </> : <button type="button" className="button primary" onClick={()=>setView("planning")}>Resume planning →</button>}
            </div>
          </section>}
          <section className="panel home-new">
            <h3>{hasActiveWork ? "Start another cook" : "Start a cook"}</h3>
            <p className="muted">{hasActiveWork ? "Start fresh when you're ready. Your unfinished cook is not automatically archived." : "Choose what you are making. We will build the checklist."}</p>
            <button type="button" className={hasActiveWork ? "button secondary" : "button primary"} onClick={beginNewCook}>+ Plan a new cook</button>
          </section>
          <button type="button" className="home-history-link" onClick={()=>setView("history")}>Past cooks and backups <span aria-hidden="true">→</span></button>
          <p className="home-storage-note">Saved on this device only. <button type="button" onClick={()=>setView("history")}>Back up your cooks</button> before switching browsers.</p>
          </div>
          <aside className="home-guide" aria-label="How it works">
            <p className="eyebrow">THE GAME PLAN</p>
            <h3>One cook. Every dish. Right on time.</h3>
            <p>Start with a template, bring everything into one timeline, and follow along when it’s time to cook.</p>
            <div className="home-guide-step"><span>01</span><div><strong>Plan your menu</strong><small>Brisket, brats, sides. All together.</small></div></div>
            <div className="home-guide-step"><span>02</span><div><strong>See the full schedule</strong><small>One checklist across every dish.</small></div></div>
            <div className="home-guide-step"><span>03</span><div><strong>Cook and check it off</strong><small>Pick up where you left off.</small></div></div>
          </aside>
        </section>
      ) : view === "history" ? (
        <section className="home-history">
          <button type="button" className="back-link" onClick={()=>setView("home")}>← Home</button>
          <CookHistoryPanel history={history} onRepeat={repeatCook} onDelete={deleteCook} onExport={downloadBackup} onImport={importBackup}/>
        </section>
      ) : cooking ? (
        <>
          <button type="button" className="back-link" onClick={()=>setView("home")}>← Home</button>
          <section className="cook-header">
            <div>
              <button className="back-link" type="button" onClick={() => setView("planning")}>← View your cook</button>
              <p className="eyebrow">YOU'RE COOKING</p>
              <h2>{meal.name || "Your cook"}</h2>
              <p className="cook-target">🍽️ Serving {when(meal.serveAt || null)} · One cook with {meal.dishes.length} {meal.dishes.length === 1 ? "dish" : "dishes"}</p>
            </div>
            <div className="cook-progress-chip"><strong>{complete}/{timeline.length}</strong><span>steps done</span></div>
          </section>

          <BeerEstimator meal={meal} timeline={timeline}/>

          <div className="cook-layout">
            <section className="panel active-cook-panel">
              <div className="progress-heading"><strong>Today&apos;s checklist</strong><span>{timeline.length ? Math.round(complete / timeline.length * 100) : 0}% complete</span></div>
              <div className="progress-track"><div style={{width: (timeline.length ? complete / timeline.length * 100 : 0) + "%"}} /></div>
              <AddStepForm compact onAdd={addCustom}/>
              {message && <p className="form-error" role="alert">{message}</p>}
              {remaining.length > 0 ? (
                <>
                  <p className="cook-section-label">NOW &amp; COMING UP</p>
                  <div className="checklist">{remaining.map((task, i) => taskCard(task, "cooking", i === 0))}</div>
                </>
              ) : (
                <div className="cook-finished">
                  <span aria-hidden>🎉</span>
                  <h3>{timeline.length ? "That's a wrap!" : "Your checklist is empty"}</h3>
                  <p>{timeline.length ? "All steps are checked off. Enjoy dinner, and save those notes for next time." : "Go back and add a dish to build your plan."}</p>
                </div>
              )}
              {finished.length > 0 && (
                <section className="done-section">
                  <button type="button" className="done-toggle" aria-expanded={showCompleted}
                    onClick={() => setShowCompleted(v => !v)}>
                    <span>✓ Completed ({finished.length})</span><span>{showCompleted ? "Hide −" : "Show +"}</span>
                  </button>
                  {showCompleted && <div className="checklist completed-list">{finished.map(task => taskCard(task, "cooking"))}</div>}
                </section>
              )}
              <section className="finish-cook">
                <h3>All wrapped up?</h3>
                <p className="muted small">Save this session's actual steps, notes and temperatures so you can reference them next time.</p>
                {!showFinish ? <button className="button primary" type="button" onClick={()=>setShowFinish(true)}>✓ Finish & Save Cook</button>
                  : <div className="finish-form">
                    <p className="muted small">{remaining.length} unchecked steps. You can save even if some weren't needed.</p>
                    <label htmlFor="cook-outcome">How did it turn out? (optional)</label>
                    <textarea id="cook-outcome" rows={3} maxLength={2000} value={outcome} onChange={e=>setOutcome(e.target.value)} placeholder="Tenderness, timing, bark, what I'd change next time..."/>
                    <button type="button" className="button primary" onClick={finishCook}>Save Cook & Start Fresh</button>
                    <button type="button" className="button secondary" onClick={()=>setShowFinish(false)}>Not yet</button>
                  </div>}
              </section>
            </section>
            <aside className="cook-sidebar">
              <section className="panel cook-summary">
                <p className="eyebrow">YOUR COOK</p>
                <h3>On the menu</h3>
                {meal.dishes.map(d => <div className="menu-item" key={d.id}><strong>{d.name}</strong><span>{d.equipment}</span></div>)}
                {next && <div className="sidebar-next"><span>Next planned milestone</span><strong>{when(next.scheduledAt)}</strong></div>}
              </section>
              {warnings.length > 0 && <section className="panel cook-warnings"><strong>Things to watch</strong>{warnings.map((w,i) => <p key={i}>⚠️ {w}</p>)}</section>}
              {timeline.some(t => t.scheduledAt === null) && <p className="warning">Some recipe steps do not have confirmed timing yet. Edit the plan to set their durations.</p>}
              <section className="panel tip">
                <strong>Cook smart</strong>
                <p>All times are planning estimates. Use a food thermometer, verify doneness, and follow safe holding and equipment instructions.</p>
                <button className="link" onClick={() => setView("planning")}>View the plan →</button>
              </section>
            </aside>
          </div>
          <nav className="cook-mobile-bar" aria-label="Cook tools">
            <span>✓ {complete} of {timeline.length} complete</span>
            <button type="button" onClick={() => {setShowFinish(true);document.querySelector(".finish-cook")?.scrollIntoView({behavior:"smooth",block:"center"});}}>Save Cook</button>
            <button type="button" onClick={() => setView("planning")}>View plan</button>
          </nav>
        </>
      ) : (
        <>
          <button type="button" className="back-link" onClick={()=>setView("home")}>← Home</button>
          {meal.mode === "cooking" && <p className="notice">Cook in progress. Viewing or editing your plan won't reset your completed steps.</p>}
          <div className="guided-planner"><div className="guided-main">
          <section className="hero panel">
            <div>
              <p className="eyebrow">PLAN YOUR COOK</p>
              <h2>What time are we eating?</h2>
              <p>Set your serving time, add dishes, and we'll build your checklist.</p>
            </div>
            <div className="hero-fields">
              <label htmlFor="meal-name">Meal name</label>
              <input id="meal-name" value={meal.name} onChange={e => patch(m => ({...m, name: e.target.value}))} maxLength={80}/>
              <label htmlFor="serve-at">Serve date and time</label>
              <input id="serve-at" type="datetime-local" value={meal.serveAt} onChange={e => patch(m => ({...m, serveAt: e.target.value}))}/>
            </div>
          </section>
          <section className="workspace-overview" aria-label="Cook overview">
            <div className="workspace-heading">
              <div><p className="eyebrow">YOUR MENU</p><h2>{meal.dishes.length} {meal.dishes.length === 1 ? "dish" : "dishes"} in this cook</h2></div>
              <button id="add-dish-button" type="button" className="button secondary" onClick={()=>{setEditingDishId(null);setShowDishSetup(v=>!v)}}>{showDishSetup ? "Cancel adding" : "+ Add a dish"}</button>
            </div>
            <p className="muted small menu-guidance">{showDishSetup ? "Choose a starter or import your recipe. Everything stays in this cook." : "Tap a dish to adjust its steps. Add another whenever you're ready."}</p>
            {showDishSetup && <section className="menu-add-dish" role="region" aria-label="Add dish">
              <h3>Add a dish</h3>
              <div className="add-method-tabs" role="group" aria-label="Add dish method">
                <button type="button" aria-pressed={addMethod==="template"} className={addMethod==="template"?"selected":""} onClick={()=>setAddMethod("template")}>Start from template</button>
                <button type="button" aria-pressed={addMethod==="recipe"} className={addMethod==="recipe"?"selected":""} onClick={()=>setAddMethod("recipe")}>Import a recipe</button>
              </div>
              {addMethod==="template" ? <>
              <h3>Choose a template</h3>
              <p className="muted small">Start with a dish. You can adjust it without changing the other dishes.</p>
              <div className="template-picker">
                {(Object.entries(presets) as [BuiltIn, (typeof presets)[BuiltIn]][]).map(([id, template])=>(
                  <button type="button" className="template-choice" key={id} aria-label={"Add "+template.label.toLowerCase()} onClick={()=>{const dish=createDish(id);patch(m=>({...m,dishes:[...m.dishes,dish]}));setShowDishSetup(false);setEditingDishId(dish.id);requestAnimationFrame(()=>document.getElementById("dish-toggle-"+dish.id)?.focus())}}>
                    <strong>{template.label}</strong><span>{template.equipment}</span><b aria-hidden="true">+</b>
                  </button>
                ))}
              </div>
              </> : <div className="recipe-import-inline">
                <p className="muted small">Paste instructions or upload a text file. Recipe URLs aren't supported yet.</p>
                <label htmlFor="recipe-name">Recipe title</label>
                <input id="recipe-name" value={recipeName} onChange={e=>setRecipeName(e.target.value)} placeholder="Grandma's mac & cheese"/>
                <label htmlFor="recipe-text">Recipe instructions</label>
                <textarea id="recipe-text" rows={5} value={recipeText} onChange={e=>setRecipeText(e.target.value)} placeholder={"1. Preheat oven\\n2. Prepare ingredients\\n3. Cook until done"}/>
                <label htmlFor="recipe-file">Upload .txt or .md</label>
                <input id="recipe-file" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={e=>void onTextFile(e.target.files?.[0])}/>
                <button className="button secondary" type="button" disabled={!recipeText.trim()} onClick={()=>{
                  const parsed=parseRecipeText(recipeName,recipeText);
                  if(!parsed.steps?.length){setMessage("No recipe steps found. Try one instruction per line.");return;}
                  setDraft(parsed);setMessage("");
                }}>Preview recipe steps</button>
                {draft && <div className="draft">
                  <strong>Review {draft.steps?.length} imported steps</strong>
                  <p className="muted small">Each non-empty line becomes a step. Confirm timings after adding.</p>
                  <ol>{draft.steps?.map(step=><li key={step.id}>{step.title}</li>)}</ol>
                  <button className="button primary" type="button" onClick={()=>{
                    patch(m=>({...m,dishes:[...m.dishes,draft]}));
                    setShowDishSetup(false);setEditingDishId(draft.id);requestAnimationFrame(()=>document.getElementById("dish-toggle-"+draft.id)?.focus());setDraft(null);setRecipeName("");setRecipeText("");setMessage("");
                  }}>Add to this cook</button>
                </div>}
                {message && <p className="notice" role="status">{message}</p>}
              </div>}
            </section>}
            {meal.dishes.length ? <div className="workspace-dish-grid">
              {meal.dishes.map(d=><article className={"workspace-dish"+(editingDishId===d.id?" is-open":"")} aria-label={d.name} key={d.id}>
                <div className="dish-header">
                <button id={"dish-toggle-"+d.id} className="dish-select" type="button" aria-label={"Edit "+d.name} aria-expanded={editingDishId===d.id} aria-controls={"dish-"+d.id} onClick={()=>{setEditingDishId(current=>current===d.id?null:d.id);setShowDishSetup(false);setNewStepDishId(null);setNewStepTitle("")}}>
                  <span className="dish-summary"><strong>{d.name}</strong><span>{d.equipment} · {timeline.filter(t=>t.dishId===d.id).length} steps</span></span>
                  <span className="dish-toggle">{editingDishId===d.id?"Hide steps ↑":"Adjust steps ↓"}</span>
                </button>
                  <button type="button" className="dish-remove" aria-label={"Remove "+d.name} title={"Remove "+d.name} onClick={()=>removeDish(d.id)}>
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg>
                  </button>
                </div>
                {editingDishId===d.id && <div id={"dish-"+d.id} className="dish-inline-editor" role="region" aria-label="Dish editor">

                  <details className="dish-advanced" key={d.id}><summary>Dish settings</summary>
                  <label htmlFor={"name-"+d.id}>Dish name</label>
                  <input id={"name-"+d.id} value={d.name} onChange={e=>patch(m=>({...m,dishes:m.dishes.map(item=>item.id===d.id?{...item,name:e.target.value}:item),customTasks:(m as ExtendedMeal).customTasks?.map(t=>t.dishId===d.id?{...t,dishName:e.target.value}:t)}))}/>

                  <label htmlFor={"equipment-"+d.id}>Equipment</label>
                  <input id={"equipment-"+d.id} value={d.equipment} onChange={e=>patch(m=>({...m,dishes:m.dishes.map(item=>item.id===d.id?{...item,equipment:e.target.value}:item)}))}/>
                  {d.preset!=="custom" ? <div className="small-grid">
                    <div>
                      <label htmlFor={"cook-"+d.id}>Estimated cook ({d.preset==="brisket" || d.preset==="ribs" ? "hours" : "min"})</label>
                      <DurationInput id={"cook-"+d.id} minutes={d.cookMinutes}
                        unit={d.preset==="brisket" || d.preset==="ribs" ? "hours" : "minutes"}
                        minMinutes={15} maxMinutes={2880}
                        onChange={value=>patch(m=>({...m,dishes:m.dishes.map(item=>item.id===d.id?{...item,cookMinutes:value}:item)}))}
                      />
                    </div>
                    <div>
                      <label htmlFor={"rest-"+d.id}>Rest/hold ({d.preset==="brisket" ? "hours" : "min"})</label>
                      <DurationInput id={"rest-"+d.id} minutes={d.restMinutes}
                        unit={d.preset==="brisket" ? "hours" : "minutes"}
                        minMinutes={0} maxMinutes={720}
                        onChange={value=>patch(m=>({...m,dishes:m.dishes.map(item=>item.id===d.id?{...item,restMinutes:value}:item)}))}
                      />
                    </div>
                  </div> : <div className="recipe-steps">
                    {(d.steps||[]).map(s=><div className="recipe-row" key={s.id}>
                      <span>{s.title}</span>
                      <label><span className="sr-only">Minutes for {s.title}</span><input type="number" min="1" max="1440" placeholder="min?" value={s.minutes??""} onChange={e=>patch(m=>({...m,dishes:m.dishes.map(item=>item.id!==d.id?item:{...item,steps:item.steps?.map(step=>step.id===s.id?{...step,minutes:e.target.value===""?null:Math.max(1,Number(e.target.value)||1)}:step)})}))}/></label>
                    </div>)}
                    <p className="muted small">Blank time means the step stays unscheduled. Confirm all timings before relying on this plan.</p>
                  </div>}
                  {d.preset!=="custom" && presets[d.preset].referenceWeightLb!==undefined && (
                    <div className="template-settings">
                      <label htmlFor={"weight-"+d.id}>Weight (lb), for reference</label>
                      <input id={"weight-"+d.id} type="number" inputMode="decimal" min={1} max={40} step={0.5}
                        value={d.weightLb ?? ""}
                        onChange={e=>patch(m=>({...m,dishes:m.dishes.map(item=>item.id===d.id ? {...item,weightLb:e.target.value===""?undefined:Math.max(1,Math.min(40,Number(e.target.value)||1))}:item)}))}
                      />
                      <p className="muted small">Weight is saved with your cook. Automatic weight-based time estimates are tracked in #5, so this doesn't silently change cook time yet.</p>
                    </div>
                  )}
                  {d.preset!=="custom" && presets[d.preset].cookRangeMinutes && (
                    <p className="muted small">Editable planning window (not a guaranteed or weight-derived estimate): {Math.round(presets[d.preset].cookRangeMinutes![0]/60*10)/10}–{Math.round(presets[d.preset].cookRangeMinutes![1]/60*10)/10} hours. Source-method context only; adjust the estimate for your equipment and size.</p>
                  )}
                  {d.preset!=="custom" && presets[d.preset].pitTempF!==undefined && (
                    <div className="template-settings">
                      <label htmlFor={"pit-"+d.id}>Starting smoker / oven setting (°F)</label>
                      <input id={"pit-"+d.id} type="number" min={d.preset==="turkey"?325:150} max={450} step={5}
                        value={d.pitTempF ?? presets[d.preset].pitTempF ?? 250}
                        onChange={e=>patch(m=>({...m,dishes:m.dishes.map(item=>item.id===d.id ? {...item,pitTempF:Math.min(450,Math.max(d.preset==="turkey"?325:150,Number(e.target.value)||250))}:item)}))}
                      />
                      <p className="muted small">These are starter plans, not weight-calibrated predictions. You can adjust durations, pit settings, and every checklist step.</p>
                    </div>
                  )}
                  {d.preset!=="custom" && !!presets[d.preset].sources?.length && (
                    <div className="template-sources">
                      <span>Method references</span>
                      {presets[d.preset].sources?.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>)}
                    </div>
                  )}

                  </details>
                  <section className="inline-dish-steps" role="region" aria-label={d.name+" steps"}>
                  {timeline.filter(t=>t.dishId===d.id).map(t=>taskCard(t,"planning",false,true))}
                  {newStepDishId===d.id ? <div className="inline-step-add">
                    <label htmlFor={"new-step-"+d.id}>Step title</label>
                    <input id={"new-step-"+d.id} value={newStepTitle} onChange={e=>setNewStepTitle(e.target.value)} maxLength={160}/>
                    <button type="button" className="button primary" disabled={!newStepTitle.trim()} onClick={()=>addDishStep(d.id)}>Save step</button>
                    <button type="button" className="button secondary" onClick={()=>{setNewStepDishId(null);setNewStepTitle("")}}>Cancel</button>
                  </div> : <button type="button" className="button secondary" onClick={()=>setNewStepDishId(d.id)}>Add a step to {d.name}</button>}
                </section>
                </div>}
              </article>)}
            </div> : <div className="workspace-empty">Nothing on the menu yet. Add your first dish using a cooking template.</div>}
          </section>
          <section className="cook-actions" aria-label="Cooking actions">
            <div className="cook-action-controls">
              <button type="button" className="button primary cook-action-button"
                disabled={!cookInProgress && !!startBlockReason}
                aria-describedby={!cookInProgress && startBlockReason ? "cook-start-help" : undefined}
                onClick={() => {
                  if (!cookInProgress) patch(m => ({...m, mode: "cooking", startedAt: m.startedAt ?? new Date().toISOString()}));
                  else if (meal.mode !== "cooking") patch(m => ({...m, mode: "cooking"}));
                  setView("cooking");setShowCompleted(false);window.scrollTo({top:0,behavior:"instant"});
                }}>{cookInProgress ? "Continue cooking" : "Start cooking"}</button>
              {timeline.length > 0 && <button type="button" className="link review-checklist-button"
                aria-expanded={showChecklistPreview} aria-controls="checklist-preview"
                onClick={()=>setShowChecklistPreview(v=>!v)}>{showChecklistPreview ? "Hide checklist" : "Review checklist"}</button>}
            </div>
            {!cookInProgress && startBlockReason && <p className="muted small" id="cook-start-help">{startBlockReason}</p>}
          </section>
          <section className="plan-notes" aria-label="Plan notes">
            {warnings.map((warning,i) => <p className="warning" key={i}>{warning}</p>)}
            {timeline.some(t => t.scheduledAt === null) && <p className="warning">Some steps have no timing. Set a planned date and time in the step editor, or leave them unscheduled and review them before relying on the schedule.</p>}
            <p className="muted small timing-guidance">Schedules are estimates, not food-safety checks or guaranteed finish times. Use a thermometer and follow your equipment instructions.</p>
          </section>
          {showChecklistPreview && timeline.length > 0 && (
            <section className="checklist-preview" id="checklist-preview" aria-label="Cooking checklist preview">
              <div className="preview-intro"><h3>Cooking checklist</h3></div>
              <p className="muted small">Review all dishes together. Check off steps and record actual readings in Cooking Mode.</p>
              <div className="checklist preview-task-list">{timeline.map(task => taskCard(task, "planning"))}</div>
              <AddStepForm onAdd={addCustom}/>
              {message && <p className="form-error" role="alert">{message}</p>}
            </section>
          )}
          {timeline.length === 0 && <AddStepForm onAdd={addCustom}/>}
          </div>
          <aside className="guided-schedule" aria-label="Live schedule">
            <div className="schedule-head"><p className="eyebrow">LIVE SCHEDULE</p><strong>{timeline.length} steps</strong></div>
            <p className="muted small">Serving {when(meal.serveAt || null)}</p>
            {timeline.length ? <>
              <ol className="schedule-list">
                {(showFullSchedule?liveSchedule:liveSchedule.slice(0,4)).map(task=><li key={task.id}><button type="button" className="schedule-step" aria-label={"Edit "+task.title+" for "+task.dishName} onClick={()=>editScheduleStep(task)}><time dateTime={task.scheduledAt??undefined}>{when(task.scheduledAt)}</time><strong>{task.title}</strong><span>{task.dishName}{task.durationMinutes!=null?" · "+formatDuration(task.durationMinutes):""}</span><span className="schedule-edit-hint">Adjust step →</span></button></li>)}
              </ol>
              {timeline.length>4 && <button type="button" className="link schedule-toggle" onClick={()=>setShowFullSchedule(v=>!v)}>{showFullSchedule?"Show less":"Show full schedule"} →</button>}
            </> : <p className="muted small">Add a dish to see your schedule.</p>}
            {warnings.length>0 && <p className="muted small">Review schedule and equipment warnings in the plan notes.</p>}
          </aside>
          </div>
        </>
      )}
      <footer>How Many Beers? · Plan it. Cook it. Check it off. <span>Made for the cook, not the clock.</span><span className="build-version" title="Deployment branch and Git commit">{process.env.NEXT_PUBLIC_BUILD_BRANCH ?? "local"} · {(process.env.NEXT_PUBLIC_BUILD_SHA ?? "local").slice(0, 7)}</span></footer>
    </main>
  );
}
