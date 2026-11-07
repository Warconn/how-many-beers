"use client";

import {useRecipeFirst} from '@/components/RecipeFirstContext';
import RecipeMethodReview from '@/components/RecipeMethodReview';
import {useStepReorder} from '@/components/useStepReorder';
import {StepReorderHelp} from '@/components/StepListControls';
import {reorderPlannedStep} from '@/domain/stepReorder';
import {recipeReview,addReviewedDish,reviewDuration} from '@/domain/recipeReview';
import UpcomingCooks from '@/components/UpcomingCooks';
import CancelCookDialog from '@/components/CancelCookDialog';
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dish, Meal, PlannedTask, PresetId } from "@/domain/meal";
import { createDish, newMeal, presets } from "@/domain/meal";
import { chronologicalTasks, formatDuration } from "@/domain/stepTiming";
import { equipmentWarnings } from "@/domain/schedule";
import { addStep, cookTimeline, stepTimingWarnings, setStepDuration, editStep, moveStep, recordEvent, removeStep, updateTaskNote, startCookSession, addDishToMeal } from "@/domain/cookState";
import type { CookEventKind, ExtendedMeal } from "@/domain/cookState";
import BeerEstimator from '@/components/Beerometer';
import TurkeyPreparation from "@/components/TurkeyPreparation";
import BrisketPlanner from "@/components/BrisketPlanner";
import PlannedCookStart from "@/components/PlannedCookStart";
import CookingChecklist from "@/components/CookingChecklist";
import { cookingFocus, guidedCookingSteps } from "@/domain/cookingFocus";
import {cookingTitle} from "@/components/CookingStepSummary";
import TaskRow from "@/components/TaskRow";
import {physicalPhase} from "@/domain/physicalPhase";
import StepForecastTime from "@/components/StepForecastTime";
import {recordRemainingEstimate} from '@/domain/cookingPhases';
import {cookProjection} from "@/domain/cookProjection";
import {liveStepForecasts} from "@/domain/cookForecast";
import RecipeDetails from "@/components/RecipeDetails";
import RecipePreview from "@/components/RecipePreview";
import Icon from "@/components/Icon";
import RemoveButton from "@/components/RemoveButton";
import AddStepForm from "@/components/AddStepForm";
import { parseRecipeText } from "@/domain/recipe";
import { archiveCook, exportBackup, MAX_BACKUP_BYTES, removeArchivedCook, repeatArchivedCook, validateBackup } from "@/domain/cookHistory";
import type { ArchivedCook } from "@/domain/cookHistory";
import CookHistoryPanel from "@/components/CookHistoryPanel";
import AccountControl from '@/components/AccountControl';
import {takeCookReturn} from '@/auth/returnToCook';
import {useCookWorkspace} from '@/account/useCookWorkspace';
import {useAccount} from '@/auth/AccountProvider';
import AccountPanel from '@/components/AccountPanel';

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

function downloadCookFile(contents:string,filename:string){
 const blob=new Blob([contents],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}
export default function Home(){
  const {ownerId}=useAccount();
  const owner=process.env.NEXT_PUBLIC_ENABLE_CLOUD_COOKS==='true'?ownerId:null;
  const [identity,setIdentity]=useState({owner,key:0});
  if(identity.owner!==owner)setIdentity({owner,key:identity.owner?identity.key+1:identity.key});
  return <CookExperience key={identity.key}/>;
}
function CookExperience() {
  const recipeFirst=useRecipeFirst();
  const [methodReview,setMethodReview]=useState<ExtendedMeal|null>(null);
  const reviewTarget=useRef<string|null>(null);
  const workspace=useCookWorkspace();
  const {meal,history,status:storageStatus,error:storageError,setError:setStorageError,patch,save,retry,reset,restore,recoveryExport}=workspace;
  const [view, setView] = useState<"home" | "planning" | "cooking" | "history">("home");
  useEffect(()=>{setMethodReview(null);setView('home');setEditingStep(null);setNewStepDishId(null);setShowDishSetup(false);setShowCancel(false);setRecipeText('');setRecipeName('');},[workspace.selection]);
  const accountReturnHandled=useRef(false);
  useEffect(()=>{
    if(!meal||accountReturnHandled.current)return;
    accountReturnHandled.current=true;
    const url=new URL(window.location.href);
    if(url.searchParams.get("account-return")!=="1")return;
    url.searchParams.delete("account-return");
    window.history.replaceState(null,"",url.pathname+url.search+url.hash);
    try{const returning=takeCookReturn(window.sessionStorage,meal.id);if(returning)setView(returning==="cooking"&&meal.mode!=="cooking"?"planning":returning);}catch{/* Fall back to Home if tab storage is unavailable. */}
  },[meal]);
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
  const [clockNow,setClockNow] = useState(()=>Date.now());
  const [cookPanel,setCookPanel] = useState<"step"|"checklist">("step");
  const [guidedTaskId,setGuidedTaskId] = useState<string|null>(null);
  const [cookReadingOpen,setCookReadingOpen] = useState(false);
  const [addStepDraftOpen,setAddStepDraftOpen] = useState(false);
  const [navigationNote,setNavigationNote] = useState("");
  const [outcome,setOutcome] = useState("");
  const [showFinish,setShowFinish] = useState(false);
  const [showCancel,setShowCancel] = useState(false);
  const cancelTrigger=useRef<HTMLButtonElement|null>(null);
  const [planSaveResult,setPlanSaveResult] = useState<"saved"|"error"|null>(null);

  useEffect(()=>{
    if(view!=="cooking"){setEditingStep(current=>current?.context==="cooking"?null:current);return;}
    const update=()=>{
      // Avoid moving an editor or a partially entered reading between groups.
      if(editingStep?.context==="cooking" || document.querySelector('.cooking-screen .reading-form'))return;
      if(document.activeElement?.matches('input:not([type=checkbox]),textarea,select'))return;
      setClockNow(Date.now());
    };
    update();
    const timer=window.setInterval(update,30_000);
    document.addEventListener('visibilitychange',update);
    window.addEventListener('focus',update);
    return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',update);window.removeEventListener('focus',update);};
  },[view,editingStep]);

  useEffect(()=>{
    if(view==="cooking"){setCookPanel("step");setGuidedTaskId(null);setShowFinish(false);setNavigationNote("");}
  },[view]);
  useEffect(()=>{
    const draft=!!methodReview||!!editingStep||!!newStepDishId||cookReadingOpen||addStepDraftOpen||(showFinish&&!!outcome)||(showDishSetup&&addMethod==='recipe'&&!!recipeText);
    if(!draft)return;
    const leave=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',leave);const signout=(event:Event)=>event.preventDefault();if(methodReview)window.addEventListener('hmb-before-signout',signout);return ()=>{window.removeEventListener('beforeunload',leave);window.removeEventListener('hmb-before-signout',signout);};
  },[methodReview,editingStep,newStepDishId,cookReadingOpen,addStepDraftOpen,showFinish,outcome,showDishSetup,addMethod,recipeText]);

  const timeline = useMemo(() => meal ? cookTimeline(meal) : [], [meal]);
  const projection=useMemo(()=>meal&&(meal.mode==="cooking"||meal.startedAt)?cookProjection(meal,timeline,clockNow):null,[meal,timeline,clockNow]);
  const forecasts=useMemo(()=>projection?.forecasts??(meal?liveStepForecasts(meal,timeline,clockNow):{}),[meal,timeline,clockNow,projection]);
  const liveSchedule = useMemo(() => chronologicalTasks(timeline), [timeline]);
  const warnings = useMemo(() => meal ? [...equipmentWarnings(meal),...stepTimingWarnings(meal)] : [], [meal]);
  const cookingTasks=meal?.phasePlan?timeline.filter(t=>!meal.phasePlan!.suppressed.includes(t.id)):timeline;
  const progressTasks=view==='cooking'?cookingTasks:timeline;
  const complete = meal ? progressTasks.filter(task => !!meal.completed[task.id]).length : 0;

  const remaining = meal ? cookingTasks.filter(task => !meal.completed[task.id]) : [];
  const phaseWaiting=!!meal?.phasePlan&&!remaining.length&&(projection?.remaining===null||(projection?.remaining??0)>0);
  const focus = cookingFocus(timeline,meal?.completed??{},clockNow);
  const guidance=guidedCookingSteps(cookingTasks,meal?.completed??{},guidedTaskId,meal?.phasePlan?forecasts:undefined);

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

  const planReorder=useStepReorder(!recipeFirst||view!=='planning'||!!editingStep||!!newStepDishId||!!methodReview||workspace.locked,(id,target,after)=>{
    patch(current=>reorderPlannedStep(current,id,target,after));setClockNow(Date.now());setMessage('');
  });

  if (!meal) return <main className="shell"><header className="site-header"><h1>How Many Beers?</h1><AccountControl view={view} cookId={workspace.selectedPlanId??''} canReload={false} savePhase={workspace.kind==='account'?workspace.savePhase:undefined}/></header><div className="panel"><p role="status">Loading your cook...</p>{workspace.isSelectedPlan&&<button type="button" className="button secondary" onClick={()=>void workspace.returnToCurrent().then(()=>setView('home')).catch(()=>{})}>Home</button>}{workspace.authUnavailable&&<AccountPanel/>}</div></main>;


  const cooking = view === "cooking";
  const cookInProgress = meal.mode === "cooking" || !!meal.startedAt || (workspace.plansEnabled&&!workspace.isSelectedPlan&&workspace.currentCookInProgress);
  const startBlockReason = timeline.length === 0 ? "Add a dish or prep step to start."
    : !Number.isFinite(new Date(meal.serveAt).getTime()) ? "Set a valid serving date and time to start." : "";
  const hasActiveWork = (workspace.plansEnabled&&workspace.upcomingPlans.length>0) || timeline.length > 0 || meal.dishes.length > 0 || Object.keys(meal.completed).length > 0 || !!meal.startedAt || ((meal as ExtendedMeal).events?.length ?? 0) > 0 || (meal.name !== "Next cook") || (meal.mode === "cooking");
  const planStepDraftOpen=!!methodReview||editingStep?.context==="dish" || editingStep?.context==="checklist" || newStepDishId!==null;
  const savePlanForLater = async () => {
    if(workspace.kind==='trial'){window.dispatchEvent(new Event('hmb-open-account'));return;}
    if(cookInProgress || timeline.length===0 || planStepDraftOpen)return;
    try{
      await save({active:meal});
      if(workspace.plansEnabled)await workspace.returnToCurrent();
      setStorageError(previous=>previous.startsWith("Browser storage is unavailable") || previous.startsWith("Could not save the cook start.") ? "" : previous);
      setPlanSaveResult("saved");setView("home");setEditingStep(null);
      window.scrollTo({top:0,behavior:"instant"});
    }catch{if(workspace.plansEnabled){setPlanSaveResult(null);try{await workspace.returnToCurrent();setView('home');}catch{/* Keep the current document until its draft is protected. */}}else{setPlanSaveResult("error");requestAnimationFrame(()=>document.getElementById("save-plan-error")?.focus());}}
  };
  const startCooking = async () => {
    if(workspace.plansEnabled&&workspace.isSelectedPlan){
      try{await workspace.startSelectedPlan();setView('cooking');setStorageError('');window.scrollTo({top:0,behavior:'instant'});}catch{/* The existing save indicator tracks the pending start. */}return;
    }
    if(!cookInProgress && startBlockReason)return;
    const next:Meal=!cookInProgress ? startCookSession(meal,new Date().toISOString())
      : meal.mode!=="cooking" ? {...meal,mode:"cooking"} : meal;
    try{
      await save({active:next});
      setStorageError(previous=>previous.startsWith("Could not save the cook start.") ? "" : previous);
      setPlanSaveResult(null);setView("cooking");
      window.scrollTo({top:0,behavior:"instant"});
    }catch{setStorageError("Could not save the cook start. Your plan is unchanged. Retry saving or download a backup.");requestAnimationFrame(()=>document.getElementById("storage-warning")?.focus());}
  };
  const beginNewCook = async () => {
    if(workspace.plansEnabled){
      try{await workspace.createPlan();setView('planning');setShowDishSetup(false);setEditingDishId(null);setEditingStep(null);setAddMethod('template');setMessage('');setPlanSaveResult(null);}
      catch{if(workspace.hasSelectedPlan())setView('planning');}return;
    }
    if (hasActiveWork && !window.confirm("Start a new cook? This replaces your unfinished cook. Export a backup first if you want to keep it.")) return;
    try {
      const fresh = hasActiveWork ? newMeal() : meal;
      await save({active:fresh});setPlanSaveResult(null);
      setView("planning");
      setShowDishSetup(false);
      setEditingDishId(null);
      setEditingStep(null);
      setAddMethod("template");

      setMessage("");
    } catch { setStorageError("Unable to save a new cook. Your current cook is unchanged."); }
  };
  const safelyPatch = (fn:(m:Meal)=>Meal) => {
    try { patch(fn); setClockNow(Date.now()); setMessage(""); }
    catch(error) { setMessage(error instanceof Error ? error.message : "Could not update checklist."); }
  };
  const returnHome = () => {
    setShowFinish(false);
    setOutcome("");
    setView("home");
    window.scrollTo({top:0,behavior:"instant"});
  };
  const goHome = async () => {if(methodReview&&!window.confirm('Discard this recipe review and return Home?'))return;setMethodReview(null);try{if(workspace.plansEnabled)await workspace.returnToCurrent();returnHome();}catch{/* The existing save indicator reflects changes still being saved. */}};
  const continueCurrentCook = async () => {try{await workspace.returnToCurrent();setView('cooking');}catch{/* Keep both documents intact until saving can continue. */}};
  const openUpcomingPlan = async (id:string) => {try{await workspace.openPlan(id);setView('planning');setPlanSaveResult(null);setMessage('');}catch{if(workspace.hasSelectedPlan())setView('planning');}};
  const startUpcomingPlan = async (id:string) => {try{await workspace.openPlan(id);await workspace.startSelectedPlan();setView('cooking');setMessage('');}catch{if(workspace.hasSelectedPlan())setView('planning');}};
  const persistNewMeal = async(next:Meal) => {await save({active:next});returnHome();};
  const dismissCancel = () => {setShowCancel(false);requestAnimationFrame(()=>cancelTrigger.current?.focus());};
  const confirmCancel = async () => {
    await workspace.cancel(meal.id);
    setShowCancel(false);returnHome();setMessage("Cook canceled.");
  };
  const finishCook = async () => {
    if(workspace.kind==='trial'){window.dispatchEvent(new Event('hmb-open-account'));return;}
    if(!meal) return;
    try{
      const nextArchive=archiveCook(meal,history,outcome,new Date().toISOString());
      await save({active:newMeal(),history:nextArchive});
      returnHome();
      setMessage("Cook saved to history. Ready for the next one!");
    }catch(error){
      setStorageError("Could not save this cook. It is still available in your active checklist. Keep this page open. Retry saving or download a backup.");
    }
  };
  const repeatCook = async(entry:ArchivedCook) => {
    if(workspace.plansEnabled){try{await workspace.createPlan(repeatArchivedCook(entry));setView('planning');setMessage('Copied your previous cook into a new upcoming plan.');}catch{if(workspace.hasSelectedPlan())setView('planning');}return;}
    if(!window.confirm("Start a new cook using this saved plan? Any unsaved current plan will be replaced."))return;
    try{await persistNewMeal(repeatArchivedCook(entry));setMessage("Copied your previous cook. Set a new serving time before starting.");setStorageError("");}
    catch{setStorageError("Could not create a repeat cook. Your current plan was not replaced.");}
  };
  const deleteCook = async(entry:ArchivedCook) => {
    if(!window.confirm("Delete this saved cook permanently? Consider downloading a backup first."))return;
    try{
      const next=removeArchivedCook(history,entry.id);
      await save({history:next});
    }catch{setStorageError("Could not delete the saved cook. Retry saving or download a backup.");}
  };
  const downloadBackup = () => {
    if(workspace.plansEnabled&&workspace.isSelectedPlan){downloadCookFile(recoveryExport(),'how-many-beers-plan-draft-recovery.json');return;}
    if(!meal)return;
    try{
      const blob=new Blob([exportBackup(workspace.backup?.active??meal,workspace.backup?.history??history,new Date().toISOString(),workspace.backup?.canceled)],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement("a");
      anchor.href=url;
      anchor.download="how-many-beers-backup-"+new Date().toISOString().slice(0,10)+".json";
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),500);
    }catch{setStorageError("Could not export the cook backup.");}
  };
  const importBackup = async (file:File) => {
    if(file.size>MAX_BACKUP_BYTES){setStorageError("Backup is too large (32 MB maximum).");return;}
    try{
      const data=validateBackup(await file.text());
      if(!window.confirm("Restore this backup? It replaces your active cook and saved history."))return;
      await restore(data);
      setMessage("Your cook history has been restored.");
    }catch{setStorageError("Could not restore backup. Check that it is a valid cook backup and that browser storage is available. Your original data is retained for recovery.");}
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
    requestAnimationFrame(()=>document.getElementById("add-step-"+dishId)?.focus());
  };
  const addCustom = (title:string,instructions:string,scheduledAt:string|null) => {
    safelyPatch(m=>addStep(m,title,instructions,scheduledAt));
  };
  const cookingDraftOpen=editingStep?.context==="cooking" || cookReadingOpen || addStepDraftOpen;
  const focusGuidedStep=()=>requestAnimationFrame(()=>{
    const element=document.querySelector<HTMLElement>('.guided-step .cook-task')??document.getElementById('cook-complete');
    element?.focus({preventScroll:true});element?.scrollIntoView({block:"start",behavior:"instant"});
  });
  const openGuidedStep=(id:string)=>{
    if(cookingDraftOpen)return;
    setGuidedTaskId(id);setCookPanel("step");setNavigationNote("");focusGuidedStep();
  };
  const toggleCookPanel=()=>{
    if(cookingDraftOpen)return;
    setNavigationNote("");setCookPanel(current=>current==="step"?"checklist":"step");
    requestAnimationFrame(()=>document.getElementById(cookPanel==="step"?"full-cook-checklist":!remaining.length&&!guidedTaskId?"cook-complete":"current-cook-step")?.focus());
  };
  const completeCookingStep=(id:string,done:boolean)=>{
    safelyPatch(m=>recordEvent(m,id,done?"completed":"reopened",new Date().toISOString()));
    setEditingStep(null);setGuidedTaskId(null);
    setNavigationNote(done?(timeline.some(t=>t.id!==id&&!meal.completed[t.id])?"Step checked off. Showing the next unchecked step.":""):"Step reopened. Its previous activity is retained.");
    if(!done)setCookPanel("step");
    if(cookPanel==="step"||!done)focusGuidedStep();
  };
  const openFinishCook=()=>{
    if(cookingDraftOpen)return;
    setShowFinish(true);requestAnimationFrame(()=>document.getElementById("cook-outcome")?.focus());
  };
  const taskCard = (task: PlannedTask, mode:"planning"|"cooking", isNext = false, compact = false) => {
    const visibleTasks = compact||mode==="planning" ? timeline.filter(t=>t.dishId===task.dishId) : timeline;
    const index = visibleTasks.findIndex(t => t.id === task.id);
    const taskEvents = (meal as ExtendedMeal).events ?? [];
    const phase=projection?.phases?.find(p=>p.dishId===task.dishId&&p.active&&(p.kind==='heating'||Date.parse(p.finish)>clockNow))??projection?.phases?.find(p=>p.id===forecasts[task.id]?.phaseId);
    const concurrent=projection?.phases?.filter(p=>p.dishId!==task.dishId&&p.active&&(p.kind==='heating'||Date.parse(p.finish)>clockNow))??[];
    const context = compact ? "dish" : mode === "cooking" ? "cooking" : "checklist";
    return <TaskRow
      key={task.id}
      task={task}
      forecast={mode==="cooking"?forecasts[task.id]:undefined}
      activePhase={mode==='cooking'?phase:undefined}
      alsoCooking={mode==='cooking'&&guidance.current?.id===task.id?[...new Set(concurrent.map(p=>meal.dishes.find(d=>d.id===p.dishId)?.name??'Another dish'))]:[]}
      onRemainingEstimate={mode==='cooking'&&phase?.active?minutes=>safelyPatch(m=>recordRemainingEstimate(m,phase.id,minutes,new Date().toISOString())):undefined}
      showTimingDetails={task.dishId==='custom'||meal.dishes.some(d=>d.id===task.dishId&&d.preset==='custom')}
      hasServeTarget={Number.isFinite(Date.parse(meal.serveAt))}
      index={index}
      count={visibleTasks.length}
      compact={compact}
      planningControls={recipeFirst&&mode==='planning'?{grip:planReorder.grip(task.id),dragging:planReorder.list===(compact?'dish-'+task.dishId:'meal-plan')&&planReorder.dragging===task.id,drop:planReorder.list===(compact?'dish-'+task.dishId:'meal-plan')&&planReorder.drop?.id===task.id?(planReorder.drop.after?'after':'before'):null,duration:reviewDuration(meal,task)}:undefined}
      editorId={context+"-step-"+task.id}
      editing={editingStep?.id===task.id && editingStep.context===context}
      onEditingChange={open=>{if(open && mode==="cooking")setGuidedTaskId(task.id);setEditingStep(open?{id:task.id,context}:null);}}
      isNext={isNext}
      mode={mode}
      completedAt={meal.completed[task.id]}
      events={taskEvents}
      note={meal.notes[task.id] || ""}
      onReadingChange={mode==="cooking"?setCookReadingOpen:undefined}
      onNote={value=>patch(m=>updateTaskNote(m,task.id,value,new Date().toISOString()))}
      onEdit={(title,instructions,details)=>safelyPatch(m=>{
        const changed=title!==task.title || instructions!==task.instructions;
        const updated=editStep(m,task.id,title,instructions,details);
        if(!changed || m.mode!=="cooking" || physicalPhase(task) || !!m.phasePlan?.actions[task.id]?.starts?.length) return updated;
        const history=(m as ExtendedMeal).events??[];
        const taskEvents=history.filter(e=>e.taskId===task.id);
        const reopen=taskEvents.map(e=>e.kind).lastIndexOf("reopened");
        if(taskEvents.slice(reopen+1).some(e=>e.kind==="started"||e.kind==="completed")) return updated;
        return recordEvent(updated,task.id,"started",new Date().toISOString());
      })}
      onDurationChange={mode==="planning"&&meal.dishes.some(d=>d.id===task.dishId&&d.preset==='custom')&&!task.id.endsWith(':serve')?minutes=>safelyPatch(m=>setStepDuration(m,task.id,minutes)):undefined}
      durationDisabled={!!editingStep||!!newStepDishId}
      onMove={direction=>{
        try { moveStep(meal,task.id,direction,task.dishId,mode==="planning"); }
        catch(error) { return error instanceof Error?error.message:"Could not move this step."; }
        safelyPatch(m=>moveStep(m,task.id,direction,task.dishId,mode==="planning"));
      }}
      onRemove={()=>{setEditingStep(current=>current?.id===task.id?null:current);safelyPatch(m=>removeStep(m,task.id,new Date().toISOString()));}}
      onEvent={(kind:CookEventKind,value,unit,note,occurredAt)=>{
        if(kind==="completed"||kind==="reopened")completeCookingStep(task.id,kind==="completed");
        else safelyPatch(m=>recordEvent(m,kind==='started'&&phase?phase.startTaskId:task.id,kind,occurredAt??new Date().toISOString(),value,unit,note));
      }}
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

  const canUpdate=!methodReview&&!workspace.locked&&storageStatus==='saved'&&!editingStep&&!newStepDishId&&!cookReadingOpen&&!addStepDraftOpen&&!showFinish&&!showCancel&&!(showDishSetup&&(view==='planning'||(addMethod==='recipe'&&(!!recipeText||!!recipeName||!!draft))));

  return (
    <main className={"shell " + (cooking ? "cooking-screen"+(!remaining.length?" cooking-screen-complete":"") : "planning-screen")}>
      {showCancel&&<CancelCookDialog name={meal.name} temporary={workspace.kind==='trial'} onDismiss={dismissCancel} onConfirm={confirmCancel}/>}
      {storageError&&!(workspace.kind==='account'&&['load-error','conflict','blocked','unsaved'].includes(workspace.cloudPhase))&&!(workspace.plansEnabled&&(workspace.isSelectedPlan||workspace.pendingOperation==='promote')) && <div id="storage-warning" tabIndex={-1} className={`warning ${storageStatus==='unsaved'||storageStatus==='conflict'?'storage-alert':''}`} role="alert">{storageError}
        <div className="storage-recovery-actions">
          {storageStatus!=='recovery'&&<button type="button" onClick={downloadBackup}>{workspace.plansEnabled&&workspace.isSelectedPlan?"Download plan draft":"Download backup"}</button>}
          {storageStatus==='recovery' ? <>
            <button type="button" onClick={()=>{
              const blob=new Blob([recoveryExport()],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='how-many-beers-recovery.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
            }}>Download recovery data</button>
            <button type="button" onClick={()=>window.location.reload()}>Try reading saved data again</button>
            <button type="button" onClick={()=>{if(window.confirm('Reset saved cooks? Download recovery data first. A recovery copy must be saved before any existing data is replaced.')){try{reset();setView('home');}catch{setStorageError('Could not reset saved data safely. Export recovery data and free storage before retrying.');}}}}>Reset saved cooks</button>
          </> : <>
            <button type="button" onClick={()=>{void retry().catch(()=>{});}}>Retry saving</button>
            <button type="button" onClick={()=>{if(window.confirm('Reload the latest saved cooks? Download a backup first to keep any unsaved changes in this tab.'))window.location.reload();}}>Reload saved cooks</button>
          </>}
        </div>
      </div>}
      <header className="site-header">
        <div className="brand-icon" aria-hidden="true"><img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/brand/badge-mark.svg`} width="256" height="256" alt="" /></div>
        <div>
          <p className="eyebrow">PLAN · COOK · REPEAT</p>
          <h1>How Many Beers?</h1>
          <p className="subtitle">From First Beer to First Bite.</p>
        </div>
        {meal&&<AccountControl view={view} cookId={meal.id} canReload={canUpdate} savePhase={workspace.kind==='account'?workspace.savePhase:undefined}/>}
      </header>



      {workspace.kind==='trial'&&<p className="guest-limit">Guest cooks aren’t kept after you leave. Sign in to keep this cook.</p>}

      {workspace.kind==='account'&&['load-error','conflict','blocked','unsaved'].includes(workspace.cloudPhase)&&!workspace.isSelectedPlan&&workspace.pendingOperation!=='promote'&&<section className={workspace.cloudPhase==='unsaved'?'account-save-details':'warning'} aria-label="Account cook recovery">
        {workspace.cloudPhase!=='unsaved'&&<p>{/another tab/i.test(workspace.error)?'This cook is open in another tab. Close that tab, then refresh this page to continue.':workspace.cloudPhase==='conflict'?'A newer saved version of this cook is available. Your changes are still held in this tab.':workspace.cloudPhase==='load-error'?'Your saved cooks could not be loaded. Keep this tab open while the connection is restored.':'Saving this action has not been confirmed yet. Keep this tab open so your progress stays available.'}</p>}
        <details><summary>Save details</summary>
          <p className="small">{workspace.error}</p>
          <div className="storage-recovery-actions">
            <button type="button" onClick={()=>void retry().catch(()=>{})}>Retry account saving</button>
            <button type="button" onClick={()=>workspace.cloudPhase==='load-error'?downloadCookFile(recoveryExport(),'how-many-beers-account-backup.json'):downloadBackup()}>Download backup</button>
            <button type="button" onClick={()=>{if(window.confirm('Load the latest saved cooks and discard this tab’s pending changes? Download a backup first if you need to keep those changes.'))void workspace.reloadAccount().catch(()=>setStorageError('Could not load saved cooks. Your changes remain in this tab.'));}}>Load account version</button>
          </div>
        </details>
      </section>}
      {workspace.plansEnabled&&workspace.isSelectedPlan&&workspace.locked&&<nav aria-label="Plan navigation"><button type="button" className="back-link" onClick={()=>void goHome()}><Icon name="arrow-left"/>Home</button></nav>}
      <div className="cook-content" inert={workspace.locked}>{recipeFirst&&view==='planning'&&<StepReorderHelp id={planReorder.helpId} announcement={planReorder.announcement}/>}
      {storageStatus==='recovery'&&workspace.kind!=='account' ? <section className="panel" aria-label="Saved cook recovery">
        <h2>Recover your saved cooks</h2>
        <p>Your existing saved data is protected. Download recovery data above before resetting anything. It preserves the original data for recovery; it is not a normal cook backup.</p>
        <p>If you have a known-good JSON backup, restore it here. Your original recovery data will be kept before replacement.</p>
        <label>Restore a backup<input type="file" accept=".json,application/json" onChange={async event=>{const file=event.target.files?.[0];if(file)await importBackup(file);event.target.value='';}}/></label>
      </section> : view === "home" ? (
        <section className={`home-layout ${hasActiveWork ? "home-returning" : "home-first-visit"}`} aria-label="Home">
          <div className="home-primary">
          <div className="home-intro">{hasActiveWork ? <><h2>What&apos;s cooking?</h2><p className="muted">Pick up where you left off or plan something new.</p></> : <>
            <h2>From First Beer<br className="brand-line-break" /> to First Bite.</h2>
            <p className="home-product-line">Plan every dish. Time your dinner. Enjoy the cook.</p>
            <p className="muted">Set your serving time, bring your dishes into one plan, and follow a guided checklist when it’s time to cook.</p>
          </>}</div>
          {message==='Cook canceled.'&&<p className="notice" role="status">Cook canceled.</p>}
          {planSaveResult==="saved" && <p className="notice" role="status">Plan saved. Come back here to start when you’re ready.</p>}
          {hasActiveWork&&(!workspace.plansEnabled||cookInProgress||workspace.currentCookInProgress)&&<section className="panel home-current">
            <div className="between"><p className="eyebrow">YOUR CURRENT COOK</p><span className="home-status">{cookInProgress ? "In progress" : "Planning"}</span></div>
            <h3>{meal.name || "Your cook"}</h3>
            <p className="muted">{when(meal.serveAt || null)} · {meal.dishes.length} {meal.dishes.length === 1 ? "dish" : "dishes"}</p>
            {meal.dishes.length > 0 && <p className="home-dishes">{meal.dishes.map(d=>d.name).join(" · ")}</p>}
            {!cookInProgress && <PlannedCookStart meal={meal} timeline={timeline}/>}
            <div className="home-actions">
              {cookInProgress ? <>
                <button type="button" className="button primary" onClick={workspace.plansEnabled?()=>void continueCurrentCook():startCooking}>Continue cooking <Icon name="arrow-right"/></button>
                <button type="button" className="button secondary" onClick={()=>setView("planning")}>View cook</button>
              </> : <>
                <button type="button" className="button primary" disabled={!!startBlockReason} aria-describedby={startBlockReason?"home-start-help":undefined} onClick={startCooking}>Start cooking</button>
                <button type="button" className="button secondary" onClick={()=>{setPlanSaveResult(null);setView("planning");}}>Resume planning <Icon name="arrow-right"/></button>
              </>}
              {cookInProgress&&workspace.canCancel&&<button type="button" className="button secondary" disabled={workspace.locked} onClick={e=>{cancelTrigger.current=e.currentTarget;setShowCancel(true);}}>Cancel cook</button>}
              {!cookInProgress && startBlockReason && <p id="home-start-help" className="muted small">{startBlockReason}</p>}
            </div>
          </section>}
          {workspace.plansEnabled&&<UpcomingCooks plans={workspace.upcomingPlans} active={workspace.currentCookInProgress} busy={workspace.locked} onOpen={openUpcomingPlan} onStart={startUpcomingPlan} loading={workspace.plansLoading||!!workspace.plansError} onCreate={beginNewCook}/>}
          {!workspace.plansEnabled&&<section className="panel home-new">
            <h3>{workspace.plansEnabled?"Plan another cook":hasActiveWork ? "Start another cook" : "Start a cook"}</h3>
            <p className="muted">{workspace.plansEnabled?"Save a future meal without changing your current cook.":hasActiveWork ? "Start fresh when you're ready. Your unfinished cook is not automatically archived." : "Choose what you are making. We will build the checklist."}</p>
            <button type="button" className={hasActiveWork ? "button secondary" : "button primary"} onClick={beginNewCook}>+ Plan a new cook</button>
          </section>}
          <button type="button" className="home-history-link" onClick={()=>setView("history")}>Past cooks <Icon name="arrow-right"/></button>
          </div>
          <aside className="home-guide" aria-label="How it works">
            <p className="eyebrow">THE GAME PLAN</p>
            <h3>One dinner.<br />One game plan.</h3>
            <p>A shared schedule for every dish, with room to adjust as the cook unfolds.</p>
            <div className="home-guide-step"><span>01</span><div><strong>Set serving time</strong><small>Start with when you want to eat.</small></div></div>
            <div className="home-guide-step"><span>02</span><div><strong>Add dishes</strong><small>Templates or your own instructions. All together.</small></div></div>
            <div className="home-guide-step"><span>03</span><div><strong>Adjust the plan</strong><small>Review timing in one Live Schedule.</small></div></div>
            <div className="home-guide-step"><span>04</span><div><strong>Cook and check it off</strong><small>Record progress. Pick up where you left off.</small></div></div>
          </aside>
        </section>
      ) : view === "history" ? (
        <section className="home-history">
          <button type="button" className="back-link" onClick={()=>void goHome()}><Icon name="arrow-left"/>Home</button>
          <CookHistoryPanel history={history} onRepeat={repeatCook} onDelete={deleteCook}/>
        </section>
      ) : cooking ? (
        <>
          <nav className="cooking-navigation" aria-label="Cook navigation">
            <button type="button" className="back-link" disabled={cookingDraftOpen} onClick={()=>void goHome()}><Icon name="arrow-left"/>Home</button>
            <button className="back-link" type="button" disabled={cookingDraftOpen} onClick={()=>setView("planning")}>Edit plan</button>
          </nav>
          <section className="cook-header">
            <div><h2>{meal.name || "Your cook"}</h2><p className="cook-target">{meal.phasePlan?'Serving target':'Original target'} {when(meal.serveAt || null)} · {meal.dishes.length} {meal.dishes.length===1?"dish":"dishes"}</p></div>
          </section>
          <BeerEstimator meal={meal} timeline={timeline} projection={projection}/>
          <div className="cook-layout">
            <section className="panel active-cook-panel">
              {remaining.length>0&&<><div className="progress-heading"><strong>{complete} of {progressTasks.length} steps done</strong></div>
              <div className="progress-track" role="progressbar" aria-label="Cook progress" aria-valuemin={0} aria-valuemax={progressTasks.length} aria-valuenow={complete}><div style={{width: (progressTasks.length ? complete / progressTasks.length * 100 : 0) + "%"}} /></div></>}
              {storageStatus!=='saved'&&!!storageError&&<p className="cook-autosave-note muted small">Your latest changes are not saved. Keep this tab open and download a backup.</p>}
              {cookingDraftOpen && <p className="notice" id="cooking-draft-help">Save or cancel the open edit or reading before switching steps.</p>}
              {message && <p className="form-error" role="alert">{message}</p>}
              {navigationNote && remaining.length>0 && <p className="step-navigation-note" role="status">{navigationNote}</p>}
              {!remaining.length&&!!timeline.length&&!showFinish&&<section className="cook-finished" aria-label="Cook complete" id="cook-complete" tabIndex={-1}>
                <h3>{phaseWaiting?projection?.phases?.some(p=>p.active&&p.kind==='heating')?'Cooking underway':'Resting or cooling underway':'All steps checked'}</h3>
                <div className="cook-completion-actions">{!phaseWaiting&&<button id="finish-cook-trigger" type="button" className="button primary" disabled={cookingDraftOpen} onClick={openFinishCook}>Finish cook</button>}<button type="button" className="button secondary" disabled={cookingDraftOpen} onClick={toggleCookPanel}>{cookPanel==="step"?"Full checklist":"Back to step"}</button></div>
              </section>}
              {cookPanel==="checklist" ? <CookingChecklist forecasts={forecasts} tasks={guidance.ordered} completed={meal.completed} onSelect={openGuidedStep} onComplete={completeCookingStep}/> : (guidance.current||!timeline.length)?<section className="guided-step" aria-label="Current step" id="current-cook-step" tabIndex={-1}>
                {guidance.current ? <>
                  {meal.completed[guidance.current.id]&&<p className="small muted">Completed step</p>}
                  {taskCard(guidance.current,"cooking")}
                </> : !timeline.length?<div className="cook-finished"><h3>Your checklist is empty</h3><p>Edit the plan to add a dish or prep step.</p></div>:null}
              </section>:null}
              {showFinish && <section className="finish-cook" aria-label="Finish cook">
                <h3>Finish this cook?</h3><p className="muted small">{workspace.kind==='trial'?"This trial cook is not saved. Sign in to keep it in your history.":"Save its plan, notes and actual readings in your history."}</p>
                <p className="muted small">{remaining.length} unchecked steps. You can save even if some weren't needed.</p>
                <label htmlFor="cook-outcome">How did it turn out? (optional)</label><textarea id="cook-outcome" rows={3} maxLength={2000} value={outcome} onChange={e=>setOutcome(e.target.value)} placeholder="Tenderness, timing, what to change next time..."/>
                <button type="button" className="button primary" disabled={cookingDraftOpen} onClick={finishCook}>{workspace.kind==='trial'?'Sign in to save this cook':'Save finished cook'}</button>{workspace.kind==='trial'&&<button type="button" className="button secondary" onClick={()=>{if(window.confirm('Finish without saving? This cook will not be kept in your history.'))void save({active:newMeal()}).then(returnHome);}}>Finish without saving</button>}<button type="button" className="button secondary" onClick={()=>{setShowFinish(false);requestAnimationFrame(()=>document.getElementById("finish-cook-trigger")?.focus());}}>Keep cooking</button>
              </section>}
            </section>
            <section className="cook-sidebar" aria-label="Cooking tools"><details className="cook-extra-tools"><summary><Icon name="chevron-right" className="disclosure-icon"/>Cook details &amp; tools</summary>
              <section className="panel cook-summary"><p className="eyebrow">ON THE MENU</p>{meal.dishes.map(d=><div className="menu-item" key={d.id}><strong>{d.name}</strong><span>{d.equipment}</span></div>)}<p className="muted small">{projection&&<>Session elapsed {formatDuration(Math.floor(projection.elapsed))}{projection.projected!==null?' · Projected total '+formatDuration(Math.round(projection.projected)):''}<br/></>}{focus.now.length} planned earlier · {focus.untimed.length} untimed</p></section>
              {warnings.length>0 && <section className="panel cook-warnings"><strong>Things to watch</strong>{warnings.map((w,i)=><p key={i}>{w}</p>)}</section>}
              <p className="muted small cook-safety-note">Use a food thermometer, verify doneness and monitor safe holding. The checklist cannot confirm readiness by time alone.</p>
              <AddStepForm compact onAdd={addCustom} onDraftChange={setAddStepDraftOpen}/>{(remaining.length>0||!timeline.length||phaseWaiting)&&!showFinish&&<button id="finish-cook-trigger" type="button" className="button secondary" disabled={cookingDraftOpen||(!timeline.length&&!meal.dishes.length)} onClick={openFinishCook}>Finish cook early</button>}
              {cookInProgress&&workspace.canCancel&&<p className="cancel-cook-entry"><button type="button" className="button secondary" disabled={cookingDraftOpen||workspace.locked} onClick={e=>{cancelTrigger.current=e.currentTarget;setShowCancel(true);}}>Cancel cook</button></p>}</details>
            </section>
          </div>
          {remaining.length>0&&<nav className="cook-guide-bar" aria-label="Cooking guide">
            <button type="button" className="guide-checklist-button" aria-label={cookPanel==="step"?"Full checklist":"Back to step"} disabled={cookingDraftOpen} aria-describedby={cookingDraftOpen?"cooking-draft-help":undefined} onClick={toggleCookPanel}>{cookPanel==="step"?"Full checklist":"Back to step"}</button>
            {guidance.next ? <button type="button" className="guide-next-button" aria-label={"Preview next step: "+guidance.next.title} disabled={cookingDraftOpen} aria-describedby={cookingDraftOpen?"cooking-draft-help":undefined} onClick={()=>{
              openGuidedStep(guidance.next!.id);if(guidance.current && !meal.completed[guidance.current.id])setNavigationNote("Previous step remains unchecked. It is still in Full checklist.");
            }}><span className="guide-next-label">Up next · {guidance.next.dishName}</span><strong>{cookingTitle(guidance.next.title)}</strong><span className="guide-next-time">{forecasts[guidance.next.id]?<StepForecastTime forecast={forecasts[guidance.next.id]} part="start" simple/>:guidance.next.scheduledAt?new Date(guidance.next.scheduledAt).toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"Untimed · choose when"}</span><Icon name="arrow-right" className="guide-next-icon"/></button>
            : <div className="guide-next-empty"><strong>Last unchecked step</strong><span>Check it off when ready.</span></div>}
          </nav>}
        </>
      ) : (
        <>
          {!(workspace.plansEnabled&&workspace.isSelectedPlan&&workspace.locked)&&<button type="button" className="back-link" onClick={()=>void goHome()}><Icon name="arrow-left"/>Home</button>}
          {meal.mode === "cooking" && <p className="notice">Cook in progress. Viewing or editing your plan won't reset your completed steps.</p>}
          {timeline.length>0 && <BeerEstimator meal={meal} timeline={timeline}/>}
          <div className={timeline.length?"guided-planner":"empty-planner"}><div className="guided-main">
          {(!recipeFirst||meal.dishes.length>0||timeline.length>0)&&<section className="hero panel">
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
          </section>}
          <section className={"workspace-overview"+(recipeFirst&&methodReview?" reviewing-method":"")} aria-label="Cook overview">
            <div className="workspace-heading">
              {!(recipeFirst&&methodReview)&&<div><p className="eyebrow">YOUR MENU</p><h2>{meal.dishes.length ? `${meal.dishes.length} ${meal.dishes.length===1?"dish":"dishes"} in this cook` : "What do you want to cook?"}</h2></div>}
              {(meal.dishes.length>0 || showDishSetup) && <button id="add-dish-button" type="button" className={showDishSetup?"cancel-add-dish":"button secondary"} aria-label={showDishSetup?"Cancel adding":"+ Add a dish"} aria-expanded={showDishSetup} aria-controls="menu-add-dish" onClick={()=>{setEditingDishId(null);setMethodReview(null);setShowDishSetup(v=>!v)}}>{showDishSetup ? <><Icon name="close"/> Cancel</> : "+ Add a dish"}</button>}
            </div>
            {meal.dishes.length===0 && (!recipeFirst||!showDishSetup) && <div className="empty-planner-choices">
              <button id={!showDishSetup?"add-dish-button":undefined} type="button" className="button primary" onClick={()=>{setAddMethod('template');setShowDishSetup(true)}}>{recipeFirst?"Choose a template":"Start with a template"}</button>
              <button type="button" className="button secondary" onClick={()=>{setAddMethod('recipe');setShowDishSetup(true)}}>{recipeFirst?"Add your own recipe":"Upload a recipe"}</button>
              <p className="muted small">Choose a starter or use your own recipe. You can add more dishes afterward.</p>
            </div>}
            {meal.dishes.length>0 && <p className="muted small menu-guidance">{showDishSetup ? (recipeFirst?"Choose a template or add your own recipe. Everything stays in this meal.":"Choose a starter or import your recipe. Everything stays in this cook.") : "Tap a dish to adjust its steps. Add another whenever you're ready."}</p>}
            {showDishSetup && <section id="menu-add-dish" className="menu-add-dish" role="region" aria-label="Add dish">
              {!(recipeFirst&&methodReview)&&<h3>Add a dish</h3>}
              {meal.dishes.length>0&&!(recipeFirst&&methodReview) && <div className="add-method-tabs" role="group" aria-label="Add dish method">
                <button type="button" aria-pressed={addMethod==="template"} className={addMethod==="template"?"selected":""} onClick={()=>setAddMethod("template")}>{recipeFirst?"Choose a template":"Start from template"}</button>
                <button type="button" aria-pressed={addMethod==="recipe"} className={addMethod==="recipe"?"selected":""} onClick={()=>setAddMethod("recipe")}>{recipeFirst?"Add your own recipe":"Import a recipe"}</button>
              </div>
              }
              {recipeFirst&&methodReview?<RecipeMethodReview meal={methodReview} onChange={setMethodReview} onBack={()=>setMethodReview(null)} onAdd={async()=>{if(meal.id!==reviewTarget.current)throw Error('Your meal changed. Go back to choices before adding this recipe.');await save({active:addReviewedDish(meal,methodReview,true)});setMethodReview(null);setShowDishSetup(false);setEditingDishId(null);setDraft(null);setRecipeName('');setRecipeText('');requestAnimationFrame(()=>document.getElementById('serve-at')?.focus());}}/>:addMethod==="template" ? <>
              <h3>Choose a template</h3>
              <p className="muted small">Start with a dish. You can adjust it without changing the other dishes.</p>
              <div className="template-picker">
                {(Object.entries(presets) as [BuiltIn, (typeof presets)[BuiltIn]][]).map(([id, template])=>(
                  <button type="button" className="template-choice" key={id} aria-label={"Add "+template.label.toLowerCase()} onClick={()=>{const dish=createDish(id);if(recipeFirst){reviewTarget.current=meal.id;setMethodReview(recipeReview(dish,meal.serveAt));return;}patch(m=>addDishToMeal(m,dish,new Date().toISOString()));setShowDishSetup(false);setEditingDishId(dish.id);requestAnimationFrame(()=>document.getElementById("dish-toggle-"+dish.id)?.focus())}}>
                    <strong>{template.label}</strong><span>{template.equipment}</span><Icon name="plus" className="template-add-icon"/>
                  </button>
                ))}
              </div>
              </> : <div className="recipe-import-inline">
                {!draft ? <>
                <p className="muted small">{recipeFirst?"Write your steps, paste a recipe, or upload a text file. We’ll pick up any times you include.":"Paste instructions or upload a text file. We'll find written times for you to review. Recipe URLs aren't supported yet."}</p>
                <label htmlFor="recipe-name">Recipe title</label>
                <input id="recipe-name" value={recipeName} onChange={e=>setRecipeName(e.target.value)} placeholder="Grandma's mac & cheese"/>
                <label htmlFor="recipe-text">Recipe instructions</label>
                <textarea id="recipe-text" rows={5} value={recipeText} onChange={e=>setRecipeText(e.target.value)} placeholder={"1. Preheat oven (10 minutes)\n2. Prepare ingredients (5 minutes)\n3. Roast for 20–25 minutes"}/>
                <label htmlFor="recipe-file">Upload .txt or .md</label>
                <input id="recipe-file" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={e=>void onTextFile(e.target.files?.[0])}/>
                <button className="button secondary" type="button" disabled={!recipeText.trim()} onClick={()=>{
                  const parsed=parseRecipeText(recipeName,recipeText);
                  if(!parsed.steps?.length){setMessage("No recipe steps found. Try one instruction per line.");return;}
                  if(recipeFirst){reviewTarget.current=meal.id;setMethodReview(recipeReview(parsed,meal.serveAt));setDraft(null);}else setDraft(parsed);setMessage("");
                }}>Preview recipe steps</button>
                </> : <RecipePreview dish={draft} onChange={setDraft} onBack={()=>{setRecipeName(draft.name);setDraft(null);setMessage('');}} onAdd={()=>{
                  patch(m=>addDishToMeal(m,draft,new Date().toISOString()));
                  setShowDishSetup(false);setEditingDishId(draft.id);requestAnimationFrame(()=>document.getElementById("dish-toggle-"+draft.id)?.focus());setDraft(null);setRecipeName("");setRecipeText("");setMessage("");
                }}/>}
                {message && <p className="notice" role="status">{message}</p>}
              </div>}
            </section>}
            {meal.dishes.length ? <div className="workspace-dish-grid">
              {meal.dishes.map(d=><article className={"workspace-dish"+(editingDishId===d.id?" is-open":"")} aria-label={d.name} key={d.id}>
                <div className="dish-header">
                <button id={"dish-toggle-"+d.id} className="dish-select" type="button" aria-label={"Edit "+d.name} aria-expanded={editingDishId===d.id} aria-controls={"dish-"+d.id} onClick={()=>{setEditingDishId(current=>current===d.id?null:d.id);setShowDishSetup(false);setNewStepDishId(null);setNewStepTitle("")}}>
                  <span className="dish-summary"><strong>{d.name}</strong><span>{d.equipment} · {timeline.filter(t=>t.dishId===d.id).length} steps</span></span>
                  <span className="dish-toggle"><span>{editingDishId===d.id?"Hide steps":"Adjust steps"}</span><Icon name={editingDishId===d.id?"chevron-up":"chevron-down"}/></span>
                </button>
                  <RemoveButton className="dish-remove" label={"Remove "+d.name} onClick={()=>removeDish(d.id)}/>
                </div>
                {editingDishId===d.id && <div id={"dish-"+d.id} className="dish-inline-editor" role="region" aria-label="Dish editor">

                  {d.preset==="brisket" && <BrisketPlanner dish={d} serveAt={meal.serveAt} onChange={dish=>patch(m=>({...m,dishes:m.dishes.map(item=>item.id===d.id?dish:item)}))}/>}
                  {d.preset==="turkey" && <TurkeyPreparation dish={d} onChange={dish=>patch(m=>({...m,dishes:m.dishes.map(item=>item.id===d.id?dish:item)}))}/>}
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
                        onChange={value=>patch(m=>({...m,dishes:m.dishes.map(item=>item.id===d.id?{...item,cookMinutes:value,brisketPlan:item.brisketPlan?{...item.brisketPlan,mode:"manual"}:undefined}:item)}))}
                      />
                    </div>
                    <div>
                      <label htmlFor={"rest-"+d.id}>Rest/hold ({d.preset==="brisket" ? "hours" : "min"})</label>
                      <DurationInput id={"rest-"+d.id} minutes={d.restMinutes}
                        unit={d.preset==="brisket" ? "hours" : "minutes"}
                        minMinutes={0} maxMinutes={720}
                        onChange={value=>patch(m=>({...m,dishes:m.dishes.map(item=>item.id===d.id?{...item,restMinutes:value,brisketPlan:item.brisketPlan?{...item.brisketPlan,mode:"manual"}:undefined}:item)}))}
                      />
                    </div>
                  </div> : <p className="muted small">Set estimated durations directly on the steps below.</p>}
                  {d.preset!=="custom" && d.preset!=="brisket" && presets[d.preset].referenceWeightLb!==undefined && (
                    <div className="template-settings">
                      <label htmlFor={"weight-"+d.id}>Weight (lb), for reference</label>
                      <input id={"weight-"+d.id} type="number" inputMode="decimal" min={1} max={40} step={0.5}
                        value={d.weightLb ?? ""}
                        onChange={e=>patch(m=>({...m,dishes:m.dishes.map(item=>item.id===d.id ? {...item,weightLb:e.target.value===""?undefined:Math.max(1,Math.min(40,Number(e.target.value)||1))}:item)}))}
                      />
                      <p className="muted small">Weight is saved with your cook. Automatic weight-based time estimates are tracked in #5, so this doesn't silently change cook time yet.</p>
                    </div>
                  )}
                  {d.preset!=="custom" && d.preset!=="brisket" && presets[d.preset].cookRangeMinutes && (
                    <p className="muted small">Editable planning window (not a guaranteed or weight-derived estimate): {Math.round(presets[d.preset].cookRangeMinutes![0]/60*10)/10}–{Math.round(presets[d.preset].cookRangeMinutes![1]/60*10)/10} hours. Planning context only; adjust the estimate for your equipment and size.</p>
                  )}
                  {d.preset!=="custom" && d.preset!=="brisket" && presets[d.preset].pitTempF!==undefined && (
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
                      {presets[d.preset].sources?.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <Icon name="external"/></a>)}
                    </div>
                  )}

                  {d.recipeSource&&<RecipeDetails dish={d} onChange={dish=>patch(m=>({...m,dishes:m.dishes.map(item=>item.id===d.id?dish:item)}))}/>}
                  {d.recipeSource&&<details className="recipe-original"><summary>Original recipe</summary><pre>{d.recipeSource}</pre></details>}
                  </details>
                  {d.preset==='custom' && <p className="import-timing-help muted small">Set estimated durations below; start times and the Beerometer update automatically. Leave a duration blank if unknown. Use Edit for a fixed start or other step details.</p>}
                  <section className="inline-dish-steps" data-step-list={"dish-"+d.id} role="region" aria-label={d.name+" steps"}>
                  {timeline.filter(t=>t.dishId===d.id).map(t=>taskCard(t,"planning",false,true))}
                  {newStepDishId===d.id ? <form className="inline-step-add" aria-label="Add dish step" onSubmit={e=>{e.preventDefault();addDishStep(d.id);}} onKeyDown={e=>{if(e.key==='Escape'){setNewStepDishId(null);setNewStepTitle("");requestAnimationFrame(()=>document.getElementById("add-step-"+d.id)?.focus());}}}>
                    <label htmlFor={"new-step-"+d.id}>Step title</label>
                    <input id={"new-step-"+d.id} autoFocus value={newStepTitle} onChange={e=>setNewStepTitle(e.target.value)} maxLength={160}/>
                    <button type="submit" className="button primary" disabled={!newStepTitle.trim()}>Save step</button>
                    <button type="button" className="button secondary" onClick={()=>{setNewStepDishId(null);setNewStepTitle("");requestAnimationFrame(()=>document.getElementById("add-step-"+d.id)?.focus());}}>Cancel</button>
                  </form> : <button id={"add-step-"+d.id} type="button" className="button secondary dish-add-step" disabled={!!editingStep} onClick={()=>setNewStepDishId(d.id)}>Add a step to {d.name}</button>}
                </section>
                </div>}
              </article>)}
            </div> : null}
          </section>
          {timeline.length>0 && <section className="cook-actions" aria-label="Cooking actions">
            <div className="cook-action-controls">
              <button type="button" className="button primary cook-action-button"
                disabled={!!methodReview||(!cookInProgress && !!startBlockReason)||(workspace.plansEnabled&&workspace.isSelectedPlan&&workspace.currentCookInProgress)}
                aria-describedby={!cookInProgress && startBlockReason ? "cook-start-help" : undefined}
                onClick={startCooking}>{cookInProgress ? "Continue cooking" : "Start cooking"}</button>
              {!cookInProgress && <button type="button" className="button secondary save-plan-button" disabled={timeline.length===0 || planStepDraftOpen} aria-describedby={planStepDraftOpen?"save-plan-help":undefined} onClick={savePlanForLater}>{workspace.kind==='trial'?'Sign in to save plan':'Save plan for later'}</button>}
              {timeline.length > 0 && <button type="button" className="link review-checklist-button"
                aria-expanded={showChecklistPreview} aria-controls="checklist-preview"
                onClick={()=>setShowChecklistPreview(v=>!v)}>{recipeFirst ? (showChecklistPreview ? "Hide Meal Plan" : "Review Meal Plan") : (showChecklistPreview ? "Hide checklist" : "Review checklist")}</button>}
            </div>
            {!cookInProgress && planStepDraftOpen && <p id="save-plan-help" className="muted small">Save or cancel the open step first, then save your plan for later.</p>}
            {workspace.plansEnabled&&workspace.isSelectedPlan&&workspace.currentCookInProgress&&<div className="plan-active-notice"><p>Your current cook is still running. You can save this plan now and start it after finishing or canceling that cook.</p><button type="button" className="button secondary" disabled={planStepDraftOpen} onClick={()=>void continueCurrentCook()}>Continue current cook</button></div>}
            {planSaveResult==="error"&&!workspace.plansEnabled && <p id="save-plan-error" tabIndex={-1} className="warning" role="alert">Could not save the plan. Keep this page open, free browser storage or export a backup, then retry.</p>}
            {!cookInProgress && startBlockReason && <p className="muted small" id="cook-start-help">{startBlockReason}</p>}
          </section>
          }
          {timeline.length>0 && <section className="plan-notes" aria-label="Plan notes">
            {warnings.map((warning,i) => <p className="warning" key={i}>{warning}</p>)}
            {timeline.some(t => t.scheduledAt === null) && <p className="warning">Some steps have no timing. For uploaded recipes, add estimated durations on each step to work back from serving time. Use Edit for a fixed start, or leave timing unknown and review before cooking.</p>}
            <p className="muted small timing-guidance">Schedules are estimates, not food-safety checks or guaranteed finish times. Use a thermometer and follow your equipment instructions.</p>
          </section>
          }
          {showChecklistPreview && timeline.length > 0 && (
            <section className="checklist-preview" id="checklist-preview" aria-label={recipeFirst?"Meal plan preview":"Cooking checklist preview"}>
              <div className="preview-intro"><h3>{recipeFirst?"Meal plan":"Cooking checklist"}</h3></div>
              <p className="muted small">Review all dishes together. Check off steps and record actual readings in Cooking Mode.</p>
              <div className="checklist preview-task-list" data-step-list="meal-plan">{timeline.map(task => taskCard(task, "planning"))}</div>
              <AddStepForm onAdd={addCustom}/>
              {message && <p className="form-error" role="alert">{message}</p>}
            </section>
          )}

          {timeline.length===0 && <details className="empty-prep"><summary>Other preparation</summary><AddStepForm onAdd={addCustom} onDraftChange={setAddStepDraftOpen}/></details>}
          </div>
          {timeline.length>0 && <aside className="guided-schedule" aria-label="Live schedule">
            <div className="schedule-head"><p className="eyebrow">LIVE SCHEDULE</p><strong>{timeline.length} steps</strong></div>
            <p className="muted small">Serving {when(meal.serveAt || null)}</p>{liveSchedule.some(t=>t.recipeOrder!==undefined&&!t.scheduledAt)&&<p className="muted small">Untimed recipes stay in recipe order until start times are known.</p>}
            {timeline.length ? <>
              <ol className="schedule-list">
                {(showFullSchedule?liveSchedule:liveSchedule.slice(0,4)).map(task=><li key={task.id}><button type="button" className="schedule-step" aria-label={"Edit "+task.title+" for "+task.dishName} onClick={()=>editScheduleStep(task)}><time dateTime={task.scheduledAt??undefined}>{task.scheduledAt?when(task.scheduledAt):"Start time not set"}</time><strong>{task.title}</strong><span>{task.dishName}{task.durationMinutes!=null?" · "+formatDuration(task.durationMinutes):""}</span><span className="schedule-edit-hint">Adjust step <Icon name="arrow-right"/></span></button></li>)}
              </ol>
              {timeline.length>4 && <button type="button" className="link schedule-toggle" onClick={()=>setShowFullSchedule(v=>!v)}>{showFullSchedule?"Show less":"Show full schedule"} <Icon name="arrow-right"/></button>}
            </> : <p className="muted small">Add a dish to see your schedule.</p>}
            {warnings.length>0 && <p className="muted small">Review schedule and equipment warnings in the plan notes.</p>}
          </aside>}
          </div>
        </>
      )}
      <footer>How Many Beers? <span>From First Beer to First Bite.</span><span className="build-version" title="Deployment branch and Git commit">{process.env.NEXT_PUBLIC_BUILD_BRANCH ?? "local"} · {(process.env.NEXT_PUBLIC_BUILD_SHA ?? "local").slice(0, 7)}</span></footer>
      </div>
    </main>
  );
}
