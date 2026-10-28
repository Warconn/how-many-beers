"use client";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { accountClient } from "@/auth/client";
import { accountConfig, callbackUrl } from "@/auth/config";
export default function AccountPage() {
  const [available, setAvailable] = useState<boolean | null>(null),
    [user, setUser] = useState<User | null>(null),
    [checking, setChecking] = useState(true);
  const [email, setEmail] = useState(""),
    [sentTo, setSentTo] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const generation = useRef(0),
    alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    const client = accountClient();
    setAvailable(!!client);
    if (!client) {
      setChecking(false);
      return () => {
        alive.current = false;
      };
    }
    const verify = async () => {
      const request = ++generation.current;
      setChecking(true);
      try {
        const { data, error } = await client.auth.getUser();
        if (!alive.current || request !== generation.current) return;
        setUser(error ? null : data.user);
        if (data.user && !error) {
          setSentTo("");
          setCode("");
          setMessage("");
        }
      } catch {
        if (alive.current && request === generation.current) {
          setUser(null);
          setMessage("Reconnect to confirm your account.");
        }
      } finally {
        if (alive.current && request === generation.current) setChecking(false);
      }
    };
    void verify();
    const { data } = client.auth.onAuthStateChange((event) => {
      if (!alive.current) return;
      if (event === "SIGNED_OUT") {
        generation.current++;
        setUser(null);
        setChecking(false);
        setSentTo("");
        setCode("");
        setMessage("Signed out on this device.");
      } else
        queueMicrotask(() => {
          if (alive.current) void verify();
        });
    });
    return () => {
      alive.current = false;
      generation.current++;
      data.subscription.unsubscribe();
    };
  }, []);
  const perform = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch {
      setMessage("Sign-in could not be completed. Please try again.");
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const home = (process.env.NEXT_PUBLIC_BASE_PATH ?? "") + "/";
  return (
    <main className="shell account-page">
      <a href={home}>← Back to cook</a>
      <section className="panel" aria-label="Account preview">
        <h1>Your account</h1>
        <p className="notice">
          Account preview: cook saving is still browser-local. Account-backed
          cooks and history follow in the next delivery.
        </p>
        {available === null || checking ? (
          <p role="status">Checking your session…</p>
        ) : !available ? (
          <p>Sign-in is not available on this site yet.</p>
        ) : user ? (
          <>
            <p role="status">
              Signed in as {user.email ?? "your linked account"}
            </p>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  const result = await accountClient()!.auth.signOut({
                    scope: "local",
                  });
                  if (result.error) throw result.error;
                })
              }
            >
              Sign out on this device
            </button>
          </>
        ) : (
          <>
            <h2>Sign in or create a free account</h2>
            {accountConfig(window.location.origin)?.providers.map(
              (provider) => (
                <button
                  key={provider}
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      const result =
                        await accountClient()!.auth.signInWithOAuth({
                          provider,
                          options: {
                            redirectTo: callbackUrl(window.location.origin),
                          },
                        });
                      if (result.error) throw result.error;
                    })
                  }
                >
                  Continue with {provider === "google" ? "Google" : "Apple"}
                </button>
              ),
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void perform(async () => {
                  const recipient = email.trim();
                  const result = await accountClient()!.auth.signInWithOtp({
                    email: recipient,
                    options: {
                      emailRedirectTo: callbackUrl(window.location.origin),
                    },
                  });
                  if (result.error) throw result.error;
                  setSentTo(recipient);
                  setCode("");
                  setMessage("Check your email for a sign-in link or code.");
                });
              }}
            >
              <label htmlFor="account-email">Email address</label>
              <input
                id="account-email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
              <button className="button primary" disabled={busy}>
                Send sign-in email
              </button>
            </form>
            {sentTo && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void perform(async () => {
                    const result = await accountClient()!.auth.verifyOtp({
                      email: sentTo,
                      token: code.trim(),
                      type: "email",
                    });
                    if (result.error) {
                      setMessage(
                        "That code is invalid or expired. Request a new sign-in email.",
                      );
                      return;
                    }
                    setCode("");
                  });
                }}
              >
                <p>
                  Enter the code sent to {sentTo}, or open the link in this
                  browser.
                </p>
                <label htmlFor="account-code">Email code</label>
                <input
                  id="account-code"
                  autoComplete="one-time-code"
                  required
                  maxLength={128}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={busy}
                />
                <button className="button primary" disabled={busy}>
                  Verify code
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setSentTo("");
                    setCode("");
                    setMessage("");
                  }}
                >
                  Cancel
                </button>
              </form>
            )}
          </>
        )}
        {message && <p role="status">{message}</p>}
      </section>
    </main>
  );
}
