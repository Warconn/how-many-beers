"use client";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "@/auth/AccountProvider";
import { useLocalCook } from "@/components/useLocalCook";
import { LocalCookStore, type LocalSnapshot } from "@/domain/localPersistence";
import {
  ACTIVE_KEY,
  HISTORY_KEY,
  emptyHistory,
  type HistoryLibrary,
} from "@/domain/cookHistory";
import { newMeal, type Meal } from "@/domain/meal";
import { migrateMeal } from "@/domain/cookState";
import { useAccountCook } from "./useAccountCook";
import {retainCanceled,emptyCanceled} from '../domain/canceledCooks';
import { meaningful, mergeHistory } from "./workspace";
import {useUpcomingPlans,currentHasActuals,hasUpcomingContent,type UpcomingPlan} from './useUpcomingPlans';
import {savedPlanAPI,planMeal,exportSavedPlans,validateSavedPlansBackup} from './savedPlans';
type SavePhase='loading'|'load-error'|'saved'|'syncing'|'unsaved'|'conflict'|'saving'|'blocked';
/** A current critical transition always owns the existing account saving indicator. */
export function combinedSavePhase(current:SavePhase,selected:SavePhase|null,future:SavePhase='saved'):SavePhase{
  if(['loading','load-error','saving','blocked','conflict'].includes(current))return current;
  for(const phase of [selected,future])if(phase==='conflict'||phase==='load-error')return phase;
  if(current==='unsaved'||selected==='unsaved'||future==='unsaved')return 'unsaved';
  if(current==='syncing'||selected==='syncing'||selected==='loading'||future==='syncing'||future==='loading')return 'syncing';
  return current;
}
const LEGACY_OWNER = "how-many-beers:legacy-owner:v1";
type Candidate = { snapshot: LocalSnapshot; legacy: boolean };
export function useCookWorkspace() {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_CLOUD_COOKS === "true";
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const account = useAccount(),
    cloud = useAccountCook(enabled);
  const ownerScope=useRef(account.ownerId);ownerScope.current=account.ownerId;
  const assertOwner=(owner:string)=>{if(!mounted.current||ownerScope.current!==owner)throw Error("Your account changed. Reopen your plans before continuing.");};
  const plansEnabled=!!(enabled&&account.ownerId&&cloud.state.canPlan);
  const upcoming=useUpcomingPlans(plansEnabled);
  const [legacySelection,setLegacySelection]=useState<{owner:string;id:string}|null>(null);
  const legacyRef=useRef<{owner:string;id:string}|null>(null);
  const selectLegacy=(value:{owner:string;id:string}|null)=>{legacyRef.current=value;setLegacySelection(value);};
  const selectedPlanId=upcoming.selectedId??(legacySelection?.owner===account.ownerId?legacySelection.id:null);
  const isSelectedPlan=selectedPlanId!==null;
  const [legacyScope, setLegacyScope] = useState<string | null>(null),
    [legacyAllowed, setLegacyAllowed] = useState(false),
    [legacyCandidate, setLegacyCandidate] = useState<Candidate | null>(null);
  const [trial, setTrial] = useState<LocalSnapshot>(() => ({
    active: migrateMeal(newMeal()),
    history: emptyHistory(),
  }));
  const trialRef = useRef(trial);
  trialRef.current = trial;
  const guestRef = useRef<Candidate | null>(null);
  const [imported, setImported] = useState(false);
  const [selection, setSelection] = useState(0),
    [transitionError, setTransitionError] = useState("");
  const mode =
    !enabled || account.phase === "disabled"
      ? "disabled"
      : (account.ownerId ?? (account.phase === "guest" ? "guest" : "checking"));
  useEffect(() => {
    if (mode === "checking" || mode === "disabled") return;
    let candidate: Candidate | null = null,
      allowed = false;
    try {
      const raw = window.localStorage.getItem(LEGACY_OWNER),
        claim = raw ? JSON.parse(raw) : null;
      if (!claim || (claim.owner === account.ownerId && !claim.imported)) {
        const exists =
          window.localStorage.getItem(ACTIVE_KEY) !== null ||
          window.localStorage.getItem(HISTORY_KEY) !== null;
        if (exists) {
          try {
            const snapshot = new LocalCookStore(window.localStorage).load(
              false,
            );
            if (meaningful(snapshot)||(snapshot.canceled?.cooks.length??0)>0) {
              candidate = { snapshot, legacy: true };
              allowed = mode === "guest";
            }
          } catch {
            allowed = mode === "guest";
          }
        }
      }
    } catch {
      setTransitionError(
        "Earlier cooks could not be checked safely. They have not been replaced.",
      );
    }
    setLegacyCandidate(candidate);
    setLegacyAllowed(allowed);
    setLegacyScope(mode);
  }, [mode, account.ownerId]);
  const local = useLocalCook(
    mode === "disabled" ||
      (mode === "guest" && legacyScope === "guest" && legacyAllowed),
  );
  const guest =
    legacyAllowed && local.meal
      ? { active: migrateMeal(local.meal), history: local.history, canceled:local.canceled }
      : trial;
  if (mode === "guest" && legacyScope === "guest")
    guestRef.current = { snapshot: guest, legacy: legacyAllowed };
  const candidate =
    enabled && account.ownerId
      ? guestRef.current && meaningful(guestRef.current.snapshot)
        ? guestRef.current
        : legacyCandidate
      : null;
  const earlierAvailable = !!candidate && !imported;
  const selectedOwner = useRef<string | null>(null);
  useEffect(() => {
    if (!account.ownerId || !cloud.state.snapshot || selectedOwner.current === account.ownerId) return;
    selectedOwner.current = account.ownerId;
    setSelection(v => v + 1);
  }, [account.ownerId, cloud.state.snapshot]);
  const data =
    mode === "disabled"
      ? local.meal
        ? { active: migrateMeal(local.meal), history: local.history, canceled:local.canceled }
        : null
      : account.ownerId
        ? (cloud.state.snapshot ?? guestRef.current?.snapshot ?? trial)
        : mode === "guest" && legacyScope === "guest"
          ? guest
          : mode === "checking"
            ? (guestRef.current?.snapshot ?? null)
            : null;
  const backup =
    enabled && account.ownerId
      ? cloud.state.backup
      : data;
  const currentStatus =
    mode === "disabled" || (mode === "guest" && legacyAllowed)
      ? local.status
      : account.ownerId
        ? cloud.state.phase === "saved"
          ? "saved"
          : cloud.state.phase === "conflict"
            ? "conflict"
            : cloud.state.phase === "load-error"
              ? "recovery"
              : cloud.state.phase === "loading"
                ? "loading"
                : "unsaved"
        : mode === "guest" && meaningful(trial)
          ? "unsaved"
          : "saved";
  const error =
    transitionError ||
    (enabled && account.ownerId
      ? cloud.state.error
      : legacyAllowed || mode === "disabled"
        ? local.error
        : "");
  const currentLocked =
    enabled &&
    (mode === "checking" ||
      (!!account.ownerId &&
        ["loading", "load-error", "saving", "blocked", "conflict"].includes(cloud.state.phase)));
  const currentCook=data?.active??null;
  const selectedDocument=!!upcoming.selectedId;
  const selectedPhase=upcoming.state.phase;
  const savePhase=combinedSavePhase(cloud.state.phase,selectedDocument?selectedPhase:null,upcoming.savingPhase??'saved');
  const status=selectedDocument?(selectedPhase==='saved'?currentStatus:selectedPhase==='loading'?'loading':selectedPhase==='load-error'?'recovery':selectedPhase==='conflict'?'conflict':'unsaved'):currentStatus;
  const locked=currentLocked||(selectedDocument&&['loading','load-error','conflict'].includes(selectedPhase));
  const selectedStore=()=>upcoming.store.current?.owner===account.ownerId?upcoming.store.current:null;
  const flushCurrent=async()=>{
    if(enabled&&account.ownerId){
      if(!cloud.store.current||cloud.store.current.owner!==account.ownerId)throw Error('Account cooks are loading.');
      await cloud.store.current.flush(true);
    }
  };
  const currentMeal=()=>(cloud.store.current?.owner===account.ownerId?cloud.store.current?.state().snapshot?.active:null)??data?.active??null;
  const legacySource=cloud.store.current?.owner===account.ownerId?cloud.store.current?.currentDocument?.():null;
  const legacyPlan=currentCook&&hasUpcomingContent(currentCook)?{
    id:currentCook.id,meal:currentCook,revision:0,legacy:true as const,
    serveInstant:legacySource?legacySource.serveInstant:Number.isFinite(Date.parse(currentCook.serveAt))?new Date(currentCook.serveAt).toISOString():null,
    timeZone:cloud.state.activeTimeZone??Intl.DateTimeFormat().resolvedOptions().timeZone??'UTC',
  }:null;
  const upcomingPlans:UpcomingPlan[]=[...upcoming.plans.map(plan=>({...plan,meal:planMeal(plan)})),...(plansEnabled&&legacyPlan&&!upcoming.plans.some(p=>p.id===legacyPlan.id)?[legacyPlan]:[])].sort((a,b)=>(a.serveInstant??'9999').localeCompare(b.serveInstant??'9999')||a.id.localeCompare(b.id));
  const createPlan=async(seed?:Meal)=>{
    if(!plansEnabled)throw Error('Upcoming plans are not available for this account yet.');
    await flushCurrent();selectLegacy(null);
    return upcoming.create(seed);
  };
  const openPlan=async(id:string)=>{
    if(!plansEnabled||!account.ownerId)throw Error('Upcoming plans are not available for this account yet.');
    await flushCurrent();
    const current=currentMeal();
    if(current?.id===id&&hasUpcomingContent(current)){
      await upcoming.close();selectLegacy({owner:account.ownerId,id});return;
    }
    selectLegacy(null);await upcoming.open(id);
  };
  const returnToCurrent=async()=>{
    await flushCurrent();await upcoming.close();selectLegacy(null);
  };
  const startSelectedPlan=async(id?:string)=>{
    if(id)await openPlan(id);
    if(!plansEnabled||!account.ownerId||!cloud.store.current)throw Error('Account cooks are loading.');
    await flushCurrent();
    const current=currentMeal();
    const selected=selectedStore();
    if(currentHasActuals(current)){
      const intendedId=selected?.state().plan?.id??(legacyRef.current?.owner===account.ownerId?legacyRef.current.id:null);
      if(current?.id===intendedId&&!selected?.dirty()){
        await upcoming.forgetSelected().catch(()=>{});upcoming.releaseSelection();selectLegacy(null);await upcoming.refresh().catch(()=>{});return;
      }
      throw Error('Finish or cancel your current cook before starting another. Your upcoming plan is still saved.');
    }
    if(selected){
      await selected.flush(true);
      const plan=selected.state().plan;
      if(!plan)throw Error('Save the upcoming plan before starting it.');
      await cloud.store.current.promote(plan.id,plan.revision);
      await upcoming.forgetSelected().catch(()=>{});upcoming.releaseSelection();selectLegacy(null);
      await upcoming.refresh().catch(()=>{});
    }else if(legacyRef.current?.owner===account.ownerId&&legacyRef.current.id===current?.id){
      await cloud.store.current.save({active:{...current,mode:'cooking',startedAt:new Date().toISOString()}});
      selectLegacy(null);
    }else throw Error('Select an upcoming plan before starting.');
    setTransitionError('');
  };
  const exportUpcomingPlans=async()=>{
    const owner=account.ownerId;
    if(!plansEnabled||!account.ownerId||!account.client)throw Error('Upcoming plans are not available for this account yet.');
    await flushCurrent();
    try{await upcoming.flush();}catch{await upcoming.protectSelected();}
    const plans=await upcoming.withPendingBackup(await savedPlanAPI(account.client,account.ownerId).list());
    const current=currentMeal();
    const raw=cloud.store.current?.currentDocument();
    const legacy=current&&raw&&hasUpcomingContent(current)?{id:current.id,...raw,timeZone:cloud.store.current?.state().activeTimeZone??cloud.state.activeTimeZone??Intl.DateTimeFormat().resolvedOptions().timeZone??'UTC'}:undefined;
    assertOwner(owner!);
    return exportSavedPlans(plans,new Date().toISOString(),legacy);
  };
  const importUpcomingPlans=async(text:string)=>{
    const owner=account.ownerId;
    if(!plansEnabled||!account.ownerId||!account.client)throw Error('Upcoming plans are not available for this account yet.');
    const documents=validateSavedPlansBackup(text);
    await flushCurrent();await upcoming.flush();
    await savedPlanAPI(account.client,account.ownerId).import(crypto.randomUUID(),documents);
    assertOwner(owner!);
    await upcoming.refresh();
  };
  const save = async (change: { active?: Meal; history?: HistoryLibrary; canceled?: LocalSnapshot["canceled"] }) => {
    if (enabled && account.ownerId) {
      if (!cloud.store.current) throw Error("Account cooks are loading.");
      const selected=selectedStore();
      if(selected){
        if(change.active)await selected.save(change.active);
        if(change.history)await cloud.store.current.save({history:change.history});
      }else await cloud.store.current.save(change);
    } else if (mode === "disabled" || legacyAllowed) local.save(change);
    else if (mode === "guest") {
      const retained=trialRef.current.canceled??emptyCanceled();
      if(change.active&&retained.cooks.some(c=>c.meal.id===change.active!.id)||change.history?.cooks.some(c=>retained.cooks.some(r=>r.meal.id===c.id)))throw Error('A canceled cook cannot be restored as active or completed.');
      const next = {
        ...trialRef.current,
        active: migrateMeal(change.active ?? trialRef.current.active),
        history: change.history ?? trialRef.current.history,
      };
      trialRef.current = next;
      setTrial(next);
    } else throw Error("Confirm your account before saving.");
    setTransitionError("");
  };
  const cancel = async (cookId:string) => {
    const current=currentMeal();
    if(!current||current.id!==cookId||!currentHasActuals(current))throw Error('This cook is no longer active. Reload your saved cooks.');
    if(enabled&&account.ownerId){
      if(!cloud.store.current)throw Error('Account cooks are loading.');
      await cloud.store.current.cancel(cookId);
    }else if(mode==='disabled'||legacyAllowed)local.cancel(cookId);
    else if(mode==='guest'){
      const current=trialRef.current;
      const next={...current,active:migrateMeal(newMeal()),canceled:retainCanceled(current.active,current.canceled??emptyCanceled(),new Date().toISOString())};
      trialRef.current=next;setTrial(next);
    }else throw Error('Confirm your account before canceling.');
    setTransitionError('');setSelection(v=>v+1);
  };
  const patch = (fn: (m: Meal) => Meal) => {
    try {
      if (enabled && account.ownerId){const selected=selectedStore();if(selected)selected.edit(fn);else cloud.store.current?.edit(fn);}
      else if (mode === "disabled" || legacyAllowed) local.patch(fn);
      else if (mode === "guest") {
        const next = {
          ...trialRef.current,
          active: migrateMeal(fn(trialRef.current.active)),
        };
        trialRef.current = next;
        setTrial(next);
      }
    } catch (e) {
      setTransitionError(
        e instanceof Error ? e.message : "Could not update this cook.",
      );
    }
  };
  useEffect(() => {
    if (cloud.state.phase === "saved") setTransitionError("");
  }, [cloud.state.phase]);
  const trialDirty = mode === "guest" && !legacyAllowed && meaningful(trial);
  useEffect(() => {
    if (!trialDirty) return;
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [trialDirty]);
  const importCooks = async () => {
    if (
      !candidate ||
      !earlierAvailable ||
      !cloud.state.snapshot ||
      !cloud.store.current ||
      !account.ownerId
    )
      throw Error("Account cooks have not loaded.");
    if (candidate.legacy) {
      // Reserve the old records BEFORE uploading. Other accounts/guests must never
      // see this private recovery copy after a failed upload or failed marker write.
      try {
        window.localStorage.setItem(
          LEGACY_OWNER,
          JSON.stringify({ owner: account.ownerId, imported: false }),
        );
      } catch {
        throw Error(
          "Earlier cooks could not be protected for your account. Download a backup, free some space and retry.",
        );
      }
    }
    const current = cloud.state.snapshot;
    await cloud.store.current.save({
      active: meaningful({ ...candidate.snapshot, history: emptyHistory() })
        ? candidate.snapshot.active
        : current.active,
      history: mergeHistory(current.history, candidate.snapshot.history),
    });
    if (candidate.legacy) {
      try {
        window.localStorage.setItem(
          LEGACY_OWNER,
          JSON.stringify({ owner: account.ownerId, imported: true }),
        );
      } catch {
        /* Reserved owner remains safe; re-import is explicit and deduplicated. */
      }
    }
    setImported(true);
    setSelection(v => v + 1);
    guestRef.current = null;
    setLegacyCandidate(null);
    setTransitionError("");
  };
  const retry = async () => {
    setTransitionError("");
    if (enabled && account.ownerId) {
      const wasBlocked = cloud.state.phase === "blocked";
      // Confirm the critical workspace receipt first. A successful promotion
      // removes its source plan, so reading that plan first would create a false
      // conflict and strand an otherwise acknowledged cook.
      if(wasBlocked){
        if(cloud.store.current)await cloud.store.current.retry();else cloud.restart();
        if(selectedStore()&&!selectedStore()!.dirty()){upcoming.releaseSelection();selectLegacy(null);await upcoming.refresh().catch(()=>{});}
        if(!selectedStore())setSelection(v=>v+1);
      }else{
        if(selectedStore())await upcoming.retry();
        if(cloud.store.current)await cloud.store.current.retry();else cloud.restart();
      }
    } else local.retry();
  };
  const promotionAutomatic=useRef<{id:string;resume:(restart?:boolean)=>void}|null>(null);
  const completedPromotion=useRef<string|null>(null);
  useEffect(()=>{
    if(!enabled||!account.ownerId||account.phase!=='authenticated'||cloud.state.pendingOperation!=='promote'||!cloud.state.pendingOperationId)return;
    const owner=account.ownerId,source=cloud.store.current,operationId=cloud.state.pendingOperationId;
    if(!source||source.owner!==owner)return;
    let disposed=false,attempts=0,timer:ReturnType<typeof setTimeout>|undefined,running=false;
    const owned=()=>mounted.current&&ownerScope.current===owner&&cloud.store.current===source;
    const pending=()=>!disposed&&owned()&&source.state().phase==='blocked'&&source.state().pendingOperation==='promote'&&source.state().pendingOperationId===operationId;
    const finish=async()=>{
      const after=source.state();
      if(attempts===0||!owned()||after.phase!=='saved'||after.pendingOperation==='promote'||completedPromotion.current===operationId)return;
      completedPromotion.current=operationId;
      const selected=selectedStore();
      if(selected&&!selected.dirty()&&selected.state().plan?.id===after.snapshot?.active.id){
        await upcoming.forgetSelected().catch(()=>{});
        if(!owned())return;
        upcoming.releaseSelection();selectLegacy(null);
      }
      await upcoming.refresh().catch(()=>{});
      if(owned()&&!selectedStore())setSelection(value=>value+1);
    };
    const schedule=(restart=false)=>{
      if(restart){attempts=0;if(timer)clearTimeout(timer);timer=undefined;}
      if(!pending()||running||timer||attempts>=4)return;
      timer=setTimeout(()=>{timer=undefined;void attempt();},[1000,2000,4000,8000][attempts]);
    };
    const attempt=async()=>{
      if(!pending()||running)return;
      running=true;attempts++;
      try{await source.retry();}catch{/* The same immutable receipt remains pending until acknowledged. */}
      finally{running=false;await finish();schedule();}
    };
    const resume=()=>{if(document.visibilityState!=='hidden')schedule(true);};
    const controller={id:operationId,resume:schedule};promotionAutomatic.current=controller;
    schedule();
    window.addEventListener('online',resume);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
    return()=>{
      disposed=true;if(timer)clearTimeout(timer);
      if(promotionAutomatic.current===controller)promotionAutomatic.current=null;
      window.removeEventListener('online',resume);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);
      // Acknowledgement clears pendingOperation during publish, before retry()'s
      // continuation. Finalize by owner/receipt rather than the disposed effect.
      void finish();
    };
    // The controller survives saving/blocked transitions; each immutable receipt has one bounded budget.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[enabled,account.ownerId,account.phase,cloud.state.pendingOperation,cloud.state.pendingOperationId]);
  useEffect(()=>{
    const controller=promotionAutomatic.current;
    if(cloud.state.phase==='blocked'&&cloud.state.pendingOperation==='promote'&&controller&&controller.id===cloud.state.pendingOperationId)controller.resume();
  },[cloud.state.phase,cloud.state.pendingOperation,cloud.state.pendingOperationId]);
  const reloadSelectedPlan=async()=>{
    const selected=selectedStore();
    if(!selected)throw Error('Select the future plan before loading its saved version.');
    await selected.reload();
    if(!mounted.current||selected.owner!==ownerScope.current)throw Error('Your account changed. Reopen the plan.');
    await upcoming.refresh();setTransitionError('');
  };
  const reloadAccount = async () => {
    if (cloud.store.current) await cloud.store.current.reload();
    else cloud.restart();
    setTransitionError("");
    setSelection((v) => v + 1);
  };
  const reset = () => {
    if (enabled && account.ownerId)
      throw Error("Use a backup or reload your account cooks.");
    local.reset();
  };
  const restore = async (snapshot: LocalSnapshot) => {
    if (mode === "disabled" || (legacyAllowed && !account.ownerId))
      local.restore(snapshot);
    else await save(snapshot);
  };
  return {
    meal: selectedDocument?upcoming.state.meal:currentCook,
    currentCook,
    currentCookInProgress:currentHasActuals(currentCook),
    plansEnabled,
    upcomingPlans,
    selectedPlanId,
    isSelectedPlan,
    hasSelectedPlan:()=>upcoming.hasSelection()||(legacyRef.current?.owner===account.ownerId&&!!legacyRef.current),
    selectedPlanPhase:selectedDocument?selectedPhase:null,
    selectedSavePhase:selectedDocument?selectedPhase:null,
    savePhase,
    planError:upcoming.state.error||upcoming.listError,
    planListPhase:upcoming.listPhase,
    plansError:upcoming.listError,
    plansLoading:upcoming.listPhase==='loading',
    reloadPlans:upcoming.refresh,
    reloadSelectedPlan,
    createPlan,openPlan,returnToCurrent,startSelectedPlan,
    refreshUpcomingPlans:upcoming.refresh,
    exportUpcomingPlans,importUpcomingPlans,
    history: data?.history ?? emptyHistory(),
    status,
    error:selectedDocument?(upcoming.state.error||error):error,
    setError: setTransitionError,
    patch,
    save,
    cancel,
    canCancel: enabled&&account.ownerId?!!cloud.state.canCancel:true,
    retry,
    reset,
    restore,
    recoveryExport:
      enabled && account.ownerId
        ? () => selectedStore()?.recoveryExport()??cloud.store.current?.recoveryExport()??"{}"
        : local.recoveryExport,
    backup,
    authUnavailable: account.phase === "unavailable",
    kind:
      enabled && account.ownerId
        ? "account"
        : mode === "disabled" || legacyAllowed
          ? "legacy"
          : "trial",
    locked,
    cloudPhase: cloud.state.phase,
    pendingOperation:cloud.state.pendingOperation??null,
    earlierAvailable,
    candidate,
    accountSnapshot: cloud.state.snapshot,
    accountHasCook:
      !!cloud.state.snapshot &&
      meaningful({ ...cloud.state.snapshot, history: emptyHistory() }),
    importCooks,
    reloadAccount,
    selection,
  };
}
