'use client';
import type { Dish } from '@/domain/meal';
import { applyBrisketTiming, brisketDefaults, estimateBrisket, type BrisketInputs } from '@/domain/brisketEstimate';
const hours=(n:number)=>Number((n/60).toFixed(2));
const time=(iso:string|null)=>iso?new Date(iso).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'Timing needed';
export default function BrisketPlanner({dish,serveAt,onChange}:{dish:Dish;serveAt:string;onChange:(dish:Dish)=>void}){
  const inputs=dish.brisketPlan?.inputs ?? {...brisketDefaults,restMinutes:dish.restMinutes};
  const estimate=estimateBrisket(inputs,serveAt);
  const set=(changes:Partial<BrisketInputs>)=>onChange({...dish,brisketPlan:{...dish.brisketPlan,mode:dish.brisketPlan?.mode??'manual',inputs:{...inputs,...changes}}});
  const id=(field:string)=>'brisket-'+dish.id+'-'+field;
  const applied=dish.brisketPlan?.applied;
  const dirty=!!applied && (JSON.stringify(applied.inputs)!==JSON.stringify(inputs) || applied.recommendedStart!==estimate.recommendedStart);
  const estimated=dish.brisketPlan?.mode==='estimate';
  const current=estimated && !dirty;
  return <section className="brisket-planner" aria-label="Brisket timing">
    <h3>Plan brisket timing</h3>
    {!applied&&<p className="muted small">The manual starter uses your personal 180 → 225 → 250°F method. These comparisons use separate researched profiles.</p>}
    <p className="muted small">Compare a start window, then use it in your plan. Your fixed step times and recorded activity stay intact.</p>
    <div className="small-grid">
      <div><label htmlFor={id('weight')}>Brisket weight (lb)</label><input id={id('weight')} type="number" inputMode="decimal" min="1" max="40" step="0.5" placeholder="Unknown" value={inputs.weightLb??''} onChange={e=>set({weightLb:e.target.value===''?undefined:Number(e.target.value)})}/></div>
      <div><label htmlFor={id('measured')}>Weight measured</label><select id={id('measured')} value={inputs.weightMeasured} onChange={e=>set({weightMeasured:e.target.value as BrisketInputs['weightMeasured']})}><option value="trimmed">After trimming</option><option value="untrimmed">Before trimming</option></select></div>
      <div><label htmlFor={id('cut')}>Brisket cut</label><select id={id('cut')} value={inputs.cut} onChange={e=>set({cut:e.target.value as BrisketInputs['cut']})}><option value="packer">Whole packer</option><option value="flat">Flat (wider uncertainty)</option></select></div>
      <div><label htmlFor={id('wrap')}>Wrapping strategy</label><select id={id('wrap')} value={inputs.wrap} onChange={e=>set({wrap:e.target.value as BrisketInputs['wrap']})}><option value="paper">Butcher paper</option><option value="foil">Foil</option><option value="none">No wrap</option></select></div>
    </div>
    <label htmlFor={id('method')}>Cooking profile</label><select id={id('method')} value={inputs.method} onChange={e=>set({method:e.target.value as BrisketInputs['method'],pitTempF:e.target.value==='traeger-225-v1'?225:200})}><option value="meatchurch-staged-v1">Meat Church stages · 200 → 225 → 250/275°F</option><option value="traeger-225-v1">Traeger guide · 225°F comparison</option></select>
    {estimate.smokeMin===null ? <div className="notice"><strong>{!inputs.weightLb?'Weight unknown':'Timing needed'}</strong><ul>{estimate.unknowns.map(t=><li key={t}>{t}</li>)}</ul></div> : <div className="brisket-window" aria-live="polite">
      <p className="muted small">{inputs.method==='meatchurch-staged-v1'?'Unvalidated app weight comparison; recipe stages are source-inspired.':'Broad source-guide comparison; not calibrated to your cooker.'}</p>
      <strong>Estimated smoke: {hours(estimate.smokeMin)}–{hours(estimate.smokeMax!)} hours</strong>
      <p>Recommended on-smoker start <time dateTime={estimate.recommendedStart!}>{time(estimate.recommendedStart)}</time></p>
      <p>Latest plausible start <time dateTime={estimate.latestStart!}>{time(estimate.latestStart)}</time><span className="muted small"> Shortest estimate, no extra hold buffer; higher risk of missing dinner.</span></p>
      <p className="small">Begin prep {time(estimate.prepStart)} · Serve {time(new Date(serveAt).toISOString())}</p>
      <p className="muted small">The plan uses the longer smoke estimate plus rest and a separate hold buffer. Neither start guarantees dinner on time.</p>
      {estimate.recommendedStart && Date.parse(estimate.recommendedStart)<Date.now() && <p className="warning">The recommended start has passed. Serving time may be at risk; review your plan.</p>}
    </div>}
    <div className="timing-choice">
      <p role="status"><strong>{estimated?'Using estimated timing':'Using manual timing'}</strong><span>{estimated ? dirty?'Comparison changed. Apply it to update your plan.':'This estimate is in your plan. Changing serving time shifts derived steps.' : 'Your current step timings stay in place until you apply this comparison.'}</span></p>
      <div className="timing-choice-actions">
        <button type="button" className="button secondary" disabled={estimate.smokeMax===null || current} onClick={()=>onChange(applyBrisketTiming({...dish,brisketPlan:{...dish.brisketPlan,mode:'manual',inputs}},serveAt))}>{current?'Timing applied':'Use this timing'}</button>
        {estimated && <button type="button" className="link" onClick={()=>onChange({...dish,brisketPlan:{...dish.brisketPlan,inputs,mode:'manual'}})}>Use manual timing</button>}
      </div>
    </div>
    <details><summary>Timing assumptions &amp; options</summary>
      <div className="small-grid">{(['prepMinutes','preheatMinutes','restMinutes','holdBufferMinutes'] as const).map((field,index)=><div key={field}><label htmlFor={id(field)}>{['Prep (minutes)','Preheat (minutes)','Rest (minutes)','Extra hot-hold buffer (minutes)'][index]}</label><input id={id(field)} type="number" min="0" max="720" value={inputs[field]} onChange={e=>set({[field]:e.target.value===''?0:Number(e.target.value)})}/></div>)}
        <div><label htmlFor={id('pit')}>Profile starting pit (°F)</label><input id={id('pit')} type="number" min="150" max="450" value={inputs.pitTempF} onChange={e=>set({pitTempF:Number(e.target.value)})}/></div>
      </div>
      <p className="muted small">Prep and preheat overlap. Rest and extra hold buffer are counted once each. Hold only with temperature monitoring at 140°F or above; a cooler is not temperature control.</p>
      <ul className="small">{estimate.assumptions.map(a=><li key={a}>{a}</li>)}</ul>
      <label className="personal-rule"><input type="checkbox" checked={inputs.comparePersonal} onChange={e=>set({comparePersonal:e.target.checked})}/>Compare my 1.5 hr/lb rule</label>
      {inputs.comparePersonal && inputs.weightLb && <p className="small">Personal comparison: {inputs.weightLb*1.5} hours of smoke, plus rest/hold. User recollection, not validated guidance; not used in the recommendation.</p>}
      <div className="template-sources">{estimate.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.title} ↗</a>)}</div>
    </details>
  </section>;
}
