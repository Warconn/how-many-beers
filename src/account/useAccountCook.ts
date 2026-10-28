"use client";
import { useEffect, useRef, useState } from "react";
import { recoveryStorage } from "./recoveryStorage";
import {
  AccountCookStore,
  accountCacheKey,
  type AccountState,
} from "./AccountCookStore";
import { workspaceAPI } from "./workspace";
import { useAccount } from "@/auth/AccountProvider";
const initial: AccountState = {
  snapshot: null,
  backup: null,
  phase: "loading",
  error: "",
};
export function useAccountCook(enabled = true) {
  const { ownerId, client, phase } = useAccount();
  const [state, setState] = useState(initial),
    [scope, setScope] = useState<string | null>(null),
    [attempt, setAttempt] = useState(0);
  const store = useRef<AccountCookStore | null>(null),
    allowed = useRef(false);
  allowed.current = phase === "authenticated";
  useEffect(() => {
    if (!enabled || !ownerId || !client) return;
    let cancelled = false,
      release: (() => void) | undefined;
    setState(initial);
    setScope(ownerId);
    const load = async (readonly: boolean) => {
      if (cancelled) return;
      try {
        const recovery = await recoveryStorage(accountCacheKey(ownerId));
        if (cancelled) {
          recovery.close?.();
          return;
        }
        const current = new AccountCookStore(
          ownerId,
          workspaceAPI(client, ownerId),
          recovery,
          setState,
          () => allowed.current,
          readonly,
        );
        store.current = current;
        setState(current.state());
        void current.connect();
      } catch {
        setState({
          ...initial,
          phase: "load-error",
          error:
            "Account recovery storage is unavailable. Keep this page open and retry.",
        });
      }
    };
    if (navigator.locks) {
      void navigator.locks
        .request(
          "how-many-beers:account-writer:" + ownerId,
          { ifAvailable: true },
          async (lock) => {
            if (cancelled) return;
            if (!lock) {
              await load(true);
              return;
            }
            const held = new Promise<void>((resolve) => {
              release = resolve;
            });
            await load(false);
            await held;
          },
        )
        .catch(() => load(false));
    } else load(false);
    const leaving = (event: BeforeUnloadEvent) => {
      if (store.current?.dirty()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const signingOut = (event: Event) => {
      if (store.current?.dirty()) event.preventDefault();
    };
    const online = () => {
      if (allowed.current) void store.current?.connect();
    };
    window.addEventListener("beforeunload", leaving);
    window.addEventListener("hmb-before-signout", signingOut);
    window.addEventListener("online", online);
    return () => {
      cancelled = true;
      store.current?.dispose();
      store.current = null;
      release?.();
      window.removeEventListener("beforeunload", leaving);
      window.removeEventListener("hmb-before-signout", signingOut);
      window.removeEventListener("online", online);
    };
  }, [ownerId, client, enabled, attempt]);
  useEffect(() => {
    if (phase === "authenticated" && ownerId && store.current)
      void store.current.connect();
  }, [phase, ownerId]);
  return {
    state: scope === ownerId ? state : initial,
    store,
    restart: () => setAttempt((v) => v + 1),
  };
}
