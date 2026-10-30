"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAccount } from "@/auth/AccountProvider";
import { accountConfig, callbackUrl } from "@/auth/config";
export default function AccountPanel({cookTools, onDraftChange}: {cookTools?: ReactNode; onDraftChange?: (dirty: boolean) => void}) {
  const { phase, user, client, refresh, signOutVersion } = useAccount();
  const [email, setEmail] = useState(""),
    [sentTo, setSentTo] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [forceSignOut, setForceSignOut] = useState(false);
  useEffect(() => {
    onDraftChange?.(!!email || !!sentTo || !!code || busy);
  }, [email, sentTo, code, busy, onDraftChange]);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setEmail("");
    setSentTo("");
    setCode("");
    setMessage("");
    setForceSignOut(false);
  }, [user?.id, signOutVersion]);
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
  return (
    <section className="account-panel">
      <h1>Your account</h1>
      {process.env.NEXT_PUBLIC_ENABLE_CLOUD_COOKS !== "true" && (
        <p className="notice">
          Account cook saving isn’t available on this preview yet.
        </p>
      )}
      {phase === "loading" || phase === "checking" ? (
        <p role="status">Checking your session…</p>
      ) : phase === "disabled" ? (
        <p>Sign-in is not available on this site yet.</p>
      ) : phase === "unavailable" ? (
        <div role="alert">
          <p>Reconnect to confirm your account. Your cook is still here.</p>
          <button
            className="button secondary"
            type="button"
            onClick={() => void refresh()}
          >
            Retry account connection
          </button>
        </div>
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
                if (
                  !window.dispatchEvent(
                    new Event("hmb-before-signout", { cancelable: true }),
                  )
                ) {
                  setForceSignOut(true);
                  setMessage(
                    "This cook has unsaved changes. Close account and retry saving or download a backup before signing out.",
                  );
                  return;
                }
                const result = await client!.auth.signOut({
                  scope: "local",
                });
                if (result.error) throw result.error;
              })
            }
          >
            Sign out on this device
          </button>
          {cookTools}
        </>
      ) : (
        <>
          <h2>Sign in or create a free account</h2>
          {accountConfig(window.location.origin)?.providers.map((provider) => (
            <button
              key={provider}
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  const result = await client!.auth.signInWithOAuth({
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
          ))}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void perform(async () => {
                const recipient = email.trim();
                const result = await client!.auth.signInWithOtp({
                  email: recipient,
                  options: {
                    emailRedirectTo: callbackUrl(window.location.origin),
                  },
                });
                if (result.error) throw result.error;
                setSentTo(recipient);
                setCode("");
                setMessage("Check your email for your sign-in code.");
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
              Send sign-in code
            </button>
          </form>
          {sentTo && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void perform(async () => {
                  const result = await client!.auth.verifyOtp({
                    email: sentTo,
                    token: code.trim(),
                    type: "email",
                  });
                  if (result.error) {
                    setMessage(
                      "That code is invalid or expired. Request a new sign-in code.",
                    );
                    return;
                  }
                  setCode("");
                });
              }}
            >
              <p>Enter the code sent to {sentTo}.</p>
              <label htmlFor="account-code">Email code</label>
              <input
                id="account-code"
                inputMode="numeric"
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
      {forceSignOut && user && (
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void perform(async () => {
              if (
                !window.confirm(
                  "Sign out with unsaved changes? Download a backup first. Recovery stays protected by this account.",
                )
              )
                return;
              const result = await client!.auth.signOut({ scope: "local" });
              if (result.error) throw result.error;
            })
          }
        >
          Sign out anyway
        </button>
      )}
    </section>
  );
}
