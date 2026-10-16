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
  const imaginaryBeers = Number((minutesLeft / 90).toFixed(1));
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
        <strong>{dish && valid ? (isFinished ? "Done!" : imaginaryBeers.toFixed(1)) : "—"}</strong>
        <span>{isFinished ? "You checked it off" : "imaginary beers"}</span>
      </div>
      <p className="beerometer-clock">{dish && valid && !isFinished
        ? (minutesLeft === 0 ? "The planned finish time has passed" : `${hours}h ${String(minutes).padStart(2, "0")}m on the clock`)
        : isFinished ? "Nice work. Dinner awaits." : "The clock starts once you add a dish."}</p>
    </div>
    <p className="beerometer-disclaimer">1 imaginary beer = 90 minutes. Just a fun countdown, not a drinking target or a reliable doneness estimate. Trust the probe, not the clock.</p>
  </section>;
}

export default function Home() {
  const [meal, setMeal] = useState<Meal | null>(null);
  const [preset, setPreset] = useState<BuiltIn>("brisket");
  const [recipeName, setRecipeName] = useState("");
  const [recipeText, setRecipeText] = useState("");
  const [draft, setDraft] = useState<Dish | null>(null);
  const [message, setMessage] = useState("");

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

  return (
    <main className="shell">
      <header className="site-header">
        <div className="brand-icon" aria-hidden>🍺</div>
        <div>
          <p className="eyebrow">THE COOKING CHECKLIST</p>
          <h1>How Many Beers?</h1>
          <p className="subtitle">Dinner has a deadline. Brisket does not.</p>
        </div>
        <span className="version-pill">Early MVP</span>
      </header>

      <section className="hero panel">
        <div>
          <p className="eyebrow">YOUR GAME PLAN</p>
          <h2>What time are we eating?</h2>
          <p>Pick a time, add your dishes, and keep the actual cook in one place.</p>
        </div>
        <div className="hero-fields">
          <label htmlFor="meal-name">Meal name</label>
          <input id="meal-name" value={meal.name} onChange={e => patch(m => ({...m,name:e.target.value}))} maxLength={80}/>
          <label htmlFor="serve-at">Serve date and time</label>
          <input id="serve-at" type="datetime-local" value={meal.serveAt} onChange={e=>patch(m=>({...m,serveAt:e.target.value}))}/>
        </div>
      </section>

      <BeerEstimator meal={meal} timeline={timeline}/>

      <div className="two-column">
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
          <section className="panel checklist-panel">
            <div className="section-title"><span className="section-icon">✅</span><div><p className="eyebrow">STEP 2</p><h2>Follow the plan</h2></div></div>
            {timeline.length===0 ? <div className="empty"><span aria-hidden>🕒</span><h3>No steps yet</h3><p>Add your first dish to build a serving-time checklist.</p></div> : <>
              <div className="progress-heading"><strong>{complete} / {timeline.length} complete</strong><span>{Math.round(100*complete/timeline.length)}%</span></div>
              <div className="progress-track"><div style={{width:(100*complete/timeline.length)+"%"}}/></div>
              {next && <div className="up-next"><p className="eyebrow">UP NEXT</p><strong>{next.title}</strong><p>{next.dishName} · {when(next.scheduledAt)}</p></div>}
              {warnings.map((warning,i)=><div className="warning" key={i}>⚠️ {warning}</div>)}
              {timeline.some(t=>t.scheduledAt===null) && <div className="warning">⚠️ Some imported steps need durations before they can be scheduled.</div>}
              <div className="checklist">
                {timeline.map(task=>{
                  const done=meal.completed[task.id];
                  return <article key={task.id} className={"task "+(done?"done":"")}>
                    <label className="task-top">
                      <input type="checkbox" checked={!!done} onChange={e=>patch(m=>{
                        const completed={...m.completed};if(e.target.checked)completed[task.id]=new Date().toISOString();else delete completed[task.id];return {...m,completed};
                      })}/>
                      <div className="task-main"><div className="between"><strong>{task.title}</strong><time>{when(task.scheduledAt)}</time></div>
                        <p className="task-dish">{task.dishName}</p>
                        <p className="muted small">{task.instructions}</p>
                        {task.isCondition && <span className="condition">Requires a real-world check</span>}
                        {done && <p className="completed-time">✓ Completed {new Date(done).toLocaleString()}</p>}
                      </div>
                    </label>
                    <label className="note-label" htmlFor={"note-"+task.id}>Cook notes / temperature</label>
                    <input id={"note-"+task.id} className="task-note" placeholder="e.g. 169°F, wrapped, bark looks good" value={meal.notes[task.id]||""} onChange={e=>patch(m=>({...m,notes:{...m.notes,[task.id]:e.target.value}}))}/>
                  </article>;
                })}
              </div>
            </>}
          </section>
          <aside className="panel tip">
            <strong>A heads-up about timing</strong>
            <p>These are editable planning estimates, not guaranteed finish times or food-safety checks. Always use a food thermometer, follow your equipment instructions, and hold food at appropriate temperatures.</p>
            <button className="link" onClick={()=>{
              if(window.confirm("Start a new meal? This will replace the current locally saved cook.")){
                setMeal(newMeal());
                setMessage("Started a new meal.");
              }
            }}>Start a fresh cook →</button>
          </aside>
        </div>
      </div>
      <footer>How Many Beers? · Plan it. Cook it. Check it off. <span>Made for the cook, not the clock.</span></footer>
    </main>
  );
}
