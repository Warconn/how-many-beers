"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { accountConfig } from "./config";

type Phase =
  | "loading"
  | "disabled"
  | "checking"
  | "guest"
  | "authenticated"
  | "unavailable";
type Account = {
  phase: Phase;
  user: User | null;
  client: SupabaseClient | null;
  refresh: () => Promise<void>;
  signOutVersion: number;
};
const Context = createContext<Account | null>(null);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading"),
    [user, setUser] = useState<User | null>(null),
    [client, setClient] = useState<SupabaseClient | null>(null),
    [signOutVersion, setSignOutVersion] = useState(0),
    [attempt, setAttempt] = useState(0);
  const clientRef = useRef<SupabaseClient | null>(null),
    alive = useRef(false),
    generation = useRef(0);
  const refresh = useCallback(async () => {
    const sdk = clientRef.current;
    if (!alive.current) return;
    if (!sdk) {
      setAttempt((value) => value + 1);
      return;
    }
    const request = ++generation.current;
    // Never continue presenting a cached identity while verification is pending.
    setUser(null);
    setPhase("checking");
    try {
      const { data, error } = await sdk.auth.getUser();
      if (!alive.current || request !== generation.current) return;
      if (error) {
        setPhase(
          error.name === "AuthSessionMissingError" ||
            error.status === 401 ||
            error.status === 403
            ? "guest"
            : "unavailable",
        );
      } else {
        setUser(data.user);
        setPhase(data.user ? "authenticated" : "guest");
      }
    } catch {
      if (alive.current && request === generation.current)
        setPhase("unavailable");
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    if (!accountConfig(window.location.origin)) {
      setPhase("disabled");
      return () => {
        alive.current = false;
      };
    }
    setPhase("checking");
    void import("./client")
      .then(({ accountClient }) => {
        if (cancelled || !alive.current) return;
        const sdk = accountClient();
        if (!sdk) {
          setPhase("disabled");
          return;
        }
        clientRef.current = sdk;
        setClient(sdk);
        const { data } = sdk.auth.onAuthStateChange((event) => {
          if (!alive.current) return;
          if (event === "SIGNED_OUT") {
            generation.current++;
            setUser(null);
            setPhase("guest");
            setSignOutVersion((v) => v + 1);
          } else if (event !== "INITIAL_SESSION") {
            // Avoid calling asynchronous Auth methods while the SDK holds its auth lock.
            queueMicrotask(() => {
              if (alive.current) void refresh();
            });
          }
        });
        unsubscribe = () => data.subscription.unsubscribe();
        void refresh();
      })
      .catch(() => {
        if (!cancelled && alive.current) setPhase("unavailable");
      });
    return () => {
      cancelled = true;
      alive.current = false;
      generation.current++;
      unsubscribe?.();
    };
  }, [refresh, attempt]);
  return (
    <Context.Provider value={{ phase, user, client, refresh, signOutVersion }}>
      {children}
    </Context.Provider>
  );
}
export function useAccount() {
  const account = useContext(Context);
  if (!account) throw Error("AccountProvider is missing.");
  return account;
}
