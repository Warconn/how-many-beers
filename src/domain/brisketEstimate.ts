import type { Dish } from './meal';

export type BrisketInputs = {
  weightLb?: number;
  weightMeasured: 'trimmed' | 'untrimmed';
  cut: 'packer' | 'flat';
  method: 'meatchurch-staged-v1' | 'traeger-225-v1';
  pitTempF: number;
  wrap: 'paper' | 'foil' | 'none';
  prepMinutes: number;
  preheatMinutes: number;
  restMinutes: number;
  holdBufferMinutes: number;
  comparePersonal: boolean;
};
export type BrisketEstimate = {
  version: 'brisket-window-v1';
  smokeMin: number | null; smokeMax: number | null;
  recommendedStart: string | null; latestStart: string | null; prepStart: string | null;
  assumptions: string[]; unknowns: string[]; sources: {title:string;url:string}[];
  inputs: BrisketInputs;
};
export type BrisketPlan = {
  inputs: BrisketInputs;
  mode: 'manual' | 'estimate';
  applied?: BrisketEstimate;
};
export const brisketDefaults:BrisketInputs={weightMeasured:'trimmed',cut:'packer',method:'meatchurch-staged-v1',pitTempF:200,wrap:'paper',prepMinutes:75,preheatMinutes:35,restMinutes:120,holdBufferMinutes:60,comparePersonal:false};
const source={title:'Meat Church · Pellet Grill Brisket',url:'https://www.meatchurch.com/blogs/recipes/pellet-grill-brisket'};
const guide={title:'Traeger · Brisket planning guide',url:'https://www.traeger.com/learn/how-to-smoked-brisket'};
export const safetySource={title:'USDA · Keep food safe',url:'https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/steps-keep-food-safe'};

/** Planning policy, not a measured doneness model. See docs/brisket-estimates.md. */
export function estimateBrisket(inputs:BrisketInputs, serveAt:string):BrisketEstimate {
  const i={...inputs};
  const unknowns:string[]=[];
  if(!Number.isFinite(i.weightLb) || !i.weightLb || i.weightLb<1 || i.weightLb>40)unknowns.push('Weight unknown: enter 1–40 lb to compare timing.');
  if(i.weightMeasured!=='trimmed')unknowns.push('Enter trimmed weight before applying a weight-based plan.');
  if(!['packer','flat'].includes(i.cut) || !['paper','foil','none'].includes(i.wrap))unknowns.push('Choose a supported cut and wrapping strategy.');
  const staged=i.method==='meatchurch-staged-v1';
  if(!staged && i.method!=='traeger-225-v1')unknowns.push('Choose a supported cooking profile.');
  if(i.pitTempF!==(staged?200:225))unknowns.push('This pit setting is outside the selected profile. Keep manual timing or restore its starting setpoint.');
  if([i.prepMinutes,i.preheatMinutes,i.restMinutes,i.holdBufferMinutes].some(n=>!Number.isFinite(n)||n<0||n>720))unknowns.push('Prep, preheat, rest and hold buffer must each be 0–720 minutes.');
  const serve=Date.parse(serveAt);
  if(!Number.isFinite(serve))unknowns.push('Set a valid serving date and time.');
  const assumptions=staged ? [
    'Meat Church stages: start at 200°F, raise to 225°F near 165°F internal, then 250–275°F after wrapping when bark is ready.',
    'App assumption: the existing 10–18 hour window at a 16 lb reference scales linearly with trimmed weight. This is an unvalidated planning comparison, not a time-per-pound claim from Meat Church.'
  ] : ['Traeger’s broad 30–60 min/lb guide is used only for this 225°F planning profile. It is not a guaranteed duration.'];
  if(i.cut==='flat')assumptions.push('Flat: widen the range by 25% at both ends. App uncertainty allowance, not a measured cut correction.');
  if(i.wrap==='none')assumptions.push('No wrap: allow 25% more time at the upper end. App buffer for an uncertain stall, not a measured prediction.');
  if(i.wrap==='foil')assumptions.push('Foil: retain the full range; no unverified speed-up credit.');
  assumptions.push('Thickness, stall, bark, weather and equipment can move these estimates. Check tenderness and safe temperatures.');
  const result:BrisketEstimate={version:'brisket-window-v1',inputs:i,smokeMin:null,smokeMax:null,recommendedStart:null,latestStart:null,prepStart:null,assumptions,unknowns,sources:[staged?source:guide,safetySource]};
  if(unknowns.length)return result;
  let low=i.weightLb!*(staged?37.5:30), high=i.weightLb!*(staged?67.5:60);
  if(i.cut==='flat'){low*=0.75;high*=1.25;}
  if(i.wrap==='none')high*=1.25;
  // Round outward to 15 minutes, avoiding misleading minute precision.
  result.smokeMin=Math.floor(low/15)*15;result.smokeMax=Math.ceil(high/15)*15;
  const before=(minutes:number)=>new Date(serve-minutes*60_000).toISOString();
  result.recommendedStart=before(result.smokeMax+i.restMinutes+i.holdBufferMinutes);
  result.latestStart=before(result.smokeMin+i.restMinutes);
  // Prep and preheat overlap, matching the existing template anchors.
  result.prepStart=before(result.smokeMax+i.restMinutes+i.holdBufferMinutes+Math.max(i.prepMinutes,i.preheatMinutes));
  return result;
}

export function applyBrisketTiming(dish:Dish, serveAt:string):Dish {
  if(!dish.brisketPlan)return dish;
  const estimate=estimateBrisket(dish.brisketPlan.inputs,serveAt);
  if(estimate.smokeMax===null)throw Error(estimate.unknowns.join(' '));
  return {...dish,weightLb:estimate.inputs.weightLb,pitTempF:estimate.inputs.pitTempF,
    cookMinutes:estimate.smokeMax,restMinutes:estimate.inputs.restMinutes,
    brisketPlan:{...dish.brisketPlan,mode:'estimate',applied:estimate}};
}
