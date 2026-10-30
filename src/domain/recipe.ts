import type { Dish, RecipeStep } from "./meal";

export type RecipeTiming={minutes:number|null;range?:[number,number]};
const words:Record<string,number>={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12};
const quantity='(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:\\.\\d+)?|half(?:\\s+an?)?|'+Object.keys(words).join('|')+')';
const units='(?:minutes?|mins?|hours?|hrs?|seconds?|secs?|days?|h|m|s)';
const value=(s:string)=>{
 if(s.startsWith('half'))return 0.5;
 if(s in words)return words[s];
 if(s.includes('/')){const parts=s.split(/\s+/),fraction=parts.pop()!.split('/').map(Number);return (parts.length?Number(parts[0]):0)+fraction[0]/fraction[1];}
 return Number(s);
};
/** Explicit durations only. Repeated/relative checks are not extra cook time. */
export function extractRecipeTiming(source:string):RecipeTiming{
 const text=source.toLowerCase().replace(/(\d+)\s*½/g,'$1.5').replace(/(\d+)\s*¼/g,'$1.25').replace(/(\d+)\s*¾/g,'$1.75').replaceAll('½','0.5').replaceAll('¼','0.25').replaceAll('¾','0.75').replace(/\bbetween\s+(\d+(?:\.\d+)?)\s+and\s+(\d+(?:\.\d+)?)/g,'$1–$2');
 const pattern=new RegExp('\\b('+quantity+')(?:\\s*(?:[-–—]|to)\\s*('+quantity+'))?\\s*-?\\s*('+units+')\\b','g');
 const matches=[] as {low:number;high:number;start:number;end:number}[];
 for(const match of text.matchAll(pattern)){
  const start=match.index!,prefix=text.slice(0,start),suffix=text.slice(start+match[0].length);
  if(/[\d./-]$/.test(prefix))return {minutes:null};
  if(/\b(?:every|after|at)\s*$/.test(prefix)||/^\s*(?:intervals?|increments?|remaining)\b/.test(suffix))continue;
  const factor=/^(?:h|hr|hour)/.test(match[3])?60:/^s/.test(match[3])?1/60:/^d/.test(match[3])?1440:1;
  const low=value(match[1])*factor,high=value(match[2]??match[1])*factor;
  if(!Number.isFinite(low)||!Number.isFinite(high)||low<0||high<low||high>43200)return {minutes:null};
  matches.push({low,high,start,end:start+match[0].length});
 }
 if(!matches.length)return {minutes:null};
 let low=matches[0].low,high=matches[0].high;
 for(let i=1;i<matches.length;i++){
  const between=text.slice(matches[i-1].end,matches[i].start);
  if(matches.length===2&&/\bbetween\s*$/.test(text.slice(0,matches[0].start))&&/^\s*and\s*$/.test(between)){high=matches[i].high;}
  else if(/^\s*(?:and\s*)?$/.test(between)){low+=matches[i].low;high+=matches[i].high;}
  else if(matches.length===2&&/^\s*(?:to|[-–—])\s*$/.test(between)){high=matches[i].high;}
  else return {minutes:null}; // Distinct cooking actions require a reviewed estimate.
 }
 if(high<low||high>43200)return {minutes:null};
 low=Math.round(low*1000000)/1000000;high=Math.round(high*1000000)/1000000;
 return {minutes:high,...(low!==high?{range:[low,high] as [number,number]}:{})};
}
const clean=(line:string)=>line.trim().replace(/^#{1,6}\s*/,'').replace(/\*\*/g,'').trim();
const instructionHeading=/^(?:instructions?|directions?|method|steps?|preparation)(?:\s*\([^)]*\))?:?$/i;
const referenceHeading=/^(?:ingredients?|equipment|notes?|tips?|storage|serving suggestions?)(?:\s*\([^)]*\))?:?$/i;

/** Parse explicit timing into a reviewable draft. Original source remains reference. */
export function parseRecipeText(name:string,text:string):Dish{
 const lines=text.split(/\r?\n/).map(clean).filter(Boolean);
 const structured=lines.some(line=>instructionHeading.test(line));
 const hasTitle=structured||/^\s*#{1,6}\s+/.test(text);
 const first=lines[0]??'';
 const sourceTitle=hasTitle&&!instructionHeading.test(first)&&!referenceHeading.test(first)&&!/^\d|^[-*•]|^(?:prep|cook|total)\s*time\s*:/i.test(first)?first:undefined;
 let inInstructions=!structured;
 const steps:RecipeStep[]=[];
 for(const line of lines){
  if(line===sourceTitle||line.toLowerCase()===name.trim().toLowerCase())continue;
  if(instructionHeading.test(line)){inInstructions=true;continue;}
  if(referenceHeading.test(line)){inInstructions=false;continue;}
  if(!inInstructions||/^(?:prep(?:aration)?|cook(?:ing)?|total|rest(?:ing)?)\s*time\s*:/i.test(line))continue;
  const instruction=line.replace(/^(?:\d+[.)]|[-*•])\s*/, '');
  if(instruction.length<3)continue;
  // A separate halfway/periodic reminder belongs to the preceding cooking step,
  // not to another interval that doubles the roast time or blocks the schedule.
  if(steps.length&&extractRecipeTiming(instruction).minutes===null&&/^(?:stir|turn|flip|rotate|check|baste)\b.*\b(?:halfway|every|after|at)\b/i.test(instruction)){
   const previous=steps[steps.length-1];previous.instructions=(previous.instructions??previous.title)+'\n'+instruction;continue;
  }
  if(steps.length>=100)break;
  const timing=extractRecipeTiming(instruction);
  steps.push({id:'step-'+(steps.length+1),title:instruction.slice(0,180),instructions:instruction,minutes:timing.minutes});
 }
 return {id:crypto.randomUUID(),name:name.trim()||sourceTitle?.slice(0,180)||'Imported recipe',preset:'custom',equipment:'Kitchen',cookMinutes:0,restMinutes:0,steps,recipeSource:text};
}
