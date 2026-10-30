import type {Dish,TemplateStage} from './meal';
import {turkeyPreparation} from './turkeyPrep';
/** Authored, editable planning allowances. Never infer activity lengths from the
 * distance between reminders, and never assign a timer to a doneness check. */
export function templateStage(dish:Dish,key:string):TemplateStage|undefined{
 const cook=Math.max(15,dish.cookMinutes),rest=Math.max(0,dish.restMinutes)+(dish.preset==='brisket'?dish.brisketPlan?.applied?.inputs.holdBufferMinutes??0:0);
 const prep=(minutes:number,startLabel?:string):TemplateStage=>({kind:'preparation',minutes,...(startLabel?{startLabel}:{})});
 const activity=(minutes:number,after:string,startLabel?:string):TemplateStage=>({kind:'activity',minutes,after,...(startLabel?{startLabel}:{})});
 if(key==='rest')return rest>0?{kind:'rest',minutes:rest,startLabel:'Begin rest now'}:undefined;
 if(key==='start')return {kind:'cook',minutes:dish.preset==='brats'||dish.preset==='wings'?cook-15:cook,startLabel:dish.preset==='brisket'||dish.preset==='wings'?'On smoker now':'Begin cooking now'};
 if(dish.preset==='brats')return key==='prep'?prep(20):key==='preheat'?prep(20):key==='bath'?activity(15,'start','Begin searing'):undefined;
 if(dish.preset==='wings')return key==='dry'?prep(480,'Begin refrigerated drying'):key==='prep'?prep(30):key==='preheat'?prep(25):key==='oil'?activity(10,'start'):key==='fry'?activity(3,'oil','Begin frying'):key==='finish'?activity(2,'fry'):undefined;
 if(dish.preset==='brisket')return key==='prep'?prep(dish.brisketPlan?.applied?.inputs.prepMinutes??30):key==='season'?prep(15):key==='preheat'?prep(dish.brisketPlan?.applied?.inputs.preheatMinutes??30):undefined;
 if(dish.preset==='turkey'){
  const t=turkeyPreparation(dish);
  return key==='brine'&&t.brineHours>0?prep(t.brineHours*60,'Begin refrigerated brining'):key==='dry'&&t.dryHours>0?prep(t.dryHours*60,'Begin refrigerated drying'):key==='prep'?prep(15):key==='preheat'?prep(45):undefined;
 }
 return key==='prep'?prep(20):key==='preheat'?prep(20):undefined;
}
