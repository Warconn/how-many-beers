'use client';
import type {Dish} from '@/domain/meal';
import {turkeyPreparation} from '@/domain/turkeyPrep';
export default function TurkeyPreparation({dish,onChange}:{dish:Dish;onChange:(dish:Dish)=>void}){
 const prep=turkeyPreparation(dish),id=(field:string)=>'turkey-'+dish.id+'-'+field;
 const set=(change:Partial<typeof prep>)=>onChange({...dish,turkeyPrep:{...prep,...change}});
 return <section className="brisket-planner" aria-label="Turkey preparation">
  <h3>Plan turkey preparation</h3>
  <p className="muted small">Oven-roasted, unstuffed. Review these preparation times before relying on your schedule.</p>
  <label htmlFor={id('state')}>Turkey thawing status</label>
  <select id={id('state')} value={prep.state} onChange={e=>set({state:e.target.value as typeof prep.state})}>
   <option value="frozen">Frozen / plan full thaw</option><option value="thawing">Already thawing</option><option value="thawed">Fully thawed</option>
  </select>
  <div className="small-grid">
   {prep.state!=='thawed'&&<div><label htmlFor={id('thaw')}>Refrigerator thaw days remaining</label><input id={id('thaw')} type="number" min="0" max="14" step="0.5" value={prep.thawDays} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=0&&n<=14)set({thawDays:n});}}/></div>}
   <div><label htmlFor={id('brine')}>Brine hours</label><input id={id('brine')} type="number" min="0" max="48" step="0.25" value={prep.brineHours} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=0&&n<=48)set({brineHours:n});}}/></div>
   <div><label htmlFor={id('dry')}>Refrigerated air-dry hours</label><input id={id('dry')} type="number" min="0" max="48" step="0.25" value={prep.dryHours} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=0&&n<=48)set({dryHours:n});}}/></div>
  </div>
  <p className="muted small">Allow about 24 hours per 4–5 lb to thaw at 40°F or below. The default allows 6 days for a 22 lb bird; if already thawing, enter the remaining time. Brine 22 h and air-dry 2¼ h reflect the supplied plan; follow your Meat Church product directions. Set brine hours to 0 to skip brining.</p>
 </section>;
}
