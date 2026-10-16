"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dish, Meal, PlannedTask, PresetId } from "@/domain/meal";
import { createDish, newMeal, presets } from "@/domain/meal";
import { buildTimeline, equipmentWarnings } from "@/domain/schedule";
import { parseRecipeText } from "@/domain/recipe";

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
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const dish = meal.dishes.find(item => item.preset === "brisket") ?? meal.dishes[0];
  const plannedFinish = dish ? timeline.find(task => task.id === dish.id + ":finish") : undefined;
  const serveTask = dish ? timeline.find(task => task.id === dish.id + ":serve") : undefined;
  const targetIso = plannedFinish?.scheduledAt ?? serveTask?.scheduledAt;
  const endTime = targetIso ? new Date(targetIso).getTime() : NaN;
  const valid = Number.isFinite(endTime);
  const minutesLeft = valid ? Math.max(0, Math.ceil((endTime - now) / 60_000)) : 0;
  const beers = Number((minutesLeft / 90).toFixed(1));
  const hours = Math.floor(minutesLeft / 60);
  const minutes = minutesLeft % 60;
  const isFinished = !!(plannedFinish && meal.completed[plannedFinish.id]);

  return <section className="beerometer" aria-label="Playful cooking countdown">
    <div className="beerometer-main">
      <div className="beerometer-emblem" aria-hidden="true">🍺</div>
      <div className="beerometer-copy">
        <p className="eyebrow">THE BEEROMETER</p>
        <h2>How many beers till it&apos;s done?</h2>
        <p>{dish
          ? "Counting down to " + dish.name.toLowerCase() + (plannedFinish ? "\u0027s planned finish." : "\u0027s planned serving time.")
          : "Add a dish to fire up the countdown."}</p>
      </div>
    </div>
    <div className="beerometer-reading">
      <div className="beerometer-figure">
        <strong>{dish && valid ? (isFinished ? "Done!" : beers.toFixed(1)) : "—"}</strong>
        <span>{isFinished ? "You checked it off" : "beers"}</span>
      </div>
      <p className="beerometer-clock">{dish && valid && !isFinished
        ? (minutesLeft === 0 ? "The planned finish time has passed" : `${hours}h ${String(minutes).padStart(2, "0")}m on the clock`)
        : isFinished ? "Nice work. Dinner awaits." : "The clock starts once you add a dish."}</p>
    </div>
  </section>;
}

export default function Home() {
  const [meal, setMeal] = useState<Meal | null>(null);
  const [preset, setPreset] = useState<BuiltIn>("brisket");
  const [recipeName, setRecipeName] = useState("");
  const [recipeText, setRecipeText] = useState("");
  const [draft, setDraft] = useState<Dish | null>(null);
  const [message, setMessage] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: Meal = JSON.parse(saved);
        if (parsed?.version === 1 && Array.isArray(parsed.dishes) && parsed.completed && parsed.notes) {
          setMeal(parsed);
          return;
        }
      }
    } catch {
      // Corrupt or unavailable local storage: start a new plan.
    }
    setMeal(newMeal());
  }, []);

  useEffect(() => {
    if (!meal) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(meal));
    } catch {
      // Browsers may refuse persistence when storage is disabled.
    }
  }, [meal]);

  const timeline = useMemo(() => meal ? buildTimeline(meal) : [], [meal]);
  const warnings = useMemo(() => meal ? equipmentWarnings(meal) : [], [meal]);
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


  const cooking = meal.mode === "cooking";
  const toggleTask = (taskId: string, checked: boolean) => {
    patch(m => {
      const completed = {...m.completed};
      if (checked) completed[taskId] = new Date().toISOString();
      else delete completed[taskId];
      return {...m, completed};
    });
  };
  const taskCard = (task: PlannedTask, index = -1) => {
    const done = meal.completed[task.id];
    return (
      <article key={task.id} className={"task cook-task " + (done ? "done " : "") + (index === 0 ? "first-task" : "")}>
        <label className="task-top">
          <input type="checkbox" checked={!!done} onChange={e => toggleTask(task.id, e.target.checked)} />
          <div className="task-main">
            {index === 0 && <p className="eyebrow next-label">DO THIS NEXT</p>}
            <div className="between">
              <strong>{task.title}</strong>
              <time>{when(task.scheduledAt)}</time>
            </div>
            <p className="task-dish">{task.dishName}</p>
            <p className="muted small">{task.instructions}</p>
            {task.isCondition && <span className="condition">Check the food, not just the timer</span>}
            {done && <p className="completed-time">✓ Done {new Date(done).toLocaleString()}</p>}
          </div>
        </label>
        <label className="note-label" htmlFor={"note-" + task.id}>Notes / temperature</label>
        <input
          className="task-note"
          id={"note-" + task.id}
          placeholder="e.g. 169°F, wrapped, bark looks good"
          value={meal.notes[task.id] || ""}
          onChange={e => patch(m => ({ ...m, notes: { ...m.notes, [task.id]: e.target.value } }))}
        />
      </article>
    );
  };

  return (
    <main className={"shell " + (cooking ? "cooking-screen" : "planning-screen")}>
      <header className="site-header">
        <div className="brand-icon" aria-hidden>🍺</div>
        <div>
          <p className="eyebrow">THE COOKING CHECKLIST</p>
          <h1>How Many Beers?</h1>
          <p className="subtitle">Dinner has a deadline. Brisket does not.</p>
        </div>
        <span className="version-pill">{cooking ? "Cook in progress" : "Plan your cook"}</span>
      </header>

      {cooking ? (
        <>
          <section className="cook-header">
            <div>
              <button className="back-link" type="button" onClick={() => patch(m => ({...m, mode: "planning"}))}>← Edit your plan</button>
              <p className="eyebrow">YOU'RE COOKING</p>
              <h2>{meal.name || "Your cook"}</h2>
              <p className="cook-target">🍽️ Serving {when(meal.serveAt || null)} · {meal.dishes.length} {meal.dishes.length === 1 ? "dish" : "dishes"}</p>
            </div>
            <div className="cook-progress-chip"><strong>{complete}/{timeline.length}</strong><span>steps done</span></div>
          </section>

          <BeerEstimator meal={meal} timeline={timeline}/>

          <div className="cook-layout">
            <section className="panel active-cook-panel">
              <div className="progress-heading"><strong>Today&apos;s checklist</strong><span>{timeline.length ? Math.round(complete / timeline.length * 100) : 0}% complete</span></div>
              <div className="progress-track"><div style={{width: (timeline.length ? complete / timeline.length * 100 : 0) + "%"}} /></div>
              {remaining.length > 0 ? (
                <>
                  <p className="cook-section-label">NOW &amp; COMING UP</p>
                  <div className="checklist">{remaining.map((task, i) => taskCard(task, i))}</div>
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
                  {showCompleted && <div className="checklist completed-list">{finished.map(task => taskCard(task))}</div>}
                </section>
              )}
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
                <button className="link" onClick={() => patch(m => ({...m, mode: "planning"}))}>Adjust the plan →</button>
              </section>
            </aside>
          </div>
          <nav className="cook-mobile-bar" aria-label="Cook tools">
            <span>✓ {complete} of {timeline.length} complete</span>
            <button type="button" onClick={() => patch(m => ({...m, mode: "planning"}))}>Edit plan</button>
          </nav>
        </>
      ) : (
        <>
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
          <div className="planning-layout">
        <div className="stack">
          <section className="panel">
            <div className="section-title"><span className="section-icon">🔥</span><div><p className="eyebrow">STEP 1</p><h2>What are we cooking?</h2></div></div>
            <div className="add-form">
              <label htmlFor="preset">Choose a starting template</label>
              <select id="preset" value={preset} onChange={e=>setPreset(e.target.value as BuiltIn)}>
                {Object.entries(presets).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}
              </select>
              <p className="muted small">{presets[preset].notice}</p>
              <button className="button primary" onClick={()=>patch(m=>({...m,dishes:[...m.dishes,createDish(preset)]}))}>+ Add dish</button>
            </div>
            {meal.dishes.length>0 && <div className="dish-list">
              {meal.dishes.map(d=>(
                <article key={d.id} className="dish-card">
                  <div className="between">
                    <strong>{d.name}</strong>
                    <button className="link danger" onClick={()=>patch(m=>({...m,dishes:m.dishes.filter(item=>item.id!==d.id)}))} aria-label={"Remove "+d.name}>Remove</button>
                  </div>
                  <p className="muted small">{d.preset==="custom" ? "Imported recipe" : "Built-in timing template"}</p>
                  <label htmlFor={"name-"+d.id}>Dish name</label>
                  <input id={"name-"+d.id} value={d.name} onChange={e=>patch(m=>({...m,dishes:m.dishes.map(item=>item.id===d.id?{...item,name:e.target.value}:item)}))}/>
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
                </article>
              ))}
            </div>}
          </section>

          <section className="panel">
            <div className="section-title"><span className="section-icon">📋</span><div><p className="eyebrow">OPTIONAL</p><h2>Import a recipe</h2></div></div>
            <p className="muted">Paste your recipe or load a plain text file. We&apos;ll turn each line into an editable checklist step. Photo/PDF intelligence comes next.</p>
            <label htmlFor="recipe-name">Recipe title</label>
            <input id="recipe-name" value={recipeName} onChange={e=>setRecipeName(e.target.value)} placeholder="Grandma's mac & cheese"/>
            <label htmlFor="recipe-text">Recipe instructions</label>
            <textarea id="recipe-text" rows={7} value={recipeText} onChange={e=>setRecipeText(e.target.value)} placeholder={"1. Preheat oven\n2. Prepare ingredients\n3. Bake until cooked\n4. Let rest and serve"}/>
            <label className="file-label" htmlFor="recipe-file">Choose a .txt or .md recipe</label>
            <input id="recipe-file" className="file-input" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={e=>void onTextFile(e.target.files?.[0])}/>
            <button className="button secondary" disabled={!recipeText.trim()} onClick={()=>{
              const parsed=parseRecipeText(recipeName,recipeText);
              if(!parsed.steps?.length){setMessage("No recipe steps found. Try one instruction per line.");return;}
              setDraft(parsed);setMessage("");
            }}>Preview recipe steps</button>
            {draft && <div className="draft">
              <strong>Review {draft.steps?.length} imported steps</strong>
              <p className="muted small">The basic importer treats each non-empty line as a step, including ingredient lines. Remove any unwanted lines from the source before importing. Timing stays unassigned until you confirm it.</p>
              <ol>{draft.steps?.map(s=><li key={s.id}>{s.title}</li>)}</ol>
              <button className="button primary" onClick={()=>{patch(m=>({...m,dishes:[...m.dishes,draft]}));setDraft(null);setRecipeName("");setRecipeText("");setMessage("Added recipe. Set each step's timing in the dish editor.");}}>Add to this cook</button>
            </div>}
            {message && <p className="notice" role="status">{message}</p>}
          </section>
        </div>


            <div className="stack">
              <section className="panel ready-panel">
                <p className="eyebrow">READY WHEN YOU ARE</p>
                <h2>Your cooking plan</h2>
                <p className="muted">{meal.dishes.length === 0
                  ? "Add a dish to start building your timeline."
                  : meal.dishes.length + (meal.dishes.length === 1 ? " dish" : " dishes") + " · " + timeline.length + " planned steps"}</p>
                {warnings.map((warning,i) => <p className="warning" key={i}>⚠️ {warning}</p>)}
                {timeline.some(t => t.scheduledAt === null) && <p className="warning">⚠️ Some imported recipe steps don't have timing yet. Add durations for a useful schedule.</p>}
                {meal.dishes.length > 0 && (
                  <div className="ready-summary">
                    <div><span>Serve</span><strong>{when(meal.serveAt || null)}</strong></div>
                    <div><span>First planned step</span><strong>{when(timeline.find(t => !!t.scheduledAt)?.scheduledAt ?? null)}</strong></div>
                  </div>
                )}
                <button type="button" className="button primary start-cook-btn" disabled={meal.dishes.length === 0}
                  onClick={() => {patch(m => ({...m, mode: "cooking", startedAt: m.startedAt ?? new Date().toISOString()}));setShowCompleted(false);}}>
                  {meal.startedAt ? "▶ Resume cooking" : "🔥 Start the cook"}
                </button>
                <p className="small muted">When you start, your checklist takes center stage. You can return to edit the plan anytime without losing progress.</p>
              </section>
              <aside className="panel tip">
                <strong>A heads-up about timing</strong>
                <p>Schedules are estimates, not food-safety checks or guaranteed finish times. Use a thermometer and follow your equipment instructions.</p>
                <button className="link" onClick={() => {
                  if (window.confirm("Start a new meal? This replaces the current cook stored in this browser.")) {
                    setMeal(newMeal());
                    setShowCompleted(false);
                    setMessage("Started a new meal.");
                  }
                }}>Start a fresh plan →</button>
              </aside>
            </div>
          </div>
          {meal.dishes.length > 0 && (
            <div className="plan-mobile-bar">
              <span>{meal.dishes.length} {meal.dishes.length === 1 ? "dish" : "dishes"} ready</span>
              <button type="button" onClick={() => {patch(m => ({...m, mode: "cooking", startedAt: m.startedAt ?? new Date().toISOString()}));setShowCompleted(false);}}>
                {meal.startedAt ? "Resume cook →" : "Start cooking →"}
              </button>
            </div>
          )}
        </>
      )}
      <footer>How Many Beers? · Plan it. Cook it. Check it off. <span>Made for the cook, not the clock.</span></footer>
    </main>
  );
}
