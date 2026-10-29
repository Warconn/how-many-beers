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
import { meaningful, mergeHistory } from "./workspace";
const LEGACY_OWNER = "how-many-beers:legacy-owner:v1";
type Candidate = { snapshot: LocalSnapshot; legacy: boolean };
export function useCookWorkspace() {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_CLOUD_COOKS === "true";
  const account = useAccount(),
    cloud = useAccountCook(enabled);
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
            if (meaningful(snapshot)) {
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
      ? { active: migrateMeal(local.meal), history: local.history }
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
        ? { active: migrateMeal(local.meal), history: local.history }
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
  const status =
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
  const locked =
    enabled &&
    (mode === "checking" ||
      (!!account.ownerId &&
        ["loading", "load-error", "saving", "blocked", "conflict"].includes(cloud.state.phase)));
  const save = async (change: { active?: Meal; history?: HistoryLibrary }) => {
    if (enabled && account.ownerId) {
      if (!cloud.store.current) throw Error("Account cooks are loading.");
      await cloud.store.current.save(change);
    } else if (mode === "disabled" || legacyAllowed) local.save(change);
    else if (mode === "guest") {
      const next = {
        active: migrateMeal(change.active ?? trialRef.current.active),
        history: change.history ?? trialRef.current.history,
      };
      trialRef.current = next;
      setTrial(next);
    } else throw Error("Confirm your account before saving.");
    setTransitionError("");
  };
  const patch = (fn: (m: Meal) => Meal) => {
    try {
      if (enabled && account.ownerId) cloud.store.current?.edit(fn);
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
      if (cloud.store.current) await cloud.store.current.retry();
      else cloud.restart();
      if (wasBlocked) setSelection((v) => v + 1);
    } else local.retry();
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
    meal: data?.active ?? null,
    history: data?.history ?? emptyHistory(),
    status,
    error,
    setError: setTransitionError,
    patch,
    save,
    retry,
    reset,
    restore,
    recoveryExport:
      enabled && account.ownerId
        ? () => cloud.store.current?.recoveryExport() ?? "{}"
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
